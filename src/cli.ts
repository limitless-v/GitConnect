#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {add,load,use,status} from './core.js';
try {
  const {values,positionals}=parseArgs({allowPositionals:true,options:{name:{type:'string'},email:{type:'string'},key:{type:'string'},repo:{type:'string'},remote:{type:'string'},help:{type:'boolean',short:'h'}}});
  const [command,id]=positionals;
  if(values.help||!command) console.log('GitConnect\n  add <id> --name "Your Name" --email you@example.com --key "C:\\Users\\you\\.ssh\\id_ed25519"\n  list\n  use <id> [--repo path] [--remote origin]\n  status [--repo path]');
  else if(command==='add'&&id&&positionals.length===2&&values.name&&values.email&&values.key) {add(id,values.name,values.email,values.key);console.log(`Added ${id}.`);}
  else if(command==='list'&&positionals.length===1) console.log(JSON.stringify(load(),null,2));
  else if(command==='use'&&id&&positionals.length===2) {use(id,values.repo,values.remote);console.log(`Selected ${id} for this repository.`);}
  else if(command==='status'&&positionals.length===1) console.log(JSON.stringify(status(values.repo),null,2));
  else throw new Error('Invalid command or missing arguments. Run gitconnect --help.');
} catch(error) {console.error(`GitConnect: ${(error as Error).message}`);process.exitCode=1;}
