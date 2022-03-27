import * as fs from "fs"
import * as path from 'path';

 export default class TTFParser{


    protected f;
    protected tables:any;
	protected numberOfHMetrics:any;
	protected numGlyphs:any;
	protected glyphNames:any;
	protected indexToLocFormat:any;
	protected subsettedChars:any;
	protected subsettedGlyphs:any;
	public chars:any;
	public glyphs:any;
	public unitsPerEm:any;
	public xMin:any
    public yMin:any
    public xMax:any
    public yMax:any;
	public postScriptName:any;
	public embeddable:any;
	public bold:any;
	public typoAscender:any;
	public typoDescender:any;
	public capHeight:any;
	public italicAngle:any;
	public underlinePosition:any;
	public underlineThickness:any;
	public isFixedPitch:any;
    protected possition=0;

    constructor(file:string){
		
        if(!fs.existsSync(file)){
            this.Error("Font file doest exists on path: "+file)
        }
		
		this.f=fs.openSync(path.join(file),'r+');
    }

    __destruct(){

		if(this.f){
			fs.closeSync(this.f);
        }
	}

	Parse(){
		this.ParseOffsetTable();
		this.ParseHead();
		this.ParseHhea();
		this.ParseMaxp();
		this.ParseHmtx();
		this.ParseLoca();
		this.ParseGlyf();
		this.ParseCmap();
		this.ParseName();
		this.ParseOS2();
		this.ParsePost();
        
	}
	
    ParseOffsetTable(){
		const version = this.Read(4);

        if(version=='OTTO'){
			this.Error('OpenType fonts based on PostScript outlines are not supported');
		}
		if(version!=="\x00\x01\x00\x00"){
			this.Error('Unrecognized file format');
		}
		
		const numTables = this.ReadUShort();
		this.Skip(3*2); // searchRange, entrySelector, rangeShift
		this.tables = {};
		for(let i=0;i<numTables;i++){
			const tag = this.Read(4);
			const checkSum = this.Read(4,"hex");
			const offset = this.ReadULong();		
			const length = this.ReadULong();
			this.tables[`${tag}`] = {'offset':offset, 'length':length, 'checkSum':checkSum};
		}
		
	}

	ParseHead(){

		this.Seek('head');
		this.Skip(3*4); // version, fontRevision, checkSumAdjustment
		
		const magicNumber = this.ReadULong();
		if(magicNumber!==0x5F0F3CF5){
			this.Error('Incorrect magic number');
		}
		
		this.Skip(2); // flags
		this.unitsPerEm = this.ReadUShort();
		this.Skip(2*8); // created, modified
		this.xMin = this.ReadShort();
		this.yMin = this.ReadShort();
		this.xMax = this.ReadShort();
		this.yMax = this.ReadShort();
		this.Skip(3*2); // macStyle, lowestRecPPEM, fontDirectionHint
		this.indexToLocFormat = this.ReadShort();
		
	}
	
	ParseHhea(){
		this.Seek('hhea');
		this.Skip(4+15*2);//4+15*2
		this.numberOfHMetrics = this.ReadUShort();
	}

	ParseMaxp()
	{
		this.Seek('maxp');
		this.Skip(4);
		this.numGlyphs = this.ReadUShort();

	}

	ParseHmtx()
	{
		this.Seek('hmtx');
		this.glyphs = [];
		let  advanceWidth
		for(let i=0;i<this.numberOfHMetrics;i++)
		{
			advanceWidth = this.ReadUShort();
			const lsb = this.ReadShort();
			this.glyphs[i] = {'w':advanceWidth, 'lsb':lsb};
		}
		for(let i=this.numberOfHMetrics;i<this.numGlyphs;i++)
		{
			const lsb = this.ReadShort();
			this.glyphs[i] = {'w':advanceWidth, 'lsb':lsb};
		}

		console.log(`len glyphs${this.glyphs.length}`)
	}

	ParseLoca()
	{
		this.Seek('loca');
		const offsets = [];
		
		if(this.indexToLocFormat===0)
		{
			// Short format
			for(let i=0;i<=this.numGlyphs;i++){
				offsets.push(2*this.ReadUShort());
			}
				
		}
		else
		{
			// Long format
			for(let i=0;i<=this.numGlyphs;i++){
				offsets.push(this.ReadULong());
			}
		}

		for(let i=0;i<this.numGlyphs;i++)
		{
			this.glyphs[i]['offset'] = offsets[i];
			this.glyphs[i]['length'] = offsets[i+1] - offsets[i];
		}

	}

	ParseGlyf()
	{
		const tableOffset = this.tables['glyf']['offset'];
	
		this.glyphs.forEach((glyph:any) => {
			
			if(glyph['length']>0){
				
				this.FSeek(tableOffset+glyph['offset']);
				if(this.ReadShort()<0){
					// Composite glyph
					this.Skip(4*2); // xMin, yMin, xMax, yMax
					let offset = 5*2;
					let a:any =[];
					let flags=0
					do
					{
						
						flags = this.ReadUShort();
						let index = this.ReadUShort();
						let skip=0
						a[offset+2] = index;
			
						if(flags&1){ // ARG_1_AND_2_ARE_WORDS
							skip = 2*2;
						}else{
							skip = 2;
						}
						
						if(flags&8){ // WE_HAVE_A_SCALE
							skip += 2;
						}else if(flags & 64){ // WE_HAVE_AN_X_AND_Y_SCALE
							skip += 2*2;
						}else if(flags & 128){ // WE_HAVE_A_TWO_BY_TWO
							skip += 4*2;
						}

						this.Skip(skip);
						offset += 2*2 + skip;
					
					}while(flags&32); // MORE_COMPONENTS
					
					glyph['components'] = a;
					
				}

			}

		});

	}

	ParseCmap()
	{
		this.Seek('cmap');
		this.Skip(2); // version
		const numTables = this.ReadUShort();
		let offset31 = 0;
		for(let i=0;i<numTables;i++)
		{
			const platformID = this.ReadUShort();
			const encodingID = this.ReadUShort();
			const offset = this.ReadULong();

			if(platformID===3 && encodingID===1){
				offset31 = offset;
			}
		}

		if(offset31===0){
			this.Error('No Unicode encoding found');
		}

		
		let startCount = [];
		let endCount = [];
		let idDelta = [];
		let idRangeOffset = [];
		this.chars = {};
		this.FSeek(this.tables['cmap']['offset']+offset31);
		const format = this.ReadUShort();
		if(format!==4){
			this.Error(`Unexpected subtable format: ${format}`);
		}
		
		this.Skip(2*2); // length, language
		const segCount = this.ReadUShort()/2;
		this.Skip(3*2); // searchRange, entrySelector, rangeShift
		for(let i=0;i<segCount;i++){
			endCount[i] = this.ReadUShort();
		}
		this.Skip(2); // reservedPad
		for(let i=0;i<segCount;i++){
			startCount[i] = this.ReadUShort();
		}
		for(let i=0;i<segCount;i++){
			idDelta[i] = this.ReadShort();
		}
		const offset =this.possition// ftell(this.f);
		for(let i=0;i<segCount;i++){
			idRangeOffset[i] = this.ReadUShort();
		}
		
		for(let i=0;i<segCount;i++)
		{
			const c1 = startCount[i];
			const c2 = endCount[i];
			const d = idDelta[i];
			const ro = idRangeOffset[i];
			if(ro>0){
				this.FSeek(offset+2*i+ro);
			}
			for(let c=c1;c<=c2;c++){
				let gid;
				if(c==0xFFFF){
					break;
				}
				if(ro>0){
					gid = this.ReadUShort();
					if(gid>0){
						gid += d;
					}
				}else{
					gid = c+d;
				}
				if(gid>=65536){
					gid -= 65536;
				}
				if(gid>0){
					this.chars[c] = gid;
				}
			}
		}

	}

	ParseName(){

		this.Seek('name');
		const tableOffset = this.tables['name']['offset'];
		this.postScriptName = '';
		this.Skip(2); // format
		const count = this.ReadUShort();
		const stringOffset = this.ReadUShort();
		for(let i=0;i<count;i++)
		{
			this.Skip(3*2); // platformID, encodingID, languageID
			const nameID = this.ReadUShort();
			const length = this.ReadUShort();
			const offset = this.ReadUShort();
			if(nameID===6){

				// PostScript name
				this.FSeek(tableOffset+stringOffset+offset);
				let s = this.Read(length) as string; 
				s=s.replace(new RegExp(String.fromCharCode(0),'g'),'') //str_replace(chr(0), '', $s);
				s=s.replace(/|[ \[\](){}<>/%]|/g,'');//preg_replace('|[ \[\](){}<>/%]|', '', $s);
				this.postScriptName = s;
				break;

			}
		}

		if(this.postScriptName===''){
			this.Error('PostScript name not found');
		}

	}

	ParseOS2(){

		this.Seek('OS/2');
		const version = this.ReadUShort();
		this.Skip(3*2); // xAvgCharWidth, usWeightClass, usWidthClass
		const fsType = this.ReadUShort();
		this.embeddable = (fsType!==2) && (fsType & 0x200)==0;
		this.Skip(11*2+10+4*4+4);
		const fsSelection = this.ReadUShort();
		this.bold = (fsSelection & 32)!==0;
		this.Skip(2*2); // usFirstCharIndex, usLastCharIndex
		this.typoAscender = this.ReadShort();
		this.typoDescender = this.ReadShort();
		if(version>=2){
			this.Skip(3*2+2*4+2);
			this.capHeight = this.ReadShort();
		}else{
			this.capHeight = 0;
		}

	}
	 ParsePost()
	{
		
		this.Seek('post');
		const version = this.ReadULong();
		this.italicAngle = this.ReadShort();
		this.Skip(2); // Skip decimal part
		this.underlinePosition = this.ReadShort();
		this.underlineThickness = this.ReadShort();
		this.isFixedPitch = (this.ReadULong()!==0);
		if(version===0x20000)
		{
			// Extract glyph names
			this.Skip(4*4); // min/max usage
			this.Skip(2); // numberOfGlyphs
			let glyphNameIndex = [];
			let names:any = [];
			let numNames = 0;
			for(let i=0;i<this.numGlyphs;i++)
			{
				const index = this.ReadUShort();
				glyphNameIndex.push(index);
				if(index>=258 && index-257>numNames){
					numNames = index-257;
				}
			}
			for(let i=0;i<numNames;i++)
			{
				const len = ord(this.Read(1));
				names.push(this.Read(len));
			}
			
			glyphNameIndex.forEach((index,i) => {
	
				if(index>=258){
					this.glyphs[i]['name'] = names[index-258];
				}else{
					this.glyphs[i]['name'] = index;	
				}

			});
			this.glyphNames = true;
		
		}else{
			this.glyphNames = false;
		}
		
	}
	
	Subset(chars:any){

		this.subsettedGlyphs = [];
		this.AddGlyph(0);
		this.subsettedChars =[];

		chars.forEach((char:any) => {
			if(this.chars[char]){
				this.subsettedChars.push(char);	
				this.AddGlyph(this.chars[char]);
			}
		});
	}

	AddGlyph(id:any){

		if(!this.glyphs[id]['ssid']){

			this.glyphs[id]['ssid'] = this.subsettedGlyphs.length
			this.subsettedGlyphs.push(id);
			
			if(this.glyphs[id]['components']){
				this.glyphs[id]['components'].forEach((cid:any) => {
					this.AddGlyph(cid);	
				});
			}

		}
	}

	Build(){
		this.BuildCmap();
		this.BuildHhea();
		this.BuildHmtx();
		this.BuildLoca();
		this.BuildGlyf();
		this.BuildMaxp();
		this.BuildPost();
		return this.BuildFont();
		
	}

	BuildCmap(){

		if(!this.subsettedChars){
			return;
		}
		
		// Divide charset in contiguous segments
		let chars = this.subsettedChars;
		chars.sort((a:any, b:any)=> { return a - b; })
		
		let segments = [];
		let segment = [chars[0],chars[0]]
		for(let i=1;i<chars.length;i++)
		{
			if(chars[i]>segment[1]+1){
				segments.push(segment);
				segment = [chars[i],chars[i]];
			}else{
				segment[1]++;
			}
		}

		segments.push(segment);
		segments.push([0xFFFF, 0xFFFF]);
		let segCount = segments.length;

		// Build a Format 4 subtable
		let startCount = [];
		let endCount = [];
		let idDelta = [];
		let idRangeOffset = [];
		let glyphIdArray = '';
		
		for(let i=0;i<segCount;i++){
			
			let [start, end]=segments[i] //list(start, end) = $segments[$i];
			startCount.push(start);
			endCount.push(end);
			if(start!==end)
			{
				// Segment with multiple chars
				idDelta.push(0);
				idRangeOffset.push(glyphIdArray.length+ (segCount-i)*2) //= strlen($glyphIdArray) + ($segCount-$i)*2;
				for(let c=start;c<=end;c++)
				{
					
					let ssid = this.glyphs[this.chars[c]]['ssid'];
					glyphIdArray +=pack('n',ssid) //pack('n', $ssid);
	
				}

			}else{
				
				// Segment with a single char
				let ssid
				if(start<0xFFFF){
					ssid = this.glyphs[this.chars[start]]['ssid'];
				}else{
					ssid = 0;
				}
				idDelta.push(ssid - start);
				idRangeOffset.push(0);
				
			}
			
		}
		
		let entrySelector = 0;
		let n = segCount;
		while(n!==1)
		{
			n = n>>1;
			entrySelector++;
		}

		let searchRange = (1<<entrySelector)*2;
		let  rangeShift = 2*segCount - searchRange;
		let cmap = pack('nnnn', 2*segCount, searchRange, entrySelector, rangeShift);
		endCount.forEach((val:any)=>{ cmap += pack('n', val); })
		cmap += pack('n', 0); // reservedPad
		startCount.forEach((val:any)=>{ 
			cmap += pack('n', val); 
		})
		idDelta.forEach((val:any)=>{ 
			cmap += pack('n', val);
		})
		idRangeOffset.forEach((val:any)=>{ 
			cmap += pack('n', val); 
		})
		cmap += glyphIdArray;

		let data = pack('nn', 0, 1); // version, numTables
		data += pack('nnN', 3, 1, 12); // platformID, encodingID, offset
		data += pack('nnn', 4, 6+cmap.length,0)//strlen(cmap), 0); // format, length, language
		data += cmap;
		this.SetTable('cmap', data);
		
	}
	
	BuildHhea(){
		this.LoadTable('hhea');
		let numberOfHMetrics = count(this.subsettedGlyphs);
		let data = substr_replace(this.tables['hhea']['data'], pack('n',numberOfHMetrics), 4+15*2, 2);
		this.SetTable('hhea', data);
	}

	BuildHmtx(){
		let data = '';
		this.subsettedGlyphs.forEach((id:any) => {
			let glyph = this.glyphs[id];
			data += pack('nn', glyph['w'], glyph['lsb']);	
		});
		this.SetTable('hmtx', data);
	}

	BuildLoca(){
		let data = '';
		let offset = 0;

		this.subsettedGlyphs.forEach((id:any) => {
			if(this.indexToLocFormat===0){
				data += pack('n', offset/2);
			}else{
				data += pack('N', offset);
			}
			offset += this.glyphs[id]['length'];
		});

		if(this.indexToLocFormat===0){
			data += pack('n', offset/2);
		}else{
			data += pack('N', offset);
		}
		this.SetTable('loca', data);
	}

	BuildGlyf(){

		let tableOffset = this.tables['glyf']['offset'];
		let data = '';
		
		this.subsettedGlyphs.forEach((id:any) => {
			
			let glyph = this.glyphs[id];
			this.FSeek(tableOffset+glyph['offset'])
			let glyph_data = this.Read(glyph['length']) as string;
			if(glyph['components']){
				
				
				// Composite glyph
				glyph['components'].forEach((cid:any,offset:number) => {
					let ssid = this.glyphs[cid]['ssid'];
					glyph_data = substr_replace(glyph_data, pack('n',ssid), offset, 2);	
				});

			}

			data += glyph_data;

		});
		this.SetTable('glyf', data);
	}

	BuildMaxp(){
		this.LoadTable('maxp');
		let numGlyphs = count(this.subsettedGlyphs);
		let data = substr_replace(this.tables['maxp']['data'], pack('n',numGlyphs), 4, 2);
		this.SetTable('maxp', data);
	}

	BuildPost(){

		this.Seek('post');
		let data:any

		if(this.glyphNames){

			// Version 2.0
			let numberOfGlyphs = count(this.subsettedGlyphs);
			let numNames = 0;
			let names = '';
			data = this.Read(2*4+2*2+5*4);
			data += pack('n', numberOfGlyphs);
			
			this.subsettedGlyphs.forEach((id:any) => {
				const name = this.glyphs[id]['name'];
				if(typeof name ==="string"){
					data += pack('n', 258+numNames);
					names +=  String.fromCharCode(name.length)+name;
					numNames++;
				}else{
					data += pack('n', name);	
				}

			});

			data += names;
		
		}else{

			// Version 3.0
			this.Skip(4);
			data = "\x00\x03\x00\x00";
			data += this.Read(4+2*2+5*4);
		}

		this.SetTable('post', data);
	}

	BuildFont(){	
		
		
		let tags:any = [];

		['cmap', 'cvt ', 'fpgm', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post', 'prep'].forEach((tag)=>{

			if(this.tables[tag]){
				tags.push(tag)	
			}

		})	

		let numTables = count(tags);
		let offset = 12 + 16*numTables;
		tags.forEach((tag:any)=>{

			if(!this.tables[tag]['data']){
				this.LoadTable(tag);
			}
			this.tables[tag]['offset'] = offset;
			offset += this.tables[tag]['data'].length;
		})	


		// Build offset table
		let entrySelector = 0;
		let n = numTables;
		while(n!==1)
		{
			n = n>>1;
			entrySelector++;
		}
		
		let searchRange = 16*(1<<entrySelector);
		let rangeShift = 16*numTables - searchRange;
		let offsetTable = pack('nnnnnn', 1, 0, numTables, searchRange, entrySelector, rangeShift);
		tags.forEach((tag:any)=>{
			let table = this.tables[tag];
			offsetTable += tag+table['checkSum']+pack('NN', table['offset'], table['length']);
		})
		
		// Compute checkSumAdjustment (0xB1B0AFBA - font checkSum)
		let s = this.CheckSum(offsetTable);
		tags.forEach((tag:any)=>{
			s += this.tables[tag]['checkSum'];
		})

		let a:any = unpack('n2', this.CheckSum(s));
		let high = 0xB1B0 + (a[1]^0xFFFF);
		let low = 0xAFBA + (a[2]^0xFFFF) + 1;
		let checkSumAdjustment = pack('nn', high+(low>>16), low);

		this.tables['head']['data'] = substr_replace(this.tables['head']['data'], checkSumAdjustment, 8, 4);
		
		//const mbufftmp=Buffer.from(offsetTable)
		let font =offsetTable//mbufftmp.toString('binary')//offsetTable;
		tags.forEach((tag:string)=>{

			//const mbuff=Buffer.from(this.tables[tag]['data'],'binary')
			font +=this.tables[tag]['data'];//mbuff.toString('binary') //this.tables[tag]['data'];
		
		})

		return font//Buffer.from(font).toString('binary');
		
	}

    Read(n:number,encode:any="binary",lconvert:boolean=true){
        
		let buffer= Buffer.alloc ? Buffer.alloc(n) : new Buffer(n);
		let read = fs.readSync(this.f,buffer,0,n,this.possition)
		this.possition+=read
		
		if(lconvert){
			return buffer.toString(encode);
		}else{
			return buffer
		}
		
    }
    
	ReadShort(){

        const buffer = Buffer.alloc ? Buffer.alloc(2) : new Buffer(2);
        const read = fs.readSync(this.f, buffer, 0, 2,this.possition);
        let a= buffer.readInt16BE()
        this.possition+=read

		if(a>=0x8000){
            a -= 65536;
        }

		return a
    }

	ReadUShort(){

        const buffer = Buffer.alloc ? Buffer.alloc(2) : new Buffer(2);
        const read = fs.readSync(this.f, buffer, 0, 2,this.possition);
		this.possition+=read
        return buffer.readUInt16BE()

    }

	ReadULong(){

        const buffer = Buffer.alloc ? Buffer.alloc(4) : new Buffer(4);
        const read = fs.readSync(this.f, buffer, 0, 4,this.possition);
		this.possition+=read
        return buffer.readUInt32BE()

    }
	
	CheckSum(s:string)
	{
		let n = s.length//strlen($s);
		let high = 0;
		let low = 0;
		for(let i=0;i<n;i+=4)
		{
			high += (ord(s[i])<<8) + ord(s[i+1]);
			low += (ord(s[i+2])<<8) + ord(s[i+3]);
		}

		return pack('nn', high+(low>>16), low);
	}

	Skip(n:number){ 
		this.possition+=n
	}
	
	LoadTable(tag:string){
		this.Seek(tag);
		let length = this.tables[tag]['length'];
		let n = length % 4;
		if(n>0){
			length += 4 - n;
		}
		this.tables[tag]['data'] = this.Read(length,'binary',false);
	}
	
	SetTable(tag:string, data:any){

		let length = data.length //strlen($data);
		let n = length % 4;
		if(n>0){
			data = strPad(data, length+4-n, "\x00");
		}
		this.tables[tag]['data'] = Buffer.from(data).toString('binary');
		this.tables[tag]['length'] = length;
		this.tables[tag]['checkSum'] = this.CheckSum(data);
	}

	Seek(tag:string){
		this.possition=this.tables[tag]['offset']
	}
	
	FSeek(offset:number){
		this.possition=offset
	}

    Error(msg:string){
		throw msg;
	}
}

