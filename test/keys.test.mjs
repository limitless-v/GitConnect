import {test,after,mock} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {createAccount,uploadKey} from '../dist/keys.js';
import {load} from '../dist/core.js';

const root=mkdtempSync(path.join(os.tmpdir(),'gitconnect keys '));
process.env.GITCONNECT_HOME=path.join(root,'profiles');
mock.method(os,'homedir',()=>root);
after(()=>{mock.restoreAll();syncBuiltinESMExports();rmSync(root,{recursive:true,force:true});});

test('create generates a real key and profile; duplicates and existing directories stay intact',()=>{
  const key=createAccount('generated','Test User','test@example.com',true);
  assert.equal(load().generated.key,key);
  assert.match(readFileSync(`${key}.pub`,'utf8'),/^ssh-ed25519 /);
  const original=readFileSync(key,'utf8');
  assert.throws(()=>createAccount('generated','Test','test@example.com',true),/already exists/);
  assert.equal(readFileSync(key,'utf8'),original);
  assert.throws(()=>createAccount('../escape','Test','test@example.com',true),/Profile ID/);
  assert.throws(()=>createAccount('bad-email','Test','invalid',true),/valid author/);
  const profiles=path.join(root,'profiles','profiles.json');
  writeFileSync(profiles,'{}');
  assert.throws(()=>createAccount('generated','Test','test@example.com',true),/Existing keys are preserved/);
  writeFileSync(profiles,JSON.stringify({generated:{name:'Test User',email:'test@example.com',key}}));
});

test('GitHub upload selects explicit credentials, verifies identity, and sends only public key',()=>{
  const original=childProcess.execFileSync;
  const calls=[];
  let login='target-user';
  const stub=mock.method(childProcess,'execFileSync',(file,args,options)=>{
    if(file!=='gh') return original(file,args,options);
    calls.push({args,options});
    if(args[0]==='auth') return 'fake-test-token\n';
    if(args.includes('user')) return login+'\n';
    return '';
  });
  syncBuiltinESMExports();
  try {
    uploadKey('generated','target-user');
    assert.deepEqual(calls[0].args,['auth','token','--hostname','github.com','--user','target-user']);
    assert.equal(calls[1].options.env.GH_TOKEN,'fake-test-token');
    assert.equal(JSON.parse(calls[2].options.input).key,readFileSync(load().generated.key+'.pub','utf8').trim());
    assert.ok(!calls.some(call=>call.args.includes('switch')));
    calls.length=0;login='wrong-user';
    assert.throws(()=>uploadKey('generated','target-user'),/upload failed/);
    assert.equal(calls.length,2,'Identity mismatch must stop before upload');
    assert.ok(load().generated,'Profile survives upload failure');
    assert.throws(()=>uploadKey('generated','--bad'),/valid GitHub username/);
  } finally {stub.mock.restore();syncBuiltinESMExports();}
});
