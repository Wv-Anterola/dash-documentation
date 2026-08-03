import ts from 'typescript';

const TS_KINDS = new Map([
  [ts.SyntaxKind.ClassDeclaration, 'class'],
  [ts.SyntaxKind.InterfaceDeclaration, 'interface'],
  [ts.SyntaxKind.FunctionDeclaration, 'function'],
  [ts.SyntaxKind.EnumDeclaration, 'enum'],
  [ts.SyntaxKind.TypeAliasDeclaration, 'type'],
  [ts.SyntaxKind.MethodDeclaration, 'method'],
  [ts.SyntaxKind.MethodSignature, 'method'],
  [ts.SyntaxKind.PropertyDeclaration, 'property'],
  [ts.SyntaxKind.PropertySignature, 'property'],
  [ts.SyntaxKind.GetAccessor, 'getter'],
  [ts.SyntaxKind.SetAccessor, 'setter'],
  [ts.SyntaxKind.Constructor, 'constructor'],
]);

const scriptKind = (path) => {
  if (/\.tsx$/i.test(path)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(path)) return ts.ScriptKind.JSX;
  if (/\.(mjs|cjs|js)$/i.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

const textOfName = (name, sourceFile) => {
  if (!name) return '';
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
  return name.getText(sourceFile).replace(/\s+/g, ' ');
};

const modifierFlags = (node) =>
  ts.canHaveModifiers(node) ? ts.getCombinedModifierFlags(node) : ts.ModifierFlags.None;

const isExported = (node) => {
  const flags = modifierFlags(node);
  return Boolean(flags & (ts.ModifierFlags.Export | ts.ModifierFlags.Default));
};

const visibilityOf = (node) => {
  const flags = modifierFlags(node);
  if (flags & ts.ModifierFlags.Private) return 'private';
  if (flags & ts.ModifierFlags.Protected) return 'protected';
  return 'public';
};

const documentationOf = (node, sourceFile) => {
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) ?? [];
  const docs = ranges
    .filter((range) => sourceFile.text.slice(range.pos, range.end).startsWith('/**'))
    .map((range) => sourceFile.text.slice(range.pos + 3, range.end - 2)
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim())
    .filter(Boolean);
  return docs.at(-1) ?? '';
};

const signatureOf = (node, sourceFile) => {
  let end = node.end;
  if (node.body) end = node.body.pos;
  else if (node.initializer) end = node.initializer.pos;
  const raw = sourceFile.text.slice(node.getStart(sourceFile), end)
    .replace(/\s+/g, ' ')
    .replace(/\s*{\s*$/, '')
    .trim();
  return raw.length > 600 ? `${raw.slice(0, 597)}...` : raw;
};

const expressionName = (expression, sourceFile) => {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.getText(sourceFile);
  if (ts.isElementAccessExpression(expression)) return expression.getText(sourceFile);
  return '';
};

export function parseTypeScriptBlob({ sha, path, text, mode = 'full' }) {
  const includeGraphDetail = mode === 'full';
  const sourceFile = ts.createSourceFile(
    path,
    text,
    { languageVersion: ts.ScriptTarget.Latest, jsDocParsingMode: ts.JSDocParsingMode.ParseAll },
    true,
    scriptKind(path)
  );
  const symbols = [];
  const calls = [];
  const imports = [];
  const enums = {};
  const containers = [];
  let currentSymbol = '';

  const addDeclaration = (node, name, kind) => {
    const qualifiedName = [...containers, name].filter(Boolean).join('.');
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.end);
    const record = {
      name,
      qualifiedName,
      kind,
      signature: signatureOf(node, sourceFile),
      visibility: visibilityOf(node),
      exported: isExported(node),
      documentation: documentationOf(node, sourceFile),
      lineStart: start.line + 1,
      lineEnd: end.line + 1,
    };
    symbols.push(record);
    return record;
  };

  const visit = (node) => {
    if (includeGraphDetail && (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))) {
      const specifier = node.moduleSpecifier;
      if (specifier && ts.isStringLiteralLike(specifier)) imports.push(specifier.text);
    }

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const record = addDeclaration(
          declaration,
          declaration.name.text,
          containers.length ? 'property' : 'variable'
        );
        if (isExported(node)) record.exported = true;
      }
    }

    const declarationKind = TS_KINDS.get(node.kind);
    let declaration;
    if (declarationKind) {
      const fallback = ts.isConstructorDeclaration(node) ? 'constructor' : '';
      const name = textOfName(node.name, sourceFile) || fallback;
      if (name) declaration = addDeclaration(node, name, declarationKind);
      if (includeGraphDetail && declaration && ts.isEnumDeclaration(node)) {
        enums[declaration.qualifiedName] = node.members.map((member) => ({
          name: textOfName(member.name, sourceFile),
          value: member.initializer?.getText(sourceFile) ?? null,
          line: sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1,
        }));
      }
    }

    if (includeGraphDetail && ts.isCallExpression(node) && currentSymbol) {
      const target = expressionName(node.expression, sourceFile);
      if (target) {
        calls.push({
          from: currentSymbol,
          to: target,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        });
      }
    }

    const createsContainer =
      declaration &&
      (ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node));

    if (createsContainer) {
      const previous = currentSymbol;
      currentSymbol = declaration.qualifiedName;
      containers.push(declaration.name);
      ts.forEachChild(node, visit);
      containers.pop();
      currentSymbol = previous;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return {
    sha,
    path,
    symbols,
    calls,
    imports: [...new Set(imports)].sort(),
    enums,
    errors: [],
    diagnostics: sourceFile.parseDiagnostics.map((diagnostic) => {
      const position = diagnostic.start ?? 0;
      const location = sourceFile.getLineAndCharacterOfPosition(position);
      return {
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        line: location.line + 1,
        column: location.character + 1,
      };
    }),
  };
}

