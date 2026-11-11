const commands = [
  {usage:'create <id> --name <name> --email <email> [--no-passphrase] [--github-user <username>]', description:'Generate an Ed25519 key and save a profile. Optionally upload the public key to a signed-in GitHub account using gh.', examples:['create personal --name "Your Name" --email you@example.com', 'create work --name "Your Name" --email you@company.com --github-user your-work-login']},
  {usage:'upload-key <id> --github-user <username>', description:'Upload a saved profile’s matching public key to an explicit GitHub account using gh.', examples:['upload-key personal --github-user your-login']},
  {usage:'add <id> --name <name> --email <email> --key <path>', description:'Register an account with an existing SSH private key.', examples:['add personal --name "Your Name" --email you@example.com --key "C:/Users/you/.ssh/id_ed25519_personal"']},
  {usage:'list', description:'Show all saved account profiles as JSON.', examples:['list']},
  {usage:'accounts [--repo <path>] [--remote <name>]', description:'Choose an account with arrow keys or select Add a new account; marks the current profile.', examples:['accounts', 'accounts --repo "D:/Projects/My Repo" --remote upstream']},
  {usage:'clone <url> [--account <id>] [destination]', description:'Clone with a saved SSH account. HTTPS links from GitHub, GitLab, and Bitbucket convert to SSH. Omit --account to open the picker.', examples:['clone git@github.com:owner/repo.git', 'clone git@github.com:owner/repo.git --account personal "D:/Projects/My Repo"']},
  {usage:'use <id> [--repo <path>] [--remote <name>]', description:'Apply an account directly to an existing repository.', examples:['use personal', 'use personal --repo "D:/Projects/My Repo" --remote upstream']},
  {usage:'status [--repo <path>]', description:'Show effective repository identity and SSH settings.', examples:['status', 'status --repo "D:/Projects/My Repo"']},
  {usage:'push [--repo <path>] [--remote <name>]', description:'Push the current branch and set its upstream.', examples:['push', 'push --remote upstream']},
  {usage:'pr [--repo <path>] [--remote <name>] [--base <branch>] [--head <branch>] [--title <text>] [--body <text>]', description:'Open a GitHub pull request from a pushed branch using GitHub CLI.', examples:['pr --base main', 'pr --base main --title "Add a feature" --body "Describe the change."']},
  {usage:'help', description:'Show every command with usage and examples. Also: --help or -h.', examples:['help', '--help', '-h']},
];

const banner = [
  String.raw`   ____ _ _    ____                            _   `,
  String.raw`  / ___(_) |_ / ___|___  _ __  _ __   ___  ___| |_ `,
  String.raw` | |  _| | __| |   / _ \| '_ \| '_ \ / _ \/ __| __|`,
  String.raw` | |_| | | |_| |__| (_) | | | | | | |  __/ (__| |_ `,
  String.raw`  \____|_|\__|\____\___/|_| |_|_| |_|\___|\___|\__|`,
].join('\n');

export function showHelp(detailed=false):void {
  const heading=process.stdout.isTTY&&!('NO_COLOR' in process.env)?`\x1b[36m${banner}\x1b[0m`:banner;
  console.log(`\n${heading}\n\nYour repositories. Your accounts. Your choice.\n\nUsage: gitconnect <command> [options]\n\nAvailable commands:\n`);
  for(const command of commands) {
    console.log(`  ${command.usage}\n    ${command.description}`);
    if(detailed) console.log(command.examples.map(example=>`    $ gitconnect ${example}`).join('\n'));
    console.log();
  }
  if(detailed) console.log('Paths with spaces must be quoted. --repo defaults to the current directory.\n--remote defaults to origin. Cloning accepts SSH URLs or HTTPS repository links from GitHub, GitLab, and Bitbucket.\nPick accounts with Up/Down arrows and Enter; Esc, q, or Ctrl+C cancels.\nRedirected input accepts an account number or ID.\nSaved profiles do not prove repository access. status does not test authentication.');
  else console.log('Run gitconnect help for examples of every command.');
}

