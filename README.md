# GitConnect

A TypeScript CLI that selects an existing SSH key and Git author identity for each repository. Requires Node.js 22+, Git, and OpenSSH (`ssh-keygen` and `ssh`) on PATH. Windows Git must support `core.sshCommand`.

## Installation

```sh
npm install --global gitconnect
gitconnect --help
```

If PowerShell blocks the npm script, run `npm.cmd install --global gitconnect` and `gitconnect.cmd --help`.

## Command reference

Use `gitconnect <command> [options]`. Angle brackets mean a required value; square brackets mean an optional argument. Replace the placeholders with your own values.

| Command | What it does |
| --- | --- |
| `gitconnect` | Shows the ASCII banner and a summary of all commands. |
| `gitconnect create <id> --name <name> --email <email> [--no-passphrase] [--github-user <username>]` | Generates a new Ed25519 SSH key and saves an account profile. Optionally uploads the public key to GitHub. |
| `gitconnect upload-key <id> --github-user <username>` | Registers a saved profile's matching `.pub` key on the specified GitHub account through GitHub CLI. |
| `gitconnect add <id> --name <name> --email <email> --key <path>` | Saves an account profile using an existing SSH private key and commit author details. |
| `gitconnect list` | Prints all saved profiles as JSON, including names, emails, and key paths. |
| `gitconnect accounts [--repo <path>] [--remote <name>]` | Opens the account picker for an existing repository, highlights the current profile, and applies your selection. Includes interactive account registration. |
| `gitconnect clone <url> [--account <id>] [destination]` | Clones using a saved account's SSH key and saves its identity in the new repository. Supported HTTPS links convert to SSH automatically. |
| `gitconnect use <id> [--repo <path>] [--remote <name>]` | Applies a saved account directly to an existing repository without opening the picker. |
| `gitconnect status [--repo <path>]` | Prints the effective profile, author name/email, SSH command, and whether SSH environment overrides are present, as JSON. Does not test network access. |
| `gitconnect push [--repo <path>] [--remote <name>]` | Pushes the current branch and sets its upstream. |
| `gitconnect pr [--repo <path>] [--remote <name>] [--base <branch>] [--head <branch>] [--title <text>] [--body <text>]` | Creates a pull request on GitHub using GitHub CLI. |
| `gitconnect help` | Shows full command usage and examples. Aliases: `gitconnect --help` and `gitconnect -h`. |

### Options and arguments

| Option or argument | Used with | Meaning |
| --- | --- | --- |
| `<id>` | `add`, `use` | Your profile label, such as `personal` or `work`. New IDs must contain 1–64 letters, digits, underscores, or hyphens, starting with a letter or digit. Existing IDs cannot be overwritten. |
| `--name <name>` | `add`, `create` | Required commit author name. Quote names containing spaces. |
| `--email <email>` | `add`, `create` | Required commit author email. |
| `--no-passphrase` | `create` | Explicitly generates an unencrypted key. Otherwise OpenSSH prompts for a passphrase in an interactive terminal. |
| `--github-user <username>` | `create`, `upload-key` | GitHub login that should receive the public key. Must already be signed into GitHub CLI with key-management permission. Optional for `create`, required for `upload-key`. |
| `--key <path>` | `add` | Required path to an existing private key, not its `.pub` file. Supports `~/` and `~\` home-directory prefixes. |
| `--repo <path>` | `accounts`, `use`, `status` | Repository directory. Defaults to the current directory. |
| `--remote <name>` | `accounts`, `use` | Remote whose fetch and push URLs are checked for SSH compatibility. Defaults to `origin`. The selected identity applies to SSH operations throughout the repository. |
| `<url>` | `clone` | SSH clone URL, or an HTTPS repository link from `github.com`, `gitlab.com`, or `bitbucket.org`. Other hosts require an SSH clone URL. |
| `--account <id>` | `clone` | Saved profile to use. Omit to choose interactively. |
| `[destination]` | `clone` | New clone directory. Defaults to the repository name under the current directory. |
| `--help`, `-h` | Any invocation | Shows full help instead of executing the command. |

### Examples of every command

```powershell
# Show the banner and command summary
gitconnect

# Register personal and work profiles
gitconnect add personal --name "Your Name" --email "you@personal.com" --key "$HOME\.ssh\id_ed25519_personal"
gitconnect add work --name "Your Name" --email "you@company.com" --key "$HOME\.ssh\id_ed25519_work"