export function parseTypeScriptHistoryBlob({ sha, path, text }) {
  const sourceFile = ts.createSourceFile(
    path,
    text,
    { languageVersion: ts.ScriptTarget.Latest, jsDocParsingMode: ts.JSDocParsingMode.ParseNone },
    false,
    scriptKind(path)
  );
  const symbols = [];
  const containers = [];

  const addDeclaration = (name, kind) => {
    if (!name) return null;
    const record = {
      name,
      qualifiedName: [...containers, name].filter(Boolean).join('.'),
      kind,
    };
    symbols.push(record);
    return record;
  };

  const visit = (node) => {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        addDeclaration(declaration.name.text, containers.length ? 'property' : 'variable');
      }
    }

    const declarationKind = TS_KINDS.get(node.kind);
    let declaration = null;
    if (declarationKind) {
      const fallback = ts.isConstructorDeclaration(node) ? 'constructor' : '';
      declaration = addDeclaration(textOfName(node.name, sourceFile) || fallback, declarationKind);
    }

    const createsContainer =
      declaration &&
      (ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node));

    if (createsContainer) {
      containers.push(declaration.name);
      ts.forEachChild(node, visit);
      containers.pop();
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return {
    sha,
    path,
    symbols,
    errors: [],
    diagnostics: sourceFile.parseDiagnostics.map((diagnostic) => {
      const position = diagnostic.start ?? 0;
      const location = sourceFile.getLineAndCharacterOfPosition(position);
      return {
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        line: location.line + 1,
        column: location.character + 1,
      };
    }),
  };
}

export function parseJsonConfiguration(path, text) {
  const normalized = path.replaceAll('\\', '/').toLowerCase();
  const acceptsComments =
    /(^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(normalized) ||
    /(^|\/)jsconfig\.json$/.test(normalized) ||
    normalized.includes('/.vscode/') ||
    normalized.startsWith('.vscode/');

  if (acceptsComments) {
    const result = ts.parseConfigFileTextToJson(path, text);
    if (!result.error) return { ok: true, error: null };
    return {
      ok: false,
      error: ts.flattenDiagnosticMessageText(result.error.messageText, '\n'),
    };
  }

  try {
    JSON.parse(text);
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Invalid JSON in ${path}`,
    };
  }
}

export const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py',
  '.java', '.kt', '.kts', '.go', '.rs', '.c', '.cc', '.cpp', '.h', '.hpp',
  '.cs', '.swift', '.rb', '.php', '.sh', '.ps1', '.vue', '.svelte',
]);

export const PARSED_TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export const extensionOf = (path) =>
  path.toLowerCase().match(/(\.[a-z0-9]+)$/)?.[1] ?? '';

export function classifyPath(path) {
  const normalized = path.replaceAll('\\', '/');
  const lower = normalized.toLowerCase();
  const name = lower.split('/').at(-1) ?? lower;
  const extension = extensionOf(lower);

  if (/(^|\/)(node_modules|vendor|third_party|external)(\/|$)/.test(lower)) return 'vendored';
  if (/(^|\/)(dist|build|coverage|storybook-static|generated)(\/|$)/.test(lower) ||
      /\.(min|bundle)\.(js|css)$/.test(lower) ||
      ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(name)) {
    return 'generated';
  }
  if (/(^|\/)(__tests__|tests?|e2e|specs?|fixtures)(\/|$)/.test(lower) ||
      /\.(test|spec)\.[^.]+$/.test(lower)) return 'test';
  if (/\.(png|jpe?g|gif|webp|svg|ico|mp4|webm|mov|mp3|wav|ogg|woff2?|ttf|otf|pdf|psd)$/.test(lower)) {
    return 'media';
  }
  if (/(^|\/)(research|papers?|publications?|artifacts?|evaluations?|evals?)(\/|$)/.test(lower) ||
      /\.(bib|ris|cff)$/.test(lower)) return 'research-artifact';
  if (
    /(^|\/)(scripts?|config|configs?|deploy|docker|\.github|\.vscode)(\/|$)/.test(lower) ||
    /(^|\/)(electron-main|webpack|vite|astro|playwright|eslint|prettier|stylelint|tsconfig)/.test(lower) ||
    /\.(ya?ml|toml|ini|env|config\.[^.]+)$/.test(lower) ||
    ['dockerfile', 'makefile', 'procfile', 'package.json', 'jsconfig.json'].includes(name)
  ) return 'build-config';
  if (SOURCE_EXTENSIONS.has(extension)) return 'source';
  if (/\.(csv|tsv|json|jsonl|ndjson|xml|parquet|sqlite|db)$/.test(lower)) return 'data';
  return 'artifact';
}

export function sourceUrl(remote, commit, path, lineStart, lineEnd = lineStart) {
  const webRemote = remote
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
    .replace(/\.git$/, '');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${webRemote}/blob/${commit}/${encodedPath}#L${lineStart}-L${lineEnd}`;
}
