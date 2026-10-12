# Security Specification for NXV SMS

## 1. Data Invariants
1. **User Profile Ownership**: A user profile document `/users/{userId}` can only be read by the profile owner (`request.auth.uid == userId`) or an admin. Users cannot modify their own `role` or escalate privileges.
2. **Order Integrity & Relational Isolation**: An SMS order `/users/{userId}/smsOrders/{orderId}` must strictly have `userId == request.auth.uid` and match the path parameter `{userId}`.
3. **No Unauthenticated Access**: Unauthenticated guests cannot read or write user data or order logs.
4. **Order Status Lifecycle**: Order status must transition only between `WAITING`, `RECEIVED`, `EXPIRED`, and `CANCELLED`.
5. **Broadcast Logs Protection**: Global broadcasts can only be created/updated by verified administrators; all authenticated users can read broadcast logs.
6. **Input Boundary Enforcement**: Phone numbers, service names, and OTP strings are bound to strict maximum sizes to prevent denial-of-wallet resource exhaustion.

## 2. The "Dirty Dozen" Threat Payloads
1. **Payload 1 (Privilege Escalation on User Profile)**: Setting `role: "admin"` during user self-update. Result: REJECT.
2. **Payload 2 (Cross-User Profile Theft)**: User A attempting `get` or `list` on `/users/{userB}`. Result: REJECT.
3. **Payload 3 (Orphaned Order Injection)**: Creating an SMS order with `userId: "attackerId"` under another user's subcollection. Result: REJECT.
4. **Payload 4 (Fake Order ID Path Poisoning)**: Submitting a 2MB junk string as `orderId`. Result: REJECT.
5. **Payload 5 (Unauthenticated Order Read)**: Unauthenticated client querying `/users/{userId}/smsOrders`. Result: REJECT.
6. **Payload 6 (Unauthorized Broadcast Modification)**: Regular user writing to `/broadcastLogs/{logId}`. Result: REJECT.
7. **Payload 7 (Status Tampering by Non-Owner)**: User B attempting to mutate `status` or `otpCode` of User A's order. Result: REJECT.
8. **Payload 8 (Volumetric Payload Attack)**: Injecting a 500KB text payload into `phoneNumber` or `otpCode`. Result: REJECT.
9. **Payload 9 (Shadow Field Injection)**: Injecting arbitrary undocumented fields like `__isBypassed: true`. Result: REJECT.
10. **Payload 10 (Terminal State Rewind)**: Changing status from `CANCELLED` back to `WAITING`. Result: REJECT.
11. **Payload 11 (Unverified User Writes)**: User with unverified email attempting sensitive mutations. Result: REJECT (or require authenticated session).
12. **Payload 12 (Blanket List Scraping)**: Attempting a root `collectionGroup('smsOrders')` query without ownership restriction. Result: REJECT.

## 3. Test Runner
Verified with Firestore Security Rules assertions and unit tests matching ABAC pillars.
