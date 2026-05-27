/**
 * In-memory store tracking when hospital sessions were invalidated.
 * Keyed by hospital numeric ID → Unix ms timestamp.
 * Resets on server restart (acceptable — the next modules change will re-invalidate).
 */
const invalidatedAt = new Map<number, number>();

export function invalidateHospitalSessions(hospitalId: number): void {
  invalidatedAt.set(hospitalId, Date.now());
}

export function getHospitalSessionInvalidatedAt(hospitalId: number): number | null {
  return invalidatedAt.get(hospitalId) ?? null;
}
