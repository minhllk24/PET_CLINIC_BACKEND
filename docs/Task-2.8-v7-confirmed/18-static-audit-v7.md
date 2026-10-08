# 18 V7 bounded static audit

Generated from current package by 19-contract-check-v7.py. This checks syntax, refs, schema combinations and selected contract invariants; it is not an exhaustive semantic review or implementation test.

- PASS: All internal refs resolve
- PASS: Unique operationIds
- PASS: All operations declare security/x-authz/x-audience
- PASS: All named schemas are mappings
- PASS: No legacy Service/branch deposit config
- PASS: Threshold belongs to Stock, not InventoryItem
- PASS: Threshold update endpoint exists
- PASS: Guest and Customer can access deposit mock completion
- PASS: Payment oneOf enum/const rules accept exactly 5 of 24 target/method/kind combinations
- PASS: Create response links prepayment
- PASS: Both business decisions confirmed by user
- PASS: Refund: exact 24h boundary, online late/no-show 30% penalty, 70% refund
- PASS: Medical allows Nurse and/or Vet segments and requires Vet review/finalize
- PASS: Nurse submit routes completed Medical execution to Vet review
- PASS: Medical finalize contract excludes Nurse and requires all segments complete
- PASS: No pending decision labels remain in OpenAPI
- PASS: ONLINE full forfeiture override prohibited
- PASS: 17-sheet-sync-serviceType-deposit-payment-v7.csv uniform column count
- PASS: 10-ui-api-db-field-mapping-v7.csv uniform column count
- PASS: No missing v2 schema dependency

Paths: 130. Operations: 149. Schemas: 177. Internal ref occurrences: 1443.

- 17-sheet-sync-serviceType-deposit-payment-v7.csv: 28 data rows
- 10-ui-api-db-field-mapping-v7.csv: 131 data rows

Runtime/concurrency/payment-provider tests: NOT RUN (no implementation supplied). Fresh live Sheet reconciliation: NOT PERFORMED; file 17 is a proposed sync. Business decisions confirmed by user on 08/10/2026 (Asia/Saigon): online late cancellation/no-show retains 30% and refunds 70%; Medical allows Nurse/Vet execution and mandates Veterinarian review/finalization. V7 schema supplementary fields are canonical design proposals, not verified extraction from v2/DB. Full OpenAPI specification validation tool is unavailable; the checks above do not claim full OAS compliance.
