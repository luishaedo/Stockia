# Contributing

## Minimum Definition of Done for Pull Requests

Every pull request must pass the following CI checks before merge:

- `build`
- `verify:auth-policy`
- `smoke:ci`

Repository administrators must configure branch protection rules so these three checks are marked as **required status checks**.

## Verification governance

- Active and required checks are documented in `docs/verification-governance.md`.
- Deprecated `verify-phase*` scripts are retained for local/manual historical diagnostics only and are not merge gates.

## Logging and data handling policy

Follow `docs/log-redaction-policy.md`.

Any new logging statement must avoid exposing headers, cookies, tokens, secrets, passwords, or credentials.
