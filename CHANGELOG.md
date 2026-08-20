# Changelog

All notable changes to this project will be documented in this file.

Format: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)


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
