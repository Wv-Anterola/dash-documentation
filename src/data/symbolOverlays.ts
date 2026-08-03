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
  preconditions?: string[];
  postconditions?: string[];
  invariants?: string[];
  failureSemantics?: string[];
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
  'src/fields/Doc.ts#GetProto': {
    summary:
      'Resolves the shared data-root identity by following the document prototype chain until it reaches a data document or root.',
    parameters: {
      doc: 'Document or delegate whose data-root identity is required.',
    },
    returns: 'The terminal data document used as shared identity.',
    invariants: ['The prototype chain must terminate and contain document references.'],
    sideEffects: ['None expected; this is identity resolution.'],
  },
  'src/fields/Doc.ts#SetInPlace': {
    summary:
      'Writes a field to the delegate or its data owner according to existing ownership and the defaultProto policy.',
    parameters: {
      doc: 'Document or embedding being edited.',
      keyIn: 'Field name; one leading underscore is removed before ownership resolution.',
      value: 'Typed field value, or undefined to clear it through normal setter semantics.',
      defaultProto: 'When neither owner already has the field, true selects the data owner and false selects the delegate.',
    },
    returns: 'A promise that resolves after the synchronous ownership/write decision completes.',
    postconditions: ['Exactly one resolved owner receives the value through the document proxy.'],
    failureSemantics: [
      'An incorrect defaultProto choice can make a field unintentionally shared or context-local without throwing an error.',
    ],
    undo: 'The caller must place user-visible writes inside a named batch.',
  },
  'src/fields/Doc.ts#GetLayoutDataDocPair': {
    summary:
      'Resolves the contextual layout and optional data document used to render a child inside a container or template.',
    parameters: {
      containerDoc: 'The layout/container in which the child is being rendered.',
      containerDataDoc: 'Optional data context supplied by template rendering.',
      childDoc: 'Child document or pending child reference.',
      layoutFieldKey: 'Optional accumulated key used while expanding nested template layouts.',
    },
    returns: 'An object containing the resolved layout document and optional data document.',
    preconditions: ['A complete child must have a resolvable prototype.'],
    failureSemantics: [
      'A missing or pending child logs a warning and is returned in both positions so the renderer can preserve a loading state.',
    ],
  },
  'src/client/documents/Documents.ts#InstanceFromProto': {
    summary:
      'Internal factory primitive that separates data and view options, creates a typed data document, and returns the contextual document instance used by canonical factories.',
    parameters: {
      proto: 'Registered prototype for the selected document type.',
      data: 'Initial typed content field.',
      options: 'Initial data and underscore-prefixed layout fields.',
      delegId: 'Optional persistent identifier for the contextual document.',
      fieldKey: 'Data-field name populated by the factory.',
      protoId: 'Optional persistent identifier for the data document.',
      placeholderDocIn: 'Optional loading/placeholder document to replace in place.',
      noView: 'Create only the data side when true.',
    },
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
    invariants: ['Every view operates on the same collection members and shared mutation callbacks.'],
    failureSemantics: ['Undefined returns null; safe mode can substitute a simpler view type.'],
  },
  'src/client/DocServer.ts#init': {
    summary:
      'Initializes the identity cache and WebSocket-only Socket.IO transport, then binds document read/write and incoming-update handlers.',
    parameters: {
      protocol: 'Page protocol used to choose ws or wss.',
      hostname: 'Server host.',
      port: 'Dash WebSocket port.',
      identifier: 'Current user identifier returned during the server handshake.',
    },
    postconditions: ['Document persistence functions no longer point at the pre-initialization error function.'],
    failureSemantics: [
      'Connection errors are logged to the browser console; this function does not create an outgoing write retry queue.',
    ],
  },
  'src/client/DocServer.ts#GetRefField': {
    summary:
      'Returns the identity-preserving cached document for an ID or requests, deserializes, and caches it on a cold read.',
    parameters: {
      id: 'Persistent document identifier.',
      force: 'Refresh an existing cached document in place when true.',
    },
    returns: 'A promise resolving to the cached/hydrated document or undefined for a missing record.',
    invariants: ['One client object identity is retained for each hydrated document ID.'],
    failureSemantics: ['A missing record resolves as undefined and is removed from cache.'],
  },
  'src/client/DocServer.ts#GetRefFields': {
    summary:
      'Batches cold reference reads, deduplicates cache work, hydrates records, and yields periodically to update loading progress.',
    parameters: {
      ids: 'Persistent document identifiers to resolve.',
    },
    returns: 'A map from every requested ID to its hydrated document or undefined state.',
    invariants: ['Already cached documents retain object identity.'],
  },
  'src/client/DocServer.ts#UpdateField': {
    summary:
      'Forwards a serialized document-field operation through the active update implementation.',
    parameters: {
      id: 'Persistent document identifier.',
      updatedState: 'Serialized $set, $unset, or list operation.',
    },
    preconditions: ['DocServer has been initialized.'],
    failureSemantics: [
      'Guest and read-only updates are suppressed; normal outgoing writes do not return a client acknowledgement.',
    ],
    sideEffects: ['May emit MessageStore.UpdateField over Socket.IO.'],
  },
  'src/client/util/UndoManager.ts#RunInBatch': {
    summary:
      'Runs related persistent changes as one named undo/redo unit.',
    parameters: {
      fn: 'Synchronous mutation function to execute.',
      batchName: 'Human-readable action label shown in undo history.',
    },
    returns: 'The callback result.',
    invariants: ['The batch closes in finally even when the callback throws.'],
    undo: 'All tracked mutations inside the callback are reversed or replayed together.',
  },
  'src/client/util/UndoManager.ts#StartBatch': {
    summary:
      'Opens or nests the current undo batch and returns a handle that must be ended or canceled exactly once.',
    parameters: {
      batchName: 'Human-readable action label used when the outer batch enters history.',
    },
    returns: 'A Batch handle with end and cancel operations.',
    invariants: ['Only the outer completed batch is pushed to undo history.'],
    failureSemantics: ['A batch left open can absorb later unrelated events; disposing twice logs a warning.'],
  },
  'src/client/util/UndoManager.ts#AddEvent': {
    summary:
      'Adds an inverse/forward field event only while a batch is open and history is not being replayed.',
    parameters: {
      event: 'Undo, redo, and property-name record.',
      value: 'Optional value used by diagnostic logging.',
    },
    invariants: ['Undo/redo replay never creates new history entries.'],
  },
  'src/client/util/LinkFollower.ts#LinkFollower.FollowLink': {
    summary:
      'Resolves the opposite link endpoint and navigates to an existing or newly opened context without copying the target.',
    preconditions: ['The link and destination are readable and their references resolve.'],
    postconditions: ['Navigation preserves target identity and applies contextual view/highlight behavior.'],
    failureSemantics: ['Missing or inaccessible endpoints require a non-destructive no-target result.'],
    permissions: 'Link previews, backlinks, search, and navigation must not reveal an inaccessible target.',
  },
  'src/client/views/nodes/chatbot/agentsystem/Agent.ts#Agent.execute': {
    summary:
      'Runs the canonical model/tool loop, validates selected tool parameters, invokes the registered implementation, and appends observations.',
    parameters: {
      onProcessingUpdate: 'Receives structured progress updates for the interface.',
      onAnswerUpdate: 'Receives streamed answer updates.',
    },
    returns: 'The final agent answer.',
    preconditions: ['The selected tool is registered and its schema accepts the requested parameters.'],
    invariants: ['Generated model text crosses into application behavior only through a registered tool.'],
    failureSemantics: ['Validation, tool, provider, and parsing failures should remain distinguishable.'],
    permissions: 'Each tool is responsible for bounding and authorizing its own document or external scope.',
    undo: 'Workspace write tools must group all related mutations in one named batch.',
  },
  'src/client/util/Scripting.ts#CompileScript': {
    summary:
      'Compiles a Dash document script with the configured parameters, captured variables, globals, traversal hooks, and required return type.',
    parameters: {
      script: 'TypeScript-like script source stored by the document.',
      options: 'Compilation, capture, parameter, global, traversal, and result-shape options.',
    },
    returns: 'A compiled script or structured compile error result, with successful results cached by source and capture signature.',
    errors: ['Compilation or runtime failures are returned through the scripting result/error model.'],
    sideEffects: ['A script can mutate documents when its registered globals expose mutation operations.'],
    permissions: 'Treat script documents as active code and do not expose privileged globals without review.',
    undo: 'Script-triggered persistent user actions should enter an undo batch.',
  },
};

export const runtimeContractApiIds = Object.freeze(Object.keys(symbolOverlays));

export function overlayForSymbol(id: string): SymbolOverlay | undefined {
  return symbolOverlays[id];
}
