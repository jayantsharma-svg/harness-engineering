---
project: harness-engineering
version: 1
last_synced: 2026-06-25T16:24:53.529Z
last_manual_edit: 2026-06-25T18:09:53.192Z
---

# Roadmap

## Shipped

### Merge MCP into CLI

- **Status:** done
- **Spec:** docs/changes/merge-mcp-into-cli/proposal.md
- **Summary:** Eliminate standalone mcp-server package by moving source into CLI with unified binary and paths
- **Blockers:** —
- **Plan:** docs/changes/merge-mcp-into-cli/plans/2026-03-23-phase1-move-and-rewire-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#53

### Roadmap Pipeline Sync

- **Status:** done
- **Spec:** docs/changes/roadmap-pipeline-sync/proposal.md
- **Summary:** Embed automatic roadmap status updates into brainstorming, execution, and autopilot skills
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#54

### Orchestrator Package Implementation

- **Status:** done
- **Spec:** docs/changes/orchestrator/proposal.md
- **Summary:** Long-running daemon that polls issue trackers, dispatches coding agents in isolated workspaces, with Ink TUI and HTTP API observability
- **Blockers:** —
- **Plan:** docs/changes/orchestrator/plans/2026-03-24-orchestrator-foundation-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#55

### Efficient Context Pipeline

- **Status:** done
- **Spec:** docs/changes/efficient-context-pipeline/proposal.md
- **Summary:** Reduce token waste through session-scoped state, lean agent dispatch, token-budgeted learnings, session summaries, and a learnings-driven feedback loop
- **Blockers:** —
- **Plan:** docs/changes/efficient-context-pipeline/plans/2026-03-26-phase1-session-scoped-state-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#56

### Multi-Language Framework Templates

- **Status:** done
- **Spec:** docs/changes/multi-language-templates/proposal.md
- **Summary:** Extend template system to support 10 frameworks across 5 languages (TS/JS, Python, Go, Rust, Java) with auto-detection, existing project overlay, and language manifest
- **Blockers:** —
- **Plan:** docs/changes/multi-language-templates/plans/2026-03-27-phase1-engine-foundation-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#57

### AI Foundations Integration: Session Memory & Evidence Enforcement

- **Status:** done
- **Spec:** docs/changes/ai-foundations-integration/proposal.md
- **Summary:** Upgrade manage_state with accumulative session-scoped sections and establish evidence-based claims standard across all skills with review gate verification
- **Blockers:** —
- **Plan:** docs/changes/ai-foundations-integration/plans/2026-03-27-wave1-1-schema-types-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#58

### Autopilot Final Review Gate

- **Status:** done
- **Spec:** docs/changes/autopilot-final-review-gate/proposal.md
- **Summary:** FINAL_REVIEW state in autopilot state machine — holistic code review of all cumulative changes before PR creation, catching cross-phase issues and cumulative scope concerns
- **Blockers:** —
- **Plan:** docs/changes/autopilot-final-review-gate/plans/2026-03-28-state-machine-plumbing-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#59

### Force-Multiplier Integrations (Tier 1)

- **Status:** done
- **Spec:** docs/changes/force-multiplier-integrations/proposal.md
- **Summary:** Zero-config MCP peer integrations (Context7, Sequential Thinking, Playwright) and API-key integrations (Perplexity, Augment Code) with new `harness integrations` CLI command, `harness setup` auto-config, and `harness doctor` discovery
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#60

### CI Pipeline Hardening

- **Status:** done
- **Spec:** docs/changes/ci-pipeline-hardening/proposal.md
- **Summary:** Codecov integration, ratchet-only coverage baselines for all packages, Vitest benchmarks with 10% regression gates for core and graph, and post-publish smoke test — practice the standards harness enforces on others
- **Blockers:** —
- **Plan:** docs/changes/ci-pipeline-hardening/plans/2026-03-28-phase1-coverage-output-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#61

### Migration Toolkit

- **Status:** done
- **Spec:** none
- **Summary:** Config version codemods, breaking-change detection, and upgrade scripts for users moving between harness versions
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#62

### Onboarding Funnel

- **Status:** done
- **Spec:** docs/changes/onboarding-funnel/proposal.md
- **Summary:** `harness setup` single-command environment configuration, `harness doctor` lightweight diagnostics, and first-run welcome message bridging the install-to-productivity gap for new users
- **Blockers:** —
- **Plan:** docs/changes/onboarding-funnel/plans/2026-03-28-first-run-detection-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#63

### Runtime Enforcement Extensions

- **Status:** done
- **Spec:** docs/changes/runtime-enforcement-extensions/proposal.md
- **Summary:** `harness hooks` CLI command with profile-based hook activation (minimal/standard/strict), plus 18 new security scanner rules for agent config auditing and MCP server security
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#64

### Usage & Cost Tracking

- **Status:** done
- **Spec:** docs/changes/usage-cost-tracking/proposal.md
- **Summary:** Token spend visibility via `harness usage` CLI commands (daily, sessions, session, latest). LiteLLM pricing with static fallback, cost-at-read-time calculation, opt-in Claude Code session parsing. [ACE-B1]
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#65

### Skill Discipline Upgrades

- **Status:** done
- **Spec:** docs/changes/skill-discipline-upgrades/proposal.md
- **Summary:** Evidence Requirements, Red Flags, and Rationalizations to Reject sections for 8 high-traffic skills (code-review, security-scan, architecture-advisor, enforce-architecture, auth, api-design, database, deployment) via shared discipline template. [ACE-Batch1]
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#66
- **Updated-At:** 2026-04-19T21:38:46.393Z

### Documentation Auto-Generation

- **Status:** done
- **Spec:** docs/changes/docs-auto-generation/proposal.md
- **Summary:** Build script generating CLI Command Reference (76+ commands), MCP Tools Reference (54 tools), and Skills Catalog (79 skills) from code metadata. CI freshness check ensures generated docs never drift.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#67

### Security Rule Test Coverage

- **Status:** done
- **Spec:** docs/architecture/framework-gaps-assessment/ADR-001.md
- **Summary:** Unit tests for 8+ untested security rule implementations (crypto, XSS, path traversal, deserialization, network, stack-specific). Enforce coverage thresholds in CI as blockers, not warnings. [E9/E10]
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#68

### Harness Dashboard

- **Status:** done
- **Spec:** docs/changes/harness-dashboard/proposal.md
- **Summary:** Local web dashboard (`harness dashboard`) with Hono API + React SPA showing roadmap progress, codebase health, and graph metrics with SSE real-time updates
- **Blockers:** —
- **Plan:** docs/changes/harness-dashboard/plans/2026-04-06-dashboard-phase1-scaffolding-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#121

