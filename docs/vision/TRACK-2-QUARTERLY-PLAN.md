# Track-2 Vision Validation Plan — Q3 2026 → v2.0 Readiness

> **Created**: 2026-04-21
> **Budget hard cap**: 4 hours/week maximum — NEVER in excess of Track-1
> **Owner**: solo engineer (same person as Track-1)
> **Purpose**: accumulate customer and competitor evidence to inform ADR-021..030 acceptance

---

## Operating principle

Track-2 does NOT feed back into Track-1 execution decisions.
Track-1 ships the planned WOs regardless of what Track-2 finds.

Track-2 findings affect:
- ADR-021..030 status transitions (`proposed` → `accepted` / `rejected`)
- v2.0 scope decisions (what to build after v1.0 GA)
- PIVOT decisions (per KILL-SWITCH-CONDITIONS.md §PIVOT)

If Track-2 requires > 5 h/week to maintain, **reduce scope, not budget**.

---

## Weekly rhythm (4 h/week)

| Day | Time | Activity |
|---|---|---|
| Monday | 1 h | Competitor monitoring digest (see §Competitor protocol) |
| Wednesday | 2 h | Customer interview (or outreach + prep if no interview scheduled) |
| Friday | 1 h | Synthesize this week's findings into interview note or competitor note |

Do NOT schedule Track-2 on the same day as WO agent launches (cognitive conflict).

---

## Q3 2026 — Customer Discovery

**Period**: 2026-07-01 → 2026-09-30
**Interview target**: 5–10 sessions (minimum viable: 3)
**Competitor digests**: 13 weeks × 1/week = 13 documents

### Customer interview protocol

**Duration**: 30 minutes via Zoom/Meet.
**Recruit**: DM + short intro. "I'm building a local browser-based HTML presentation editor. Would you spend 30 min to help me understand your workflow? No sales, just research."

**Candidate pools (priority order)**:
1. Reveal.js GitHub issues / Discord — technical creators already using HTML presentations
2. YouTube/Twitch technical educators who build slide decks in code
3. IndieHackers / r/webdev — developers who hate PowerPoint
4. Academic Twitter / X — researchers using Reveal.js or Marp
5. Reddit r/homelab — people who self-host everything

**Session script**:
```
0:00 - 0:05  Intro + consent ("I'll take notes but won't share your name")
0:05 - 0:10  Current workflow: How do you make presentations today?
0:10 - 0:20  Last presentation: Walk me through the last deck you built. What was painful?
0:20 - 0:25  Magic wand: If you could change ONE thing about your presentation tooling, what?
0:25 - 0:29  Live demo: Show ~90 seconds of v0.25.0 opening + selecting + editing
0:29 - 0:30  Open: What questions do you have? What would you want to see differently?
```

**Deliverable**: one `docs/vision/INTERVIEWS-2026-Q3/interview-NN.md` per session
(see template at end of this doc).

**Stop condition**: if < 3 interviews completed by 2026-08-15 (week 7), Track-2 interview
protocol pauses. User acquisition becomes the problem to solve before resuming.
This does NOT stop Track-1.

---

### Competitor monitoring protocol

**Weekly cadence**: every Monday, 1 hour.

Track (weekly):
- **Gamma.app**: blog + changelog + Twitter/X
- **Pitch.com**: changelog + LinkedIn
- **Tome.app**: product updates + app store reviews
- **Slides.com** (Reveal.js hosted): blog + GitHub

Track (monthly, first Monday of month):
- **Canva Presentations**: feature announcements
- **Beautiful.ai**: updates
- **Marp** (open-source Markdown → pptx): GitHub releases

**Deliverable**: `docs/vision/COMPETITORS-WEEKLY/YYYY-wNN.md`

**Threat scoring per week**:
- **L (Low)**: no relevant updates or updates in unrelated areas
- **M (Medium)**: feature shipped that overlaps our angle peripherally
- **H (High)**: direct overlap with our core angle (local editing, zero install, HTML-native)

**Trigger**: 2 consecutive H weeks → create `ADR-NNN-competitive-response.md` within 48 h
and present as PIVOT candidate at next quarterly checkpoint.

**Quarterly aggregation**: `docs/vision/COMPETITIVE-THREATS-2026-Q3.md` by Sep 28.

---

## Q4 2026 — Archetype Synthesis

**Period**: 2026-10-01 → 2026-12-31
**Interview target**: additional 5 (cumulative: 10–15 by year end)
**Focus**: synthesize patterns from Q3 interviews into USER-ARCHETYPES-v1.md

### Archetype candidates (hypotheses to validate or invalidate)

| Archetype | Hypothesis | Validation criteria |
|---|---|---|
| **Technical Educator** | DevRel / YouTuber who uses Reveal.js, frustrated by WYSIWYG gap | ≥ 3 interviews confirm "I can write HTML but hate editing it visually" |
| **Developer Who Hates Slides** | Developer forced to make client/team presentations, wants to stay in code tooling | ≥ 3 confirm "I'd use anything that keeps me out of PowerPoint" |
| **Open-Source Hoarder** | Person who self-hosts everything, allergic to SaaS lock-in | ≥ 3 confirm file:// / zero-server as deciding factor |
| **Academic Researcher** | Researcher who uses Marp or Reveal.js, needs accessible exports | ≥ 2 confirm accessibility or PPTX export as must-have |

