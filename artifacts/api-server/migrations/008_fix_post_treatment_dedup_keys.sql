-- Backfill old post-treatment automation_log entries to use the new per-patient
-- dedup key format. The scheduler now looks for 'post_treatment_patient{id}_day{n}'
-- but existing rows were logged as 'post_treatment_day{n}'. Without this fix,
-- patients who already received Day 1/4/7 emails would receive them again.
UPDATE automation_log
SET automation_type = 'post_treatment_patient' || patient_id::text || '_day' ||
    substring(automation_type FROM 'post_treatment_day(.+)')
WHERE automation_type IN ('post_treatment_day1', 'post_treatment_day4', 'post_treatment_day7')
  AND patient_id IS NOT NULL;
