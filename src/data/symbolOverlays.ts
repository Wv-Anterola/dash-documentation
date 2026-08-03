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
  'src/client/util/SerializationHelper.ts#Serialize': {
    summary:
      'Converts a supported field value into its wire representation and adds the registered __type discriminator for object values.',
    parameters: {
      obj: 'Primitive, nullish value, or object registered through Deserializable.',
    },
    returns: 'A JSON-compatible primitive, null, or type-tagged object.',
    preconditions: ['Every object constructor has a registered serialization tag and serializr schema.'],
    invariants: ['Primitive values pass through; object values carry one stable __type tag.'],
    failureSemantics: [
      'Undefined and null both serialize as null; an unregistered object constructor throws synchronously.',
    ],
  },
  'src/client/util/SerializationHelper.ts#Deserialize': {
    summary:
      'Reconstructs a primitive or registered field object from its serialized representation and invokes optional post-hydration repair.',
    parameters: {
      obj: 'Primitive, nullish value, or object containing a registered __type tag.',
    },
    returns: 'A promise resolving to the reconstructed runtime value or undefined for nullish/missing-tag input.',
    postconditions: ['Registered post-deserialization behavior has been invoked before the promise resolves.'],
    failureSemantics: [
      'A missing type tag warns and resolves undefined; an unknown type tag throws; null deserializes to undefined.',
    ],
  },
  'src/client/util/SerializationHelper.ts#Deserializable': {
    summary:
      'Class decorator that binds one stable wire tag to a constructor and optional post-deserialization repair function.',
    parameters: {
      classNameForSerializer: 'Stable __type value written on the wire.',
      afterDeserialize: 'Optional behavior repair invoked after serializr populates the instance.',
      constructorArgs: 'Optional serialized property names passed to the constructor factory.',
    },
    postconditions: ['Both wire-tag-to-constructor and constructor-name-to-wire-tag registries contain the class.'],
    failureSemantics: ['Registering the same wire tag twice throws during module initialization.'],
  },
  'src/client/util/SerializationHelper.ts#autoObject': {
    summary:
      'Creates a serializr property schema that delegates nested field objects to the Dash type registry.',
    returns: 'A custom serializr schema using SerializationHelper.Serialize and Deserialize.',
    failureSemantics: ['Nested serialization and type-registration errors propagate to the containing document or list.'],
  },
  'src/fields/Proxy.ts#ProxyField.value': {
    summary:
      'Lazily resolves a referenced document by preserving its field ID, consulting the identity cache, and sharing one in-flight request.',
    returns: 'The cached document, a waiting promise, or undefined after a failed resolution.',
    invariants: ['The proxy stores an identity, not an embedded copy of the target document.'],
    failureSemantics: ['After a request resolves undefined, the proxy marks itself failed and does not automatically request again.'],
    sideEffects: ['May start DocServer.GetRefField and update observable cache state.'],
  },
  'src/fields/Proxy.ts#ProxyField.setValue': {
    summary:
      'Completes a lazy reference resolution by replacing its waiting state and recording whether the target was missing.',
    parameters: {
      field: 'Resolved document or undefined when the referenced record was not found.',
    },
    returns: 'The supplied document or undefined value.',
    postconditions: ['The in-flight promise is cleared; undefined permanently marks this proxy instance failed.'],
  },
  'src/fields/List.ts#ListImpl.constructor': {
    summary:
      'Creates an observable, serializable list and returns the JavaScript proxy that supplies indexed access and controlled array methods.',
    parameters: {
      fields: 'Optional initial values; document values are stored as ProxyField references.',
    },
    returns: 'The List proxy rather than the underlying ListImpl target.',
    invariants: ['Object members receive parent/change callbacks; document members retain reference identity.'],
    failureSemantics: [
      'Object.defineProperty and copyWithin are unsupported; filling a list with RefField values throws.',
    ],
  },
  'src/fields/List.ts#ListImpl.__realFields': {
    summary:
      'Projects stored list members to runtime values and batch-requests every unresolved document proxy before iteration.',
    returns: 'The current real-value array, which can temporarily include waiting promises or undefined references.',
    postconditions: ['All newly discovered proxies share one batch request and one MobX action for result installation.'],
    sideEffects: ['May call ObjGetRefFields and attach an external promise to each unresolved proxy.'],
  },
  'src/server/Message.ts#Message.Message': {
    summary:
      'Returns the deterministic UUIDv5 Socket.IO event identifier derived from the readable message name.',
    returns: 'The wire event string used by client and server emit/on calls.',
    invariants: ['The same readable name and UUID URL namespace produce the same event ID.'],
    failureSemantics: ['Changing the readable name changes the wire ID and breaks peers that have not changed with it.'],
  },
  'src/server/websocket.ts#initialize': {
    summary:
      'Starts the Socket.IO server, emits the handshake and statistics, and registers document, gesture, utility, and lifecycle handlers.',
    parameters: {
      isRelease: 'Chooses HTTPS server setup and also controls registration of the destructive Delete All handler.',
      credentials: 'TLS server credentials used by the release HTTPS server.',
    },
    postconditions: ['The configured socket port is listening and connection handlers can reach the database.'],
    failureSemantics: [
      'The initializer does not attach HTTP-session authentication or per-document authorization to its handlers.',
      'Its termination helper emits a literal event that does not match the client registered MessageStore UUID.',
    ],
    permissions: 'Production use requires server-authenticated sockets and authorization on every read and mutation event.',
  },
  'src/server/websocket.ts#UpdateField': {
    summary:
      'Queues one serialized update under its document ID after the socket identifier handshake and dispatches same-ID operations in order.',
    parameters: {
      socket: 'Originating Socket.IO connection.',
      diff: 'Persistent document ID plus $set, $unset, append, or removal operation.',
    },
    returns: 'True when queued for a registered socket; false when the socket has no identity mapping.',
    invariants: ['Only one operation for a given document ID is dispatched at a time in this server process.'],
    failureSemantics: [
      'The handler does not acknowledge ordinary writes to the origin and does not perform a document ACL decision.',
    ],
    permissions: 'A trusted server identity and per-document authorization must precede queue admission in production.',
  },
  'src/server/database.ts#Database.update': {
    summary:
      'Serializes database updates for one record ID and invokes the caller callback after MongoDB reports the update result.',
    parameters: {
      id: 'Document record identifier.',
      value: 'MongoDB update expression.',
      callback: 'Continuation used to broadcast and advance synchronization queues.',
      upsert: 'Whether a missing record may be created; false for normal WebSocket field updates.',
      collectionName: 'Target MongoDB collection, defaulting to document fields.',
    },
    postconditions: ['On success, the update callback runs before the next queued same-ID database operation.'],
    failureSemantics: [
      'The current updateOne error branch logs the error but does not resolve the surrounding queue promise or invoke the callback, so later work for that ID can remain blocked.',
    ],
  },
  'src/server/RouteManager.ts#RouteManager.addSupervisedRoute': {
    summary:
      'Registers one or more Express routes behind Dash’s shared identity selection, conditional release-admin handoff, handler exception translation, and missing-response check.',
    parameters: {
      initializer:
        'Method, literal or composed subscription, required secure handler, and optional public handler, error handler, or release-admin flag.',
    },
    preconditions: [
      'Each composed path satisfies the RouteManager path grammar and each supervised method/path pair is unique.',
    ],
    postconditions: [
      'Accepted subscriptions are registered with the matching Express method and recorded for startup diagnostics.',
    ],
    invariants: [
      'A request with req.user uses the secure branch; a request without it uses only an explicit public branch or redirects to login.',
    ],
    failureSemantics: [
      'Malformed and duplicate supervised registrations are accumulated and make logRegistrationOutcome exit the process.',
      'The one-second missing-response timer is scheduled after the awaited handler returns, so it does not recover a promise that never settles.',
    ],
    permissions:
      'The wrapper selects an identity branch but does not replace per-action, per-resource authorization inside the service.',
  },
  'src/server/RouteManager.ts#_error': {
    summary:
      'Logs a route failure, sets the HTTP status message, and sends the supplied error value with status 500.',
    parameters: {
      res: 'Express response being completed.',
      message: 'Operator-facing failure context also assigned to statusMessage.',
      error: 'Optional value sent as the response body.',
    },
    postconditions: ['The response is completed with HTTP 500.'],
    failureSemantics: [
      'Sending a raw error can expose stack, provider, or filesystem details; callers must sanitize externally visible failures.',
    ],
  },
  'src/server/RouteManager.ts#_success': {
    summary: 'Completes an Express response with HTTP 200 and the supplied body.',
    parameters: {
      res: 'Express response being completed.',
      body: 'Route-specific success payload; no shared envelope is added.',
    },
    postconditions: ['The response is completed with HTTP 200.'],
  },
  'src/server/RouteManager.ts#_invalid': {
    summary: 'Completes an Express response with HTTP 400 and a route-provided text message.',
    parameters: {
      res: 'Express response being completed.',
      message: 'Human-readable invalid-request explanation.',
    },
    failureSemantics: ['The helper does not supply a stable machine-readable validation code or field-error schema.'],
  },
  'src/server/RouteManager.ts#_permissionDenied': {
    summary: 'Completes an Express response with HTTP 403 and an optional permission explanation.',
    parameters: {
      res: 'Express response being completed.',
      message: 'Optional explanation appended to the fixed permission-denied text.',
    },
    permissions:
      'This helper reports a decision; the route must first derive that decision from a trusted subject, action, resource, and context.',
  },
  'src/server/api/dynamicTools.ts#setupDynamicToolsAPI': {
    summary:
      'Creates the dynamic-tool source directory and directly registers endpoints that save, enumerate, and read generated TypeScript tool files.',
    parameters: {
      app: 'Express application that receives the three direct route registrations.',
    },
    postconditions: [
      'The dynamic directory exists when creation succeeds; saveDynamicTool, getDynamicTools, and getDynamicTool routes are registered.',
    ],
    sideEffects: [
      'May create a directory, write a TypeScript source file, enumerate filenames, or return stored tool source.',
    ],
    failureSemantics: [
      'Directory creation failures are logged but registration continues; route catches return JSON errors with status 500.',
    ],
    permissions:
      'The local handlers do not perform an identity or role check and bypass RouteManager; production exposure requires explicit server authentication, authorization, bounds, isolation, audit, and rollback.',
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
