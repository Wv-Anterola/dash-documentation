/**
 * The single source of truth for cohorts, projects, concepts, and people.
 *
 * This replaces five YAML files that were read through Liquid lookups. The
 * reason for the change is not tidiness: the Liquid version resolved project
 * references by string match at render time, so a mistyped project title
 * produced an HTML comment and a silently missing reference. Here a bad
 * reference is a type error, and `validate()` turns a broken cross-link into a
 * failed build.
 *
 * To add a cohort or project, edit this file. Nothing else needs to change:
 * the project index, the cohort pages, the concept evidence tables, and the
 * roster lists all read from here.
 */

import { projects } from './projects';

export { projects };

export type StatusKey =
  | 'integrated'
  | 'implemented'
  | 'prototype'
  | 'archived'
  | 'docs-only'
  | 'unclear';

export type ConceptId =
  | 'documents'
  | 'collections'
  | 'links'
  | 'trails'
  | 'agents'
  | 'generative';

export type CohortId = '2026' | '2025' | '2024' | '2023' | '2021-2022' | '2019-2020';

export interface Status {
  key: StatusKey;
  label: string;
  blurb: string;
}

export interface Concept {
  id: ConceptId;
  title: string;
  slug: string;
  summary: string;
}

export interface Cohort {
  id: CohortId;
  title: string;
  short: string;
  current?: boolean;
  start: string;
  end: string;
  commits: number;
  summary: string;
  roster: string[];
}

export interface Project {
  title: string;
  cohort: CohortId;
  status: StatusKey;
  area: string;
  concepts: ConceptId[];
  people?: string[];
  peopleUnresolved?: string;
  problem: string;
  approach?: string;
  contribution?: string;
  relation?: string;
  outcome?: string;
  evidence?: string;
  tech?: string[];
  code?: string;
}

/* ------------------------------------------------------------------ status */

// "integrated" requires evidence in the current Dash-Web `master` branch. A
// merged branch, a screenshot, or a finished report is not sufficient on its
// own; each project records what was actually checked in `evidence`.
export const statuses: Status[] = [
  {
    key: 'integrated',
    label: 'Integrated',
    blurb:
      'Present in the current Dash application and reachable from the interface. Verified against `master`: a registered document type, collection view, agent tool, or a code path called by one of those.',
  },
  {
    key: 'implemented',
    label: 'Implemented, not integrated',
    blurb:
      'Working code exists on a branch or in a separate harness, but it is not merged into `master` and does not run in the application people use.',
  },
  {
    key: 'prototype',
    label: 'Prototype or exploration',
    blurb:
      'A partial implementation, experiment, or study instrument. Enough exists to demonstrate or measure something; it was not built to ship as a feature.',
  },
  {
    key: 'archived',
    label: 'Archived or superseded',
    blurb:
      'Was part of Dash at some point and is not any more, either removed outright or replaced by a later system.',
  },
  {
    key: 'docs-only',
    label: 'Documentation only',
    blurb:
      'Described in documentation or a report, but no corresponding implementation was identified during the source audit.',
  },
  {
    key: 'unclear',
    label: 'Status unclear',
    blurb:
      'Evidence is thin or points in two directions. Listed so it is not silently dropped, and so someone who knows can correct it.',
  },
];

/* ---------------------------------------------------------------- concepts */

export const concepts: Concept[] = [
  {
    id: 'documents',
    title: 'Documents and fields',
    slug: 'concepts/documents',
    summary:
      'Every piece of content in Dash is a document, including collections and the links between them. What varies is the type and the fields.',
  },
  {
    id: 'collections',
    title: 'Collections and views',
    slug: 'concepts/collections',
    summary:
      'A collection is a document that holds other documents. How it displays them is a property, so switching layout converts nothing.',
  },
  {
    id: 'links',
    title: 'Links and anchors',
    slug: 'concepts/links',
    summary:
      'A link can start or end at a region, a selection, or a timestamp rather than a whole file, and the link is itself a document.',
  },
  {
    id: 'trails',
    title: 'Trails',
    slug: 'concepts/trails',
    summary:
      'A prepared path through a corpus that you can leave at any point to follow links by association instead.',
  },
  {
    id: 'agents',
    title: 'Agents and tools',
    slug: 'concepts/agents',
    summary:
      'A registry of tools a language model can call, several of which write to the shared workspace, and what that implies for trust.',
  },
  {
    id: 'generative',
    title: 'Generative media',
    slug: 'concepts/generative',
    summary:
      'Model-generated images, video, charts, and text produced inside documents rather than pasted into them.',
  },
];

/* ----------------------------------------------------------------- cohorts */

