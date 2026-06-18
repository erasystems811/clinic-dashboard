-- Care plans opened as drafts don't have a department yet (derived on close)
-- and may have no summary at creation time. Drop the NOT NULL constraints.
ALTER TABLE care_plans ALTER COLUMN department DROP NOT NULL;
ALTER TABLE care_plans ALTER COLUMN summary    DROP NOT NULL;
