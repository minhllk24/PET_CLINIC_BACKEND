# Plan: Fix All Fail / Blocked Defect Log Items (`WEB 2 _ Test Case Master.xlsx`)

## Scope & Target Matrix
Triage against current codebase (`130e050` + local changes) across 26 `QA-R1-*` defects + `R01`–`R08` + `FT-M21-03`:

- **Already Fixed / Hardening Needed:**
  - `QA-R1-01` (`BE-01`): Already fixed on `startSegment`; tighten `executionService.createRecord` falsy check + segment check-in guard.
  - `QA-R1-02` (`BE-02`): Verified fixed in `content.service.js`.
  - `QA-R1-03` (`COMM-comment`): Core fixed; add `/public/community/posts/:id/...` comment aliases + `next('router')` fallback + blog reply counter.
- **Batch A (Auth, Guest Ownership, Customer/Pet RBAC & Validation):** `QA-R1-14`, `QA-R1-15`, `QA-R1-26`, `R08`, `QA-R1-06`, `R07`
- **Batch B (Catalog Cursor, Recommendation Stock, Public Review 500 + Scope, Community Edit):** `QA-R1-17`, `QA-R1-25`, `QA-R1-21`, `QA-R1-03`, `FT-M21-03`
- **Batch C (Checkout Guest/Quote, Payment Mock Complete, Booking Payment/Expiry Race, Refund 100%/70%/StoreCancel, Order Return Receive & 0-qty Refund, Adoption Duplicate):** `QA-R1-05`, `QA-R1-11`, `QA-R1-08`, `QA-R1-12`, `QA-R1-13`, `R02`, `R06`, `QA-R1-22`, `QA-R1-19`, `QA-R1-18`
- **Batch D (Slot Concurrency WriteConflict/E11000, Business Hours, Service Capacity vs Staff, Branch Shift Isolation, No-Show/Cancel State Machine, Reschedule Override Audit, Medical Record Material ISSUE vs ADJUSTMENT & Audit):** `QA-R1-04`, `QA-R1-07`, `QA-R1-09`, `QA-R1-16`, `QA-R1-10`, `R01`, `QA-R1-24`, `QA-R1-20`, `QA-R1-23`

## Verification Plan
- Add comprehensive integration tests for every fixed defect (`tests/integration/defect-log-r1-fixes.test.js` or domain-grouped test files) covering negative, boundary, concurrency, RBAC, and OpenAPI schema checks.
- Run existing regression suites (`auth`, `booking`, `order`, `inventory`, `content`, `catalog`, `review`, `recommendation`, `pet-profile`, `rbac-fixed-roles-matrix`) + `npm run build` (`babel src --out-dir dist`).

