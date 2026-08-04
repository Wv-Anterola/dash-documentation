import reference from './generated/source-modules.json';

export type SourceModule = (typeof reference.modules)[number];
export type SourceSymbol = SourceModule['symbols'][number];

export { reference };

export function moduleSlug(path: string): string {
  return path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function siteHref(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function moduleHref(path: string): string {
  return siteHref(`/technical/api/modules/${moduleSlug(path)}/`);
}

/**
 * Build the exact, collision-safe fragment identifiers used on one generated
 * module page. The declaration object is retained as the key because a source
 * file may legally contain repeated local names and the generator preserves
 * those occurrences separately.
 */
export function sourceSymbolAnchors(module: SourceModule): Map<SourceSymbol, string> {
  const counts = new Map<string, number>();
  const anchors = new Map<SourceSymbol, string>();

  for (const symbol of module.symbols) {
    const base = moduleSlug(symbol.qualifiedName);
    const occurrence = (counts.get(base) ?? 0) + 1;
    counts.set(base, occurrence);
    anchors.set(symbol, occurrence === 1 ? base : `${base}-${occurrence}`);
  }

  return anchors;
}

export function sourceSymbolHref(module: SourceModule, symbol: SourceSymbol): string {
  const anchor = sourceSymbolAnchors(module).get(symbol);
  if (!anchor) throw new Error(`Unable to build an anchor for ${symbol.id}`);
  return `${moduleHref(module.path)}#${anchor}`;
}

export function immutableSourceHref(path: string): string {
  const normalized = path.replaceAll('\\', '/');
  const module = reference.modules.find((candidate) =>
    candidate.path === normalized ||
    (normalized.endsWith('/') && candidate.path.startsWith(normalized))
  );
  if (module) return module.symbols[0]?.sourceUrl ?? moduleHref(module.path);
  const remote = reference.repository.remote
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '');
  return `${remote}/tree/${reference.repository.baselineTip}/${normalized
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')}`;
}

export function registryCounts() {
  return Object.fromEntries(
    Object.entries(reference.registries).map(([name, rows]) => [name, rows.length])
  ) as Record<keyof typeof reference.registries, number>;
}
