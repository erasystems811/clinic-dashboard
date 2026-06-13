import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
  type ReactNode,
} from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { createTracker, type HealthSnapshot, type HealthTracker } from '@/lib/health-tracker';
import { apiFetch } from '@/lib/api';
import { useAuth } from './auth-context';

interface HealthContextValue {
  snapshot: HealthSnapshot | null;
  isTracking: boolean;
  /** null = not yet asked, true = granted, false = denied */
  hasPermission: boolean | null;
  /** Call on a user gesture (button tap) to request iOS motion permission */
  requestPermission: () => Promise<void>;
}

const HealthContext = createContext<HealthContextValue | null>(null);

async function syncToServer(snapshot: HealthSnapshot): Promise<void> {
  await apiFetch("/api/patient-app/auto-health/sync", {
    method: "POST",
    auth: true,
    body: JSON.stringify({
      steps:          snapshot.steps,
      distanceMeters: snapshot.distanceMeters,
      activeMinutes:  snapshot.activeMinutes,
      caloriesBurned: snapshot.caloriesBurned,
      activityType:   snapshot.activityType,
      sleepHours:     snapshot.sleepHours,
      sleepQuality:   snapshot.sleepQuality,
      source:         snapshot.source,
    }),
  });
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const qc = useQueryClient();
  const trackerRef = useRef<HealthTracker | null>(null);
  const latestSnapshotRef = useRef<HealthSnapshot | null>(null);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const requestPermission = useCallback(async () => {
    if (!trackerRef.current) return;
    const granted = await trackerRef.current.requestPermissions();
    setHasPermission(granted);
  }, []);

  useEffect(() => {
    if (!account) return;

    const tracker = createTracker();
    trackerRef.current = tracker;

    const unsub = tracker.subscribe(s => {
      setSnapshot(s);
      latestSnapshotRef.current = s;
    });

    void (async () => {
      const needsGesture =
        typeof (DeviceMotionEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function';
      if (!needsGesture) setHasPermission(true);
      await tracker.start();
      setIsTracking(true);
    })();

    // Sync to server every 60 seconds — fire-and-forget, never blocks UI
    const syncInterval = setInterval(() => {
      const s = latestSnapshotRef.current;
      if (!s) return;
      syncToServer(s)
        .then(() => void qc.invalidateQueries({ queryKey: ["auto-health", "today"] }))
        .catch(() => {/* network failure — will retry next tick */});
    }, 60_000);

    return () => {
      unsub();
      tracker.stop();
      trackerRef.current = null;
      setIsTracking(false);
      setSnapshot(null);
      latestSnapshotRef.current = null;
      clearInterval(syncInterval);
    };
  }, [account?.id, qc]);

  return (
    <HealthContext.Provider value={{ snapshot, isTracking, hasPermission, requestPermission }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealthTracker() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealthTracker must be used within HealthProvider');
  return ctx;
}