### Anti-Rationalization Standard

- **Status:** done
- **Spec:** docs/changes/anti-rationalization-standard/proposal.md
- **Summary:** Make ## Rationalizations to Reject a required section in all user-facing skills with domain-specific table format, universal entries defined once in skill authoring spec, hard error validation, and AI-generated backfill across ~112 skill SKILL.md files
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#117

### Design Knowledge Skills

- **Status:** done
- **Spec:** docs/changes/design-knowledge-skills/proposal.md
- **Summary:** 55 framework-agnostic design knowledge skills across 10 domains (Color, Typography, Layout, Gestalt, Interaction, Depth/Motion, Design Systems, Platform Languages, Visual Craft, Design Process) with cross-references to existing css-_/a11y-_ skills
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#128

### Performance Engineering Knowledge Skills

- **Status:** done
- **Spec:** docs/changes/knowledge-skills-wave-2/proposal.md
- **Summary:** ~45 framework-agnostic performance knowledge skills covering browser rendering pipeline, Core Web Vitals, network optimization, JS runtime, caching hierarchies, bundle strategy, memory management, and rendering strategies
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#129

### Database Design Knowledge Skills

- **Status:** done
- **Spec:** docs/changes/database-design-skills/proposal.md
- **Summary:** 42 ORM-agnostic database design knowledge skills (db-{topic} naming) covering normalization, indexing, query planning, schema patterns, ACID, transactions, concurrency, CAP/BASE, data modeling, migrations, connection management, and sharding — PostgreSQL-primary with bidirectional ORM cross-references
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#130

### Security Fundamentals Knowledge Skills

- **Status:** done
- **Spec:** docs/changes/security-fundamentals-knowledge-skills/proposal.md
- **Summary:** ~45 framework-agnostic security knowledge skills covering threat modeling, cryptography primitives, auth/authz design, zero-trust architecture, secrets management, transport security, supply chain security, and incident response
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#131

### API Design Knowledge Skills

- **Status:** done
- **Spec:** docs/changes/api-design-knowledge-skills/proposal.md
- **Summary:** 36 language-agnostic API design knowledge skills across 8 clusters, all 4 platforms, with bidirectional cross-references to 17 existing skills
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#132

### UX Writing and Content Design Knowledge Skills

- **Status:** done
- **Spec:** docs/changes/ux-writing-knowledge-skills/proposal.md
- **Summary:** ~25 knowledge skills covering microcopy principles, error message design, empty states, onboarding copy, CTAs, form labels, notification copy, loading states, voice and tone, and plain language — complements the design-\* skill domain
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#133

### Adoption & Usage Telemetry

- **Status:** done
- **Spec:** docs/changes/adoption-telemetry/proposal.md
- **Summary:** Hook-based skill invocation tracking via adoption.jsonl, surfaced in CLI commands and dashboard. Local-only, on by default.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#134

### Pipeline Token Optimization

- **Status:** done
- **Spec:** docs/changes/pipeline-token-optimization/proposal.md
- **Summary:** Artifact-based agent delegation and skill compression to reduce per-session token consumption in the brainstorming-to-autopilot pipeline
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#135

### MCP Response Compaction

- **Status:** done
- **Spec:** docs/changes/mcp-response-compaction/proposal.md
- **Summary:** Auto-compaction middleware on all harness MCP tool responses plus a dedicated compact tool with content/intent/ref modes, FusionLayer-backed aggregation, and graph-cached packed summaries.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#136

### Prompt Caching with Content Stability Classification

- **Status:** done
- **Spec:** docs/changes/prompt-caching-provider-adapters/proposal.md
- **Summary:** Content stability classification (static/session/ephemeral) with provider-specific cache adapters for Anthropic, OpenAI, and Gemini. Phase 5 of MCP Response Compaction.
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#137

### Paged MCP Tool Responses

- **Status:** done
- **Spec:** docs/changes/paged-mcp-tool-responses/proposal.md
- **Summary:** Replace lossy truncation with offset/limit pagination for 8 MCP tools (gather_context, query_graph, get_relationships, code_outline, review_changes, run_code_review, detect_anomalies, get_decay_trends). Shared PaginationMeta contract, relevance-sorted pages, per-tool defaults.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#145

### Hybrid Orchestrator: Local Model Routing with Web Dashboard

- **Status:** done
- **Spec:** docs/changes/hybrid-orchestrator/proposal.md
- **Summary:** Local LLM routing for autonomous execution of simple tasks, signal-gated escalation to humans for complex work, web dashboard with Claude chat pane for human reasoning, OpenAI-compatible local backend.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#194

### Intelligence Pipeline

- **Status:** done
- **Spec:** docs/changes/intelligence-pipeline/proposal.md
- **Summary:** Spec enrichment (SEL), complexity modeling (CML), and pre-execution simulation (PESL) layers in packages/intelligence/. Augments hybrid orchestrator routing with graph-backed complexity scoring and tiered simulation.
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#152

### Dashboard Chat Panel

- **Status:** done
- **Spec:** docs/changes/dashboard-chat-panel/proposal.md
- **Summary:** Collapsible side panel on every dashboard page providing full interactive Claude sessions with command palette, contextual launch, multi-session tabs, and .harness artifact linkage
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#151

### Bidirectional Analysis Sync via Tracker Comments

- **Status:** done
- **Spec:** docs/changes/analysis-tracker-sync/proposal.md
- **Summary:** Auto-publish analysis results as structured tracker comments and pull them back locally via sync-analyses
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#150

### Multi-Orchestrator Claim Coordination

- **Status:** done
- **Spec:** docs/changes/multi-orchestrator-claim-coordination/proposal.md
- **Summary:** Claim-based coordination layer that uses the external tracker to prevent duplicate dispatch when multiple orchestrators run against the same issue source
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#195

### Orchestrator PR-Aware Dispatch Guard

- **Status:** done
- **Spec:** docs/changes/orchestrator-pr-aware-dispatch/proposal.md
- **Summary:** Pre-filter in orchestrator tick that checks candidate externalId against GitHub PR state, skipping dispatch for features with open PRs and failing open on API errors
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#196

### Docker Containerization

- **Status:** done
- **Spec:** docs/changes/docker-containerization/proposal.md
- **Summary:** Docker images for CLI, MCP server, orchestrator, and dashboard with multi-stage Dockerfile, docker-compose stack, and CI publishing to ghcr.io
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#216
- **Updated-At:** 2026-04-18T01:02:20.571Z

