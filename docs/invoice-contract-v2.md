# Invoice Contract v2 (IDs-first)

## Status
- Approved for transition with backward compatibility.
- Legacy compatibility window: 2 release cycles with deprecation logs.

## Create/Update draft payload

### Preferred fields (v2)
- `supplierId` (required for create/update draft semantics)
- `items[].sizeCurveId` (required per item semantics)

### Legacy compatibility fields (temporary)
- `proveedor` (legacy alias for supplier identifier)
- `items[].curvaTalles` (legacy alias for size curve selection by values)

When both are present, server behavior is:
1. Uses v2 IDs-first fields.
2. Falls back to legacy aliases only if v2 field is missing.
3. Emits deprecation warning in logs when legacy fields are used.

## Date filters policy (`GET /admin/invoices`)
- API contract uses UTC timestamps (`from`, `to`) in ISO-8601.
- Validation rejects requests where `from > to`.

## Pagination
- Admin invoices response now includes:
  - `pagination.page`
  - `pagination.pageSize`
  - `pagination.total`
  - `pagination.totalPages`

## New endpoint
- `GET /admin/invoice-users`
  - Query params: `page`, `pageSize`, `search`
  - Purpose: provide server-side user list for admin invoice filters.
