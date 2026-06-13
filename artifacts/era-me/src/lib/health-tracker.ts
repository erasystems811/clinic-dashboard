// Platform-agnostic health tracking interface.
// Web uses DeviceMotionEvent + Page Visibility API.
// Native (Capacitor) uses Health Connect (Android) + HealthKit (iOS).
import { WebHealthTracker } from './web-health-tracker';

export type ActivityType = 'still' | 'walking' | 'running' | 'cycling' | 'unknown';
export type SleepQuality = 'good' | 'fair' | 'poor';
export type TrackerSource = 'web' | 'native';

export interface HealthSnapshot {
  steps: number;
  distanceMeters: number;
  activeMinutes: number;
  activityType: ActivityType;
  caloriesBurned: number;
  // Inferred from last night — null if not enough data yet
  sleepHours: number | null;
  sleepQuality: SleepQuality | null;
  source: TrackerSource;
  recordedAt: string; // ISO 8601
}

export interface HealthTracker {
  readonly source: TrackerSource;
  readonly isAvailable: boolean;
  requestPermissions(): Promise<boolean>;
  start(): Promise<void>;
  stop(): void;
  getSnapshot(): HealthSnapshot;
  /** Returns an unsubscribe function. */
  subscribe(cb: (snapshot: HealthSnapshot) => void): () => void;
}

export function isCapacitorNative(): boolean {
  return (
    typeof (window as Record<string, unknown>).Capacitor !== 'undefined' &&
    typeof ((window as Record<string, unknown>).Capacitor as { isNativePlatform?: () => boolean }).isNativePlatform === 'function' &&
    ((window as Record<string, unknown>).Capacitor as { isNativePlatform: () => boolean }).isNativePlatform()
  );
}

export function createTracker(): HealthTracker {
  // When adding Capacitor native: import NativeHealthTracker and return it here
  return new WebHealthTracker();
}
