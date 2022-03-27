#!/usr/bin/env node
import MakeFont from "./makefont"

const ValidFlags=['--v','-v','-h','--h','--enc','-enc']

const ValidEncodes:any ={
    'cp1250':'cp1250 (Central Europe)',
    'cp1251':'cp1251 (Cyrillic)',
    'cp1252':'cp1252 (Western Europe)',
    'cp1253':'cp1253 (Greek)',
    'cp1254':'cp1254 (Turkish)',
    'cp1255':'cp1255 (Hebrew)',
    'cp1257':'cp1257 (Baltic)',
    'cp1258':'cp1258 (Vietnamese)',
    'cp874':'cp874 (Thai)',
    'iso-8859-1':'iso-8859-1 (Western Europe)',
    'iso-8859-2':'iso-8859-2 (Central Europe)',
    'iso-8859-4':'iso-8859-4 (Baltic)',
    'iso-8859-5':'iso-8859-5 (Cyrillic)',
    'iso-8859-7':'iso-8859-7 (Greek)',
    'iso-8859-9':'iso-8859-9 (Turkish)',
    'iso-8859-11':'iso-8859-11 (Thai)',
    'iso-8859-15':'iso-8859-15 (Western Europe)',
    'iso-8859-16':'iso-8859-16 (Central Europe)',
    'kOi8-r':'kOi8-r (Russian)',
    'kOi8-u':'kOi8-u (Ukrainian)',
}

if(process.argv.length===2){
    console.log("Use makefont_njs -h for help to use.")
}else{
    
    if(!ValidFlags.includes(process.argv[2])){

        let fontfile = process.argv[2];
        let enc="cp1252"
        let embed=true
        let subset=true

        if(process.argv.length>=4){
            enc=process.argv[3];

            if(!(enc.toLowerCase() in ValidEncodes)){
                console.log(" Incorrect encoding: "+enc)
                process.exit()
            }
        }

        if(process.argv.length>=5){
            embed=(['true','1'].includes(process.argv[4]));
        }

        if(process.argv.length>=6){
            subset=(['true','1'].includes(process.argv[5]));
        }

        MakeFont(fontfile,enc,embed,subset)

    }else if(['--v','-v'].includes(process.argv[2].toLowerCase())){
        
        console.log('makefont_njs v1.0.7',)

    }else if(['-h','--h'].includes(process.argv[2].toLowerCase())){
        
        console.log("Usage:  makefont_njs fontfile [encoding] [embed] [subset]\n")
        console.log("Paramas Description\n")
        console.log("[fontfile]: Path to the .ttf, .otf or .pfb file.")
        console.log("[encoding]: Name of the encoding to use. Default value: cp1252.")
        console.log("[embed]: Whether to embed the font or not. Default value: true.")
        console.log("[subset]: Whether to subset the font or not. Default value: true.\n")
        console.log(" or use \n")
        console.log(" -h or --h for help.")
        console.log(" -v or --v show version.")
        console.log(" -enc or --enc show available encodings.\n")

    }else if(['--enc','-enc'].includes(process.argv[2].toLowerCase())){
        
        const keys = Object.keys(ValidEncodes)
        console.log("The encoding defines the association between a code (from 0 to 255) and a character.\n The first 128 are always the same and correspond to ASCII; the following are variable.\n Encodings are stored in .map files. The available ones are:\n")
        keys.map((key:string)=>{
            console.log(ValidEncodes[key])   
        })

    }

}   
    