# Or generate a new key and profile, then upload its public key to GitHub
gitconnect create new-personal --name "Your Name" --email "you@personal.com"
gitconnect upload-key new-personal --github-user your-github-login

# Generate, save, and upload in one command after GitHub CLI sign-in
gitconnect create new-work --name "Your Name" --email "you@company.com" --github-user your-work-login

# List saved accounts
gitconnect list

# Pick an account for the current repository, or a specified repository
gitconnect accounts
gitconnect accounts --repo "D:\Projects\My Repo" --remote upstream

# Paste an HTTPS link and choose the SSH account to clone with
gitconnect clone https://github.com/owner/repo.git

# Clone with a specific account and destination
gitconnect clone https://github.com/owner/repo.git --account personal "D:\Projects\My Personal Repo"

# SSH links work too
gitconnect clone git@github.com:owner/repo.git --account work

# Switch an existing repository to a saved account
gitconnect use work
gitconnect use personal --repo "D:\Projects\My Repo" --remote upstream

# Inspect the current or a specified repository
gitconnect status
gitconnect status --repo "D:\Projects\My Repo"

# Show full usage and examples (equivalent commands)
gitconnect help
gitconnect --help
gitconnect -h
```

After selecting an account, use normal `git pull`, `git push`, and `git commit` commands in that repository. The saved SSH key handles authentication; the saved name and email identify future commits. Your selected account must already have access to the remote repository. For converted HTTPS clone links, GitConnect prints the SSH URL and saves that SSH URL as `origin`.

## Push a branch and open a pull request

After committing your changes on a feature branch, push it and open a pull request:

```powershell
gitconnect push
gitconnect pr --base main --title "Add a feature" --body "Describe the change."
```

Both commands default to `origin` in the current repository. `push` uses Git's effective authentication settings. `pr` uses the signed-in GitHub CLI account and the selected remote's github.com push URL. Run `gh auth login` before creating a PR. The head defaults to the current branch, and the base defaults to the repository's default branch. To open a PR from a fork, select the base repository's remote and pass `--head your-login:branch`.

## Working with saved accounts

### Generate and register a new SSH key

`create` runs OpenSSH locally and stores keys at `~/.ssh/gitconnect-<id>/id_ed25519` and `id_ed25519.pub`. It refuses to overwrite an existing profile or key directory. OpenSSH handles the passphrase prompt directly; GitConnect does not store passphrases. For unattended generation, explicitly pass `--no-passphrase` to create an unencrypted key. The new profile becomes available to `clone`, `accounts`, and `use`; creation alone does not select it for an existing repository.

Public-key upload currently supports **github.com** and requires [GitHub CLI (`gh`)](https://cli.github.com/) on PATH. Sign into the intended account once, requesting permission to manage SSH keys:

```powershell
gh auth login --hostname github.com --skip-ssh-key --scopes admin:public_key
gitconnect upload-key personal --github-user your-github-login
```

Choose the intended GitHub account during sign-in. For an already signed-in account missing permission, use `gh auth refresh --hostname github.com --scopes admin:public_key` for that account. GitConnect retrieves the saved credential for the explicit `--github-user`, verifies the authenticated username, and uploads only the matching public key. It does not switch GitHub CLI's active account or save tokens in profiles. GitHub may require a browser/device authorization step during sign-in; you do not need to manually paste the public key into GitHub settings.

`upload-key` also works with profiles registered through `add` when a matching `<private-key-path>.pub` file exists. If upload fails, the local key and profile remain available; fix sign-in or permissions and retry `upload-key`. For GitLab, Bitbucket, or other hosts, register the generated `.pub` key with that provider separately.

```powershell
gitconnect add work --name "Your Name" --email "you@company.com" --key "C:\Users\You\.ssh\id_ed25519_work"
gitconnect list
gitconnect use work --repo "D:\Projects\My Repo"
gitconnect status --repo "D:\Projects\My Repo"
```

To see saved accounts and choose one for an existing repository, run:

```powershell
gitconnect accounts
# Or select a repository explicitly:
gitconnect accounts --repo "D:\Projects\My Repo"
```

The picker marks and highlights the current profile. Use Up/Down arrow keys and Enter to select; press Esc, `q`, or Ctrl+C to cancel. When input or output is redirected, enter an account number or profile ID instead. Selection applies the account's SSH key and commit identity to that repository using the same checks as `use`. Pass `--remote upstream` to check a remote other than `origin`. `gitconnect list` remains available to list profiles without selecting one.

The interactive `accounts` menu also includes **Add a new account**. Select it and enter an account ID, commit author name, email, and existing private-key path. GitConnect saves the profile and selects it for the repository. If applying it fails, the saved profile remains available. This option also works when no accounts have been saved yet; it registers existing keys rather than generating or uploading them.

## Clone with a personal or work account

Register a profile with the SSH key belonging to the account you want, then select it when cloning:

```powershell
gitconnect add personal --name "Your Name" --email "you@personal.com" --key "C:\Users\You\.ssh\id_ed25519_personal"
gitconnect clone git@github.com:owner/repo.git --account personal "D:\Projects\My Personal Repo"
```

Omit the destination to create a folder named after the repository in the current directory. Use `gitconnect list` to see available profiles. The selected key authenticates the initial clone, and the new repository saves that profile's SSH key, author name, and email for future operations. Your Windows login and global Git settings stay unchanged. This grants access using the selected account; it does not transfer or fork the remote repository.

Omit `--account` to choose from all saved accounts with arrow keys and Enter:

```powershell
gitconnect clone git@github.com:owner/repo.git
```

Enter `q` or press Ctrl+C to cancel. The picker lists saved profiles; it does not verify which accounts have permission to access the repository. For scripts, pass `--account <id>` to skip the prompt.

Cloning requires a public key registered with the intended account. HTTPS repository links from github.com, gitlab.com, and bitbucket.org are automatically converted to SSH before account selection. For example, `gitconnect clone https://github.com/owner/repo.git` uses `git@github.com:owner/repo.git`. The cloned repository saves the SSH remote for future pulls and pushes. HTTPS credentials, query strings, fragments, and explicit ports are rejected; for other hosts, provide their SSH clone URL. During cloning, the selected profile takes precedence over `GIT_SSH_COMMAND` and `GIT_SSH`; existing environment overrides can still affect later Git commands. Clone progress and passphrase prompts appear in the terminal, and there is no fixed clone timeout. If cloning fails, any remaining destination files are preserved.

