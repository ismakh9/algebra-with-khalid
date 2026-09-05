#!/bin/zsh
set -e
cd "$(dirname "$0")"
# Finder may start a shell without the Node Version Manager initialization.
if ! command -v node >/dev/null 2>&1 && [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
fi
if ! command -v node >/dev/null 2>&1; then
  print 'Please install Node.js 22.13 or newer, then open this file again.'
  read '?Press Enter to close.'
  exit 1
fi
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 13)) { console.error("Please install Node.js 22.13 or newer."); process.exit(1); }'
if [[ ! -d node_modules ]]; then
  npm ci
fi
print '\nSolveX is starting. Open the Local URL below in your browser.'
print 'Keep this window open. Press Control+C to stop.\n'
npm run dev