function strPad(input:any, length:any, string:any) {
    string = string || '0'; input = input + '';
    return input.length >= length ? input : new Array(length - input.length + 1).join(string) + input;
}

const ord = (string:any) => {
    //  discuss at: https://locutus.io/php/ord/
    // original by: Kevin van Zonneveld (https://kvz.io)
    // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
    // improved by: Brett Zamir (https://brett-zamir.me)
    //    input by: incidence
    //   example 1: ord('K')
    //   returns 1: 75
    //   example 2: ord('\uD800\uDC00'); // surrogate pair to create a single Unicode character
    //   returns 2: 65536

    var str = string + ''
    var code = str.charCodeAt(0)

    if (code >= 0xD800 && code <= 0xDBFF) {
        // High surrogate (could change last hex to 0xDB7F to treat
        // high private surrogates as single characters)
        var hi = code
        if (str.length === 1) {
            // This is just a high surrogate with no following low surrogate,
            // so we return its value;
            return code
            // we could also throw an error as it is not a complete character,
            // but someone may want to know
        }
        var low = str.charCodeAt(1)
        return ((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000
    }
    if (code >= 0xDC00 && code <= 0xDFFF) {
        // Low surrogate
        // This is just a low surrogate with no preceding high surrogate,
        // so we return its value;
        return code
        // we could also throw an error as it is not a complete character,
        // but someone may want to know
    }

    return code
}

function pack(format:string,...args: any[]) {
	//  discuss at: https://locutus.io/php/pack/
	// original by: Tim de Koning (https://www.kingsquare.nl)
	//    parts by: Jonas Raoni Soares Silva (https://www.jsfromhell.com)
	// bugfixed by: Tim de Koning (https://www.kingsquare.nl)
	//      note 1: Float encoding by: Jonas Raoni Soares Silva
	//      note 1: Home: https://www.kingsquare.nl/blog/12-12-2009/13507444
	//      note 1: Feedback: phpjs-pack@kingsquare.nl
	//      note 1: "machine dependent byte order and size" aren't
	//      note 1: applicable for JavaScript; pack works as on a 32bit,
	//      note 1: little endian machine.
	//   example 1: pack('nvc*', 0x1234, 0x5678, 65, 66)
	//   returns 1: '\u00124xVAB'
	//   example 2: pack('H4', '2345')
	//   returns 2: '#E'
	//   example 3: pack('H*', 'D5')
	//   returns 3: 'Õ'
	//   example 4: pack('d', -100.876)
	//   returns 4: "\u0000\u0000\u0000\u0000\u00008YÀ"
	//        test: skip-1
	let formatPointer = 0
	let argumentPointer = 1
	let result = ''
	let argument = ''
	let i = 0
	let r = []
	let instruction, quantifier, word, precisionBits, exponentBits, extraNullCount
	// vars used by float encoding
	let bias
	let minExp
	let maxExp
	let minUnnormExp
	let status
	let exp
	let len
	let bin
	let signal
	let n
	let intPart
	let floatPart:number
	let lastBit
	let rounded
	let j
	let k
	let tmpResult
	while (formatPointer < format.length) {
	  instruction = format.charAt(formatPointer)
	  quantifier = ''
	  formatPointer++
	  while ((formatPointer < format.length) && (format.charAt(formatPointer)
		.match(/[\d*]/) !== null)) {
		quantifier += format.charAt(formatPointer)
		formatPointer++
	  }
	  if (quantifier === '') {
		quantifier = '1'
	  }
	  // Now pack variables: 'quantifier' times 'instruction'
	  switch (instruction) {
		case 'a':
		case 'A':
		  // NUL-padded string
		  // SPACE-padded string
		  if (typeof arguments[argumentPointer] === 'undefined') {
			throw new Error('Warning:  pack() Type ' + instruction + ': not enough arguments')
		  } else {
			argument = String(arguments[argumentPointer])
		  }
		  if (quantifier === '*') {
			quantifier = argument.length
		  }
		  for (i = 0; i < quantifier; i++) {
			if (typeof argument[i] === 'undefined') {
			  if (instruction === 'a') {
				result += String.fromCharCode(0)
			  } else {
				result += ' '
			  }
			} else {
			  result += argument[i]
			}
		  }
		  argumentPointer++
		  break
		case 'h':
		case 'H':
		  // Hex string, low nibble first
		  // Hex string, high nibble first
		  if (typeof arguments[argumentPointer] === 'undefined') {
			throw new Error('Warning: pack() Type ' + instruction + ': not enough arguments')
		  } else {
			argument = arguments[argumentPointer]
		  }
		  if (quantifier === '*') {
			quantifier = argument.length
		  }
		  if (quantifier > argument.length) {
			const msg = 'Warning: pack() Type ' + instruction + ': not enough characters in string'
			throw new Error(msg)
		  }
		  for (i = 0; i < quantifier; i += 2) {
			// Always get per 2 bytes...
			word = argument[i]
			if (((i + 1) >= quantifier) || typeof argument[i + 1] === 'undefined') {
			  word += '0'
			} else {
			  word += argument[i + 1]
			}
			// The fastest way to reverse?
			if (instruction === 'h') {
			  word = word[1] + word[0]
			}
			result += String.fromCharCode(parseInt(word, 16))
		  }
		  argumentPointer++
		  break
		case 'c':
		case 'C':
		  // signed char
		  // unsigned char
		  // c and C is the same in pack
		  if (quantifier === '*') {
			quantifier = arguments.length - argumentPointer
		  }
		  if (quantifier > (arguments.length - argumentPointer)) {
			throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments')
		  }
		  for (i = 0; i < quantifier; i++) {
			result += String.fromCharCode(arguments[argumentPointer])
			argumentPointer++
		  }
		  break
		case 's':
		case 'S':
		case 'v':
		  // signed short (always 16 bit, machine byte order)
		  // unsigned short (always 16 bit, machine byte order)
		  // s and S is the same in pack
		  if (quantifier === '*') {
			quantifier = arguments.length - argumentPointer
		  }
		  if (quantifier > (arguments.length - argumentPointer)) {
			throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments')
		  }
		  for (i = 0; i < quantifier; i++) {
			result += String.fromCharCode(arguments[argumentPointer] & 0xFF)
			result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF)
			argumentPointer++
		  }
		  break
		case 'N':
			// unsigned long (always 32 bit, big endian byte order)
			if (quantifier === '*') {
			  quantifier = arguments.length - argumentPointer
			}
			if (quantifier > (arguments.length - argumentPointer)) {
			  throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments')
			}
			for (i = 0; i < quantifier; i++) {
			  result += String.fromCharCode(arguments[argumentPointer] >> 24 & 0xFF)
			  result += String.fromCharCode(arguments[argumentPointer] >> 16 & 0xFF)
			  result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF)
			  result += String.fromCharCode(arguments[argumentPointer] & 0xFF)
			  argumentPointer++
			}
			break
		case 'n':
		  // unsigned short (always 16 bit, big endian byte order)
		  if (quantifier === '*') {
			quantifier = arguments.length - argumentPointer
		  }
		  if (quantifier > (arguments.length - argumentPointer)) {
			throw new Error('Warning: pack() Type ' + instruction + ': too few arguments')
		  }
		  for (i = 0; i < quantifier; i++) {
			result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF)
			result += String.fromCharCode(arguments[argumentPointer] & 0xFF)
			argumentPointer++
		  }
		  break
		case 'i':
		case 'I':
		case 'l':
		case 'L':
		case 'V':
		  // signed integer (machine dependent size and byte order)
		  // unsigned integer (machine dependent size and byte order)
		  // signed long (always 32 bit, machine byte order)
		  // unsigned long (always 32 bit, machine byte order)
		  // unsigned long (always 32 bit, little endian byte order)
		  if (quantifier === '*') {
			quantifier = arguments.length - argumentPointer
		  }
		  if (quantifier > (arguments.length - argumentPointer)) {
			throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments')
		  }
		  for (i = 0; i < quantifier; i++) {
			result += String.fromCharCode(arguments[argumentPointer] & 0xFF)
			result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF)
			result += String.fromCharCode(arguments[argumentPointer] >> 16 & 0xFF)
			result += String.fromCharCode(arguments[argumentPointer] >> 24 & 0xFF)
			argumentPointer++
		  }
		  break
		default:
		  throw new Error('Warning: pack() Type ' + instruction + ': unknown format code')
	  }
	}
	if (argumentPointer < arguments.length) {
	  const msg2 = 'Warning: pack(): ' + (arguments.length - argumentPointer) + ' arguments unused'
	  throw new Error(msg2)
	}
	return result
  }

