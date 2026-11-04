import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCloneRemote,validateRemote} from '../dist/core.js';

test('HTTPS clone links convert to SSH with nested paths and optional suffix',()=>{
  for(const [input,expected] of [
    ['https://github.com/owner/repo.git','git@github.com:owner/repo.git'],
    ['https://github.com/owner/repo/','git@github.com:owner/repo'],
    ['https://gitlab.com/group/team/repo.git','git@gitlab.com:group/team/repo.git'],
    ['https://bitbucket.org/team/repo','git@bitbucket.org:team/repo'],
  ]) assert.equal(normalizeCloneRemote(input),expected);
  const ssh='ssh://git@custom.example:2222/team/repo.git';
  assert.equal(normalizeCloneRemote(ssh),ssh);
});

test('ambiguous HTTPS URLs are rejected and existing repository validation stays SSH only',()=>{
  for(const url of [
    'http://github.com/owner/repo','https://user:token@github.com/owner/repo',
    'https://github.com:443/owner/repo','https://github.com/owner/repo?token=x',
    'https://github.com/owner/repo#main','https://github.com/owner/../repo',
    'https://github.com/owner/repo\n','https://custom.example/team/repo',
    'https://github.com/owner','https://github.com/owner/repo;command',
  ]) assert.throws(()=>normalizeCloneRemote(url));
  assert.throws(()=>validateRemote('https://github.com/owner/repo.git'));
});
