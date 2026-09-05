import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const output = join(process.cwd(), 'dist', 'client');
const repositoryName = process.env.PAGES_REPOSITORY ?? 'algebra-with-khalid';
const nested = join(output, repositoryName, '_next');
const target = join(output, '_next');

// Vinext writes assetPrefix files beneath the prefix directory. GitHub Pages
// already mounts the artifact at that prefix, so keep one copy at its root.
if (existsSync(nested)) {
  mkdirSync(output, { recursive: true });
  rmSync(target, { recursive: true, force: true });
  renameSync(nested, target);
  rmSync(join(output, repositoryName), { recursive: true, force: true });
}
