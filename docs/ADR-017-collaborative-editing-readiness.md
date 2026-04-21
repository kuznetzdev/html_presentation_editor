# ADR-017: Collaborative Editing Readiness — CRDT-friendly state shape, single-user execution

**Status**: Proposed (readiness-only — live collaboration deferred indefinitely)
**Phase**: v0.30.x+ model-shape guidance; live collab remains out of scope
**Owner**: Architecture · State layer
**Depends on**: ADR-013 (observable store)
**Date**: 2026-04-20

---

## Context

ROADMAP_NEXT §Deferred explicitly lists "Online collaboration / multi-user" as a different product. This ADR is **not** a proposal to ship collaboration.

It **is** a proposal to shape the v1.0 state layer so that if collaboration is ever added, it doesn't require a rewrite. Specifically: the difference between "state that happens to be mutable" and "state that is CRDT-friendly" is ~10% of work if done once during ADR-013 migration, and ~90% of work if retrofitted later.

Areas that are hard to retrofit:

- Mutation patterns. Replacing `array[i] = x` with `array = [...array.slice(0,i), x, ...array.slice(i+1)]` costs nothing once but everything later.
- Timestamp / causality. CRDTs need `lamport` or `hybrid-logical-clock` on each state update. Adding post-hoc requires state migration.
- Model identity. Elements need stable IDs independent of DOM position (already have `data-editor-node-id` — good).
- Undo/redo semantics. Per-user vs. global undo branches need different history shape.

---

## Decision

**Build ADR-013 store to be CRDT-friendly in shape; do not implement CRDT semantics or transport.**

### What this means concretely

1. **Immutable slice updates.**
   `store.update("slice", patch)` produces a new slice object via `{...prev, ...patch}`. Never mutates in place. Already the ADR-013 shape. Keep it.

2. **Stable node IDs.**
   Every `modelDoc` element has `data-editor-node-id` (exists today). IDs are UUID v4 (or lexicographic-order prefixed) — globally unique without coordination.

3. **Patch-based history.**
   ADR-013 §history — snapshots become **patches** (`{op: "replace"|"insert"|"delete", path, value}`). Full-HTML snapshots are derived if needed. Fixes PAIN-MAP P0-11 (14 MB undo buffer) AND unlocks op-based sync.

4. **Causality metadata on each patch.**
   `{op, path, value, at: Date.now(), clientId: <local-uuid>, counter: <monotonic>}`. Single-user today: `clientId` is constant, `counter` monotonic. Multi-user later: same shape.

5. **Array ops are position-independent where possible.**
   Slide reorder: store `{op: "move", from-slide-id, before-slide-id}` not `{op: "splice", index, count}`. Position-indexed ops become ambiguous under concurrency.

6. **No shared mutable refs across slices.**
   Don't store a reference to a DOM node inside `state.model`. Store IDs, resolve via accessor.

### What is NOT part of v1.0

- Networking transport (WebSocket, WebRTC, y-websocket).
- OT or CRDT algorithm implementation.
- Presence (cursors, user list).
- Conflict resolution semantics.
- Multi-user auth.

These remain "different product" territory.

### Validation check

Before any slice lands in ADR-013, apply the **CRDT-readiness checklist**:

- [ ] Updates produce new objects (immutable)?
- [ ] IDs are stable and globally unique?
- [ ] Operations are describable as `{op, path, value}` patches?
- [ ] Array ops are position-independent or have merge semantics?
- [ ] No cross-slice mutable references?

If a slice fails this, document the reason in the ADR-013 application notes.

---

## Consequences

**Positive:**
- 10% cost today, 100% cost saved if collaboration ever lands.
- Patch-based history is a pure win independent of collaboration — reduces memory (PAIN-MAP P0-11), enables op-replay for debugging, allows "undo 3 steps ago" without re-serializing intermediate.
- Stable IDs already exist — no rework.
- Shape is idiomatic modern state mgmt — not a bolt-on.

**Negative:**
- Discipline cost: contributors may instinctively mutate. Mitigated by ADR-013 §"direct mutation frozen in dev".
- Patch history needs a base-snapshot checkpoint every N patches; slightly more complex than full-HTML snapshot.
- Slide-reorder logic becomes slightly denser (move-before-id vs. splice-index). Acceptable.

---

## Alternatives Considered

1. **Ignore CRDT-readiness; ship whatever state shape works.** Rejected — 10× cost to retrofit later based on empirical experience in other apps.
2. **Ship CRDT transport now.** Rejected — huge scope; no product demand.
3. **Use Yjs library.** Interesting post-v1.0. Same ADR shape applies; Yjs just provides the transport.
4. **Use Automerge library.** Interesting — Automerge docs map nicely to our "modelDoc". Zero-build unfriendly (bundled as ESM).

---

## Applied In

- v0.28.x — ADR-013 store slices designed to the checklist above
- v0.28.5 — selection slice passes CRDT-readiness checklist ✓ (immutable updates, stable IDs only, patch-based via store.update, no DOM refs, no position-indexed array ops)
- v0.30.x — history.js migrated to patch-based snapshots (PAIN-MAP P0-11 remediation)
- v1.0 — readiness-only; no live collab
- v2.x (speculative) — evaluate Yjs or Automerge if product direction changes

## Links
- [ADR-013 Observable Store](ADR-013-observable-store.md)
- AUDIT-C bottleneck #1 (full-HTML snapshots)
- PAIN-MAP P0-11
- ROADMAP_NEXT §Deferred "Online collaboration"
