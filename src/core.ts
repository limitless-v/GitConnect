import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,renameSync,statSync,realpathSync,existsSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';

export interface Profile {name:string; email:string; key:string}
type Store = Record<string,Profile>;
export function run(file:string,args:string[],cwd=process.cwd()):string {
  try {return execFileSync(file,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000}).trim();}
  catch {throw new Error(`${file} ${args[0]} failed. Check the repository, file permissions, and installed Git/OpenSSH tools.`);}
}
export function storePath():string {return path.join(process.env.GITCONNECT_HOME || path.join(os.homedir(),'.gitconnect'),'profiles.json');}
export function load():Store {
  if(!existsSync(storePath())) return Object.create(null) as Store;
  const data:unknown=JSON.parse(readFileSync(storePath(),'utf8'));
  if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error('Invalid profile store.');
  const result:Store=Object.create(null) as Store;
  for(const [id,p] of Object.entries(data)) {
    validateId(id);
    if(!p || typeof p!=='object') throw new Error('Invalid profile.');
    const v=p as Profile; validateIdentity(v.name,v.email);
    if(typeof v.key!=='string' || !path.isAbsolute(v.key) || /[\r\n\0]/.test(v.key)) throw new Error('Invalid key path.');
    result[id]={name:v.name,email:v.email,key:v.key};
  }
  return result;
}
function validateId(id:string):void {if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)) throw new Error('Profile ID must contain 1–64 letters, digits, underscores or hyphens.');}
function validateIdentity(name:string,email:string):void {
  if(typeof name!=='string'||!name.trim()||/[\r\n\0]/.test(name)) throw new Error('Provide a nonempty single-line name.');
  if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||/[\r\n\0]/.test(email)) throw new Error('Provide a valid email.');
}
export function validateKey(input:string):string {
  if(/[\r\n\0]/.test(input)) throw new Error('Invalid key path.');
  const expanded=input==='~'?os.homedir():input.startsWith('~/')||input.startsWith('~\\')?path.join(os.homedir(),input.slice(2)):input;
  const key=realpathSync(path.resolve(expanded));
  if(!statSync(key).isFile()) throw new Error('SSH key must be a file.');
  // Inspect the header only; key bytes are never persisted or logged.
  const content=readFileSync(key,'utf8');
  if(!/^-----BEGIN (OPENSSH|RSA|EC|DSA|PRIVATE|ENCRYPTED PRIVATE) (?:PRIVATE )?KEY-----/.test(content)) throw new Error('Select an SSH private key, not a public key.');
  run('ssh-keygen',['-l','-f',key]);
  return key;
}
export function add(id:string,name:string,email:string,input:string):void {
  validateId(id); validateIdentity(name,email);
  const profiles=load(); if(Object.hasOwn(profiles,id)) throw new Error('Profile already exists. Choose another ID.');
  profiles[id]={name,email,key:validateKey(input)};
  const file=storePath(); mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temp=`${file}.${randomUUID()}.tmp`;
  try {writeFileSync(temp,JSON.stringify(profiles,null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(temp,file);} finally {if(existsSync(temp)) unlinkSync(temp);}
}
export function validateRemote(remote:string):void {
  // Reject URLs with options, credentials, local paths, control characters or shell syntax.
  const scp=/^(?:[A-Za-z0-9._-]+@)?([A-Za-z0-9][A-Za-z0-9.-]*):([A-Za-z0-9._~/-]+)$/;
  if(/[\s\x00-\x1f\x7f]/.test(remote)) throw new Error('Remote must be an SSH URL.');
  if(remote.startsWith('ssh://')) {
    let u:URL; try {u=new URL(remote);} catch {throw new Error('Invalid SSH URL.');}
    if(!u.hostname||u.password||!/^\/[A-Za-z0-9._~/-]+$/.test(u.pathname)||u.search||u.hash||!/^ssh:\/\/(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9.-]+(?::[0-9]+)?\//.test(remote)) throw new Error('Invalid SSH URL.');
  } else {const m=remote.match(scp);if(remote.includes('://') || !m || m[1]!.length===1 || m[2]!.startsWith('-')) throw new Error('Remote must be an SSH URL, e.g. git@github.com:owner/repo.git.');}
}
export function sshCommand(key:string):string {return `ssh -i '${key.replaceAll('\\','/').replaceAll("'", "'\\''")}' -o IdentitiesOnly=yes`;}
function git(args:string[],cwd:string):string {return run('git',args,cwd);}
function localValues(key:string,cwd:string):string[] {
  try {return execFileSync('git',['config','--local','--null','--get-all',key],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).split('\0').filter(v=>v!=='');}
  catch(e) {if((e as {status?:number}).status===1) return [];throw e;}
}
export function use(id:string,cwd=process.cwd(),remoteName='origin'):void {
  const p=load()[id];if(!p) throw new Error('Unknown profile.'); validateKey(p.key);
  git(['rev-parse','--git-dir'],cwd);
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(remoteName)) throw new Error('Invalid remote name.');
  const urls=git(['remote','get-url','--all',remoteName],cwd).split('\n');
  const push=git(['remote','get-url','--push','--all',remoteName],cwd).split('\n');
  [...urls,...push].forEach(validateRemote);
  const updates:Record<string,string>={'user.name':p.name,'user.email':p.email,'core.sshCommand':sshCommand(p.key),'gitconnect.profile':id};
  const previous=Object.fromEntries(Object.keys(updates).map(k=>[k,localValues(k,cwd)]));
  try {for(const [k,v] of Object.entries(updates)) git(['config','--local','--replace-all',k,v],cwd);}
  catch(error) {
    for(const [k,values] of Object.entries(previous)) {
      if(localValues(k,cwd).length) git(['config','--local','--unset-all',k],cwd);
      for(const v of values) git(['config','--local','--add',k,v],cwd);
    }
    throw error;
  }
}
export function status(cwd=process.cwd()):Record<string,unknown> {
  git(['rev-parse','--git-dir'],cwd);
  const values:Record<string,unknown>={};
  for(const k of ['gitconnect.profile','user.name','user.email','core.sshCommand']) {
    try {values[k]=git(['config','--get',k],cwd);} catch {values[k]=null;}
  }
  values.sshEnvironmentOverride=Boolean(process.env.GIT_SSH_COMMAND||process.env.GIT_SSH);
  values.note='Settings are effective Git config values; SSH authentication and GitHub key ownership are not verified.';
  return values;
}