**Deliverable**: `docs/vision/USER-ARCHETYPES-v1.md` by 2026-12-15.

### Capability gap mapping

Based on interviews + competitor analysis, produce:
`docs/vision/CAPABILITY-MAP-v1.md` — what v1.0 delivers vs. what archetypes actually need.

This becomes the input for v2.0 WO authoring in Q2 2027.

---

## Q1 2027 — Pre-v1.0 GA validation

**Period**: 2027-01-01 → 2027-03-31
**Activity**: 2–3 RC testers from interview pool

### RC tester protocol

- Give RC testers access to v1.0.0-rc.1 (or pre-release build)
- 30-min session: "Open your own HTML presentation + try to edit it"
- Document: what blocked them, what surprised them, what delighted them
- Feed P0 bugs back to Track-1 (if RC validation window, March 2-9)

**Do NOT collect feature requests** during RC testing. Capture them separately for v1.1+ backlog.

---

## Q2 2027 — v2.0 Pre-planning

**Trigger**: v1.0.0 GA shipped + 60 days real-world usage accumulated.

### Evidence gates before v2.0 WO authoring

All four must be true:
1. **USER-ARCHETYPES-v2.md** — at least 1 validated archetype with ≥ 5 interviews
2. **ADR-021..030 status** — each transitioned to `accepted` or `rejected` based on evidence
3. **Usage signal** — at least 10 people have used v1.0 beyond the landing page (GitHub stars, direct feedback, or telemetry if opt-in users exist)
4. **Capability-MAP-v2.md** — updated post-v1.0 with real user gaps

If any gate fails: delay v2.0 WO authoring by 1 month. Run more interviews.

### v2.x hypothesis board

These are ADR-021..030 decision drivers, not committed features:

| Question | Evidence needed to decide |
|---|---|
| Block registry: JSON schema or DSL? | 2+ interviews showing how power users author custom blocks |
| Template marketplace: local vs. hosted? | Financial Reality Check (cloud = cost) + archetype preference |
| AI layer: local LLM vs. cloud API vs. user-BYOK? | Privacy archetype strength; ADR-024 |
| Export: what formats do archetypes need most? | Interview frequency: PDF > video > embed |
| Collab: CRDT vs. async-only? | Are archetypes solo or team workers? |

---

## v2.x roadmap (pre-committed hypothesis, ADR-gated)

These are NOT a schedule. They are hypotheses about what v2.x might deliver.
Each item requires its own WO set after v1.0 GA evidence review.

| Version | Hypothesis | Key ADR | Evidence gate |
|---|---|---|---|
| v2.0 | Blocks + templates + design tokens v3 | ADR-021, ADR-022, ADR-019 | USER-ARCHETYPES-v2, ≥10 users |
| v2.1 | Data binding + charts | ADR-021 | 3+ users request dynamic content |
| v2.2 | AI assistance L1 (outline, rewrite, image) | ADR-024 | AI angle validated in ≥5 interviews |
| v2.3 | Publishing (static site, embed, share link) | ADR-028 | Solo-creator archetype dominates |

---

## v3.x roadmap (pre-committed hypothesis)

*Earliest start: Q3 2028. Requires v2.0 shipped + proven adoption.*

| Version | Hypothesis | Key ADR |
|---|---|---|
| v3.0 | CRDT real-time collab + comments + version history UI | ADR-023, ADR-017 |
| v3.1 | Plugin marketplace L3 + advanced AI | ADR-016 (L3), ADR-024 |

**ADR-023 (CRDT) will not be accepted before v2.0 ships.** Collaborative editing
requires multiple concurrent users — which requires a deployed user base.

---

## Stop conditions (Track-2 only)

These do NOT stop Track-1.

| Condition | Action |
|---|---|
| < 3 interviews in 8 weeks | Auto-pause interview protocol; investigate acquisition failure |
| Track-2 consuming > 5 h/week | Reduce scope: drop monthly competitors, limit to weekly |
| Competitor HARD STOP trigger fires | Escalate to KILL-SWITCH-CONDITIONS.md §HS-02 |

---

## Interview note template

```markdown
# Interview NN — YYYY-MM-DD

**Participant**: [first name or handle only]
**Source**: [Reveal.js Discord / Reddit / Twitter / etc.]
**Duration**: 30 min

## Current workflow
<notes>

## Last deck — pain points
<notes>

## Magic wand answer
<quote>

## Demo reaction
<notes>

## Open feedback
<notes>

## Archetype signal
- [ ] Technical Educator
- [ ] Developer Who Hates Slides
- [ ] Open-Source Hoarder
- [ ] Academic Researcher
- [ ] Other: ___________

## Key quotes (3 max)
1. "..."
2. "..."
3. "..."

## Feature mentions (for v1.1+ backlog, NOT for RC feedback)
- ___________
```

---

## Links

- [TRACK-1-QUARTERLY-PLAN.md](../execution/TRACK-1-QUARTERLY-PLAN.md)
- [docs/vision/INTERVIEWS-2026-Q3/](INTERVIEWS-2026-Q3/)
- [docs/vision/COMPETITORS-WEEKLY/](COMPETITORS-WEEKLY/)
- [docs/ADR-021..030 (proposed)](../ADR-021-block-registry.md)
- [KILL-SWITCH-CONDITIONS.md](../execution/KILL-SWITCH-CONDITIONS.md)
