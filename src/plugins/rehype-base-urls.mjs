/**
 * Prefix site-root-absolute URLs in content with the configured `base`.
 *
 * Astro rewrites links it generates, but leaves `/foo/` written by hand in
 * Markdown or MDX alone. With `base: '/Dash-Documentation'` that produces a
 * 404 in production and works in dev, which is the worst possible failure mode.
 *
 * Handling it here means authors write ordinary site-root paths
 * (`/concepts/documents/`, `/assets/x.png`) and never think about the base.
 * Protocol-relative and external URLs are left alone.
 */
import { visit } from 'unist-util-visit';

const ATTRS = { a: 'href', img: 'src', source: 'src', iframe: 'src', video: 'src' };

export function rehypeBaseUrls({ base = '/' } = {}) {
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;

  return (tree) => {
    if (!prefix) return;
    visit(tree, 'element', (node) => {
      const attr = ATTRS[node.tagName];
      if (!attr) return;
      const value = node.properties?.[attr];
      if (typeof value !== 'string') return;
      // Only site-root paths. Skip //host, external, anchors, and anything
      // already carrying the prefix.
      if (!value.startsWith('/')) return;
      if (value.startsWith('//')) return;
      if (value.startsWith(`${prefix}/`)) return;
      node.properties[attr] = prefix + value;
    });
  };
}
