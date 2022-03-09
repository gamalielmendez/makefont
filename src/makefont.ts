import * as fs from "fs"
import * as path from 'path';
import TTFParser from "./ttfparser"
const lineByLine= require("n-readlines")

export default function MakeFont(fontfile:string, enc:string='cp1252', embed:boolean=true, subset:boolean=true)
{
	
    // Generate a font definition file
	if(!fs.existsSync(fontfile)){
		Error('Font file not found: '+fontfile);
    }

    const ext =fontfile.substring(fontfile.length-3,fontfile.length).toLowerCase()
    let type
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
		//$info = GetInfoFromType1($fontfile, $embed, $map);
    }
    
    /*
	$basename = substr(basename($fontfile), 0, -4);
	if($embed)
	{
		if(function_exists('gzcompress'))
		{
			$file = $basename.'.z';
			SaveToFile($file, gzcompress($info['Data']), 'b');
			$info['File'] = $file;
			Message('Font file compressed: '.$file);
		}
		else
		{
			$info['File'] = basename($fontfile);
			$subset = false;
			Notice('Font file could not be compressed (zlib extension not available)');
		}
	}

	MakeDefinitionFile($basename.'.php', $type, $enc, $embed, $subset, $map, $info);
	Message('Font definition file generated: '.$basename.'.php');
    */
}

function LoadMap(enc:string){
	
    const file = path.join(__dirname,'/',enc.toLowerCase()+'.map');

    if(!fs.existsSync(file)){
        Error('Encoding not found: '+enc);
    }
    
    const liner = new lineByLine(file);
    let line:string;
    let lineNumber = 0;
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
    
    let ttf;

	// Return information from a TrueType font
	try{
		ttf = new TTFParser(file);
		ttf.Parse();
	}catch(e:any){
		Error(e.toString());
	}
    let info={};
    if(embed){

		if(!ttf?.embeddable){
			Error('Font license does not allow embedding');
        }
		if(subset){
			let chars:any = [];
            map.forEach((v:any) => {
                if(v['name']!=='.notdef'){
					chars.push(v['uv'])  
                }  
            });
       
			//ttf.Subset(chars);
			//info['Data'] = ttf.Build();
		}
		else{
			//info['Data'] = file_get_contents(file);
        }
		//info['OriginalSize'] = info['Data'].length
	}

    /*
	$k = 1000/$ttf->unitsPerEm;
	$info['FontName'] = $ttf->postScriptName;
	$info['Bold'] = $ttf->bold;
	$info['ItalicAngle'] = $ttf->italicAngle;
	$info['IsFixedPitch'] = $ttf->isFixedPitch;
	$info['Ascender'] = round($k*$ttf->typoAscender);
	$info['Descender'] = round($k*$ttf->typoDescender);
	$info['UnderlineThickness'] = round($k*$ttf->underlineThickness);
	$info['UnderlinePosition'] = round($k*$ttf->underlinePosition);
	$info['FontBBox'] = array(round($k*$ttf->xMin), round($k*$ttf->yMin), round($k*$ttf->xMax), round($k*$ttf->yMax));
	$info['CapHeight'] = round($k*$ttf->capHeight);
	$info['MissingWidth'] = round($k*$ttf->glyphs[0]['w']);
	$widths = array_fill(0, 256, $info['MissingWidth']);
	foreach($map as $c=>$v)
	{
		if($v['name']!='.notdef')
		{
			if(isset($ttf->chars[$v['uv']]))
			{
				$id = $ttf->chars[$v['uv']];
				$w = $ttf->glyphs[$id]['w'];
				$widths[$c] = round($k*$w);
			}
			else
				Warning('Character '.$v['name'].' is missing');
		}
	}
	$info['Widths'] = $widths;
	return $info;*/
}

function Error(msg:string){
    throw msg;
}
