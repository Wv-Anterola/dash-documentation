import { capabilitiesForProject, verifiedAgainst } from './capabilities';
import { cohorts, projectSlug, projects, type StatusKey } from './dash';
import { reference } from './sourceReference';
import branchReference from './generated/semantic-branches.json';

export type VerificationState =
  | 'verified'
  | 'not-recorded'
  | 'team-confirmation-needed'
  | 'not-applicable';

export type EvidenceKind =
  | 'runtime-test'
  | 'typed-registry'
  | 'implementation-source'
  | 'publication'
  | 'research-artifact'
  | 'commit-history';

export interface SourceEvidence {
  repository: string;
  ref: string;
  commit: string;
  path: string | null;
  symbol: string | null;
  evidenceKind: EvidenceKind;
  runtimeOrTestEvidence: string | null;
  verificationState: VerificationState;
  sourceUrl: string;
}

export interface ProjectRecord {
  id: string;
  title: string;
  dates: { start: string; end: string };
  researchQuestion: string;
  people: Array<{ name: string; role: string; verificationState: VerificationState }>;
  advisor: { name: string | null; verificationState: VerificationState };
  methods: string;
  evaluationStatus: VerificationState;
  participantCount: number | null;
  results: string | null;
  limitations: string | null;
  ethicsIrBStatus: VerificationState;
  capabilities: string[];
  branches: string[];
  sourceEvidence: SourceEvidence[];
  demos: string[];
  datasets: string[];
  publications: string[];
  integrationState: StatusKey;
}

export interface PersonRecord {
  id: string;
  name: string;
  identityState: VerificationState;
  roles: string[];
  cohorts: string[];
  projects: string[];
  publications: string[];
  codeAttribution: { state: VerificationState; note: string };
}

export interface PublicationRecord {
  id: string;
  title: string;
  authors: string[];
  citation: string;
  abstract: string | null;
  stableUrl: string;
  doi: string | null;
  bibtex: string | null;
  ris: string | null;
  associatedProjects: string[];
  code: SourceEvidence[];
  data: string[];
  demos: string[];
  currentImplementationStatus: string;
}

const cohortById = new Map(cohorts.map((cohort) => [cohort.id, cohort]));
const sourceEvidenceForProject = (title: string, status: StatusKey): SourceEvidence[] => {
  const capabilityEvidence = capabilitiesForProject(title).flatMap((capability) =>
    capability.source.map((path) => {
      const module = reference.modules.find((candidate) =>
        candidate.path === path || (path.endsWith('/') && candidate.path.startsWith(path))
      );
      return {
        repository: verifiedAgainst.repository,
        ref: verifiedAgainst.ref,
        commit: verifiedAgainst.commit,
        path,
        symbol: module?.symbols[0]?.qualifiedName ?? null,
        evidenceKind: module ? 'typed-registry' : 'implementation-source',
        runtimeOrTestEvidence: null,
        verificationState: status === 'integrated' ? 'verified' : 'team-confirmation-needed',
        sourceUrl:
          module?.symbols[0]?.sourceUrl ??
          `https://github.com/${verifiedAgainst.repository}/tree/${verifiedAgainst.commit}/${path}`,
      } satisfies SourceEvidence;
    })
  );
  if (capabilityEvidence.length) return capabilityEvidence;

  const project = projects.find((candidate) => candidate.title === title);
  const branch = branchReference.branches.find((candidate) =>
    project?.code?.includes(`\`${candidate.shortName}\``)
  );
  const semanticRow =
    branch?.semanticDelta.added[0] ??
    branch?.semanticDelta.changed[0] ??
    branch?.semanticDelta.removed[0];
  if (branch && semanticRow) {
    return [{
      repository: verifiedAgainst.repository,
      ref: branch.fullName,
      commit: branch.tip,
      path: semanticRow.path,
      symbol: semanticRow.name,
      evidenceKind: 'implementation-source',
      runtimeOrTestEvidence: null,
      verificationState: 'team-confirmation-needed',
      sourceUrl: `https://github.com/${verifiedAgainst.repository}/blob/${branch.tip}/${semanticRow.path}`,
    }];
  }

  // A documentation artifact preserves the claim without upgrading it to code
  // evidence. The fixed commit keeps the fallback immutable and reviewable.
  return [{
    repository: 'brown-dash/Dash-Documentation',
    ref: 'docs-unify-2026',
    commit: 'c786bb6be8d68f4249cd2970b8aa6b5ceb525ce3',
    path: 'src/data/projects.ts',
    symbol: title,
    evidenceKind: 'research-artifact',
    runtimeOrTestEvidence: null,
    verificationState: 'team-confirmation-needed',
    sourceUrl: 'https://github.com/brown-dash/Dash-Documentation/blob/c786bb6be8d68f4249cd2970b8aa6b5ceb525ce3/src/data/projects.ts',
  }];
};

