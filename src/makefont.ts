import * as fs from "fs"
import zlib from 'zlib';
import * as path from 'path';
import TTFParser from "./ttfparser"
import { Readable } from 'stream';
const lineByLine= require("n-readlines")

export default function MakeFont(fontfile:string, enc:string='cp1252', embed:boolean=true, subset:boolean=true)
{
	
    // Generate a font definition file
	if(!fs.existsSync(fontfile)){
		Error('Font file not found: '+fontfile);
    }

    const ext =fontfile.substring(fontfile.length-3,fontfile.length).toLowerCase()
    let type:any
    if(ext==='ttf' || ext==='otf'){
		type = 'TrueType';
    }else if(ext==='pfb'){
		type = 'Type1';
    }else{
		Error('Unrecognized font file extension: '+ext);
    }

	const map = LoadMap(enc);
    let info;
	if(type==='TrueType'){
		info = GetInfoFromTrueType(fontfile, embed, subset, map);
    }else{
		info = GetInfoFromType1(fontfile, embed, map);
    }
    
    
	let _basename = basename(fontfile);
	_basename = _basename.substr(0, _basename.lastIndexOf('.')) || _basename;

	if(embed)
	{
		/*if(function_exists('zlib'))
		{
			let file = _basename+'.z';
			SaveToFile(file, gzcompress(info['Data']), 'b');
			info['File'] = file;
			console.log('Font file compressed: '+file);
		}
		else
		{*/
			info['File'] = basename(fontfile);
			subset = false;
			console.log('Font file could not be compressed (zlib extension not available)');
		//}
	}
	
	MakeDefinitionFile(_basename+'.js', type, enc, embed, subset, map, info);
	console.log('Font definition file generated: '+_basename+'.js');
    
}
function MakeDefinitionFile(file:string, type:string, enc:string, embed:boolean, subset:boolean, map:any, info:any){	
	
	let s = "const Font = {\n";	
	s += 'type: \''+type+"',\n";
	s += 'name:\''+info['FontName']+"',\n";
	s += 'desc: '+MakeFontDescriptor(info)+",\n";
	s += 'up:'+info['UnderlinePosition']+",\n";
	s += 'ut:'+info['UnderlineThickness']+",\n";
	s += 'cw:'+MakeWidthArray(info['Widths'])+",\n";
	s += 'enc:\''+enc+"',\n";
	let diff = MakeFontEncoding(map);
	if(diff){
		s += 'diff : \''+diff+"',\n";
	}
	s += 'uv : '+MakeUnicodeArray(map)+",\n";
	
	if(embed)
	{
		s += 'file: \''+info['File']+"',\n";
		if(type==='Type1')
		{
			s += 'size1 :'+info['Size1']+",\n";
			s += 'size2 : '+info['Size2']+",\n";
		}
		else
		{
			s += 'originalsize : '+info['OriginalSize']+",\n";
			if(subset){
				s += "\subsetted :true,\n";
			}
		}
	}

	s += "}\n";
	s+="module.exports = Font;"
	SaveToFile(file,s,'t');
	
}
function MakeFontDescriptor(info:any)
{	
	
	// Ascent
	let fd = "{'Ascent':"+info['Ascender'];
	// Descent
	fd += ",'Descent':"+info['Descender'];
	// CapHeight
	if(info['CapHeight']){
		fd += ",'CapHeight':"+info['CapHeight'];
	}else{
		fd += ",'CapHeight':"+info['Ascender'];
	}
	// Flags
	let flags = 0;
	if(info['IsFixedPitch']){
		flags += 1<<0;
	}
	flags += 1<<5;
	if(info['ItalicAngle']!==0){
		flags += 1<<6;
	}
	fd += ",'Flags':"+flags;
	// FontBBox
	let fbb = info['FontBBox'];
	fd += ",'FontBBox':'["+fbb[0]+' '+fbb[1]+' '+fbb[2]+' '+fbb[3]+"]'";
	// ItalicAngle
	fd += ",'ItalicAngle':"+info['ItalicAngle'];
	// StemV
	let stemv
	if(info['StdVW']){
		stemv = info['StdVW'];
	}else if(info['Bold']){
		stemv = 120;
	}else{
		stemv = 70;
	}
	fd += ",'StemV':"+stemv;
	// MissingWidth
	fd += ",'MissingWidth':"+info['MissingWidth']+'}';
	return fd;
}

