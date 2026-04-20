# ADR-029 — Plugin L3 Marketplace Security Model

**Status**: proposed
**Date**: 2026-04-21
**Deciders**: sole engineer
**Supersedes**: —
**Applied-in**: earliest v3.1 (after plugin L1 at v1.0 + L2 at v2.0)
**Depends-on**: ADR-016 (L1 accepted and shipped), ADR-021 (L2 block registry)

---

## Context

ADR-016 defines three plugin tiers:
- **L1** (v1.0, WO-35): entity-kind registry externalization — read-only, no user-submitted code
- **L2** (v2.0): block registry with parameterized templates — still developer-authored
- **L3** (v3.1+): third-party marketplace — user-submitted code executed in the editor

L3 is the most complex and the most dangerous:
- User-submitted JavaScript executes in the browser
- The editor runs in file:// context — sandbox is weaker than a served origin
- Malicious plugin = local file access via bridge + arbitrary DOM manipulation

The key question: how do you accept third-party code without accepting third-party risk?

---

## Security model options

| Option | Security level | Complexity | UX |
|---|---|---|---|
| **CSP + iframe sandbox per plugin** | High | High | Limited plugin capabilities |
| **Source-available only + community review** | Medium | Low | Slows plugin velocity |
| **Code signing (developer key)** | Medium | Medium | Requires PKI or trusted registry |
| **Worker-only execution (no DOM access)** | High | High | Major capability limitation |
| **Trust-on-install UI** (user explicitly runs) | Low-Medium | Low | Puts risk on user |

The existing trust model (ADR-014 error boundaries + WO-07 trust banner) gives users
a "neutralize scripts" option for deck-embedded scripts. L3 plugins face the same problem
but need a more structured solution.

---

## Decision (hypothesis)

**Proposed**: defer to v3.1; source-available + community review as L3 gate.

Rationale:
- Without a meaningful user base (> 500 active users), a plugin marketplace has no content
- Source-available requirement is consistent with open-source ethos
- Community review is the model npm uses (imperfect but pragmatic)
- Strong sandboxing (worker-only) reduces plugin value; marketplace growth requires real capabilities

If a malicious plugin is discovered: kill-switch is "remove from registry + publish security advisory".
No automated code scanning is sufficient for security-critical code; human review is required.

---

## Open questions

1. Who reviews plugin submissions?
   → Solo developer = bottleneck if marketplace grows. Community moderation needed at scale.
2. What capabilities do useful plugins actually need?
   → Must answer with L2 experience before designing L3 API
3. Is "local plugin" (user installs from their own computer) sufficient for most cases?
   → If yes: marketplace not needed; local-only plugin folder (like templates)

---

## Prerequisites

- ADR-016 L1 shipped + real plugin authors using it (not just the developer)
- ADR-021 L2 shipped + block authors using it
- > 500 active v2.x users (marketplace without users is a ghost town)
- Financial Reality Check: registry hosting, review bandwidth

---

## Consequences

- If source-available accepted: `plugin-registry.json` on GitHub, pull-request-gated
- If deferred: L2 (blocks) + local plugin folder is the v3.0 ceiling

---

## Review trigger

After v2.0 + 6 months: are developers asking to extend the editor beyond L2 blocks?
What type of extension do they want? This reveals whether L3 is needed at all.

---

## Links

- [ADR-016-plugin-extension-architecture.md](ADR-016-plugin-extension-architecture.md)
- [ADR-021-block-registry.md](ADR-021-block-registry.md)
- [ADR-014-error-boundaries.md](ADR-014-error-boundaries.md)
