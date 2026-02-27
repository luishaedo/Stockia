# Verification script governance

## Scope

This document defines ownership and lifecycle status for verification scripts used by CI and local diagnostics.

## Decision matrix

| Script | Current status | Classification | Owner | CI integration | Decision |
|---|---|---|---|---|---|
| `npm run build` (root) | Active | Active and valuable | Platform/Repo maintainers | Required (`build`) | Keep as required gate |
| `npm run verify:auth-policy -w api` | Active | Active and valuable | API maintainers | Required (`verify:auth-policy`) | Keep as required gate |
| `npm run smoke:ci -w api` | Active | Active and valuable | API maintainers | Required (`smoke:ci`) | Keep as required gate |
| `npm run verify:log-policy -w api` | New | Active and valuable | API maintainers | Executed inside `verify:auth-policy` job | Keep as required supporting check |
| `npm run verify:invoice-lifecycle -w api` | New | Active and valuable | API maintainers | Local and pre-release verification | Keep and evaluate promotion to CI |
| `npm run verify:contract-shared -w api` | New | Active and valuable | API + Shared maintainers | Local and pre-release verification | Keep and evaluate promotion to CI |
| `npm run verify:phase1 -w api` | Legacy | Obsolete | API maintainers | Not in CI | Deprecated for historical local diagnostics only |
| `npm run verify:phase2 -w api` | Legacy | Duplicated by smoke + service validations | API maintainers | Not in CI | Deprecated for historical local diagnostics only |
| `npm run verify:phase3 -w api` | Legacy | Duplicated by smoke + route tests in CI | API maintainers | Not in CI | Deprecated for historical local diagnostics only |

## Governance policy

1. New merge-blocking checks must be added as explicit CI jobs or clearly attached to an existing required job.
2. Any `verify-phase*` script must be either:
   - promoted to CI with an owner and objective, or
   - documented as deprecated with rationale.
3. Deprecated scripts can remain in the repository for short-term forensic/manual use, but they are not quality gates.
4. New governance scripts (for lifecycle and contracts) should remain deterministic and rely on shared schemas or shared error codes whenever possible.
