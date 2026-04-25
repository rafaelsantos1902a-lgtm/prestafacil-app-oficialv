# Security Specification - PrestaFácil

## Data Invariants
1. A loan must have a positive debt and remaining balance.
2. A user can only access data within their own path (`/users/{userId}/`).
3. Transactions once created cannot be modified (immutable).
4. Loan status must be one of: ACTIVO, PAGADO, RENOVADO.

## The "Dirty Dozen" Payloads

### 1. Identity Spoofing (Write to another user's path)
**Target:** `/artifacts/prestafacil-v1/users/OTHER_USER_ID/loans/loan123`
**Payload:** `{ "client": "Attacker", "status": "ACTIVO", ... }`
**Expected:** PERMISSION_DENIED (isOwner check)

### 2. ID Poisoning (Extremely long ID)
**Target:** `/artifacts/prestafacil-v1/users/MY_UID/loans/A_VERY_LONG_ID_EXCEEDING_128_CHARS...`
**Payload:** `{ ...valid loan... }`
**Expected:** PERMISSION_DENIED (isValidId check)

### 3. Resource Exhaustion (Huge client name)
**Target:** `/artifacts/prestafacil-v1/users/MY_UID/loans/loan123`
**Payload:** `{ "client": "A".repeat(1001), ... }`
**Expected:** PERMISSION_DENIED (isValidLoan size check)

### 4. Privilege Escalation (Modifying immutable fields)
**Target:** `/artifacts/prestafacil-v1/users/MY_UID/loans/loan123`
**Operation:** Update `debt` to 0.
**Expected:** PERMISSION_DENIED (affectedKeys constraint)

### 5. State Shortcutting (Set remaining to 0 directly)
**Target:** `/artifacts/prestafacil-v1/users/MY_UID/loans/loan123`
**Operation:** Update `remaining` to 0 without valid logic.
**Expected:** PERMISSION_DENIED (Wait, my rule allows `remaining` updates if `isOwner`. I should harden this.)

### 6. Transaction Tampering (Modifying an existing transaction)
**Target:** `/artifacts/prestafacil-v1/users/MY_UID/transactions/trans123`
**Operation:** Update `amount` from 100 to 0.
**Expected:** PERMISSION_DENIED (allow update: if false)

### 7. Missing Auth (Accessing without login)
**Expected:** PERMISSION_DENIED

### 8. PII Leak (Reading another user's loan)
**Expected:** PERMISSION_DENIED

### 9. Type Mismatch (Setting principal as string)
**Payload:** `{ "principal": "1000", ... }`
**Expected:** PERMISSION_DENIED (is number check)

### 10. Status Injection (Injecting invalid status)
**Payload:** `{ "status": "BORRADO", ... }`
**Expected:** PERMISSION_DENIED (enum check)

### 11. Ghost Field Injection
**Payload:** `{ "client": "John", "isAdmin": true, ... }`
**Expected:** PERMISSION_DENIED (keys check)

### 12. Orphaned Write (Transaction for non-existent user path)
**Target:** `/artifacts/prestafacil-v1/users/RANDOM_PATH/transactions/trans123`
**Expected:** PERMISSION_DENIED