const count = (obj:any) => {

    if (Array.isArray(obj)) {
        return obj.length
    } else if (typeof obj === 'object') {
        return Object.keys(obj).length
    } else {
        return 0
    }

}

function substr_replace (str:string, replace:string, start:number, length:number) { // eslint-disable-line camelcase
	//  discuss at: https://locutus.io/php/substr_replace/
	// original by: Brett Zamir (https://brett-zamir.me)
	//   example 1: substr_replace('ABCDEFGH:/MNRPQR/', 'bob', 0)
	//   returns 1: 'bob'
	//   example 2: var $var = 'ABCDEFGH:/MNRPQR/'
	//   example 2: substr_replace($var, 'bob', 0, $var.length)
	//   returns 2: 'bob'
	//   example 3: substr_replace('ABCDEFGH:/MNRPQR/', 'bob', 0, 0)
	//   returns 3: 'bobABCDEFGH:/MNRPQR/'
	//   example 4: substr_replace('ABCDEFGH:/MNRPQR/', 'bob', 10, -1)
	//   returns 4: 'ABCDEFGH:/bob/'
	//   example 5: substr_replace('ABCDEFGH:/MNRPQR/', 'bob', -7, -1)
	//   returns 5: 'ABCDEFGH:/bob/'
	//   example 6: substr_replace('ABCDEFGH:/MNRPQR/', '', 10, -1)
	//   returns 6: 'ABCDEFGH://'
	if (start < 0) {
	  // start position in str
	  start = start + str.length
	}
	length = length !== undefined ? length : str.length
	if (length < 0) {
	  length = length + str.length - start
	}
	return [
	  str.slice(0, start),
	  replace.substr(0, length),
	  replace.slice(length),
	  str.slice(start + length)
	].join('')
  }

  function unpack(format:string, data:any) {
	// http://kevin.vanzonneveld.net
	// +   original by: Tim de Koning (http://www.kingsquare.nl)
	// +      parts by: Jonas Raoni Soares Silva - http://www.jsfromhell.com
	// +      parts by: Joshua Bell - http://cautionsingularityahead.blogspot.nl/
	// +
	// +   bugfixed by: marcuswestin
	// %        note 1: Float decoding by: Jonas Raoni Soares Silva
	// %        note 2: Home: http://www.kingsquare.nl/blog/22-12-2009/13650536
	// %        note 3: Feedback: phpjs-unpack@kingsquare.nl
	// %        note 4: 'machine dependant byte order and size' aren't
	// %        note 5: applicable for JavaScript unpack works as on a 32bit,
	// %        note 6: little endian machine
	// *     example 1: unpack('d', "\u0000\u0000\u0000\u0000\u00008YÀ");
	// *     returns 1: { "": -100.875 }
  
	var formatPointer = 0, dataPointer = 0, result:any = {}, instruction = '',
		quantifier = '', label = '', currentData = '', i = 0, j = 0,
		word = '', fbits = 0, ebits = 0, dataByteLength = 0;
  
	// Used by float decoding - by Joshua Bell
	  //http://cautionsingularityahead.blogspot.nl/2010/04/javascript-and-ieee754-redux.html
	var fromIEEE754 = function(bytes:string, ebits:any, fbits:any) {
	  // Bytes to bits
	  var bits = [];
	  for (var i = bytes.length; i; i -= 1) {
		var byte =  parseInt(bytes[i - 1]);
		for (var j = 8; j; j -= 1) {
		  bits.push(byte % 2 ? 1 : 0); byte = byte >> 1;
		}
	  }
	  bits.reverse();
	  var str = bits.join('');
  
	  // Unpack sign, exponent, fraction
	  var bias = (1 << (ebits - 1)) - 1;
	  var s = parseInt(str.substring(0, 1), 2) ? -1 : 1;
	  var e = parseInt(str.substring(1, 1 + ebits), 2);
	  var f = parseInt(str.substring(1 + ebits), 2);
  
	  // Produce number
	  if (e === (1 << ebits) - 1) {
		return f !== 0 ? NaN : s * Infinity;
	  }
	  else if (e > 0) {
		return s * Math.pow(2, e - bias) * (1 + f / Math.pow(2, fbits));
	  }
	  else if (f !== 0) {
		return s * Math.pow(2, -(bias-1)) * (f / Math.pow(2, fbits));
	  }
	  else {
		return s * 0;
	  }
	}
	
	while (formatPointer < format.length) {
	  instruction = format.charAt(formatPointer);
  
	  // Start reading 'quantifier'
	  let quantifier:any = '';
	  formatPointer++;
	  while ((formatPointer < format.length) &&
		  (format.charAt(formatPointer).match(/[\d\*]/) !== null)) {
		quantifier += format.charAt(formatPointer);
		formatPointer++;
	  }
	  if (quantifier === '') {
		quantifier = '1';
	  }
  
  
	  // Start reading label
	  let label:string = '';
	  while ((formatPointer < format.length) &&
		  (format.charAt(formatPointer) !== '/')) {
		label += format.charAt(formatPointer);
		formatPointer++;
	  }
	  if (format.charAt(formatPointer) === '/') {
		formatPointer++;
	  }
  
	  // Process given instruction
	  switch (instruction) {

		case 'n': // unsigned short (always 16 bit, big endian byte order)
		  if (quantifier === '*') {
			quantifier = (data.length - dataPointer) / 2;
		  } else {
			quantifier = parseInt(quantifier, 10);
		  }
  
		  currentData = data.substr(dataPointer, quantifier * 2);
		  dataPointer += quantifier * 2;
  
		  for (i = 0; i < currentData.length; i += 2) {
			// sum per word;
			let currentResult = ((currentData.charCodeAt(i) & 0xFF) << 8) +(currentData.charCodeAt(i + 1) & 0xFF);
			console.log()
			const key:string=label+(quantifier>1)?`${((i / 2) + 1)}`:''
			result[key] = currentResult;
		  
		  }
		  break;

		default:
		  throw new Error('Warning:  unpack() Type ' + instruction +
			  ': unknown format code');
	  }
	}
	return result;
  }