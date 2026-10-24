import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const children = [
  spawn(node, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'watch', 'src/server.ts'], {
    cwd: path.join(root, 'apps/api'),
    stdio: 'inherit',
  }),
  spawn(node, [path.join(root, 'node_modules/vite/bin/vite.js')], {
    cwd: path.join(root, 'apps/web'),
    stdio: 'inherit',
  }),
];

let stopping = false;
const stop = (exitCode = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exitCode = exitCode;
};

for (const child of children) {
  child.on('error', (error) => {
    console.error('Could not start a development server:', error.message);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) stop(code ?? (signal ? 1 : 0));
  });
}

process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
