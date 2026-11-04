import {emitKeypressEvents,moveCursor,cursorTo,clearScreenDown} from 'node:readline';
import type {ReadStream,WriteStream} from 'node:tty';

export function pickAccount(labels:string[],initial=0,input:ReadStream=process.stdin,output:WriteStream=process.stdout):Promise<number> {
  if(!labels.length) return Promise.reject(new Error('No accounts to select.'));
  return new Promise((resolve,reject)=>{
    let selected=initial>=0&&initial<labels.length?initial:0;
    const wasRaw=Boolean(input.isRaw);
    const wasPaused=input.isPaused();
    const draw=()=>{
      const width=Math.max(1,(output.columns||80)-1);
      output.write(labels.map((label,index)=>`${index===selected?'>':' '} ${label}`.replace(/[\x00-\x1f\x7f-\x9f]/g,' ').slice(0,width)).join('\n')+'\n');
    };
    const cleanup=()=>{
      input.removeListener('keypress',onKey);
      input.removeListener('end',onEnd);
      input.removeListener('error',onError);
      input.setRawMode(wasRaw);
      if(wasPaused) input.pause();
    };
    const onError=(error:Error)=>{cleanup();reject(error);};
    const onEnd=()=>onError(new Error('Account selection cancelled.'));
    const onKey=(_text:string,key:{name?:string;ctrl?:boolean})=>{
      if(key.name==='escape'||key.name==='q'||(key.ctrl&&key.name==='c')) {onEnd();return;}
      if(key.name==='return') {cleanup();resolve(selected);return;}
      if(key.name!=='up'&&key.name!=='down') return;
      selected=(selected+(key.name==='up'?-1:1)+labels.length)%labels.length;
      moveCursor(output,0,-labels.length);
      cursorTo(output,0);
      clearScreenDown(output);
      draw();
    };
    try {
      output.write('Use Up/Down arrows to choose, Enter to select, Esc or Ctrl+C to cancel.\n');
      emitKeypressEvents(input);
      input.setRawMode(true);
      draw();
      input.on('keypress',onKey);
      input.once('end',onEnd);
      input.once('error',onError);
      input.resume();
    } catch(error) {onError(error as Error);}
  });
}
