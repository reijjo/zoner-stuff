#!/bin/bash
set -euo pipefail

mkdir -p scripts
OUT_FILE="test-output.log"

echo "Running assessment test suite"
npm test 2>&1 | tee "$OUT_FILE"

PASSED=$(grep -o "Tests:.*passed" "$OUT_FILE" | tail -n1 | grep -o "[0-9]* passed" | cut -d' ' -f1)
FAILED=$(grep -o "[0-9]* failed" "$OUT_FILE" | tail -n1 | cut -d' ' -f1)
TOTAL=$(grep -o "Tests:.*total" "$OUT_FILE" | tail -n1 | grep -o "[0-9]* total" | cut -d' ' -f1)

echo
echo "Results: ${PASSED:-0}/${TOTAL:-0} tests passed"
if [[ "${FAILED:-0}" == "0" ]]; then
  echo "All tests passing."
else
  echo "${FAILED} tests still failing."
fi
