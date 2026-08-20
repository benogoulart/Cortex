# Changelog

All notable changes to this project will be documented in this file.

Format: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)


## [0.7.0](2026-08-20)

### Agents

#### Features

- **core:** add `packages/core/src/agents/` module with 4 specialized analysis agents
- **core:** architect agent — layer detection (presentation/api/service/data/infra), coupling metrics (instability, afferent/efferent), cycle analysis, architectural debt score
- **core:** reviewer agent — enhanced code review with graph-aware caller impact analysis, convention checking from memory, cross-file analysis
- **core:** security agent — full-file security scan (not just diff), entropy-based secret detection, OWASP Top 10 mapping, crypto weakness detection, auth/authz gap analysis
- **core:** tester agent — test coverage mapping per file, untested critical path detection, test suggestions based on symbol analysis
- **core:** add `runAgent()`, `runAllAgents()`, `listAgents()`, `getAgent()` orchestration API
- **core:** add agent types: `AgentResult`, `AgentFinding`, `ArchitecturalReport`, `SecurityReport`, `TestReport`, `CouplingMetrics`, `OwaspGroup`, `FileCoverage`, `TestSuggestion`
- **cli:** add `cortex agent <name>` command (architect, reviewer, security, tester, all)
- **cli:** add `--json` flag for machine-readable output
- **mcp:** add 5 MCP tools: `cortex_agent_architect`, `cortex_agent_reviewer`, `cortex_agent_security`, `cortex_agent_tester`, `cortex_agent_all`

### Types

#### Features

- add `AgentName`, `AgentResult`, `AgentFinding`, `LayerInfo`, `LayerViolation`, `CouplingMetrics`, `ArchitecturalReport`
- add `SecurityFinding`, `OwaspGroup`, `EndpointInfo`, `SecurityReport`
- add `FileCoverage`, `TestSuggestion`, `TestReport`

### General

#### Refactoring

- bump version to 0.7.0 across all packages
- update README with agents feature and architecture


## [0.6.0](2026-08-19)

### MCP Server

#### Features

- **mcp:** add new `@cortex/mcp` package with MCP server over stdio
- **mcp:** expose 12 MCP tools: cortex_init, cortex_status, cortex_analyze, cortex_search, cortex_context, cortex_remember, cortex_memory_search, cortex_memory_list, cortex_memory_get, cortex_memory_delete, cortex_plan, cortex_review, cortex_dependencies
- **mcp:** use `@modelcontextprotocol/server` v2 with `serveStdio` transport
- **mcp:** input validation via zod/v4 schemas
- **mcp:** all tools accept optional `root` parameter (defaults to cwd)
- **mcp:** add shebang for direct execution (`#!/usr/bin/env node`)

### Code Review

#### Features

- **core:** add review module — parse git diff, detect architecture violations, security issues, missing tests, complexity changes
- **core:** detect hardcoded secrets, API keys, private keys, XSS vectors, SQL injection patterns
- **core:** check for direct database access in controllers, eval() usage, child_process imports
- **core:** flag new functions without corresponding tests
- **core:** compute review score (0-100) based on findings severity and diff size
- **cli:** add `cortex review` command with `--staged` and `--target` flags
- **cli:** display findings grouped by severity (critical, warning, info) with category labels

### Types

#### Features

- add `ReviewResult`, `ReviewFinding`, `ReviewSeverity`, `ReviewCategory`, `DiffSummary`, `DiffHunk` types

### General

#### Refactoring

- bump version to 0.6.0 across all packages
- merge v0.5 code review branch into main
- add `zod` and `@modelcontextprotocol/server` dependencies to mcp package
- update README architecture diagram with MCP server
- update README project structure with mcp package and review module
- update CHANGELOG with v0.5 and v0.6 entries


## [0.4.0](2026-08-19)

### Task Planner

#### Features

- **core:** add task planner module for generating structured execution plans
- **core:** analyze codebase to identify affected modules from task description
- **core:** risk assessment based on module impact, scope, circular deps, file size
- **core:** generate phased execution plan (discovery, architecture, implementation, testing, security)
- **core:** auto-detect security-relevant tasks from keywords
- **core:** compute complexity score (0-100) from affected modules, task count, risk level
- **core:** identify affected modules with reasons and risk levels
- **cli:** add `cortex plan <description>` command
- **cli:** display plan with risk factors, affected modules, phased tasks, priorities

### Types

#### Features

- add `ExecutionPlan`, `PlanTask`, `PlanPhase`, `AffectedModule`, `TaskPriority` types

### General

#### Refactoring

- bump version to 0.4.0 across all packages
- update README with plan command preview and examples
- update architecture diagram with planner module
- update project structure with planner directory
- update features table with task planner


## [0.3.0](2026-08-19)

### Memory

#### Features

- **core:** add persistent project memory module (`.cortex/memory.json`)
- **core:** auto-detect category from text (decision, convention, pattern, mistake, task, note)
- **core:** extract semantic tags from memory entries
- **core:** search memory by text relevance with weighted scoring
- **core:** list, show, delete memory entries
- **cli:** add `cortex remember <text>` command with `--category` and `--context` flags
- **cli:** add `cortex memory` command group (search, list, show, delete)

### Types

#### Features

- add `MemoryEntry`, `MemoryCategory`, `MemoryStore` types

### General

#### Refactoring

- bump version to 0.3.0 across all packages
- update README with memory commands and examples
- update project structure with memory directory


## [0.2.0](2026-08-19)

### Context Engine

#### Features

- **core:** replace regex parser with tree-sitter AST for accurate symbol extraction
- **core:** add tree-sitter-typescript and tree-sitter-javascript as native bindings
- **core:** extract function signatures from AST
- **core:** detect endLine for symbols from AST nodes
- **core:** add semantic search module with multi-factor weighted scoring (path, symbol, import, export, structural)
- **core:** add bidirectional dependency graph with reverse adjacency map
- **core:** add cycle detection via DFS with stack tracking
- **core:** add transitive dependency resolution with configurable depth
- **core:** add impact scoring based on dependents count
- **core:** add critical path computation from entry points
- **core:** add `analyzeDependencies()` returning full analysis report
- **core:** add `buildContext()` for enriched context results with impact scores
- **cli:** add `--verbose` flag to `cortex search` for score breakdown
- **cli:** add `--limit` flag to `cortex search`
- **cli:** add `--depth` flag to `cortex context` for transitive dep depth
- **cli:** show dependency health in `cortex analyze` (cycles, critical path)
- **cli:** show impact scores in `cortex context`

### Types

#### Features

- add `signature` field to `Symbol` interface
- add `endLine` field to `Symbol` interface
- add `SearchResult.breakdown` with per-factor scores
- add `ContextResult` type with dependencies, dependents, transitive deps, impact score
- add `DependencyAnalysis` type with cycles, transitive deps, impact scores, critical path
- add `SemanticQuery` type for weighted search configuration

### General

#### Refactoring

- bump version to 0.2.0 across all packages
- update README with v0.2 features and architecture
- update tech stack table (tree-sitter replaces regex)
- update data model documentation with symbol signatures
