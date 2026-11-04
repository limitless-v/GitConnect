#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {createInterface} from 'node:readline';
import {createInterface as createPrompt} from 'node:readline/promises';
import {showHelp} from './help.js';
import {pickAccount} from './picker.js';
import {add,load,use,status,clone,normalizeCloneRemote} from './core.js';
import {createAccount,uploadKey} from './keys.js';

async function registerAccount():Promise<string> {
  const prompt=createPrompt({input:process.stdin,output:process.stdout});
  const controller=new AbortController();
  prompt.on('SIGINT',()=>controller.abort());
  try {
    const ask=async(label:string)=>{
      const value=(await prompt.question(label,{signal:controller.signal})).trim();
      if(!value) throw new Error('Account creation cancelled. All fields are required.');
      return value;
    };
    console.log('Register an existing SSH key. Press Ctrl+C to cancel.');
    const id=await ask('Account ID: ');
    const name=await ask('Commit author name: ');
    const email=await ask('Commit author email: ');
    const key=await ask('Existing private-key path: ');
    add(id,name,email,key);
    console.log(`Added ${id}.`);
    return id;
  } finally {prompt.close();}
}

async function chooseAccount(current?:unknown,allowAdd=false):Promise<string> {
  const profiles=Object.entries(load());
  if(!profiles.length&&!(allowAdd&&process.stdin.isTTY&&process.stdout.isTTY)) throw new Error('No saved accounts. Run gitconnect add to register an account first.');
  console.log('Choose an account (repository access is not verified):');
  if(process.stdin.isTTY&&process.stdout.isTTY) {
    const labels=profiles.map(([id,profile])=>`${id} — ${profile.name} <${profile.email}>${id===current?' (current)':''}`);
    if(allowAdd) labels.push('+ Add a new account');
    const selected=await pickAccount(labels,profiles.findIndex(([id])=>id===current));
    if(selected===profiles.length) return registerAccount();
    return profiles[selected]![0];
  }
  profiles.forEach(([id,profile],index)=>console.log(`  ${index+1}. ${id} — ${profile.name} <${profile.email}>${id===current?' (current)':''}`));
  const input=createInterface({input:process.stdin,output:process.stdout,terminal:Boolean(process.stdin.isTTY&&process.stdout.isTTY)});
  try {
    process.stdout.write('Account number or ID (q to cancel): ');
    for await(const line of input) {
      const answer=line.trim();
      if(answer.toLowerCase()==='q') throw new Error('Account selection cancelled.');
      const selected=profiles.find(([id])=>id===answer) ?? (/^[1-9]\d*$/.test(answer)?profiles[Number(answer)-1]:undefined);
      if(selected) return selected[0];
      process.stdout.write('Invalid selection. Enter a listed account number or ID (q to cancel): ');
    }
    throw new Error('No account selected. Retry interactively, use gitconnect use <id>, or pass --account <id> when cloning.');
  } finally {input.close();}
}
try {
  const {values,positionals}=parseArgs({allowPositionals:true,options:{name:{type:'string'},email:{type:'string'},key:{type:'string'},repo:{type:'string'},remote:{type:'string'},account:{type:'string'},'github-user':{type:'string'},'no-passphrase':{type:'boolean'},help:{type:'boolean',short:'h'}}});
  const [command,id]=positionals;
  if(values.help||!command||(command==='help'&&positionals.length===1)) showHelp(Boolean(values.help||command==='help'));
  else if(command==='create'&&id&&positionals.length===2&&values.name&&values.email) {
    const key=createAccount(id,values.name,values.email,values['no-passphrase']);
    console.log(`Created ${id}. Private key: ${key}\nPublic key: ${key}.pub`);
    if(values['github-user']) {uploadKey(id,values['github-user']);console.log(`Public key added to GitHub account ${values['github-user']}.`);}
    else console.log(`To register on GitHub: gitconnect upload-key ${id} --github-user <username>`);
  }
  else if(command==='upload-key'&&id&&positionals.length===2&&values['github-user']) {
    uploadKey(id,values['github-user']);console.log(`Public key added to GitHub account ${values['github-user']}.`);
  }
  else if(command==='clone'&&id&&(positionals.length===2||positionals.length===3)) {
    const remote=normalizeCloneRemote(id);
    if(remote!==id) console.log(`Using SSH: ${remote}`);
    const account=values.account ?? await chooseAccount();
    const target=clone(remote,account,positionals[2]);console.log(`Cloned to ${target} using ${account}.`);
  }
  else if(command==='add'&&id&&positionals.length===2&&values.name&&values.email&&values.key) {add(id,values.name,values.email,values.key);console.log(`Added ${id}.`);}
  else if(command==='list'&&positionals.length===1) console.log(JSON.stringify(load(),null,2));
  else if(command==='accounts'&&positionals.length===1) {
    const current=status(values.repo)['gitconnect.profile'];
    const account=await chooseAccount(current,true);
    use(account,values.repo,values.remote);
    console.log(`Selected ${account} for this repository.`);
  }
  else if(command==='use'&&id&&positionals.length===2) {use(id,values.repo,values.remote);console.log(`Selected ${id} for this repository.`);}
  else if(command==='status'&&positionals.length===1) console.log(JSON.stringify(status(values.repo),null,2));
  else throw new Error('Invalid command or missing arguments. Run gitconnect --help.');
} catch(error) {console.error(`GitConnect: ${(error as Error).message}`);process.exitCode=1;}

