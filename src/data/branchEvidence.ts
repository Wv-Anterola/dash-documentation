import audit from './generated/branch-audit.json';
import type { Project } from './dash';

export type BranchAuditRow = (typeof audit.branches)[number];

const master = audit.branches.find((branch) => branch.name === 'origin/master');

export function branchesForProject(project: Project): BranchAuditRow[] {
  const text = [
    project.title,
    project.approach,
    project.contribution,
    project.relation,
    project.outcome,
    project.evidence,
    project.code,
  ].filter(Boolean).join(' ');

  const rows = audit.branches.filter(
    (branch) =>
      branch.shortName !== 'master' &&
      new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(branch.shortName)}([^A-Za-z0-9_-]|$)`).test(text)
  );

  if (project.status === 'integrated' && master) rows.unshift(master);
  return rows;
}

export function branchAuditSummary() {
  return audit.methodology;
}

export function branchAnchor(branch: Pick<BranchAuditRow, 'displayName'>) {
  return `branch-${branch.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export function branchRecordSlug(fullName: string) {
  return fullName
    .replace(/^refs\//, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function branchRecordHref(fullName: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/research/implementation/${branchRecordSlug(fullName)}/`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
