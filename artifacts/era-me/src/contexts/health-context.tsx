import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
  type ReactNode,
} from 'react';
import { createTracker, type HealthSnapshot, type HealthTracker } from '@/lib/health-tracker';
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

export function HealthProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const trackerRef = useRef<HealthTracker | null>(null);
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

    const unsub = tracker.subscribe(s => setSnapshot(s));

    void (async () => {
      // Android web + desktop: no prompt needed, auto-start immediately
      // iOS: DeviceMotionEvent.requestPermission is a function and must be called
      //       from a user gesture — we start the tracker anyway (sleep tracking
      //       via Page Visibility works without it), and the permission prompt
      //       is triggered separately via requestPermission() when the user taps
      //       the "Enable step tracking" button in the UI.
      const needsGesture =
        typeof (DeviceMotionEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function';

      if (!needsGesture) {
        setHasPermission(true);
      }
      // Start regardless — sleep inference and future native reads don't need motion permission
      await tracker.start();
      setIsTracking(true);
    })();

    return () => {
      unsub();
      tracker.stop();
      trackerRef.current = null;
      setIsTracking(false);
      setSnapshot(null);
    };
  }, [account?.id]);

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
