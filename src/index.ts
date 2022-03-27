#!/usr/bin/env node
import MakeFont from "./makefont"

let ValidFlags=['--v','-v',
                '-h','--h']

    if(process.argv.length===2){
        console.log("Usage:  makefont_njs fontfile [encoding] [embed] [subset]\n")
    }else{
        
        if(!ValidFlags.includes(process.argv[2])){

            let fontfile = process.argv[2];
            let enc="cp1252"
            let embed=true
            let subset=true
    
            if(process.argv.length>=4){
                enc=process.argv[3];
            }
    
            if(process.argv.length>=5){
                embed=(process.argv[4]=='true' || process.argv[4]=='1');
            }
    
            if(process.argv.length>=6){
                subset=(process.argv[5]=='true' || process.argv[5]=='1');
            }
    
            MakeFont(fontfile,enc,embed,subset)
        }else if(['--v','-v'].includes(process.argv[2])){
            console.log('makefont_njs ',process.version)
        }else if(['-h','--h'].includes(process.argv[2])){
            console.log("Usage:  makefont_njs fontfile [encoding] [embed] [subset]\n")
        }

    }   
     