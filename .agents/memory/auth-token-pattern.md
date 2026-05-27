---
name: Auth Token Pattern
description: How the era-patient app authenticates API calls — x-hospital-token header, not Authorization Bearer.
---

**Rule:** All direct fetch() calls in era-patient must use `"x-hospital-token": hospital.token` header, NOT `Authorization: Bearer`.

**Why:** `getHospitalFromRequest()` in `hospital-auth.ts` reads `req.headers["x-hospital-token"]` exclusively. The existing `executeEndTreatment` in nurse-station sends `Authorization: Bearer` but that route (PATCH /api/patients/:id) may have separate middleware — do not assume Bearer works for new routes.

**How to get the token in a component:**
```ts
const { hospital } = useAuth();
// in fetch:
headers: { "x-hospital-token": hospital?.token ?? "" }
```

The auto-generated API client (useListPatients, etc.) uses `setHospitalTokenGetter` from `@workspace/api-client-react` and sends x-hospital-token automatically.