### Orchestrator Session Recording

- **Status:** done
- **Spec:** docs/changes/orchestrator-session-recording/proposal.md
- **Summary:** Record full agent event streams as JSONL, persist until PR closed, replay in dashboard, post highlights to PRs
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#231
- **Updated-At:** 2026-04-21T17:39:54.491Z

### Integration Phase

- **Status:** done
- **Spec:** docs/changes/integration-phase/proposal.md
- **Summary:** New INTEGRATE state between VERIFY and REVIEW — shifts integration design left into brainstorming/planning, adds tiered wiring verification, ADR materialization in docs/knowledge/decisions/, and knowledge graph enrichment
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#252

### Dashboard Reorganization — Chat-First Architecture with Expandable Domain Navigation

- **Status:** done
- **Spec:** docs/changes/dashboard-reorganization/proposal.md
- **Summary:** Restructure dashboard from 13 flat nav items to 4 expandable domain pills, elevate chat to persistent right column, replace KPI-wall overview with triage feed.
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#253
- **Updated-At:** 2026-04-28T11:58:15.870Z

### Chat-First Dashboard Rewrite

- **Status:** done
- **Spec:** docs/changes/dashboard-reorganization/proposal.md
- **Summary:** Thread-centric messaging-app layout replacing the page-based dashboard. Five thread types (chat, attention, analysis, agent, system), zustand ThreadStore, right context panel for live session state, big-bang delivery.
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#254
- **Updated-At:** 2026-04-28T21:15:07.038Z

### Roadmap Page Enhancement: Feature Table with Claim Workflow

- **Status:** done
- **Spec:** docs/changes/roadmap-page-enhancement/proposal.md
- **Summary:** Replace Gantt chart with milestone-grouped feature table, stats bar, assignment history, and inline claim workflow with smart routing to brainstorming/planning/execution based on feature state. GitHub identity resolution and tracker sync on claim.
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#255
- **Updated-At:** 2026-04-28T22:17:57.331Z

### Init Skill — Design System & Roadmap Configuration

- **Status:** done
- **Spec:** docs/changes/init-design-roadmap-config/proposal.md
- **Summary:** Promote on_project_init triggers from declared-but-unused to actively invoked: ask 'Will this project have a UI?' (configure-only, sets design.enabled in harness.config.json) and 'Set up project roadmap now?' (creates docs/roadmap.md); auto-link 'Set up design system' as planned roadmap item when both yes.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#256

### Configurable Domain Inference for Knowledge Pipeline

- **Status:** done
- **Spec:** docs/changes/knowledge-domain-classifier/proposal.md
- **Summary:** Extract inferDomain to a shared helper in @harness-engineering/graph; wire into KnowledgeStagingAggregator and CoverageScorer; add knowledge.domainPatterns and knowledge.domainBlocklist config schema. Closes the unknown-domain bucket (7,500 → <100 on this repo) and makes per-domain coverage grades meaningful. Configurable + sensible defaults + reserved blocklist for general-purpose use across projects.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#258

### Local Model Array Fallback with Resolver Consolidation

- **Status:** done
- **Spec:** docs/changes/local-model-fallback/proposal.md
- **Summary:** Widen orchestrator agent.localModel to string|string[] with periodic /v1/models probe; consolidate local-config reads behind a LocalModelResolver; surface dashboard warning when no candidate is loaded.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#296

### Multi-Backend Routing for the Orchestrator

- **Status:** done
- **Spec:** docs/changes/multi-backend-routing/proposal.md
- **Summary:** Redesign agent backend selection: agent.backends (named map) + agent.routing (per-use-case selection). Promotes local/pi to first-class backends. In-memory migration shim for legacy agent.backend / agent.localBackend. Reuses LocalModelResolver from Spec 1.
- **Blockers:** —
- **Plan:** docs/changes/multi-backend-routing/plans/
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#297

### Tracker-Only Roadmap (File-less Mode)

- **Status:** done
- **Spec:** docs/changes/roadmap-tracker-only/proposal.md
- **Summary:** Opt-in mode where the configured external tracker is the canonical roadmap, eliminating docs/roadmap.md as a multi-session conflict surface
- **Blockers:** —
- **Plan:** docs/changes/roadmap-tracker-only/plans/
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#308

### Orchestrator Main-Branch Sync

- **Status:** done
- **Spec:** docs/changes/orchestrator-main-sync/proposal.md
- **Summary:** Periodic 15-min cron task to fast-forward the orchestrator's local default branch from origin (FF-only, surfaced warnings); plus dashboard generalization so "Run Now" works for any maintenance task.
- **Blockers:** —
- **Plan:** docs/changes/orchestrator-main-sync/plans/
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#309

### Local Model Lifecycle Manager (LMLM)

- **Status:** done
- **Spec:** docs/changes/local-model-lifecycle-manager/proposal.md
- **Summary:** Hardware-aware local model recommender, pool-bounded autonomy with proposal loop, Ollama-first install, dashboard + CLI surfaces. Approved by Chad 2026-05-24.
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#386
- **Updated-At:** 2026-05-29T21:50:50.314Z

### Granular Task→Backend Routing

- **Status:** done
- **Spec:** docs/changes/granular-task-routing/proposal.md
- **Summary:** Per-skill + per-cognitive-mode backend routing with fallback chains and decision telemetry (events, ring buffer, dashboard panel, trace CLI). ~3.5-week scope. Complements LMLM. Approved by Chad 2026-05-24.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#391

### Central Telemetry Collection

- **Status:** done
- **Spec:** docs/changes/central-telemetry/proposal.md
- **Summary:** Anonymous product analytics via PostHog HTTP API with granular opt-in identity and zero vendor dependencies
- **Blockers:** —
- **Plan:** docs/changes/central-telemetry/plans/2026-04-10-central-telemetry-phase1-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#138
- **Updated-At:** 2026-06-02T12:42:00.000Z

### Compound Engineering Adoption: Strategic Anchor

- **Status:** done
- **Spec:** docs/changes/compound-engineering-adoption/strategic-anchor/proposal.md
- **Summary:** Phases 1-6 shipped (schema, harness-strategy skill, init wiring, harness-ideate skill, brainstorming + roadmap-pilot grounding). Phases 7 (BusinessKnowledgeIngestor strategy domain) and 8 (ADRs + AGENTS.md "Strategic Anchor" section) outstanding.
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#262
- **Updated-At:** 2026-06-02T23:19:00.486Z

### Compound Engineering Adoption: Feedback Loops