function MakeWidthArray(widths:any)
{
	let s = "{\n\t";
	for(let c=0;c<=255;c++)
	{	
		if(String.fromCharCode(c)==="'"){
			s += "'\\''";
		}else if(String.fromCharCode(c)==="\\"){
			s += "'\\\\'";
		}else if(c>=32 && c<=126){
			s += "'"+String.fromCharCode(c)+"'";
		}else{
			s += `[String.fromCharCode(${c})]`;
		}
		
		s += ':'+widths[c];
		if(c<255){
			s += ',';
		}
		if((c+1)%22===0){
			s += "\n\t";
		}
		
	}
	s += '}';
	return s;
}

function MakeFontEncoding(map:any){
	// Build differences from reference encoding
	let ref = LoadMap('cp1252');
	let s = '';
	let last = 0;
	for(let c=32;c<=255;c++)
	{	
		if(map[c]){
			if(map[c]['name']!==ref[c]['name'])
			{
				if(c!==last+1){
					s += c+' ';
				}
				last = c;
				s += '/'+map[c]['name']+' ';
			}
		}
	}
	return s.trimEnd()//rtrim(s);
}

function MakeUnicodeArray(map:any)
{
	// Build mapping to Unicode values
	let ranges = [];
	let range:any
	map.forEach((v:any,c:number) => {
		let uv = v['uv'];
		if(uv!==-1)
		{
			if(range)
			{
				if(c===range[1]+1 && uv===range[3]+1)
				{
					range[1]++;
					range[3]++;
				}
				else
				{
					ranges.push(range);
					range = [c, c, uv, uv];
				}
			}
			else{
				range = [c, c, uv, uv];
			}
		}
	});
	ranges.push(range);
	let s:any;
	ranges.forEach((range:any)=>{
		if(s){
			s += ','
		}else{
			s = '{'
		}

		s += range[0]+':'
		let nb = range[1]-range[0]+1;
		if(nb>1){
			s += '['+range[2]+','+nb+']';
		}else{
			s += range[2];
		}
	})

	s += '}'
	return s

}

function SaveToFile(file:string, s:any, mode:any){
	
	const buffer = new Readable({ read() { } });
	buffer.push(s)
	buffer.pipe(fs.createWriteStream(file))
	/*
	$f = fopen($file, 'w'.$mode);
	if(!$f)
		Error('Can\'t write to file '.$file);
	fwrite($f, $s);
	fclose($f);
	*/
}

function LoadMap(enc:string){
	
    const file = path.join(__dirname,'/',enc.toLowerCase()+'.map');

    if(!fs.existsSync(file)){
        Error('Encoding not found: '+enc);
    }
    
    const liner = new lineByLine(file);
    let line:string;
    const map = []

    while (line = liner.next()) {
        const e=line.toString().split(' ');
        const c =parseInt(e[0].substring(1,undefined),16) //hexdec(substr($e[0],1));
        const uv =parseInt(e[1].substring(2,undefined),16) //hexdec(substr($e[1],2));
        const name = e[2];
        map[c]={'uv':uv, 'name':name}
    }

    return map;

}

function GetInfoFromTrueType(file:string, embed:boolean, subset:boolean, map:any){
    
    let ttf:any;

	// Return information from a TrueType font
	try{
		ttf = new TTFParser(file);
		ttf.Parse();
	}catch(e:any){
		Error(e.toString());
	}
    let info:any={};
    if(embed){

		if(!ttf.embeddable){
			Error('Font license does not allow embedding');
        }
		
		if(subset){
			
			let chars:any = [];
            map.forEach((v:any) => {
                if(v['name']!=='.notdef'){
					chars.push(v['uv'])  
                }  
            });
       
			ttf?.Subset(chars);
			info['Data'] = ttf?.Build();
		
		}else{
			const bf=fs.readFileSync(file)
			info['Data'] =bf.toString('binary')//file_get_contents(file);
        }

		info['OriginalSize'] = info['Data'].length
	}

    
	let k = 1000/ttf?.unitsPerEm;
	info['FontName'] = ttf?.postScriptName;
	info['Bold'] = ttf?.bold;
	info['ItalicAngle'] = ttf?.italicAngle;
	info['IsFixedPitch'] = ttf?.isFixedPitch;
	info['Ascender'] = Math.round(k*ttf?.typoAscender);
	info['Descender'] = Math.round(k*ttf?.typoDescender);
	info['UnderlineThickness'] = Math.round(k*ttf?.underlineThickness);
	info['UnderlinePosition'] = Math.round(k*ttf?.underlinePosition);
	info['FontBBox'] = [Math.round(k*ttf?.xMin), Math.round(k*ttf?.yMin), Math.round(k*ttf?.xMax), Math.round(k*ttf?.yMax)];
	info['CapHeight'] = Math.round(k*ttf?.capHeight);
	info['MissingWidth'] = Math.round(k*ttf?.glyphs[0]['w']);
	let widths:any = new Array(256,) //array_fill(0, 256, $info['MissingWidth']);
	widths.fill(info['MissingWidth'],0,256)
	
	map.forEach((v:any,c:number) => {
		if(v['name']!=='.notdef'){
			if(ttf?.chars[v['uv']])
			{
				let id = ttf?.chars[v['uv']];
				let w = ttf?.glyphs[id]['w'];
				widths[c] = Math.round(k*w);
			}else{
				console.log('Character '+v['name']+' is missing');
			}
		}  
	});
	info['Widths'] = widths;
	return info;
}