export const projectRecords: ProjectRecord[] = projects.map((project) => {
  const cohort = cohortById.get(project.cohort)!;
  const branchNames = branchReference.branches
    .filter((branch) => project.code?.includes(`\`${branch.shortName}\``))
    .map((branch) => branch.shortName);
  return {
    id: projectSlug(project.title),
    title: project.title,
    dates: { start: cohort.start, end: cohort.end },
    researchQuestion: project.problem,
    people: (project.people ?? []).map((name) => ({
      name,
      role: 'project contributor',
      verificationState: 'team-confirmation-needed',
    })),
    advisor: { name: null, verificationState: 'not-recorded' },
    methods: project.approach ?? 'Not recorded.',
    evaluationStatus: 'not-recorded',
    participantCount: null,
    results: project.outcome ?? null,
    limitations: null,
    ethicsIrBStatus: 'not-recorded',
    capabilities: capabilitiesForProject(project.title).map((capability) => capability.id),
    branches: branchNames,
    sourceEvidence: sourceEvidenceForProject(project.title, project.status),
    demos: [],
    datasets: [],
    publications: [],
    integrationState: project.status,
  };
});

const personNames = [...new Set(projectRecords.flatMap((project) => project.people.map((person) => person.name)))];
export const personRecords: PersonRecord[] = personNames.sort().map((name) => {
  const related = projectRecords.filter((project) => project.people.some((person) => person.name === name));
  return {
    id: projectSlug(name),
    name,
    identityState: 'team-confirmation-needed',
    roles: ['project contributor'],
    cohorts: [...new Set(related.map((project) => projects.find((row) => row.title === project.title)!.cohort))],
    projects: related.map((project) => project.title),
    publications: [],
    codeAttribution: {
      state: 'not-recorded',
      note: 'Project participation is recorded separately from commit authorship; no code attribution is inferred.',
    },
  };
});

export const publicationRecords: PublicationRecord[] = [
  {
    id: 'integrating-advanced-mapping-and-itinerary-planning-features-in-dash',
    title: 'Integrating Advanced Mapping and Itinerary Planning Features in Dash',
    authors: ['Zaul Tavangar'],
    citation: 'Zaul Tavangar. Integrating Advanced Mapping and Itinerary Planning Features in Dash. Master’s project report, Brown CS, 2024.',
    abstract: null,
    stableUrl: 'https://cs.brown.edu/media/filer_public/26/81/268132aa-2653-4e88-b089-af17fde642ce/zaultavanger.pdf',
    doi: null, bibtex: null, ris: null,
    associatedProjects: ['Calendar collection view and Mapbox documents'],
    code: sourceEvidenceForProject('Calendar collection view and Mapbox documents', 'integrated'),
    data: [], demos: [],
    currentImplementationStatus: 'Mapbox and calendar work is integrated; the itinerary branch is not.',
  },
  {
    id: 'empowering-storytelling-in-dash',
    title: 'Empowering Storytelling in Dash',
    authors: ['Michael Foiani'],
    citation: 'Michael Foiani. Empowering Storytelling in Dash. Honors thesis, Brown University, 2023.',
    abstract: null,
    stableUrl: 'https://cs.brown.edu/media/filer_public/14/d8/14d897d1-4ddc-44f0-a255-a19df14aaa68/foianimichael_honors_thesis.pdf',
    doi: null, bibtex: null, ris: null,
    associatedProjects: ['Branching presentation trails'],
    code: sourceEvidenceForProject('Branching presentation trails', 'integrated'),
    data: [], demos: [],
    currentImplementationStatus: 'A branching-trail branch was merged; larger advanced-trail branches were not.',
  },
  {
    id: 'user-controlled-document-recommendation-system',
    title: 'A User-Controlled Document Recommendation System for Knowledge Workers',
    authors: ['Geireann Lindfield Roberts'],
    citation: 'Geireann Lindfield Roberts. A User-Controlled Document Recommendation System for Knowledge Workers. Honors thesis, Brown University, 2023.',
    abstract: null,
    stableUrl: 'https://cs.brown.edu/media/filer_public/f3/5f/f35f813d-adf7-404a-a812-3b9a22645932/robertsgeireann_lindfield_honors_thesis.pdf',
    doi: null, bibtex: null, ris: null,
    associatedProjects: ['User-controlled document recommendations'],
    code: sourceEvidenceForProject('User-controlled document recommendations', 'implemented'),
    data: [], demos: [],
    currentImplementationStatus: 'Implemented on a branch and not merged into the canonical revision.',
  },
  {
    id: 'physics-simulations-in-dash',
    title: 'Physics Simulations in the Dash Hypermedia System',
    authors: ['Brynn Chernosky'],
    citation: 'Brynn Chernosky. Physics Simulations in the Dash Hypermedia System. Master’s project report, Brown CS, 2023.',
    abstract: null,
    stableUrl: 'https://cs.brown.edu/media/filer_public/2c/20/2c208c8e-0560-49d3-b43c-6e5136004aab/chernoskybrynn.pdf',
    doi: null, bibtex: null, ris: null,
    associatedProjects: [],
    code: [],
    data: [], demos: [],
    currentImplementationStatus: 'Removed from the canonical revision; retained in reachable history.',
  },
];