- **Status:** done
- **Spec:** docs/changes/compound-engineering-adoption/feedback-loops/proposal.md
- **Summary:** Add harness-pulse and harness-compound skills with two new report-only maintenance tasks (product-pulse daily, compound-candidates weekly). Closes the read-side and post-mortem capture gaps. Deprecates .harness/learnings.md.
- **Blockers:** —
- **Plan:** docs/changes/compound-engineering-adoption/feedback-loops/plans/2026-05-05-feedback-loops-phase-1-schema-foundations-plan.md, docs/changes/compound-engineering-adoption/feedback-loops/plans/2026-05-05-feedback-loops-phase-2-harness-compound-skill-plan.md, docs/changes/compound-engineering-adoption/feedback-loops/plans/2026-05-05-feedback-loops-phase-3-harness-pulse-skill-interview-plan.md, docs/changes/compound-engineering-adoption/feedback-loops/plans/2026-05-05-feedback-loops-phase-4-pulse-run-cli-plan.md, docs/changes/compound-engineering-adoption/feedback-loops/plans/2026-05-05-feedback-loops-phase-5-compound-scan-candidates-cli-plan.md, docs/changes/compound-engineering-adoption/feedback-loops/plans/2026-05-05-feedback-loops-phase-6-maintenance-task-registration-plan.md, docs/changes/compound-engineering-adoption/feedback-loops/plans/2026-05-05-feedback-loops-phase-7-orchestrator-cross-skill-integration-plan.md, docs/changes/compound-engineering-adoption/feedback-loops/plans/2026-05-05-feedback-loops-phase-8-documentation-and-adrs-plan.md
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#263
- **Updated-At:** 2026-06-02T13:41:59.609Z

### Compound Engineering Adoption: Review Depth

- **Status:** done
- **Spec:** docs/changes/compound-engineering-adoption/review-depth/proposal.md
- **Summary:** Add adversarial reviewer + framework-persona reviewers (typescript-strict, frontend-races) + Quick/Standard/Deep depth calibration in harness-code-review. Standardizes anchored confidence rubric and unified findings schema across all review personas.
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#264
- **Updated-At:** 2026-06-02T13:47:40.063Z

### Optional canary Integration for harness Test Skills

- **Status:** done
- **Spec:** docs/changes/canary-test-integration/proposal.md
- **Summary:** Add canary as an optional, gracefully-degrading dependency on the test surface via a single CanaryAdapter that execs canary-test-cli and parses JSON; gated by a Phase 0 verification spike. All 4 phases shipped (adapter core, MCP tools + audit wiring, docs/ADR, validation). PR #596 and #597 both merged.
- **Blockers:** —
- **Plan:** docs/changes/canary-test-integration/plans/2026-06-23-canary-adapter-core-plan.md, docs/changes/canary-test-integration/plans/2026-06-23-phase-2-skill-wiring-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#590

### Dashboard v2: Orchestrator Observability

- **Status:** done
- **Spec:** —
- **Summary:** Real-time agent monitoring in the harness dashboard — agent dispatch status, issue progress, resource usage, error rates — via orchestrator HTTP API and WebSocket
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#123

### CI/CD & Issue Tracker Integration

- **Status:** done
- **Spec:** docs/changes/ci-cd-issue-tracker-integration/proposal.md
- **Summary:** Automated CI/CD pipeline and issue tracker integration for harness workflows
- **Blockers:** —
- **Plan:** docs/changes/ci-cd-issue-tracker-integration/plans/2026-03-17-ci-cd-issue-tracker-integration-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#102

### Skill Discipline Upgrades — ACE Batch 2

- **Status:** done
- **Spec:** docs/architecture/awesome-claude-code-integration/ADR-001.md
- **Summary:** Add Rationalizations to Reject, Iron Laws, Red Flags, review-never-fixes, read-only research, TDD skill authoring, rubric compression, uncertainty surfacing, and comment replacement guards across 8+ discipline-enforcing skills. Inspired by Trail of Bits and Superpowers patterns. [ACE-Batch1]
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#103
- **Updated-At:** 2026-04-19T21:47:07.130Z

### Sentinel: Prompt Injection Defense

- **Status:** done
- **Spec:** docs/changes/sentinel-prompt-injection-defense/proposal.md
- **Summary:** Multi-layered prompt injection defense — sentinel hooks (Claude Code) + MCP middleware (Gemini CLI) for runtime scanning, session-scoped restrictive taint model with 30-min expiry, and CLAUDE.md config scanning on clone with tiered response. [ACE-A1/A9]
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#104

### Context Efficiency Pipeline

- **Status:** done
- **Spec:** docs/changes/context-efficiency-pipeline/proposal.md
- **Summary:** Rigor-level controls (--fast/--thorough), ephemeral scratchpad offloading, Jaccard-scored learnings in code review (>=0.7 threshold), two-pass planning with skeleton approval, commands-over-skills audit, and checkpoint commits in autopilot. Foundation-then-fan-out delivery across 5 phases. [ACE-Batch3]
- **Blockers:** —
- **Plan:** docs/changes/context-efficiency-pipeline/plans/2026-03-30-context-efficiency-foundation-plan.md
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#105

### Usage & Cost Tracking: Orchestrator Aggregation

- **Status:** done
- **Spec:** docs/architecture/awesome-claude-code-integration/ADR-001.md
- **Summary:** Orchestrator and team-level cost aggregation, cross-project spend comparison, and dashboard export. Builds on the core Usage & Cost Tracking feature (Current Work section). [ACE-B1 phase 2]
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#106
- **Updated-At:** 2026-04-20T01:30:14.927Z

### Agent Config Validation

- **Status:** done
- **Spec:** docs/changes/agent-config-validation/proposal.md
- **Summary:** harness validate --agent-configs with agnix hybrid approach — shell out to agnix binary when available (385 rules), fall back to ~20 highest-value TypeScript rules (broken agents, invalid hooks, unreachable skills, oversized CLAUDE.md). Ship .agnix.toml template in harness init. [ACE-B2]
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#107

### Security Skill Deepening

- **Status:** done
- **Spec:** docs/changes/security-skill-deepening/proposal.md
- **Summary:** FP verification gate requiring justification for harness-ignore suppressions. Insecure defaults / fail-open detection (SEC-DEF-_ rules + AI review). New harness:supply-chain-audit skill with 6-factor dependency risk evaluation. Sharp-edges checks (SEC-EDGE-_) for deprecated crypto, unsafe deserialization, TOCTOU, stringly-typed security. Adapted from Trail of Bits security skills. [ACE-Batch4]
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#108

### Hook Authoring & TDD Guard

