# Multi Board Game Collection Verification

## Configured gate
- `npm run check`
- `npm test`
- `npm run build`

## Evidence rules
- Run focused tests for the changed component before the configured gate when available.
- A success marker never overrides an error line or nonzero exit code.
- Separate pre-existing failures from failures introduced by the current diff.
- Do not claim hardware, visual, performance, model-quality, deployment, or production evidence unless that exact surface was exercised.
