---
name: Stage Semantics
description: How patient stages work — primary lifecycle states vs derived transient overlays
---

## The Model

Stages are NOT a linear flow. They are independent concurrent states, each derived from a different source:

| Stage | Source | Written to patients.stage? |
|-------|--------|---------------------------|
| Active | Primary lifecycle (scheduler, dequeue) | ✅ Yes |
| Post Treatment | Primary lifecycle (last care plan deleted) | ✅ Yes |
| Dormant | Primary lifecycle (scheduler, after N days Active) | ✅ Yes |
| In Care | Derived from care_plans table (hasCarePlan) | ❌ Never — was removed |
| Queued | Derived from queue table (isInQueue) | ❌ Never |
| Booked | Derived from appointments table (isBooked, upcoming non-cancelled) | ❌ Never |

## Key Rules

- `patients.stage` only ever holds: `Active`, `Post Treatment`, `Dormant`, `In Care`
- New patients registered with `stage: "Active"` (not "Queued")
- Checkin: never changes stage — just inserts a queue entry and updates checked_in_at
- Dequeue: never changes stage — just deletes queue entry, updates updated_at
- Appointment booked: never changes stage — "Booked" is derived at read time
- `getPatientStages(patient)` in utils.ts assembles the display list from primary + all three overlays

## API: derived fields on patient responses

All three endpoints (list, single, history) now return:
- `isInQueue` — live from queue table
- `isBooked` — live from appointments table (scheduled_at >= now, not cancelled/no_show)
- `hasCarePlan` — live from care_plans table

**Why:** Stages as stored state caused race conditions and inconsistent displays. Deriving them from authoritative tables at read time is always accurate.

## Dashboard

- Pipeline breakdown "Queued" count = queue table length (not countMap["Queued"])
- criticalAlerts = queue count + countMap["In Care"]
- pipelineBreakdown["Booked"] still uses 0 unless explicitly queried (acceptable, future work)
