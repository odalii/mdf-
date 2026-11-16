# Security Specification — CutMaster MDF Optimizer

## 1. Data Invariants
1. A `UserProfile` at `/users/{userId}` can only be read, created, updated, or deleted by the authenticated owner whose `request.auth.uid == userId`, with `email_verified == true` for writes. Listing `/users` is strictly denied.
2. `CompanySettings` at `/users/{userId}/company/{settingId}` belongs strictly to `{userId}` (`ownerId == request.auth.uid`) and is verified against the parent user or UID match. Listing is restricted to the owner.
3. A `CuttingProject` at `/projects/{projectId}` has an immutable `ownerId == request.auth.uid` and immutable `createdAt == request.time`. Queries (`list`) enforce `resource.data.ownerId == request.auth.uid`.
4. A `ProjectReport` at `/projects/{projectId}/reports/{reportId}` requires the parent project `/projects/{projectId}` to exist and belong to `request.auth.uid` (Master Gate via `get()`).
5. A `SharedProjectSnapshot` at `/sharedProjects/{shareId}` contains zero PII, denies `list` completely, allows single-document `get` by `shareId` when `isValidId(shareId)`, and restricts `create`/`update`/`delete` to the verified owner whose parent project `/projects/{projectId}` exists and is owned by `request.auth.uid`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Reading `/projects/p1` or creating `/projects/p2` with `request.auth == null`.
2. **Unverified Email Write**: Creating `/projects/p2` when `request.auth.token.email_verified == false`.
3. **Identity Spoofing on Create**: Creating `/projects/p2` with `ownerId: "victim_uid"` while signed in as `"attacker_uid"`.
4. **Owner Reassignment on Update**: Updating `/projects/p1` to change `ownerId` from `"owner_uid"` to `"attacker_uid"`.
5. **Shadow / Ghost Field Injection**: Creating or updating `/projects/p1` with an extra unlisted key `isAdmin: true` or `tier: "enterprise"`.
6. **Client-Forged Timestamp**: Creating `/projects/p1` with a past or future `createdAt` instead of `request.time`.
7. **Immutable Timestamp Tampering**: Updating `/projects/p1` to alter `createdAt`.
8. **ID Poisoning / Resource Exhaustion**: Writing to `/projects/invalid$id` or `/projects/` + 500-char string, or `name` > 120 chars.
9. **Unbounded Array / Payload DoS**: Creating `/projects/p1` with `parts` array size > 300 items.
10. **PII Blanket List / Cross-User Read**: Listing `/users` or getting `/users/victim_uid` as `"attacker_uid"`.
11. **Orphaned Subcollection Write**: Creating `/projects/nonexistent/reports/r1` or creating a report under another user's project.
12. **Shared Snapshot Enumeration**: Calling `list` on `/sharedProjects` to scrape shared project snapshots.
