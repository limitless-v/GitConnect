import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {add,load,use,status,validateKey,validateRemote,sshCommand} from '../dist/core.js';
const root=mkdtempSync(path.join(os.tmpdir(),'gitconnect test '));
// Isolate from an ancestor repository or Git settings supplied by the host.
for(const name of ['GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR','GIT_CONFIG','GIT_CONFIG_COUNT']) delete process.env[name];
process.env.GIT_CEILING_DIRECTORIES=root;
process.env.GIT_CONFIG_GLOBAL=path.join(root,'global.gitconfig');
writeFileSync(process.env.GIT_CONFIG_GLOBAL,'[user]\n\tname = Global User\n\temail = global@example.com\n');
process.env.GITCONNECT_HOME=path.join(root,'profiles');
const key=path.join(root,"key with space's");
execFileSync('ssh-keygen',['-q','-t','ed25519','-N','','-f',key]);
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const repo=path.join(root,'repo');mkdirSync(repo);git(repo,'init');
git(repo,'remote','add','origin','git@github.com:example/repo.git');
after(()=>rmSync(root,{recursive:true,force:true}));
test('register private key path, never key contents; reject duplicate and public keys',()=>{
 add('work','Work User','work@example.com',key);
 assert.equal(load().work.key,key);
 const saved=readFileSync(path.join(process.env.GITCONNECT_HOME,'profiles.json'),'utf8');
 assert.ok(!saved.includes('PRIVATE KEY'));
 assert.throws(()=>add('work','Other','other@example.com',key),/already exists/);
 assert.throws(()=>validateKey(key+'.pub'),/private key/);
 const bad=path.join(root,'invalid');writeFileSync(bad,'invalid');assert.throws(()=>validateKey(bad));
 assert.throws(()=>add('../bad','User','user@example.com',key));
 assert.throws(()=>add('bad','User\nInjected','user@example.com',key));
});
test('accept SSH remotes and reject HTTPS, local, option and shell injection forms',()=>{
 for(const value of ['git@github.com:owner/repo.git','ssh://git@github.com:22/owner/repo.git']) assert.doesNotThrow(()=>validateRemote(value));
 for(const value of ['https://github.com/owner/repo','C:/repo','/tmp/repo','-oProxyCommand=x:repo','git@github.com:repo;evil','ssh://git:password@github.com/repo','ssh://github.com/repo?x','git@github.com:repo\n']) assert.throws(()=>validateRemote(value));
});
test('use changes only intended local keys and preserves other settings and remote',()=>{
 git(repo,'config','--local','custom.keep','preserved');
 git(repo,'config','--local','--add','custom.multiple','one');git(repo,'config','--local','--add','custom.multiple','two');
 use('work',repo);
 assert.equal(git(repo,'config','--local','user.email'),'work@example.com');
 assert.equal(git(repo,'config','--local','custom.keep'),'preserved');
 assert.equal(git(repo,'config','--local','--get-all','custom.multiple'),'one\ntwo');
 assert.equal(git(repo,'remote','get-url','origin'),'git@github.com:example/repo.git');
 assert.equal(git(repo,'config','--local','core.sshCommand'),sshCommand(key));
 assert.equal(status(repo)['gitconnect.profile'],'work');
});
test('switching profiles preserves global settings and other repositories',()=>{
 const globalBefore=readFileSync(process.env.GIT_CONFIG_GLOBAL,'utf8');
 const second=path.join(root,'second repo');mkdirSync(second);git(second,'init');
 add('personal','Personal User','personal@example.com',key);
 use('personal',repo);
 assert.equal(git(repo,'config','--local','user.email'),'personal@example.com');
 assert.equal(git(second,'config','user.email'),'global@example.com');
 assert.equal(readFileSync(process.env.GIT_CONFIG_GLOBAL,'utf8'),globalBefore);
});
test('invalid push URL fails before altering local config',()=>{
 git(repo,'remote','set-url','--push','origin','https://github.com/example/repo.git');
 const before=git(repo,'config','--local','--list');
 assert.throws(()=>use('work',repo),/SSH URL/);
 assert.equal(git(repo,'config','--local','--list'),before);
});
test('missing profiles and non-repositories fail',()=>{
 assert.throws(()=>use('missing',repo),/Unknown profile/);
 const nonrepo=path.join(root,'not-a-repository');mkdirSync(nonrepo);
 assert.throws(()=>status(nonrepo));
});
test('Windows SSH command quoting reaches ssh as a single identity path',()=>{
 const shell=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/sh';
 const command=sshCommand(key);
 const expanded=execFileSync(shell,['-c',command.replace(/^ssh /,'printf \'%s\\n\' ')],{encoding:'utf8'}).trim().split('\n');
 assert.deepEqual(expanded,['-i',key.replaceAll('\\','/'),'-o','IdentitiesOnly=yes']);
});
test('CLI help and errors have expected exit codes',()=>{
 const cli=path.resolve('dist/cli.js');
 assert.match(execFileSync(process.execPath,[cli,'--help'],{encoding:'utf8'}),/GitConnect/);
 assert.throws(()=>execFileSync(process.execPath,[cli,'invalid'],{stdio:'pipe'}),e=>e.status===1);
});
