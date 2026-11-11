import {execFileSync} from 'node:child_process';
import {run} from './core.js';

function currentBranch(cwd:string):string {
  const branch=run('git',['branch','--show-current'],cwd);
  if(!branch) throw new Error('Check out a branch first.');
  return branch;
}

function remoteUrls(cwd:string,remote:string):string[] {
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(remote)) throw new Error('Invalid remote name.');
  return run('git',['remote','get-url','--push','--all',remote],cwd).split(/\r?\n/);
}

export function push(cwd=process.cwd(),remote='origin'):void {
  remoteUrls(cwd,remote);
  const branch=currentBranch(cwd);
  try {
    execFileSync('git',['push','--set-upstream','--',remote,`refs/heads/${branch}:refs/heads/${branch}`],{cwd,stdio:'inherit'});
  } catch {
    throw new Error('Push failed. Check Git’s output and the remote account’s access.');
  }
}

export function createPullRequest(cwd=process.cwd(),remote='origin',base?:string,head?:string,title?:string,body?:string):void {
  const urls=remoteUrls(cwd,remote);
  const match=urls[0]?.match(/^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https:\/\/github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i);
  if(urls.length!==1||!match) throw new Error('Choose a remote with a single github.com push URL.');
  const args=['pr','create','--repo',`github.com/${match[1]}`,'--head',head??currentBranch(cwd)];
  if(base!==undefined) args.push('--base',base);
  if(title!==undefined) args.push('--title',title);
  if(body!==undefined) args.push('--body',body);
  try {
    execFileSync('gh',args,{cwd,stdio:'inherit'});
  } catch(error) {
    if((error as NodeJS.ErrnoException).code==='ENOENT') throw new Error('Install GitHub CLI (gh) to create a pull request.');
    throw new Error('Pull request creation failed. Check GitHub CLI’s output, sign-in, and branch access.');
  }
}
