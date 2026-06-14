-- Track whether a wellness module was self-added or prescribed by a hospital
ALTER TABLE wellness_modules
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS prescribed_by_hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prescribed_by_hospital_name TEXT;