- **Status:** done
- **Spec:** docs/architecture/awesome-claude-code-integration/ADR-001.md
- **Summary:** harness generate hooks command with opinionated presets: --preset tdd (AST test counting via @ast-grep/napi, hook-based Red-Green-Refactor enforcement), --preset security (parry integration, file guard), --preset checkpoint (git stash auto-save on Stop), --preset audit (session logging). Node.js target for broad compatibility. Inspired by claude-hooks and TDD Guard. [ACE-B3/B4]
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#109

### Container Sandboxing

- **Status:** done
- **Spec:** docs/architecture/awesome-claude-code-integration/ADR-001.md
- **Summary:** Start with Docker --read-only + --user flags for simple orchestrator sandboxing. Evaluate Container Use (Dagger) MCP client as upgrade path — 13 MCP tools, immutable container state, git-branch isolation. Implement ContainerBackend interface alongside existing ClaudeBackend. Secret backends via 1Password, Vault, env vars. [ACE-A2]
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#110
- **Updated-At:** 2026-04-18T00:54:47.848Z

### Session Search & DX Tooling

- **Status:** done
- **Spec:** docs/architecture/awesome-claude-code-integration/ADR-001.md
- **Summary:** harness sessions search with SQLite FTS5 indexing — searchable by phase, persona, skill, plan_id, content. Phrase boosting with recency-weighted ranking. Desktop notification hooks via node-notifier for autopilot/orchestrator completion. Git stash auto-checkpoint hook preset (non-destructive, max 10 with cleanup). Inspired by recall and CC Notify. [ACE-B5/B6/B7]
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#111

### Structured Learnings Enhancement

- **Status:** done
- **Spec:** docs/architecture/awesome-claude-code-integration/ADR-001.md
- **Summary:** Optional root_cause and tried_and_failed fields for learning entries. Semantic overlap check (5-dimension scoring) before creating new entries — prevents near-duplicate learnings with different wording. Active staleness detection auditing learnings against current code state. Learnings-researcher as always-on reviewer in code review pipeline. Inspired by Compound Engineering Plugin. [ACE-C5/C6]
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#112
- **Updated-At:** 2026-04-19T22:08:54.223Z

### Advanced Review Pipeline

- **Status:** done
- **Spec:** docs/architecture/awesome-claude-code-integration/ADR-001.md
- **Summary:** Meta-judge pre-generation for --thorough review mode (task-specific rubric before seeing implementation). Two-stage isolated review splitting spec-compliance from code-quality with separate context. findParallelGroups algorithm for automatic parallelization from dependency graphs. Tiered MCP tool loading (core/standard/full, measure first). Triage routing for orchestrator dispatch. Inspired by Context Engineering Kit, Superpowers, sudocode, and Claude Task Master. [ACE-Batch6]
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#113

### Protected Code Regions

- **Status:** done
- **Spec:** docs/architecture/agent-skills-comparative/ADR-001.md
- **Summary:** harness-ignore annotation system for code-modifying skills — block-level protection preventing agent modification of performance-critical, compliance-required, or legally-sensitive code during refactoring and cleanup operations
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#118

### Context Budget System

- **Status:** done
- **Spec:** docs/architecture/agent-skills-comparative/ADR-001.md
- **Summary:** Explicit token budgets in skill.yaml (context_budget field) with 5-level progressive loading hierarchy (rules → spec → source → errors → history). Triggered when skill count approaches 100.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#119

### MCP Degraded Mode

- **Status:** done
- **Spec:** docs/architecture/agent-skills-comparative/ADR-001.md
- **Summary:** Degraded mode spec in SKILL.md documenting fallback behavior for each MCP tool call. Skills remain functional (with reduced capabilities) without MCP server, enabling multi-platform export to Cursor, Gemini CLI, Windsurf.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#120

### ESLint: Async IO Enforcement

- **Status:** done
- **Spec:** —
- **Summary:** Migrate 30+ sync fs calls in async functions to async equivalents, then enable the no-sync-io-in-async ESLint rule to prevent event loop blocking in orchestrator and CLI hot paths
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#217

### ESLint: Boundary Schema Validation

- **Status:** done
- **Spec:** —
- **Summary:** Configure API boundary functions and enable the require-boundary-schema ESLint rule to enforce Zod validation at HTTP handlers, MCP tools, and CLI command entry points
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#218

### ESLint: Performance-Critical Loop Guards

- **Status:** done
- **Spec:** —
- **Summary:** Add @perf-critical annotations to hot-path functions (graph traversal, scan pipeline, state machine tick) and enable the no-nested-loops-in-critical ESLint rule to prevent O(n²) regressions
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#219

### ESLint Rule: no-process-env-in-spawn

- **Status:** done
- **Spec:** —
- **Summary:** New ESLint rule to flag spawn/execFile/fork calls that pass process.env directly, which leaks all server-side secrets to subprocesses. 5 instances in codebase. Require explicit env allowlist construction.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#221

### harness:design-pipeline orchestrator

- **Status:** done
- **Spec:** —
- **Summary:** Initiative parent. **Two-layer architecture (decomposition refined 2026-05-23):** the FLOOR-RAISING layer (consistency engine, rule-based) is sub-projects #1-#4 + #0 brand-guidelines decision. The CEILING-RAISING layer (craft elevator, LLM-judgment-based) is sub-project #6 design-craft-elevator — a fundamentally different infrastructure (LLM critique passes, polish pattern library, exemplar corpus) that produces stunning output not just consistent output. Floor + ceiling together = world-class designs; floor alone = consistent mediocrity. Sub-projects: #1 detect-design-drift + align-design-system, #2 audit-component-anatomy, #3 audit-brand-compliance (blocked on #0 brand-guidelines decision), #4 harness check-design verifier, #5 (this entry) the orchestrator composing all sub-projects with FRESHEN/DETECT/FIX/AUDIT/FILL/REPORT phases mirroring harness-docs-pipeline, #6 design-craft-elevator (ceiling-raising LLM-judgment work). Existing operational dependency wired in as-is: harness-accessibility. See memory project_design_pipeline_idea.md. **Prior-art bar (must-beat references for all sub-projects):** docs/changes/design-pipeline/REFERENCES.md. #1-#4 lean on REFERENCES.md entries #5-#10 (DTCG, ESLint plugins, anatomy specs). #6 leans on REFERENCES.md entries #2, #3, #4 (impeccable, emil-design-eng, huashu-design).
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#316

### design-pipeline sub-project #1: detect-design-drift + align-design-system

