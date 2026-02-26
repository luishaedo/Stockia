# ADR 0002: JWT Strategy Migration Threshold

- Status: Accepted
- Date: 2026-02-26
- Decision owners: Backend + Security maintainers

## Context

The current authentication flow issues and validates JWTs through a lightweight custom implementation.
This implementation is sufficient for current single-service administrative use, but it lacks advanced capabilities expected in larger deployments:

- Key rotation and `kid`-based verification
- Centralized token revocation and introspection
- Standardized issuer/audience enforcement across services
- Integration with external identity providers (OIDC/SAML)
- Higher-confidence audit and compliance controls

## Decision

Keep the current custom JWT approach as the default **until explicit migration triggers are met**.

When any migration trigger is reached, move to a managed JWT strategy based on standard libraries and/or an external IdP (for example: JOSE + JWKS, Auth0, Cognito, or equivalent).

## Migration triggers (threshold)

A migration becomes mandatory when **one or more** of these conditions occur:

1. **Service scale trigger**: 3 or more backend services need to validate the same token.
2. **Identity integration trigger**: a third-party identity provider or SSO is required.
3. **Security operations trigger**: key rotation is required on a recurring schedule (<= 90 days) or emergency rotation SLA <= 4 hours.
4. **Revocation trigger**: immediate logout/token revocation is required for privileged sessions.
5. **Compliance trigger**: audit/compliance requirements mandate centralized auth telemetry or issuer-level controls.

## Decision criteria for migration option

When migration is triggered, compare options using these criteria:

- Security posture: proven cryptography, key lifecycle management, and replay protection.
- Operational complexity: deployment burden, incident response simplicity, and runbook maturity.
- Reliability: SLA and failure modes for token issuance/verification.
- Cost: direct vendor cost and operational engineering cost.
- Developer ergonomics: SDK quality, local development support, and debugging visibility.
- Backward compatibility: phased rollout ability with existing bearer tokens.

## Consequences

### Positive

- Avoids premature complexity while current scope remains small.
- Creates explicit, measurable conditions for revisiting auth strategy.
- Reduces architectural ambiguity during future scale or compliance demands.

### Trade-offs

- Current implementation remains limited in enterprise auth features.
- A future migration will require coordinated token rollout and fallback support.

## Implementation guardrails

- Keep token claims minimal and documented.
- Preserve request traceability (`traceId`) in auth failures.
- Ensure auth error metrics remain available to validate trigger conditions over time.
