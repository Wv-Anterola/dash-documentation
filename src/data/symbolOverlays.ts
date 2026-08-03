/**
 * Documentation-only overlays for extension-facing APIs in pinned Dash-Web.
 *
 * Keys are the stable `path#qualifiedName` ids emitted by the semantic
 * generator. These comments intentionally live outside Dash-Web until an
 * upstream documentation-only review accepts source TSDoc changes.
 */
export interface SymbolOverlay {
  summary: string;
  parameters?: Record<string, string>;
  returns?: string;
  errors?: string[];
  sideEffects?: string[];
  permissions?: string;
  undo?: string;
}

export const symbolOverlays: Record<string, SymbolOverlay> = {
  'src/fields/Doc.ts#Doc': {
    summary:
      'Persistent Dash document object. Field reads may follow prototypes; writes participate in the active serialization and undo context.',
    sideEffects: ['Mutating a persisted field can enqueue synchronization and invalidate MobX observers.'],
    permissions: 'Callers must preserve the document ACL and sharing semantics enforced by the surrounding manager.',
    undo: 'User-visible mutations should run inside a named UndoManager batch.',
  },
  'src/client/documents/Documents.ts#Docs': {
    summary:
      'Factory namespace for canonical document creation. Use a registered factory instead of constructing specialized document layouts by hand.',
    returns: 'A document or document-layout pair initialized for its registered type.',
    errors: ['Optional services and import-backed factories may fail asynchronously.'],
    sideEffects: ['Factories can allocate persistent documents and schedule imports or service work.'],
    undo: 'Creation from a user action should be grouped with placement in one undo batch.',
  },
  'src/client/views/nodes/DocumentContentsView.tsx#DocumentContentsView.Init': {
    summary:
      'Initializes the runtime document renderer registry before document contents are dispatched.',
    sideEffects: ['Populates global renderer mappings used by every DocumentContentsView instance.'],
    permissions: 'Renderer registration itself does not bypass document read permissions.',
  },
  'src/client/views/collections/CollectionView.tsx#CollectionView.renderSubView': {
    summary:
      'Dispatches a collection layout to the renderer associated with its CollectionViewType.',
    parameters: {
      type: 'Persisted collection-view enum value.',
      props: 'Shared view props including document mutation, sizing, and selection callbacks.',
    },
    returns: 'The selected collection subview, or null when no type is available.',
  },
  'src/client/util/UndoManager.ts#UndoManager.RunInBatch': {
    summary:
      'Runs related persistent changes as one named undo/redo unit.',
    parameters: {
      action: 'Synchronous mutation function to execute.',
      name: 'Human-readable action label shown in undo history.',
    },
    undo: 'All tracked mutations inside the callback are reversed or replayed together.',
  },
  'src/client/util/Scripting.ts#Scripting': {
    summary:
      'Defines the globals and compilation boundary available to document scripts.',
    errors: ['Compilation or runtime failures are returned through the scripting result/error model.'],
    sideEffects: ['A script can mutate documents when its registered globals expose mutation operations.'],
    permissions: 'Treat script documents as active code and do not expose privileged globals without review.',
    undo: 'Script-triggered persistent user actions should enter an undo batch.',
  },
};

export const coreExtensionApiIds = Object.freeze(Object.keys(symbolOverlays));

export function overlayForSymbol(id: string): SymbolOverlay | undefined {
  return symbolOverlays[id];
}