- **Status:** done
- **Spec:** docs/changes/design-pipeline/detect-design-drift/proposal.md + docs/changes/design-pipeline/align-design-system/proposal.md
- **Summary:** Detection skill (detect-design-drift) and remediation skill (align-design-system) for token bypass and components not adopting design-system primitives. Pattern-mirrors detect-doc-drift + align-documentation. Shipped across four PRs: (1) PR #396 / commit 42153282 — `detect-design-drift` verifier (`packages/cli/src/drift/`) with `DRIFT-T001`/`T002`/`T003`/`T004` token-bypass rules and `DRIFT-P001`–`P004` primitive-adoption rules, composed as the third verifier in `harness check-design`. (2) PR #397 / commit e4134d34 — `align-design-system` FIX skill (`packages/cli/src/align/`) with T001/T002/T003 regex codemods, T004 + all P\* precise suggestions, pre-flight classifier, standalone CLI + MCP tool, and pipeline-handoff field (`pipeline.driftFindings` ↔ `pipeline.fixesApplied`) for the (future) #5 orchestrator. (3) PR #428 / commits 7537425d + 8ce1a0db — `--revert` flag with SHA-256 content-hash safety, single-batch state at `.harness/align/last-batch.json`, and pipeline-mode orchestrator integration. (4) PR #435 / commit cf54d7db — catalog registries (`packages/cli/src/{drift,align}/catalog/index.ts`) as single-source-of-truth for v1 DRIFT-\* codes + align participation, plus public `exports.ts` surfaces matching `audit/component-anatomy/exports.ts` so the #5 orchestrator (now shipped in PR #400) can compose drift + align uniformly. Variant proliferation (`DRIFT-V*`) and primitive-adoption codemods deferred to v1.x on both detect and align sides; v1 bar is "no false positives" not "highest fix volume."
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#354

### design-pipeline sub-project #2: audit-component-anatomy

- **Status:** done
- **Spec:** docs/changes/design-pipeline/audit-component-anatomy/proposal.md
- **Summary:** Audit skill detecting missing required anatomy parts (label, helper text, error state, loading state, empty state). Rules sourced from design-component-anatomy reference content. Lowest-ambiguity sub-project. Needs documented overlap-resolution with harness-accessibility (no double-counting label-missing findings).
- **Blockers:** —
- **Plan:** docs/changes/design-pipeline/audit-component-anatomy/plans/2026-05-23-audit-component-anatomy-plan.md
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#355
- **Updated-At:** 2026-05-30T19:57:15.090Z

### design-pipeline sub-project #3: audit-brand-compliance

