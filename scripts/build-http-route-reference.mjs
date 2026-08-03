import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import sourceReference from '../src/data/generated/source-modules.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.env.DASH_SOURCE_ROOT ?? path.join(root, '..', 'Dash-Web'));
const baseline = sourceReference.repository.baselineTip;
const remote = sourceReference.repository.remote
  .replace(/^git@github\.com:/, 'https://github.com/')
  .replace(/\.git$/, '');

function git(...args) {
  return execFileSync('git', ['-c', `safe.directory=${sourceRoot.replaceAll('\\', '/')}`, '-C', sourceRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function sourceAt(file) {
  return git('show', `${baseline}:${file}`);
}

function matchingSourceFiles(pattern, directory) {
  return git('grep', '-l', '-E', pattern, baseline, '--', directory)
    .split(/\r?\n/)
    .map((row) => row.replace(new RegExp(`^${baseline}:`), ''))
    .filter((file) => /\.(?:[cm]?[jt]sx?)$/.test(file));
}

function property(object, name) {
  return object.properties.find((member) =>
    ts.isPropertyAssignment(member) && member.name.getText(object.getSourceFile()).replaceAll(/["']/g, '') === name
  );
}

function literalText(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  return undefined;
}

function subscribedRoutes(node) {
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(subscribedRoutes);

  if (ts.isNewExpression(node) && node.expression.getText() === 'RouteSubscriber') {
    const rootName = literalText(node.arguments?.[0]);
    return rootName ? [`/${rootName}`] : [];
  }

  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const callName = node.expression.name.text;
    if (callName === 'add') {
      const base = subscribedRoutes(node.expression.expression)[0];
      const params = node.arguments.map(literalText).filter(Boolean);
      return base ? [`${base}${params.map((name) => `/:${name}`).join('')}`] : [];
    }
    if (callName === 'secureSubscriber') {
      const [rootName, ...params] = node.arguments.map(literalText).filter(Boolean);
      return rootName ? [`/${rootName}/:session_key${params.map((name) => `/:${name}`).join('')}`] : [];
    }
  }

  return [];
}

function methodName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text.toUpperCase();
  return node.getText().replace(/^Method\./, '').toUpperCase();
}

function addInput(inputs, channel, name) {
  if (!name || name === 'length') return;
  inputs[channel] ??= new Set();
  inputs[channel].add(name);
}

function extractInputs(text) {
  const inputs = {};
  for (const match of text.matchAll(/req\.(body|params|query|headers)(?:\.([A-Za-z_$][\w$]*)|\[['"]([^'"]+)['"]\])/g)) {
    addInput(inputs, match[1], match[2] ?? match[3]);
  }
  for (const match of text.matchAll(/\{([^{}]+)\}\s*=\s*(?:req|[A-Za-z_$][\w$]*)\.(body|params|query|headers)/g)) {
    for (const raw of match[1].split(',')) {
      const name = raw.trim().replace(/[:=].*$/, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) addInput(inputs, match[2], name);
    }
  }
  for (const match of text.matchAll(/\{([^{}]+)\}\s*=\s*JSON\.parse\s*\(/g)) {
    for (const raw of match[1].split(',')) {
      const name = raw.trim().replace(/[:=].*$/, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) addInput(inputs, 'body', name);
    }
  }
  if (/\.on\(\s*['"]field['"]/.test(text)) {
    for (const match of text.matchAll(/\b[A-Za-z_$][\w$]*\s*===\s*['"]([^'"]+)['"]/g)) {
      addInput(inputs, 'multipart', match[1]);
    }
  }
  if (/req\.files?\b/.test(text)) addInput(inputs, 'upload', 'file(s)');
  return Object.fromEntries(Object.entries(inputs).map(([key, values]) => [key, [...values].sort()]));
}

function extractResponses(text) {
  const responses = new Set();
  for (const match of text.matchAll(/res\.(send|json|redirect|render|sendFile|download|end|status|sendStatus|type)\b/g)) {
    responses.add(match[1]);
  }
  for (const match of text.matchAll(/\b(_success|_invalid|_error|_permissionDenied)\s*\(/g)) {
    responses.add(match[1].slice(1));
  }
  return [...responses].sort();
}

function groupFor(file) {
  const name = path.posix.basename(file).replace(/Manager\.ts$|\.ts$/g, '');
  return ({
    index: 'Shell and diagnostics',
    server_Initialization: 'Authentication and assets',
    dynamicTools: 'Dynamic agent tools',
    GPT: 'Model services',
    GeneralGoogle: 'Google services',
    DataViz: 'Data and visualization',
    Assistant: 'Assistant and ingestion',
    Firefly: 'Adobe and video generation',
    Upload: 'Uploads and media',
    VideoStitcher: 'Video stitching',
    Session: 'Monitored-session operations',
    User: 'User and activity',
    Delete: 'Deletion utilities',
    Util: 'Repository utilities',
    Flashcard: 'Flashcard labeling',
  })[name] ?? name;
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function sourceUrl(file, line) {
  return `${remote}/blob/${baseline}/${file}#L${line}`;
}

function definitionsIn(sourceFile) {
  const definitions = new Map();
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      definitions.set(node.name.text, node.getText(sourceFile));
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      definitions.set(node.name.text, node.initializer.getText(sourceFile));
    }
    if ((ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) && node.name) {
      const name = node.name.getText(sourceFile).replaceAll(/["']/g, '');
      definitions.set(name, node.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return definitions;
}

function expandedHandlerText(node, sourceFile, definitions, seen = new Set(), depth = 0) {
  if (!node || depth > 4) return '';
  const parts = [node.getText(sourceFile)];
  const names = new Set();
  const collect = (child) => {
    if (ts.isIdentifier(child)) names.add(child.text);
    if (ts.isPropertyAccessExpression(child) && child.expression.kind === ts.SyntaxKind.ThisKeyword) {
      names.add(child.name.text);
    }
    ts.forEachChild(child, collect);
  };
  collect(node);
  for (const name of names) {
    if (seen.has(name) || !definitions.has(name)) continue;
    seen.add(name);
    parts.push(definitions.get(name));
  }
  return parts.join('\n');
}

function supervisedRoutes(file, sourceFile) {
  const rows = [];
  const definitions = definitionsIn(sourceFile);
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.arguments.length) {
      const config = node.arguments[0];
      if (ts.isObjectLiteralExpression(config)) {
        const subscription = property(config, 'subscription');
        const method = property(config, 'method');
        const secureHandler = property(config, 'secureHandler');
        if (subscription && method && secureHandler) {
          const routes = subscribedRoutes(subscription.initializer);
          const publicHandler = property(config, 'publicHandler');
          const errorHandler = property(config, 'errorHandler');
          const admin = property(config, 'requireAdminInRelease');
          const text = [secureHandler, publicHandler, errorHandler]
            .filter(Boolean)
            .map((handler) => expandedHandlerText(handler.initializer, sourceFile, definitions))
            .join('\n');
          for (const route of routes) {
            rows.push({
              method: methodName(method.initializer),
              path: route,
              group: groupFor(file),
              layer: 'supervised',
              access: admin ? 'admin-in-release' : publicHandler ? 'session-or-public-handler' : 'session',
              inputs: extractInputs(text),
              responses: extractResponses(text),
              source: { file, line: lineOf(sourceFile, config), url: sourceUrl(file, lineOf(sourceFile, config)) },
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return rows;
}

function directAccess(file, route) {
  if (file.endsWith('/api/dynamicTools.ts')) return 'direct-no-route-manager';
  if (/^\/(signup|login|logout|forgotPassword|reset)/.test(route)) return 'public-auth-flow';
  return 'public-shell-or-asset';
}

function routeFromDefinitionText(text) {
  const rootName = /new\s+RouteSubscriber\(\s*['"]([^'"]+)['"]\s*\)/.exec(text)?.[1];
  if (!rootName) return [];
  const addArgs = /\.add\(([^)]*)\)/.exec(text)?.[1] ?? '';
  const params = [...addArgs.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  return [`/${rootName}${params.map((name) => `/:${name}`).join('')}`];
}

function directRoutes(file, sourceFile, sharedDefinitions = new Map()) {
  const rows = [];
  const definitions = new Map([...sharedDefinitions, ...definitionsIn(sourceFile)]);
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression.getText(sourceFile);
      const method = node.expression.name.text.toUpperCase();
      if ((owner === 'app' || owner === 'server') && ['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
        const routeNode = node.arguments[0];
        const handlers = node.arguments.slice(1)
          .map((arg) => expandedHandlerText(arg, sourceFile, definitions))
          .join('\n');
        const routes = routeNode && ts.isArrayLiteralExpression(routeNode)
          ? routeNode.elements.map(literalText).filter(Boolean)
          : routeNode && ts.isStringLiteralLike(routeNode)
            ? [routeNode.text]
            : routeNode && ts.isIdentifier(routeNode) && definitions.has(routeNode.text)
              ? routeFromDefinitionText(definitions.get(routeNode.text))
            : routeNode
              ? [`<pattern: ${routeNode.getText(sourceFile)}>`]
              : [];
        for (const route of routes) {
          rows.push({
            method,
            path: route,
            group: groupFor(file),
            layer: 'direct-express',
            access: directAccess(file, route),
            inputs: extractInputs(handlers),
            responses: extractResponses(handlers),
            source: { file, line: lineOf(sourceFile, node), url: sourceUrl(file, lineOf(sourceFile, node)) },
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return rows;
}

const managerFiles = git('ls-tree', '-r', '--name-only', baseline, '--', 'src/server/ApiManagers')
  .split(/\r?\n/)
  .filter((file) => file.endsWith('Manager.ts') && !file.endsWith('ApiManager.ts'));
const supervisedFiles = ['src/server/index.ts', ...managerFiles];
const directFiles = matchingSourceFiles(
  String.raw`\b(app|server)\.(get|post|patch|delete)\s*\(`,
  'src/server'
);
const routes = [];
const authenticationSource = sourceAt('src/server/authentication/AuthenticationManager.ts');
const authenticationFile = ts.createSourceFile(
  'src/server/authentication/AuthenticationManager.ts',
  authenticationSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
const sharedDirectDefinitions = definitionsIn(authenticationFile);

for (const file of supervisedFiles) {
  const source = sourceAt(file);
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  routes.push(...supervisedRoutes(file, sourceFile));
}

for (const file of directFiles) {
  const source = sourceAt(file);
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  routes.push(...directRoutes(file, sourceFile, sharedDirectDefinitions));
}

routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method) || a.source.file.localeCompare(b.source.file));

const duplicateKeys = [...new Set(routes.map((route) => `${route.method} ${route.path}`))]
  .filter((key) => routes.filter((route) => `${route.method} ${route.path}` === key).length > 1);
const output = {
  schemaVersion: 1,
  repository: {
    remote,
    baseline,
  },
  methodology: {
    supervisedCandidateFiles: supervisedFiles.length,
    directCandidateFiles: directFiles.length,
    directOwnerNames: ['app', 'server'],
  },
  summary: {
    routes: routes.length,
    supervised: routes.filter((route) => route.layer === 'supervised').length,
    direct: routes.filter((route) => route.layer === 'direct-express').length,
    public: routes.filter((route) => route.access.includes('public')).length,
    admin: routes.filter((route) => route.access === 'admin-in-release').length,
    duplicateMethodPaths: duplicateKeys.length,
  },
  duplicateMethodPaths: duplicateKeys,
  routes,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'http-routes.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(
  `Built HTTP route reference: ${output.summary.routes} routes ` +
  `(${output.summary.supervised} supervised, ${output.summary.direct} direct, ` +
  `${output.summary.duplicateMethodPaths} duplicate method/path registrations).`
);