// Rosters come from commit authorship in Dash-Web over each date range,
// cross-checked against the team list the site carried from 2021. Git is the
// stronger source: the old team page omitted most 2019-2020 contributors.
export const cohorts: Cohort[] = [
  {
    id: '2026',
    title: 'Spring 2026 to Fall 2026',
    short: 'Spring/Fall 2026',
    current: true,
    start: '2026-01',
    end: '2026-12',
    commits: 937,
    summary:
      'The largest single-year push since 2020, and the first where most of the work sits on top of the agent rather than beside it. Six student projects landed in `master` this year, and Dash also grew a desktop build that can run models locally instead of calling OpenAI.',
    roster: [
      'Wilber Sean Anterola',
      'McCormick Breviu',
      'Jacob Elson',
      'Joanne Ding',
      'Eleanor Park',
      'A.J. Shulman',
      'Kartik Shrivastava',
      'Lanyi Stroud',
      'Aura Sukapanpotharam',
      'Thu Vu',
      'Finn Wilkie',
      'Camden Wright',
      'Nathan Robbins',
      'Alicia Yoon',
    ],
  },
  {
    id: '2025',
    title: 'Spring 2025 to Fall 2025',
    short: 'Spring/Fall 2025',
    start: '2025-01',
    end: '2025-12',
    commits: 1324,
    summary:
      'The year the chatbot turned into an agent with a real tool registry. Work split between extending what the agent could touch (canvas contents, the UI itself, the codebase) and adding document types around it.',
    roster: [
      'Semir Ali',
      'Joanne Ding',
      'Alyssa Feinberg',
      'Aisosa Idahosa',
      'Aarav Kumar',
      'Samuel Kurtis',
      'Eleanor Park',
      'Nathan Robbins',
      'A.J. Shulman',
      'Kartik Shrivastava',
      'Lanyi Stroud',
      'Thu Vu',
      'Zachary Zhang',
      'GitHub user Skitty1238',
    ],
  },
  {
    id: '2024',
    title: 'Spring 2024 to Fall 2024',
    short: 'Spring/Fall 2024',
    start: '2024-01',
    end: '2024-12',
    commits: 1792,
    summary:
      'Generative AI moved from a novelty attached to text nodes into several parts of the system at once: drawing, data visualisation, presentation transitions, and a first pass at an assistant that could act on documents.',
    roster: [
      'Alyssa Feinberg',
      'Aisosa Idahosa',
      'Alina Kim',
      'Geireann Lindfield Roberts',
      'Eric Ma',
      'Eleanor Park',
      'Emily Perelman',
      'Sarah Richman',
      'Nathan Robbins',
      'Jesus Rodriguez',
      'A.J. Shulman',
      'Zaul Tavangar',
      'Zachary Zhang',
      'Sophie Zhang',
    ],
  },
  {
    id: '2023',
    title: 'Spring 2023 to Fall 2023',
    short: 'Spring/Fall 2023',
    start: '2023-01',
    end: '2023-12',
    commits: 1594,
    summary:
      'Dash picked up its first LLM features and several new document types, and the group started using it in CS1951V, which produced the student use-case videos still linked from the overview.',
    roster: [
      'Brynn Chernosky',
      'Michael Foiani',
      'James Hu',
      'Mehek Jethani',
      'Alina Kim',
      'Geireann Lindfield Roberts',
      'Eric Ma',
      'Emily Perelman',
      'Sarah Richman',
      'Jesus Rodriguez',
      'Zaul Tavangar',
      'Sophie Zhang',
    ],
  },
  {
    id: '2021-2022',
    title: '2021 to 2022',
    short: '2021-2022',
    start: '2021-01',
    end: '2022-12',
    commits: 2374,
    summary:
      'Consolidation. Releases 0.4 through 0.8 came out of this period, the documentation site was created, and a separate component library was split out so the UI stopped being re-invented per feature.',
    roster: [
      'Anika Ahluwalia',
      'Naafiyan Ahmed',
      'Ashley Cai',
      'Brynn Chernosky',
      'Lauren Choi',
      'Michael Foiani',
      'David Grossman',
      'Lionel Han',
      'Mehek Jethani',
      'Victor Kalev',
      'Aubrey Li',
      'Vivian Li',
      'Geireann Lindfield Roberts',
      'Parker Ljung',
      'Udayveer Sodhi',
      'Anh Truong',
      'Jenny Yu',
    ],
  },
  {
    id: '2019-2020',
    title: '2019 to 2020',
    short: '2019-2020',
    start: '2018-12',
    end: '2020-12',
    commits: 8539,
    summary:
      "The founding period. The repository's first commit is December 2018, and the two years after it established nearly everything the system still rests on: the document model, freeform collections, links and annotations, and the collection view types.",
    roster: [
      'Anika Ahluwalia',
      'Mohammad Amoush',
      'Hannah Chow',
      'Philipp Eichmann',
      'Eleanor Eng',
      'Lionel Han',
      'Monika Hedman',
      'Yuna Hiraide',
      'Andrew Kim',
      'Geireann Lindfield Roberts',
      'Andrew Rickert',
      'Tyler Schicke',
      'Udayveer Sodhi',
      'Sam Wilkins',
      'Melissa Zhang',
      'Stanley Yip',
    ],
  },
];