- **Status:** done
- **Spec:** docs/changes/design-pipeline/audit-brand-compliance/proposal.md
- **Summary:** Audit skill for semantic token misuse, brand voice violations in copy, and asset misuse. Highest-ambiguity sub-project. Blocked on brand-guidelines source-of-truth decision (sub-project #0): extend DESIGN.md schema with structured brand rules, or add a brand-guidelines authoring skill. Overlaps with #1 — raw token bypass goes to #1, semantic misuse to this.
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#356

### design-pipeline sub-project #4: harness check-design verifier

- **Status:** done
- **Spec:** docs/changes/design-pipeline/check-design-verifier/proposal.md
- **Summary:** Convergence-verifier the design align skills rerun after each fix batch — equivalent of harness check-docs in docs-pipeline. Two options to decide during brainstorm: new harness check-design CLI command vs. extension of harness validate. Hooks into existing DesignConstraintAdapter. Prerequisite for the align skill in sub-project #1. Shipped in PR #394 (commit d1c9bda5): new `harness check-design` CLI command composing audit-anatomy + design-craft critique with direct programmatic invocation, graph persistence via `DesignConstraintAdapter.recordFindings()`, graceful per-verifier degradation, and exit-code semantics matching `check-docs` (0 clean / 1 error findings / 2 verifier failure). Subsequent design-pipeline sub-projects #1 (detect-design-drift) and #3 (audit-brand-compliance) were folded in as additional verifiers per the proposal's "5-line addition" plan. The Verifier-shape convention noted in the v1 comment was formally extracted into `packages/cli/src/shared/verifier.ts` at the 4th-verifier threshold (audit-brand-compliance, PR for sub-project #3).
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#357

### design-pipeline sub-project #0: brand-guidelines source-of-truth

- **Status:** done
- **Spec:** docs/knowledge/decisions/0028-brand-guidelines-source-of-truth.md
- **Summary:** ADR-style decision artifact (hours, not days). Choose: (a) extend DESIGN.md schema with a structured brand-rules block — and claim the DTCG `$extensions.harness.brand` namespace as the de-facto open schema, or (b) new brand-guidelines authoring skill. Strategic urgency: Frontify shipped Brand-Intelligence-as-MCP (vendor-locked); DTCG `$extensions` vendor prefix is first-come-first-served. Output: one-page ADR + schema sketch if path (a). Unblocks sub-project #3 (audit-brand-compliance). Load REFERENCES.md tier-1 entries #1, #5, #11, #12, #41 before starting.
- **Blockers:** —
- **Plan:** —
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#370

### design-pipeline sub-project #6: design-craft-elevator

- **Status:** done
- **Spec:** docs/changes/design-pipeline/design-craft-elevator/proposal.md
- **Summary:** CEILING-RAISING counterpart to sub-projects #1-#4 (which are floor-raising / consistency-engine work). LLM-judgment-based craft elevator that produces stunning, professional-tier output — not just consistent output. Three distinct capability classes, each requiring different infrastructure than the rule-based audits: (a) aesthetic critique — LLM passes with curated rubrics that flag muddy hierarchy, nested cards, low-contrast accents, generic spinners where skeletons belong; pattern-mirrors REFERENCES.md tier-1 #2 (impeccable.style /impeccable polish commands) and #4 (alchaincyf/huashu-design 5-dimension critique with radar output). (b) Polish pattern library — vocabulary of high-craft moves to APPLY (not enforce): spring physics with named constants, stagger timing, easing curves per gesture, skeleton-matches-content-shape, progressive corner rounding; pattern-mirrors REFERENCES.md tier-1 #3 (emilkowalski/skill emil-design-eng SKILL.md). (c) Exemplar-driven targets — curated reference corpus of "this is the bar" anchors per component type (Linear empty list, Stripe loading state, Raycast command palette, Vercel error page); enables visual/LLM-evaluated proximity-to-exemplar scoring. Fundamentally different infrastructure from #1-#4: LLM passes (not AST/tree-sitter queries), pattern application (not constraint enforcement), exemplar corpus (not rule catalog). Composes into #5 orchestrator alongside the floor-raising audits. See docs/changes/design-pipeline/REFERENCES.md tier-1 entries #2, #3, #4 for direct prior art.
- **Blockers:** —
- **Plan:** docs/changes/design-pipeline/design-craft-elevator/plans/2026-05-23-design-craft-elevator-plan.md
- **Assignee:** @chadjw
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#371
- **Updated-At:** 2026-06-01T02:05:29.562Z

### craft-pipeline sub-project #1: naming-craft

- **Status:** done
- **Spec:** docs/changes/craft-pipeline/naming-craft/proposal.md
- **Summary:** LLM-judgment skill that critiques identifier names across the codebase (variables, functions, types, modules, files, branches, commit subjects). NO rule-based floor counterpart exists — naming is universally judgment-bound; no published tool tries this. Ceiling questions: does this name carry weight? is it concrete or vague? does it match the codebase's naming gravity? are there better candidates? does this name predict the thing's behavior? Cross-cutting skill that embeds via PR-review-time invocation; the other craft skills (docs-craft, test-craft, code-craft) can call into it for their domain-specific naming dimensions. Follows ADRs 0018-0021. Likely smallest scope of the craft family (~1 week build); naming heuristics are well-codified (Robert C. Martin, Phil Karlton, Beck) so the catalog of rubrics is bounded. Shipped in PR #402.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#375

### craft-pipeline sub-project #3: test-craft

- **Status:** done
- **Spec:** docs/changes/craft-pipeline/test-craft/proposal.md
- **Summary:** LLM-judgment skill for test quality — the ceiling counterpart to harness-tdd (procedural), coverage thresholds, and test-pattern scaffolding skills (which enforce structure). Ceiling questions: does this test add signal? does the test name describe the contract or just narrate the code? is the assertion meaningful or just present? what would deleting this test lose? does the test ARRANGE-ACT-ASSERT cleanly or interleave? are fixtures earning their setup cost? Tests are often the worst-written code in a codebase precisely because the rule-based floor is so easy to clear. Follows ADRs 0018-0021. Exemplars from well-tested OSS: React Testing Library docs, vitest's own tests, well-cited "good test" examples from Kent Beck / Martin Fowler. Shipped in PR #407 (vitest/jest/mocha/playwright).
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#377

### craft-pipeline sub-project #5: copy-craft

- **Status:** done
- **Spec:** docs/changes/craft-pipeline/copy-craft/proposal.md
- **Summary:** LLM-judgment skill for ALL prose-in-code: error messages, log lines, CLI output strings, commit message subjects, PR descriptions, code comments. Primary domain is error messages (universally bad in most codebases). NO rule-based floor exists (closest adjacency is harness-accessibility checking aria-label presence, but that's structural not quality). Ceiling questions for errors: does this tell WHAT/WHY/HOW-TO-FIX? would the user know what to do next? is the wording calm and specific or panicky/vague? For log lines: does this carry signal or noise? does it survive grep? Commit messages: would a stranger understand this in 6 months? does the subject describe the change or the work? Follows ADRs 0018-0021. Composes with design-craft-elevator (which owns UI copy in components) and #2 docs-craft (which owns prose docs). Shipped in PR #405 (all 6 surfaces).
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#380

### craft-pipeline sub-project #6: spec-craft

- **Status:** done
- **Spec:** docs/changes/craft-pipeline/spec-craft/proposal.md
- **Summary:** LLM-judgment skill for spec quality — the ceiling counterpart to harness-soundness-review (which checks structural completeness: required sections present, success criteria observable, integration points populated). Ceiling questions: is this spec sharp or vague? does it cut at the joints? would two readers walk away with the same understanding? what's the load-bearing decision vs. ambient context? are the rationalizations honest? is each non-goal actually a non-goal or smuggled assumption? would a stranger picking up this spec in 6 months still be able to act? Highest-leverage craft skill because spec quality compounds across the entire planning → implementation → review lifecycle below it. Follows ADRs 0018-0021. Composes with harness-brainstorming (where specs are authored) and harness-soundness-review (rule-based floor). Shipped in PR #403 (also triggered the shared/craft extraction).
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#381

### craft-pipeline sub-project #9: knowledge-craft

- **Status:** done
- **Spec:** docs/changes/craft-pipeline/knowledge-craft/proposal.md
- **Summary:** LLM-judgment skill for knowledge-entry quality — the ceiling counterpart to harness-knowledge-pipeline (procedural ingestion + reconciliation) and harness-detect-doc-drift (structural). Ceiling questions: does this docs/knowledge/ entry state a load-bearing fact or paraphrase the code? would deleting it lose anything specific or just redundant? does it earn its place in the graph as a business_fact / business_rule / business_concept? is the entry stating a TRUTH about the domain that a code reader couldn't derive from reading the code itself? Does it carry forward decisions that would otherwise erode? Follows ADRs 0018-0021. Composes with harness-knowledge-pipeline. Shipped in PR #409 (`docs/knowledge/` per-file critique, excluding `decisions/` which is spec-craft territory; KNOW-R003 names graph taxonomy without runtime graph reads).
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#384

### craft-pipeline sub-project #10: security-craft

- **Status:** done
- **Spec:** docs/changes/craft-pipeline/security-craft/proposal.md
- **Summary:** LLM-judgment skill for security posture — the ceiling counterpart to harness-security-scan (CVE / OWASP rule-based) and harness-security-reviewer (procedural review). Threat-modeling-as-skill rather than pattern-checking. Ceiling questions: is this trust boundary respected or accidentally bridged? where's the implicit privilege escalation? does this code defend in depth or just at the gate? is principle of least authority honored in shape? what's the assumed adversary and does the code respect it? where does data flow cross a trust boundary unannounced? Hardest-to-land-well of the craft family — judgment-based security risks both false positives (overcaution paralyzes shipping) and false negatives (missed real issues). v1 mitigates the FP risk with three layers: AST-driven signal detection (files with zero signals are skipped), per-rubric appliesToSignals pre-filter, conservative-confidence system prompt biasing the LLM toward `medium` confidence. Shipped in PR #410 (8 seed rubrics SEC-R001…SEC-R008, 7 signal kinds, new CLI `harness security-craft`, new MCP tool `security_craft`; follow-up PRs #412 and #415 hardened signals.ts comment FPs and refreshed baselines). Sixth craft-pipeline sub-project to ship (of 10); #2 docs-craft, #4 code-craft, #7 api-craft, #8 cli-ergonomics remain planned and still block the orchestrator.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#385

### Stop the pre-commit auto-baseline-update for arch

- **Status:** done
- **Spec:** docs/changes/stop-arch-auto-baseline/proposal.md
- **Summary:** `.husky/pre-commit` lines 4-12 detect arch regressions in module-size/dependency-depth and silently auto-update the baseline + re-stage the change, letting the commit proceed. This is the article's failure pattern #5 verbatim: "A harness that warns but doesn't stop is not a harness. It's a notification." Remove the auto-update branch entirely. If `harness ci check` exits non-zero, the commit must fail. The human (or agent) explicitly runs `harness check-arch --update-baseline` and stages it as a visible change. Source: Pass 1 #1 (CRITICAL — single most damning finding).
- **Blockers:** —
- **Plan:** —
- **Assignee:** chad.warner@gmail.com
- **Priority:** P0
- **External-ID:** github:Intense-Visions/harness-engineering#525

### Build harness:outcome-eval skill

- **Status:** done
- **Spec:** docs/changes/outcome-eval/proposal.md
- **Summary:** The article's named #1 industry gap and the project's largest single missing piece. LLM-judgment skill that reads the spec's user-visible-behavior section + the diff + test outputs and produces a structured "did this satisfy the spec" verdict. Wire into `harness.orchestrator.md` as step 6.5 between code-review and ship. Wire into CI workflow template (item below) as required check. Uses existing primitives in `packages/intelligence` (PESL simulator, effectiveness scorer with graph-attributed execution_outcome nodes, SEL spec enrichment). Confidence calibration similar to `harness:security-craft` to manage false-positive risk. Source: Pass 1 #3, Pass 2 #3 (CRITICAL).
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** P0
- **External-ID:** github:Intense-Visions/harness-engineering#532

### Ship the 5-signal dashboard panel and signals.md doc

- **Status:** done
- **Spec:** docs/changes/five-signal-dashboard-panel/proposal.md
- **Summary:** Article gear item #7: "the five or six signals that, if any of them moves, the senior wants to know inside the hour." Today the dashboard surfaces operational data (maintenance, routing) but no curated signal layer. Pick five: PR-merged-without-multi-persona-review, coverage-trend-down-30d, complexity-trend-up-30d, baseline-auto-update-count, eval-fail-rate. Render as the dashboard's default landing view. Document the picked five in new `docs/standard/signals.md`. Source: Pass 1 #5, Pass 2 #4, Pass 3 #11.
- **Blockers:** —
- **Plan:** —
- **Assignee:** chad.warner@capillarytech.com
- **Priority:** P0
- **External-ID:** github:Intense-Visions/harness-engineering#534

### Build harness:audit-harness-strength self-audit skill

- **Status:** done
- **Spec:** docs/changes/audit-harness-strength/proposal.md
- **Summary:** Inspects the adopter's own harness.config.json, pre-commit hooks, CI workflows, branch protection, hook profile, and skill catalog usage against the seven gear pieces from the article AND the seven mechanical failure patterns the dogfood audit surfaced. Reports per-piece score and concrete remediation steps. **Must enumerate these seven patterns as mechanical checks (not generic prose):** (1) any hook documented "never blocks" or "always exits 0"; (2) any pre-commit branch that auto-updates baselines or thresholds on regression; (3) any `--skip` list longer than two categories without justification annotations; (4) any template with `layers` defined but `architecture.thresholds` empty; (5) any init flow that recommends the lowest adoption tier by default; (6) any baseline-update PR auto-approved without independent review; (7) any `passed: true` in a health snapshot whose `signals[]` array contains the corresponding signal name. The distinction between self-audit-as-marketing and self-audit-as-mechanical-check is whether the skill enumerates concrete detectable patterns. Source: Pass 2 #7, Pass 3 #5, Pass 7-D (recursion). Implemented across 5 phases via autopilot (core engine + 7-rule registry STRENGTH-001..007, CLI `check-harness-strength`, rigid skill + ADR 0039, dogfood/fixture tests); shipped in PR #615 (merged).
- **Blockers:** —
- **Plan:** docs/changes/audit-harness-strength/plans/2026-06-23-phase1-core-types-and-context.md, docs/changes/audit-harness-strength/plans/2026-06-23-phase2-rule-registry.md, docs/changes/audit-harness-strength/plans/2026-06-23-phase3-cli-command.md, docs/changes/audit-harness-strength/plans/2026-06-23-phase4-skill-and-wiring.md, docs/changes/audit-harness-strength/plans/2026-06-23-phase5-dogfood-verification.md
- **Assignee:** chad.warner@capillarytech.com
- **Priority:** P0
- **External-ID:** github:Intense-Visions/harness-engineering#535

### Ship a CI workflow template

- **Status:** done
- **Spec:** —
- **Summary:** New `templates/ci/github-actions.yml.hbs` that adopters inherit on init. Runs `harness validate && check-deps && check-arch`, runs the multi-persona review pipeline as a required check on every PR, ratchets coverage, refuses to merge if signals trigger. Today adopters write their own CI from scratch, inheriting none of the dogfood's hard-won wisdom — the dogfood's `.github/workflows/ci.yml` is in this repo, not in templates. The single largest "ships assembled vs ships in pieces" gap. Source: Pass 2 #1 (CRITICAL). Shipped in PR #616 (#540).
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** P0
- **External-ID:** github:Intense-Visions/harness-engineering#540

### Ship a required-review GitHub Action template

- **Status:** done
- **Spec:** docs/changes/required-review-ci/proposal.md
- **Summary:** New `templates/ci/required-review.yml.hbs`. GitHub Action that runs `/harness:code-review` (the 7-phase multi-persona pipeline) on every PR, posts findings as PR review, and **fails the check if review wasn't run successfully**. Branch protection wires this as a required check. Without this wrapper, the multi-persona review (the project's strongest single piece of gear) is optional — the adopter has to remember to invoke it. Source: Pass 2 #6.
- **Blockers:** —
- **Plan:** docs/changes/required-review-ci/plans/ (phases 1–4; phase 5 done inline)
- **Assignee:** chad.warner@gmail.com
- **Priority:** P0
- **External-ID:** github:Intense-Visions/harness-engineering#541

### Auto-promotion of brainstormed roadmap items

- **Status:** done
- **Spec:** docs/changes/brainstorm-auto-promote/proposal.md
- **Summary:** Brainstorming Phase 4 promotes existing backlog rows to planned atomically with the spec commit, via new `manage_roadmap action: promote`. Sub-project 1 of 4 in the brainstorm-driven roadmap loop initiative.
- **Blockers:** —
- **Plan:** —
- **Assignee:** —
- **Priority:** —
- **External-ID:** github:Intense-Visions/harness-engineering#574
