import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {pickAccount} from '../dist/picker.js';

function terminal() {
 const input=new PassThrough();
 input.pause();
 input.isRaw=false;
 input.setRawMode=value=>{input.isRaw=value;return input;};
 const output=new PassThrough();
 output.columns=80;
 let screen='';output.on('data',data=>{screen+=data;});
 return {input,output,screen:()=>screen};
}

test('arrow picker starts at current account, wraps in both directions and confirms with Enter',async()=>{
 for(const [initial,keys,expected] of [[1,'\r',1],[0,'\x1b[A\r',2],[2,'\x1b[B\r',0],[0,'\x1b[B\x1b[B\x1b[A\r',1]]) {
  const {input,output,screen}=terminal();
  const picked=pickAccount(['personal','work','other'],initial,input,output);
  input.write(keys);
  assert.equal(await picked,expected);
  assert.match(screen(),/Enter to select/);
  assert.equal(input.isRaw,false);
  assert.equal(input.listenerCount('keypress'),0);
  assert.equal(input.isPaused(),true);
 }
});

test('arrow picker cancels and restores terminal state',async()=>{
 for(const keys of ['\x03','q','\x1b']) {
  const {input,output}=terminal();
  input.isRaw=true;
  const picked=pickAccount(['personal','work'],0,input,output);
  input.write(keys);
  await assert.rejects(picked,/cancelled/);
  assert.equal(input.isRaw,true);
  assert.equal(input.listenerCount('keypress'),0);
 }
});