/** 2019-2020 commit authors we could not resolve to a full name. */
export const unresolvedContributors = [
  'ab',
  'Fawn',
  'Jude',
  'kimdahey',
  'loudonclear',
  'madelinegr',
  'vellichora',
];

export const faculty = [
  { name: 'Andries van Dam', role: 'Principal investigator', email: 'andries_van_dam@brown.edu' },
  { name: 'Bob Zeleznik', role: 'Research director' },
  { name: 'Norm Meyrowitz', role: 'Adviser' },
  { name: 'Joseph LaViola', role: 'Adviser' },
  { name: 'Rosemary Simpson', role: 'Adviser' },
];

/* ---------------------------------------------------------------- helpers */

export function statusOf(key: StatusKey): Status {
  const s = statuses.find((x) => x.key === key);
  if (!s) throw new Error(`Unknown status key: ${key}`);
  return s;
}

export function conceptOf(id: ConceptId): Concept {
  const c = concepts.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown concept id: ${id}`);
  return c;
}

export function cohortOf(id: CohortId): Cohort {
  const c = cohorts.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown cohort id: ${id}`);
  return c;
}

/** Anchor for a project inside its cohort page. */
export function projectSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Prefix a site-root path with Astro's configured base.
 *
 * Components build their own hrefs, so unlike Markdown they are not covered by
 * the rehype plugin and have to do this themselves.
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base + path;
}

/** Href for a project's first-class structured archive record. */
export function projectHref(p: Project): string {
  return withBase(`/research/projects/${projectSlug(p.title)}/`);
}

/** Href for a concept page. */
export function conceptHref(c: Concept): string {
  return withBase(`/${c.slug}/`);
}

/** Href for a cohort page. */
export function cohortHref(c: Cohort): string {
  return withBase(`/research/cohorts/${c.id}/`);
}

export function projectsInCohort(id: CohortId): Project[] {
  return projects.filter((p) => p.cohort === id);
}

/** Projects tagged with a concept, oldest cohort first. */
export function projectsForConcept(id: ConceptId): Project[] {
  const order = [...cohorts].sort((a, b) => a.start.localeCompare(b.start)).map((c) => c.id);
  return projects
    .filter((p) => p.concepts.includes(id))
    .sort((a, b) => order.indexOf(a.cohort) - order.indexOf(b.cohort));
}

/**
 * Look a project up by exact title. Throws rather than returning undefined,
 * so a mistyped reference in an MDX page fails the build instead of quietly
 * rendering nothing, which is what the previous Liquid version did.
 */
export function projectByTitle(title: string): Project {
  const p = projects.find((x) => x.title === title);
  if (!p) {
    throw new Error(
      `No project titled "${title}" in src/data/dash.ts. ` +
        `Check the spelling against the titles in that file.`
    );
  }
  return p;
}

export function areas(): string[] {
  return [...new Set(projects.map((p) => p.area))].sort();
}

/** Fails the build on internal inconsistency in the data above. */
export function validate(): void {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const p of projects) {
    if (seen.has(p.title)) errors.push(`Duplicate project title: ${p.title}`);
    seen.add(p.title);
    if (!cohorts.some((c) => c.id === p.cohort)) {
      errors.push(`Project "${p.title}" has unknown cohort ${p.cohort}`);
    }
    if (!statuses.some((s) => s.key === p.status)) {
      errors.push(`Project "${p.title}" has unknown status ${p.status}`);
    }
    for (const c of p.concepts) {
      if (!concepts.some((x) => x.id === c)) {
        errors.push(`Project "${p.title}" references unknown concept ${c}`);
      }
    }
  }

  const currents = cohorts.filter((c) => c.current);
  if (currents.length !== 1) {
    errors.push(`Exactly one cohort must be marked current; found ${currents.length}`);
  }

  if (errors.length) {
    throw new Error('Invalid Dash data:\n  ' + errors.join('\n  '));
  }
}

