# Era Systems — Clinic Dashboard

A full-stack clinic management platform for Nigerian hospitals. Manages patient queues, care plans, appointments, automated patient communications (SMS + email), and doctor workflows.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `APP_BASE_URL` — base URL for booking/feedback links in emails (e.g. `https://app.erasystems.com.ng`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server`)
- Frontend (staff): React + Wouter (`artifacts/era-patient`)
- Frontend (super admin): React (`artifacts/era-super-admin`)
- DB: Supabase (PostgreSQL); all custom tables have `DISABLE ROW LEVEL SECURITY`
- Auth: HMAC tokens via `x-hospital-token` header; `getHospitalFromRequest` returns `{ intId, code, username }` where `code` is the UUID `hospital_id` used in patient-facing tables
- Email: Resend
- SMS/WhatsApp: Termii
- AI: Claude (care plan emails, follow-up drafts) + OpenAI (in-care reminders)
- Payments: Paystack (SMS wallet top-up)

## Where things live

- `artifacts/api-server/src/routes/` — all API routes
- `artifacts/api-server/src/lib/automation.ts` — all automated email/SMS functions
- `artifacts/api-server/src/lib/automation.ts` `HospitalContext` — includes `slug` for building patient booking URLs
- `artifacts/api-server/src/routes/self-booking.ts` — public patient booking + reschedule endpoints
- `artifacts/api-server/src/routes/queue.ts` — queue management + doctor queue/call-in endpoints
- `artifacts/api-server/src/routes/doctors.ts` — doctor CRUD + transfer endpoint
- `artifacts/api-server/src/routes/automation-tests.ts` — super-admin automation test endpoint
- `artifacts/api-server/migrations/` — SQL migration files (run manually in Supabase)
- `artifacts/era-patient/src/pages/` — all staff-facing pages
- `artifacts/era-patient/src/pages/doctor-view.tsx` — doctor's private view (queue, appointments, follow-ups)
- `artifacts/era-patient/src/pages/appointments.tsx` — receptionist/admin appointments page (includes self-booking confirmation)
- `artifacts/era-patient/src/pages/book.tsx` — public patient booking page (`/book/:slug`, includes reschedule tab)
- `artifacts/era-patient/src/pages/help.tsx` — in-app help guide for all roles (admin, receptionist, nurse, doctor)
- `artifacts/era-super-admin/src/pages/automation-tests.tsx` — super-admin automation test runner UI

## Architecture decisions

- **Queue membership is separate from patient lifecycle stage** — `patients.stage` does NOT change when a patient is added to or removed from the queue. "Queued" display is derived from whether the patient exists in the `queue` table.
- **Hospital auth via HMAC tokens** — both master hospital logins and admin sub-accounts (`hospital_admins` table) are checked. Doctor logins use the `hospital_doctors` table.
- **Self-booking requires receptionist approval** — patients submit to `self_bookings` table with `status='pending'`, NO email fires until the receptionist confirms. On confirmation, an appointment is created and the standard confirmation email fires.
- **Booking URL pattern** — `${APP_BASE_URL}/book/${hospital.slug}`. The `slug` field is on the `hospitals` table and passed through `HospitalContext` to all automation functions. If null, no booking CTA is appended to emails.
- **Doctor queue transfer tracking** — `queue.transferred_from_doctor_name` column records the previous doctor's name so the new doctor sees "From Dr. X" on that patient.

## Product

- **Queue Management** — check patients into a live queue; assign to doctors; auto-SMS on check-in, next-in-line, and call-in
- **Care Plans** — nurses create plans (medication/visit schedules); AI-written explanation emails; daily in-care reminders
- **Appointments** — receptionist books appointments; calendar view; online self-booking by patients with reschedule tab; confirmation/reminder/no-show emails
- **Doctor View** — doctors see their own queue, call patients in, reassign, view upcoming appointments, flag or book follow-ups
- **Automated Emails** — post-treatment check-ins (Day 1/4/7), 30-day wellness nudge, birthday, feedback, wellness newsletter; booking CTAs appended where applicable
- **Feedback** — customisable feedback form, star ratings, category scores
- **Wellness Newsletter** — AI-written weekly health emails to active patients
- **Super Admin** — manage all hospitals, run automation tests, view analytics

## User preferences

- Supabase tables: always add `DISABLE ROW LEVEL SECURITY` on new tables
- Do not change `patients.stage` in queue routes — queue and stage are independent
- Self-booking flow: always goes through receptionist confirmation before any email fires
- Dequeue pattern: deletes queue entry only, no stage change

## Gotchas

- `hospital.code` (UUID) is the `hospital_id` in `queue`, `self_bookings`, and other patient-facing tables; `hospital.intId` (integer) is the `hospital_id` in `appointments`, `care_plans`, etc.
- TypeScript: `req.params.id` typed as `string | string[]` — cast with `as string` before `parseInt`
- Pre-existing TypeScript errors exist in `scheduler.ts` and `super-admin.ts` — do not fix unless directly working on those files
- Migration files in `artifacts/api-server/migrations/` must be run manually in Supabase SQL editor

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
