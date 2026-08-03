/**
 * Generate raw TypeDoc reflection JSON from an immutable origin/master archive.
 *
 * The archive lives in the OS temp directory and is removed after conversion;
 * Dash-Web's working tree is never checked out or modified.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Application } from 'typedoc';

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(here, '..');
const dashRoot = resolve(process.env.DASH_REPO ?? resolve(docsRoot, '..', 'Dash-Web'));
const baseline = process.env.DASH_BASELINE ?? 'origin/master';
const outputPath = resolve(docsRoot, 'src', 'data', 'generated', 'typedoc-api.json');
const safeDirectory = dashRoot.replaceAll('\\', '/');

const git = (args) =>
  execFileSync('git', ['-c', `safe.directory=${safeDirectory}`, ...args], {
    cwd: dashRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 1024,
  }).trim();

const baselineTip = git(['rev-parse', baseline]);
const remote = git(['remote', 'get-url', 'origin'])
  .replace(/^git@github\.com:/, 'https://github.com/')
  .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
  .replace(/\.git$/, '');
const tempRoot = mkdtempSync(join(tmpdir(), 'dash-typedoc-'));
const archivePath = join(tempRoot, 'dash-source.tar');
const sourceRoot = join(tempRoot, 'source');

try {
  mkdirSync(sourceRoot, { recursive: true });
  execFileSync(
    'git',
    [
      '-c',
      `safe.directory=${safeDirectory}`,
      'archive',
      '--format=tar',
      `--output=${archivePath}`,
      baseline,
      '--',
      'src',
      'packages',
      'electron-main.mjs',
      'package.json',
      'tsconfig.json',
    ],
    { cwd: dashRoot, windowsHide: true, maxBuffer: 1024 * 1024 * 1024 }
  );
  execFileSync('tar.exe', ['-xf', archivePath, '-C', sourceRoot], {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 1024,
  });
  const typedocTsconfig = join(sourceRoot, 'typedoc.tsconfig.json');
  writeFileSync(typedocTsconfig, JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Node',
      jsx: 'react-jsx',
      allowJs: true,
      experimentalDecorators: true,
      useDefineForClassFields: false,
      skipLibCheck: true,
      strict: false,
    },
    include: ['src/**/*', 'packages/components/src/**/*'],
    exclude: ['**/*.stories.tsx', '**/*.test.ts', '**/*.test.tsx'],
  }, null, 2));

  const app = await Application.bootstrap({
    entryPoints: [
      join(sourceRoot, 'src').replaceAll('\\', '/'),
      join(sourceRoot, 'packages', 'components', 'src').replaceAll('\\', '/'),
    ],
    entryPointStrategy: 'expand',
    tsconfig: typedocTsconfig,
    skipErrorChecking: true,
    excludeExternals: true,
    excludePrivate: false,
    excludeProtected: false,
    gitRevision: baselineTip,
    basePath: sourceRoot,
    exclude: ['**/*.stories.tsx', '**/*.test.ts', '**/*.test.tsx'],
    sourceLinkTemplate: `${remote}/blob/{gitRevision}/{path}#L{line}`,
    name: `Dash-Web ${baselineTip.slice(0, 12)}`,
  });
  const project = await app.convert();
  if (!project) throw new Error('TypeDoc conversion returned no project.');
  mkdirSync(dirname(outputPath), { recursive: true });
  await app.generateJson(project, outputPath);

  const reflection = JSON.parse(readFileSync(outputPath, 'utf8'));
  const count = (node) => 1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
  process.stdout.write(
    `Wrote ${outputPath}\nTypeDoc reflections: ${count(reflection).toLocaleString()}\nPinned commit: ${baselineTip}\n`
  );
} finally {
  // tempRoot is created above with a fixed prefix inside os.tmpdir().
  if (tempRoot.startsWith(tmpdir())) rmSync(tempRoot, { recursive: true, force: true });
}
