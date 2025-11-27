# Candidate Runbook

## Prerequisites
- Node.js 18+
- npm 9+

## Install
```bash
make install
```

## Run the entire suite
```bash
make test
```

## Targeted runs
- Watch mode: `make test-watch`
- Integration-only: `make test-integration`
- Any other subset: `npx jest <pattern>`

## Notes
- Do not edit or delete existing tests.
- Use the existing NestJS/Jest toolchain; no extra test frameworks.
- Assume MongoDB is mocked; do not introduce real infrastructure dependencies.

## Time Expectations
- Target: 3–4 hours
- Hard stop: 6 hours (submit whatever progress you have along with notes)

## Submission
1. Ensure `make test` passes.
2. Commit your changes.
3. Provide a short writeup (≤500 words) covering:
   - Bugs you found/fixed
   - Approach and reasoning
   - Time spent per area
   - Known uncertainties or trade-offs
4. Push your solution to your own GitHub repository and include the link with your submission.
