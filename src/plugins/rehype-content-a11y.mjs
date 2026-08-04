/**
 * Two accessibility fixups that markdown cannot express on its own.
 *
 * Both are things an author would have to remember on every page, which is
 * exactly the kind of obligation that gets dropped. Doing them here means a
 * contributor writes ordinary markdown and the output is still correct.
 *
 * 1. **Table header scope.** GitHub-flavoured markdown renders `<th>` with no
 *    `scope`, leaving a screen reader to infer the association between a cell
 *    and its header. The inference is usually right for a small table and
 *    wrong for a wide one, and this site is full of wide ones.
 *
 * 2. **Task-list checkboxes.** A `- [ ]` item renders as a disabled checkbox
 *    with no accessible name, so a screen reader announces a checkbox and
 *    then, separately, some text, without saying which one it belongs to.
 *    Naming it from the item's own text restores the connection.
 *
 * Anything that already declares `scope` or an accessible name is left alone,
 * so a component can still be more specific than this.
 */
import { visit } from 'unist-util-visit';

/** Readable text of a hast subtree, for use as an accessible name. */
function textOf(node) {
  if (node.type === 'text') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(textOf).join('');
}

export function rehypeContentA11y() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'table') {
        for (const section of node.children ?? []) {
          if (section.type !== 'element') continue;
          const inHead = section.tagName === 'thead';
          for (const row of section.children ?? []) {
            if (row.type !== 'element' || row.tagName !== 'tr') continue;
            for (const cell of row.children ?? []) {
              if (cell.type !== 'element' || cell.tagName !== 'th') continue;
              cell.properties ??= {};
              if (cell.properties.scope) continue;
              cell.properties.scope = inHead ? 'col' : 'row';
            }
          }
        }
        return;
      }

      if (node.tagName !== 'li') return;
      const checkbox = (node.children ?? []).find(
        (child) => child.type === 'element' && child.tagName === 'input' && child.properties?.type === 'checkbox'
      );
      if (!checkbox) return;
      checkbox.properties ??= {};
      if (checkbox.properties.ariaLabel || checkbox.properties['aria-label']) return;
      const label = node.children
        .filter((child) => child !== checkbox)
        .map(textOf)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      checkbox.properties['aria-label'] = label || (checkbox.properties.checked ? 'Item complete' : 'Item not complete');
    });
  };
}
