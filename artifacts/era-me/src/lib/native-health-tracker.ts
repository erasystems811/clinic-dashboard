import type { HealthSnapshot, HealthTracker } from './health-tracker';

// Stub — wire up when adding the Capacitor native wrapper.
//
// Packages to install:
//   npm i @capacitor/core @capacitor/app
//   npm i @capacitor-community/health-connect   ← Android (Health Connect)
//   npm i capacitor-health-kit                  ← iOS (HealthKit)
//
// Both plugins expose: steps, distance, activeMinutes, sleepAnalysis, heartRate.
// The HealthProvider in health-context.tsx will auto-select this class when
// isCapacitorNative() returns true.

const EMPTY: HealthSnapshot = {
  steps: 0,
  distanceMeters: 0,
  activeMinutes: 0,
  activityType: 'unknown',
  caloriesBurned: 0,
  sleepHours: null,
  sleepQuality: null,
  source: 'native',
  recordedAt: new Date().toISOString(),
};

export class NativeHealthTracker implements HealthTracker {
  readonly source = 'native' as const;
  readonly isAvailable = false; // flip to true once Capacitor plugins are wired

  async requestPermissions(): Promise<boolean> { return false; }
  async start(): Promise<void> {}
  stop(): void {}
  getSnapshot(): HealthSnapshot { return { ...EMPTY, recordedAt: new Date().toISOString() }; }
  subscribe(_cb: (s: HealthSnapshot) => void): () => void { return () => {}; }
}
