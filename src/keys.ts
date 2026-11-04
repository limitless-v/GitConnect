import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {add,load,validateKey} from './core.js';

export function createAccount(id:string,name:string,email:string,noPassphrase=false):string {
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)) throw new Error('Profile ID must contain 1–64 letters, digits, underscores or hyphens.');
  if(!name.trim()||/[\r\n\0]/.test(name)||!/^\S+@\S+\.\S+$/.test(email)||/[\r\n\0]/.test(email)) throw new Error('Provide a valid author name and email.');
  if(Object.hasOwn(load(),id)) throw new Error('Profile already exists. Choose another ID.');
  if(!noPassphrase&&!(process.stdin.isTTY&&process.stdout.isTTY)) throw new Error('Key generation needs an interactive terminal for the passphrase prompt. Use --no-passphrase explicitly for an unencrypted key.');
  const parent=path.join(os.homedir(),'.ssh');
  mkdirSync(parent,{recursive:true,mode:0o700});
  const directory=path.join(parent,`gitconnect-${id}`);
  // A newly created directory prevents replacing any existing private or public key.
  try {mkdirSync(directory,{mode:0o700});}
  catch {throw new Error(`Cannot create key directory ${directory}. It may already exist; choose another profile ID. Existing keys are preserved.`);}
  const key=path.join(directory,'id_ed25519');
  try {
    execFileSync('ssh-keygen',['-t','ed25519','-C',email,'-f',key,...(noPassphrase?['-N','']:[])],{stdio:'inherit'});
    add(id,name,email,key);
  } catch {throw new Error(`Key generation or profile registration failed. Any generated files remain in ${directory}. If the key is complete, register it with gitconnect add.`);}
  return key;
}

export function uploadKey(id:string,githubUser:string):void {
  if(!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(githubUser)) throw new Error('Provide a valid GitHub username with --github-user.');
  const profile=load()[id];
  if(!profile) throw new Error('Unknown profile.');
  validateKey(profile.key);
  const publicKey=readFileSync(`${profile.key}.pub`,'utf8').trim();
  // Compare the public key to OpenSSH’s fingerprint of the private key.
  const fingerprint=(args:string[])=>execFileSync('ssh-keygen',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split(/\s+/)[1];
  if(!/^ssh-ed25519 |^ssh-rsa |^ecdsa-sha2-/.test(publicKey)||fingerprint(['-l','-f',profile.key])!==fingerprint(['-l','-f',`${profile.key}.pub`])) throw new Error('The .pub file must match this profile’s private key.');
  try {
    // Retrieve only this user's saved credential; do not switch gh's active account.
    const token=execFileSync('gh',['auth','token','--hostname','github.com','--user',githubUser],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    if(!token) throw new Error('Missing credential');
    const env={...process.env,GH_TOKEN:token,GH_HOST:'github.com',GH_PROMPT_DISABLED:'1'};
    const actual=execFileSync('gh',['api','--hostname','github.com','user','--jq','.login'],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    if(actual.toLowerCase()!==githubUser.toLowerCase()) throw new Error('Account mismatch');
    // Send only public key data, through stdin rather than command-line arguments.
    execFileSync('gh',['api','--hostname','github.com','--method','POST','user/keys','--input','-'],{env,input:JSON.stringify({title:`GitConnect ${id} (${os.hostname()})`,key:publicKey}),stdio:['pipe','ignore','pipe']});
  } catch {throw new Error(`GitHub upload failed; the local profile and key are preserved. Install gh, sign in as ${githubUser} with gh auth login --hostname github.com --skip-ssh-key --scopes admin:public_key, then retry gitconnect upload-key ${id} --github-user ${githubUser}. Check account identity, token permissions, and whether the key is already registered.`);}
}
