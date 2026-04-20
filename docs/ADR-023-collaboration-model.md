# ADR-023 — Collaboration Model

**Status**: proposed
**Date**: 2026-04-21
**Deciders**: sole engineer
**Supersedes**: —
**Applied-in**: ADR-017 (collaborative editing readiness) provides the architectural foundation
**Depends-on**: ADR-017 accepted + v2.0 shipped + proven multi-user adoption

---

## Context

v1.0 is a single-user local editor. v3.0 vision includes real-time collaboration.

Three models are in tension:

| Model | Latency | Complexity | Conflict resolution | Infra required |
|---|---|---|---|---|
| **CRDT via yjs** | Near-real-time | High (state model must be CRDT-compatible) | Automatic (merge) | WebSocket relay or peer-to-peer |
| **OT server** | Near-real-time | High (central server required) | Server-authoritative | Full backend |
| **Async-only** (snapshots + manual merge) | Minutes to hours | Low (file diff model) | Manual | None (git-style) |

The `file://` invariant creates a hard constraint: real-time collaboration requires a network
connection and a relay. This is fundamentally opt-in, not a base feature.

ADR-017 (already accepted) explicitly designed the model document to be CRDT-compatible
(node IDs stable, no positional references). This is a prerequisite, not a commitment.

---

## Decision (hypothesis)

**Proposed**: CRDT via yjs for v3.0, async-only as a v2.3 milestone.

Rationale:
- CRDT avoids central server for small teams (use WebRTC peer-to-peer or hosted relay)
- yjs is battle-tested (Notion, Linear, VS Code Live Share use similar approaches)
- ADR-017 already designed the model doc for CRDT compatibility
- Async-only (v2.3) provides value to solo users who want "share a snapshot" workflow without CRDT complexity

**Explicit non-goal for v2.x**: no real-time collab. Async-only snapshot sharing is NOT
collaboration — it is export + re-import. Genuine real-time is v3.0 earliest.

---

## Open questions

1. What does "collaboration" mean to our archetypes?
   → Technical Educator: asynchronous review + comment likely sufficient
   → Open-Source Hoarder: async-only (git-style) preferred
   → Enterprise user (hypothetical v3.x): real-time expected
2. Is yjs WebRTC viable without a hosted signaling server?
   → Requires a signaling step even for peer-to-peer; "zero server" breaks for initial handshake
3. Does CRDT require changing the bridge protocol?
   → Yes — bridge must carry yjs delta messages; this affects ADR-012 significantly

---

## Prerequisites

- v2.0 shipped with proven multi-user adoption (≥ 50 active users)
- ADR-012 (bridge v2) fully accepted and stable
- ADR-028 (cloud sync) defines the server/relay architecture
- Financial Reality Check: relay server = operating cost

---

## Consequences

- If CRDT accepted: major bridge protocol change; new ADR for relay architecture
- If async-only accepted: simpler model; no real-time; covers 80% of archetype need
- If deferred beyond v3.0: collaboration stays "share HTML file" forever

---

## Review trigger

Do NOT transition until:
- v2.0 has ≥ 50 active users
- At least 5 users have specifically requested real-time collaboration
- Financial runway analysis for relay infra is complete

---

## Links

- [ADR-017-collaborative-editing-readiness.md](ADR-017-collaborative-editing-readiness.md)
- [ADR-012-bridge-protocol-v2.md](ADR-012-bridge-protocol-v2.md)
- [ADR-028-cloud-sync-opt-in.md](ADR-028-cloud-sync-opt-in.md)