function GetInfoFromType1(file:string,embed:boolean, map:any)
{	
	/*
	// Return information from a Type1 font
	if($embed)
	{
		$f = fopen($file, 'rb');
		if(!$f)
			Error('Can\'t open font file');
		// Read first segment
		$a = unpack('Cmarker/Ctype/Vsize', fread($f,6));
		if($a['marker']!=128)
			Error('Font file is not a valid binary Type1');
		$size1 = $a['size'];
		$data = fread($f, $size1);
		// Read second segment
		$a = unpack('Cmarker/Ctype/Vsize', fread($f,6));
		if($a['marker']!=128)
			Error('Font file is not a valid binary Type1');
		$size2 = $a['size'];
		$data .= fread($f, $size2);
		fclose($f);
		$info['Data'] = $data;
		$info['Size1'] = $size1;
		$info['Size2'] = $size2;
	}

	$afm = substr($file, 0, -3).'afm';
	if(!file_exists($afm))
		Error('AFM font file not found: '.$afm);
	$a = file($afm);
	if(empty($a))
		Error('AFM file empty or not readable');
	foreach($a as $line)
	{
		$e = explode(' ', rtrim($line));
		if(count($e)<2)
			continue;
		$entry = $e[0];
		if($entry=='C')
		{
			$w = $e[4];
			$name = $e[7];
			$cw[$name] = $w;
		}
		elseif($entry=='FontName')
			$info['FontName'] = $e[1];
		elseif($entry=='Weight')
			$info['Weight'] = $e[1];
		elseif($entry=='ItalicAngle')
			$info['ItalicAngle'] = (int)$e[1];
		elseif($entry=='Ascender')
			$info['Ascender'] = (int)$e[1];
		elseif($entry=='Descender')
			$info['Descender'] = (int)$e[1];
		elseif($entry=='UnderlineThickness')
			$info['UnderlineThickness'] = (int)$e[1];
		elseif($entry=='UnderlinePosition')
			$info['UnderlinePosition'] = (int)$e[1];
		elseif($entry=='IsFixedPitch')
			$info['IsFixedPitch'] = ($e[1]=='true');
		elseif($entry=='FontBBox')
			$info['FontBBox'] = array((int)$e[1], (int)$e[2], (int)$e[3], (int)$e[4]);
		elseif($entry=='CapHeight')
			$info['CapHeight'] = (int)$e[1];
		elseif($entry=='StdVW')
			$info['StdVW'] = (int)$e[1];
	}

	if(!isset($info['FontName']))
		Error('FontName missing in AFM file');
	if(!isset($info['Ascender']))
		$info['Ascender'] = $info['FontBBox'][3];
	if(!isset($info['Descender']))
		$info['Descender'] = $info['FontBBox'][1];
	$info['Bold'] = isset($info['Weight']) && preg_match('/bold|black/i', $info['Weight']);
	if(isset($cw['.notdef']))
		$info['MissingWidth'] = $cw['.notdef'];
	else
		$info['MissingWidth'] = 0;
	$widths = array_fill(0, 256, $info['MissingWidth']);
	foreach($map as $c=>$v)
	{
		if($v['name']!='.notdef')
		{
			if(isset($cw[$v['name']]))
				$widths[$c] = $cw[$v['name']];
			else
				Warning('Character '.$v['name'].' is missing');
		}
	}
	$info['Widths'] = $widths;
	return $info;
	*/
}

function Error(msg:string){
    throw msg;
}

function basename(fullPath:string) {
	return  fullPath.replace(/^.*[\\\/]/, '') // path.split('/').reverse()[0];
}

const substr = (str:string, start:number, length:number) => {
    str=`${str}`

	console.log(str)
    if (str&&start>=0) {
        return str.substr(start, length)
    }else if(str&&start<0){
      return str.substr(start,length) 
    } else {
        return ''
    }

}

const function_exists = (cModule:string) => {

    try {
        const test = require(cModule)
        return true
    } catch (error) {
        return false
    }

}

const gzcompress = (data:any) => {
    const chunk = (!Buffer.isBuffer(data)) ? Buffer.from(data, 'binary') : data
    return zlib.deflateSync(chunk)
}

