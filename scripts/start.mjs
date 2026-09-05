import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectDir = fileURLToPath(new URL('../', import.meta.url));
if (!existsSync(join(projectDir, 'dist/server/wrangler.json'))) {
  console.error('Build SolveX first with: npm run build');
  process.exit(1);
}
const server = spawn(process.execPath, [
  join(projectDir, 'node_modules/wrangler/bin/wrangler.js'),
  'dev', '--local', '--config', 'dist/server/wrangler.json', '--ip', '127.0.0.1',
  ...process.argv.slice(2),
], {
  cwd: projectDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    XDG_CONFIG_HOME: join(projectDir, '.wrangler/config'),
    WRANGLER_CACHE_DIR: join(projectDir, '.wrangler/cache'),
    WRANGLER_SEND_METRICS: 'false',
    WRANGLER_WRITE_LOGS: 'false',
    WRANGLER_LOG_PATH: join(projectDir, '.wrangler/logs'),
    WRANGLER_REGISTRY_PATH: join(projectDir, '.wrangler/registry'),
    MINIFLARE_REGISTRY_PATH: join(projectDir, '.wrangler/registry'),
    CHOKIDAR_USEPOLLING: 'true',
  },
});
server.on('error', error => { console.error(error.message); process.exit(1); });
server.on('exit', code => process.exit(code ?? 0));
process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
