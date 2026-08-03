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

export function moduleHref(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/technical/api/modules/${moduleSlug(path)}/`;
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