Run `use` and `status` inside a repository or pass `--repo`. `use` checks `origin` by default; select another remote with `--remote upstream`. Both fetch and all push URLs for that remote must be SSH URLs (`git@github.com:owner/repo.git` or `ssh://git@github.com/owner/repo.git`). HTTPS and local remotes are rejected before changes. Remotes are never rewritten. SSH host aliases can be used if already configured.

Profiles live in `%USERPROFILE%\.gitconnect\profiles.json`; set `GITCONNECT_HOME` to use another directory. They contain only profile IDs, names, emails, and absolute private-key paths. Key contents are never copied into profiles or logs. Keep your key in its original secure location; GitConnect does not change its permissions. Paths with spaces and apostrophes are supported. `~\` and `~/` expand to your home directory. Quote paths in PowerShell; environment variables must be expanded by your shell.

`add` checks that the file has a private-key header and that OpenSSH recognizes it. Public keys and malformed files are rejected. Existing profile IDs cannot be overwritten. Encrypted keys can be registered; load them into your SSH agent or enter their passphrase when Git prompts. Use `create` to generate keys and `upload-key` to register public keys on GitHub. Adding a local profile alone does not prove which remote account owns its key or grant repository access.

`use` replaces only repository-local `user.name`, `user.email`, `core.sshCommand`, and `gitconnect.profile`. Other local settings, remote URLs, global Git configuration, and SSH configuration are preserved. It attempts to restore the prior values if a write fails. Avoid simultaneous configuration changes. Linked worktrees share local configuration with their parent repository. Worktree-specific settings can override local values; `status` displays effective values so you can spot differences.

The SSH command selects the key with `IdentitiesOnly=yes`. Existing SSH host settings may specify additional identity files. `GIT_SSH_COMMAND`, `GIT_SSH`, command-line Git options, or worktree-specific configuration can affect which identity Git actually uses; `status` flags SSH environment overrides. Author name/email affect future commits, while the SSH key authenticates pushes. Existing commits are unchanged. Account selection applies to SSH operations in this repository, not only the chosen remote. It does not affect GitHub CLI/browser sign-in or HTTPS credentials.

## Removing a repository's profile settings

To stop applying a selected profile, restore your previous values for the four local settings using `git config --local`, or unset those settings if you want to inherit global defaults. Removing a profile record does not undo repository settings.
