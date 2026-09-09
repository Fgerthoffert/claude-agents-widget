# ADR-0004: Functional TypeScript style, enforced by tooling

- **Status**: Accepted
- **Date**: 2026-09-09

## Context

The owner's stated requirement is functional TypeScript: arrow functions, no classes, one exported
function per file, strict mode, and colocated unit tests. Left as prose in a contributing guide,
conventions like these erode — especially in a repo where much of the code will be written by agents
that default to whatever the surrounding ecosystem does. They need to be machine-checked.

## Decision

Functional TypeScript everywhere, enforced where a linter can enforce it:

- `@typescript-eslint` **strict-type-checked** + **stylistic-type-checked**, with
  `eslint-config-prettier` applied last.
- `func-style: ["error", "expression"]` and `prefer-arrow-callback` — no `function` declarations.
- `no-restricted-syntax` bans `ClassDeclaration` and `ClassExpression`.
- `no-console: ["error", { allow: ["warn", "error"] }]`.
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`.
- Vitest with v8 coverage, thresholds at 85% (lines/functions/statements/branches) scoped to
  `src/core/**`. UI is excluded until Phase 3 introduces component tests.

**One exported function per file** stays a documented convention (CLAUDE.md) rather than a lint rule:
no off-the-shelf rule expresses it well, and types the function owns legitimately sit beside it.

## Alternatives Considered

- **Object-oriented / class-based style** — rejected: the owner's explicit preference, and the
  domain (pure transformations over session records) has no natural use for inheritance or
  mutable-object identity.
- **Multi-export modules** — rejected: one-function-per-file makes files trivially greppable by
  name, which matters more than usual when agents navigate the codebase by filename.
- **Prose-only conventions** — rejected: unenforceable, so untrue within a few phases.

## Consequences

Style is a build failure, not a review comment, which keeps agent-written code consistent for free.
The cost is friction against library types that assume looser settings — `exactOptionalPropertyTypes`
in particular required an explicit conditional spread rather than `hmr: undefined` in
`vite.config.ts`, and `strict-type-checked` forbids implicit number-to-string coercion in template
literals. Both are cheap and local.

### Deviation: TypeScript version

The Phase 1 plan called for pinning `typescript@~5.9`, on the grounds that TypeScript 7 (7.0.2 was
latest on npm) had unverified compatibility with `typescript-eslint`. That concern is real —
`typescript-eslint@8.70.0` declares `typescript: ">=4.8.4 <6.1.0"`, so TS 7 is genuinely out of range.

However, `create-tauri-app` now scaffolds `typescript@~6.0.3`, which _is_ inside that supported
range. We kept `~6.0.3` rather than downgrading to `~5.9`: it satisfies the constraint the pin was
meant to protect (a TypeScript version the lint tooling verifiably supports), while staying aligned
with the upstream template. Revisit when `typescript-eslint` widens its peer range to TS 7.

### Deviation: single tsconfig

The scaffold's split `tsconfig.json` / `tsconfig.node.json` (project references) was collapsed into
one `tsconfig.json` that also includes `vite.config.ts` and `vitest.config.ts`. Two reasons:
`composite` and `noEmit` cannot be combined, and `typescript-eslint`'s `projectService` only resolves
files reachable from the default project — root config files were otherwise unlintable. One config
means one `tsc --noEmit` covers everything the repo type-checks.
