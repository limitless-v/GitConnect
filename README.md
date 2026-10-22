# GitConnect — phase one

A TypeScript CLI that selects an existing SSH key and Git author identity for each repository. Requires Node.js 22+, Git, and OpenSSH (`ssh-keygen` and `ssh`) on PATH. Windows Git must support `core.sshCommand`.

## Setup

```powershell
cd D:\GitConnect
npm.cmd install
npm.cmd run build
npm.cmd test
node .\dist\cli.js --help
```

Optional: `npm.cmd link` exposes the `gitconnect` command. Otherwise use `node D:\GitConnect\dist\cli.js` in place of `gitconnect` below. No global installation is required.

```powershell
gitconnect add work --name "Your Name" --email "you@company.com" --key "C:\Users\You\.ssh\id_ed25519_work"
gitconnect list
gitconnect use work --repo "D:\Projects\My Repo"
gitconnect status --repo "D:\Projects\My Repo"
```

Run `use` and `status` inside a repository or pass `--repo`. `use` checks `origin` by default; select another remote with `--remote upstream`. Both fetch and all push URLs for that remote must be SSH URLs (`git@github.com:owner/repo.git` or `ssh://git@github.com/owner/repo.git`). HTTPS and local remotes are rejected before changes. Remotes are never rewritten. SSH host aliases can be used if already configured.

Profiles live in `%USERPROFILE%\.gitconnect\profiles.json`; set `GITCONNECT_HOME` to use another directory. They contain only profile IDs, names, emails, and absolute private-key paths. Key contents are never copied into profiles or logs. Keep your key in its original secure location; GitConnect does not change its permissions. Paths with spaces and apostrophes are supported. `~\` and `~/` expand to your home directory. Quote paths in PowerShell; environment variables must be expanded by your shell.

`add` checks that the file has a private-key header and that OpenSSH recognizes it. Public keys and malformed files are rejected. Existing profile IDs cannot be overwritten. Encrypted keys can be registered; load them into your SSH agent or enter their passphrase when Git prompts. GitConnect does not generate keys, upload keys, handle passphrases, or prove that a key belongs to a GitHub account. Register the matching public key with the intended GitHub account before pushing.

`use` replaces only repository-local `user.name`, `user.email`, `core.sshCommand`, and `gitconnect.profile`. Other local settings, remote URLs, global Git configuration, and SSH configuration are preserved. It attempts to restore the prior values if a write fails. Avoid simultaneous configuration changes. Linked worktrees share local configuration with their parent repository. Worktree-specific settings can override local values; `status` displays effective values so you can spot differences.

The SSH command selects the key with `IdentitiesOnly=yes`. Existing SSH host settings may specify additional identity files. `GIT_SSH_COMMAND`, `GIT_SSH`, command-line Git options, or worktree-specific configuration can affect which identity Git actually uses; `status` flags SSH environment overrides. Author name/email affect future commits, while the SSH key authenticates pushes. Existing commits are unchanged. Account selection applies to SSH operations in this repository, not only the chosen remote. It does not affect GitHub CLI/browser sign-in or HTTPS credentials.

## Verification and limitations

`npm.cmd test` builds and runs integration tests with temporary repositories and a generated disposable test key. Tests cover profile validation, SSH URL rejection, local-setting preservation, invalid push URLs, Windows shell quoting, status, and CLI errors. They make no GitHub network calls and do not modify personal keys or global Git configuration. Live GitHub authentication must be checked separately after you register your public key.

To stop applying a selected profile, restore your previous values for the four local settings using `git config --local`, or unset those settings if you want to inherit global defaults. Removing a profile record does not undo repository settings.
