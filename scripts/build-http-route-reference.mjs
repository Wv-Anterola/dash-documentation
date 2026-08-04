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

/**
 * The comment a developer left above a route registration.
 *
 * Roughly half the registrations in Dash-Web carry one, and none of it has ever
 * reached this site: the reference could state a route's method, inputs, and
 * responses while the one sentence explaining its purpose sat three lines above
 * in the same file. This recovers that sentence rather than inventing one.
 */
function leadingComment(node, sourceFile) {
  const full = sourceFile.getFullText();
  // Walk out to the enclosing statement: the comment sits above `register({`,
  // not above the object literal the caller hands this function.
  let target = node;
  while (target.parent && !ts.isStatement(target) && !ts.isPropertyAssignment(target)) target = target.parent;
  const ranges = ts.getLeadingCommentRanges(full, target.pos) ?? [];
  const text = ranges
    .map((range) => full.slice(range.pos, range.end))
    .join('\n')
    .replace(/^\s*\/\*\*?/gm, '')
    .replace(/\*\/\s*$/gm, '')
    .replace(/^\s*\*\s?/gm, '')
    .replace(/^\s*\/\/\s?/gm, '')
    .replace(/^\s*eslint-disable.*$/gm, '')
    // Tag lines describe parameters that the inputs field already lists.
    .replace(/^\s*@\w+.*$/gm, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  return text.length > 600 ? `${text.slice(0, 599)}...` : text;
}

const callIgnored = new Set([
  'if', 'for', 'return', 'map', 'filter', 'forEach', 'push', 'includes', 'indexOf', 'split', 'join', 'trim',
  'toString', 'toLowerCase', 'startsWith', 'endsWith', 'then', 'catch', 'require', 'String', 'Number', 'Boolean',
  'JSON.stringify', 'JSON.parse', 'Object.keys', 'Object.values', 'Object.entries', 'Array.isArray', 'console.log',
  'console.error', 'console.warn', 'Promise.all', 'Math.max', 'Math.min', 'Math.round', 'Error', 'Date',
  // The regex matches any identifier followed by `(`, which control-flow
  // keywords also are. They are not calls and must not read as evidence.
  'while', 'switch', 'async', 'await', 'function', 'typeof', 'delete', 'new', 'throw', 'yield', 'super', 'void',
  'do', 'else', 'try', 'finally', 'in', 'of', 'case', 'not',
]);

/** Notable calls inside a handler, as evidence of what the route actually does. */
function extractCalls(text) {
  const names = new Set();
  for (const match of text.matchAll(/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/g)) {
    const name = match[1];
    const tail = name.split('.').pop() ?? name;
    if (callIgnored.has(name) || callIgnored.has(tail)) continue;
    if (/^(res|req)\./.test(name)) continue;
    names.add(name);
  }
  return [...names].sort().slice(0, 14);
}

/**
 * What a route touches, in the terms someone worrying about a route cares
 * about. Derived from the handler text, so it is evidence rather than a label
 * applied by hand.
 */
function classifyEffects(text) {
  return {
    database: /\bDatabase\.|\bmongo|dropSchema|\bWebSocket\.do/i.test(text),
    filesystem: /\bfs\.|writeFile|readFile|mkdirSync|rimraf|createWriteStream|createReadStream|unlink/i.test(text),
    network: /\baxios\b|\bfetch\(|node-fetch|https?\.get\(|https?\.request\(/i.test(text),
    process: /\bexec\(|execSync|spawn\(|spawnSync|child_process/i.test(text),
    externalModel: /openai|anthropic|\bgpt|firefly|gemini|replicate|stability/i.test(text),
  };
}

/**
 * Reviewed purpose for each route family.
 *
 * Written per group rather than per route on purpose. A group is one file with
 * one job, which is a claim a reader can check by opening it; 109 invented
 * per-route sentences would be 109 chances to be confidently wrong about code
 * nobody documented. Generation fails when a group appears with no purpose, or
 * a purpose outlives its group.
 */
const groupPurposes = {
  'Shell and diagnostics': 'Serves the application shell itself and the operator-facing pages around it: the root document, the admin surface, and per-document entry points.',
  'Authentication and assets': 'Signup, login, logout, and password reset, plus the script bundle and stylesheet the browser needs before any of that can run.',
  'User and activity': 'Reads about the current user and the workspace state attached to them, including the identifiers a client needs before it can resolve sharing and links.',
  'Monitored-session operations': 'Operator controls for a running server session, keyed by a session key rather than by a user: backup, debug output, and session teardown.',
  'Adobe and video generation': 'Drives Adobe Firefly and the video-generation pipeline, including cancelling work already in flight and polling what is still running.',
  'Assistant and ingestion': 'Everything the assistant needs to turn outside material into Dash documents: capturing pages, chunking and formatting text, and creating the documents.',
  'Uploads and media': 'Accepts files into the server, inspects and transcodes media, and answers whether the server is reachable.',
  'Data and visualization': 'Supplies tabular data to the visualization documents.',
  'Deletion utilities': 'Destructive operator routes that drop database contents, uploaded files, or both. Admin-gated in a release build.',
  'Dynamic agent tools': 'Stores and serves the agent tools that are defined at runtime rather than compiled into the client.',
  'Google services': 'Proxies Google Docs and Google Tasks so the credentials stay on the server rather than in the browser.',
  'Model services': 'The general model endpoints: completion, embedding, image description, and the smaller model-backed helpers.',
  'Flashcard labeling': 'Labels flashcard content for the study features.',
  'Repository utilities': 'Reports the running version and pulls the repository, which is how a deployment is updated in place.',
  'Video stitching': 'Submits, tracks, and health-checks the video stitching jobs that run outside the request that started them.',
};

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
              docComment: leadingComment(config, sourceFile),
              calls: extractCalls(text),
              effects: classifyEffects(text),
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
            docComment: leadingComment(node, sourceFile),
            calls: extractCalls(handlers),
            effects: classifyEffects(handlers),
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

const presentGroups = [...new Set(routes.map((route) => route.group))].sort();
const groupDrift = [
  ...presentGroups.filter((group) => !groupPurposes[group]).map((group) => `route group "${group}" has no reviewed purpose`),
  ...Object.keys(groupPurposes).filter((group) => !presentGroups.includes(group)).map((group) => `reviewed purpose for "${group}" outlived its routes`),
];
if (groupDrift.length) throw new Error(`The HTTP route families drifted:\n  ${groupDrift.join('\n  ')}`);

const groups = presentGroups.map((group) => {
  const members = routes.filter((route) => route.group === group);
  return {
    name: group,
    purpose: groupPurposes[group],
    routes: members.length,
    documented: members.filter((route) => route.docComment).length,
    files: [...new Set(members.map((route) => route.source.file))],
    // Worth surfacing per family: these are the questions a reader asks before
    // reading any single route in it.
    touchesDatabase: members.some((route) => route.effects.database),
    touchesFilesystem: members.some((route) => route.effects.filesystem),
    reachesOutward: members.some((route) => route.effects.network || route.effects.externalModel),
    runsProcesses: members.some((route) => route.effects.process),
  };
});
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
    docComments: 'Recovered from the comment above each registration in Dash-Web, not written here. A route with no comment is reported as having none',
    calls: 'Notable calls inside the handler, with the handler expanded through same-file helper definitions',
    effects: 'Database, filesystem, outbound network, subprocess, and external-model contact, classified from the expanded handler text',
    groupPurpose: 'Reviewed per family rather than per route: a family is one file with one job, which a reader can check',
    driftRule: 'Generation fails when a route family appears without a reviewed purpose, or a reviewed purpose outlives its family',
  },
  summary: {
    routes: routes.length,
    supervised: routes.filter((route) => route.layer === 'supervised').length,
    direct: routes.filter((route) => route.layer === 'direct-express').length,
    public: routes.filter((route) => route.access.includes('public')).length,
    admin: routes.filter((route) => route.access === 'admin-in-release').length,
    duplicateMethodPaths: duplicateKeys.length,
    groups: groups.length,
    documented: routes.filter((route) => route.docComment).length,
    withCalls: routes.filter((route) => route.calls.length).length,
    touchDatabase: routes.filter((route) => route.effects.database).length,
    touchFilesystem: routes.filter((route) => route.effects.filesystem).length,
    reachOutward: routes.filter((route) => route.effects.network || route.effects.externalModel).length,
    runProcesses: routes.filter((route) => route.effects.process).length,
  },
  duplicateMethodPaths: duplicateKeys,
  groups,
  routes,
};

const outputPath = path.join(root, 'src', 'data', 'generated', 'http-routes.json');
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(
  `Built HTTP route reference: ${output.summary.routes} routes in ${output.summary.groups} explained families ` +
  `(${output.summary.supervised} supervised, ${output.summary.direct} direct, ` +
  `${output.summary.duplicateMethodPaths} duplicate method/path registrations); ` +
  `${output.summary.documented} carry a comment recovered from source, ${output.summary.withCalls} have traced calls; ` +
  `${output.summary.touchDatabase} touch the database, ${output.summary.touchFilesystem} the filesystem, ` +
  `${output.summary.reachOutward} reach outside the server, ${output.summary.runProcesses} run a subprocess.`
);
