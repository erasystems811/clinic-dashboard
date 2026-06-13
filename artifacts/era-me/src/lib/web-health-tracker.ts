import type { ActivityType, HealthSnapshot, HealthTracker, SleepQuality } from './health-tracker';

// Step detection constants
const STEP_THRESHOLD = 11.8;     // m/s² magnitude — resting gravity is ~9.8, a step spike is ~12+
const STEP_SMOOTHING = 0.85;     // low-pass filter weight (higher = more smoothing)
const MIN_STEP_GAP_MS = 260;     // debounce — max ~3.8 steps/sec
const STRIDE_M = 0.762;          // ~30 inches, average adult stride
const KCAL_PER_STEP = 0.04;      // rough estimate at 70 kg walking pace

// Sleep inference constants
const SLEEP_START_HOUR = 21;     // 9 PM — earliest we infer sleep onset
const SLEEP_END_HOUR = 9;        // 9 AM — latest we infer wake-up
const MIN_SLEEP_HOURS = 2;       // ignore anything shorter

const STORAGE_KEY = 'era_health_web';

interface Stored {
  date: string;          // YYYY-MM-DD — resets daily
  steps: number;
  activeMinutes: number;
  sleepStart: string | null;  // ISO — when screen went dark at night
  sleepEnd: string | null;    // ISO — when screen came back in the morning
  hiddenSince: string | null; // ISO — current hidden session start (cleared on show)
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function isNightHour(d: Date): boolean {
  const h = d.getHours();
  return h >= SLEEP_START_HOUR || h < SLEEP_END_HOUR;
}

export class WebHealthTracker implements HealthTracker {
  readonly source = 'web' as const;

  private _available = false;
  private _steps = 0;
  private _activeMinutes = 0;
  private _lastStepAt = 0;
  private _magSmoothed = 9.8;   // start at resting gravity
  private _rising = false;
  private _recentSteps: number[] = [];  // timestamps of steps in last 60s (cadence window)
  private _activeStart: number | null = null;
  private _subs: Array<(s: HealthSnapshot) => void> = [];
  private _motionCb: ((e: DeviceMotionEvent) => void) | null = null;
  private _visCb: (() => void) | null = null;
  private _tick: ReturnType<typeof setInterval> | null = null;
  private _stored: Stored = this._load();

  get isAvailable() { return this._available; }

  // ── Persistence ──────────────────────────────────────────────────────────────

  private _load(): Stored {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Stored;
        if (d.date === todayStr()) return d;
      }
    } catch { /* ignore */ }
    return { date: todayStr(), steps: 0, activeMinutes: 0, sleepStart: null, sleepEnd: null, hiddenSince: null };
  }

  private _persist() {
    this._stored.steps = this._steps;
    this._stored.activeMinutes = this._activeMinutes;
    this._stored.date = todayStr();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._stored)); } catch { /* ignore */ }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async requestPermissions(): Promise<boolean> {
    if (typeof DeviceMotionEvent === 'undefined') return false;
    // iOS 13+ requires an explicit user-gesture permission request
    const needsPrompt = typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function';
    if (needsPrompt) {
      try {
        const r = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        return r === 'granted';
      } catch {
        return false;
      }
    }
    return true; // Android / desktop — no prompt needed
  }

  async start(): Promise<void> {
    // Restore persisted counts for today
    this._steps = this._stored.steps;
    this._activeMinutes = this._stored.activeMinutes;

    // Motion tracking
    if (typeof DeviceMotionEvent !== 'undefined') {
      this._available = true;
      this._motionCb = (e) => this._onMotion(e);
      window.addEventListener('devicemotion', this._motionCb, { passive: true });
    }

    // Sleep tracking — Page Visibility API (no permission required)
    this._visCb = () => this._onVisibility();
    document.addEventListener('visibilitychange', this._visCb);
    // Handle case where tracker starts while screen is already off
    if (document.hidden) this._onVisibility();

    // Persist + notify subscribers every 30 s
    this._tick = setInterval(() => {
      this._persist();
      this._emit();
    }, 30_000);

    this._emit();
  }

  stop(): void {
    if (this._motionCb) { window.removeEventListener('devicemotion', this._motionCb); this._motionCb = null; }
    if (this._visCb) { document.removeEventListener('visibilitychange', this._visCb); this._visCb = null; }
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
    this._persist();
  }

  getSnapshot(): HealthSnapshot {
    return {
      steps: this._steps,
      distanceMeters: Math.round(this._steps * STRIDE_M),
      activeMinutes: this._activeMinutes,
      activityType: this._activityType(),
      caloriesBurned: Math.round(this._steps * KCAL_PER_STEP),
      sleepHours: this._sleepHours(),
      sleepQuality: this._sleepQuality(),
      source: 'web',
      recordedAt: new Date().toISOString(),
    };
  }

  subscribe(cb: (s: HealthSnapshot) => void): () => void {
    this._subs.push(cb);
    return () => { this._subs = this._subs.filter(s => s !== cb); };
  }

  // ── Motion handler (step counting) ───────────────────────────────────────────

  private _onMotion(e: DeviceMotionEvent) {
    const g = e.accelerationIncludingGravity;
    if (g?.x == null || g.y == null || g.z == null) return;

    const raw = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
    // Low-pass filter: blend toward current reading
    this._magSmoothed = STEP_SMOOTHING * this._magSmoothed + (1 - STEP_SMOOTHING) * raw;

    const now = Date.now();

    // Peak detection: wait for magnitude to rise above threshold, then fall back
    if (!this._rising && this._magSmoothed > STEP_THRESHOLD) {
      this._rising = true;
    } else if (this._rising && this._magSmoothed < STEP_THRESHOLD) {
      this._rising = false;
      if (now - this._lastStepAt > MIN_STEP_GAP_MS) {
        this._lastStepAt = now;
        this._steps++;
        this._recentSteps.push(now);
        if (!this._activeStart) this._activeStart = now;
      }
    }

    // Prune cadence window to last 60 s
    const cutoff = now - 60_000;
    this._recentSteps = this._recentSteps.filter(t => t > cutoff);

    // No steps in last 60 s → end active session
    if (this._recentSteps.length === 0 && this._activeStart) {
      const mins = (now - this._activeStart) / 60_000;
      if (mins >= 1) this._activeMinutes += Math.floor(mins);
      this._activeStart = null;
    }
  }

  // ── Visibility handler (sleep inference) ─────────────────────────────────────

  private _onVisibility() {
    const now = new Date();

    if (document.hidden) {
      // Screen going off
      this._stored.hiddenSince = now.toISOString();
      // If it's nighttime and we haven't recorded a sleep start yet, mark it
      if (isNightHour(now) && !this._stored.sleepStart) {
        this._stored.sleepStart = now.toISOString();
      }
      this._persist();
    } else {
      // Screen coming back on
      if (this._stored.sleepStart && !this._stored.sleepEnd) {
        // Morning wake-up: screen back during day hours
        if (!isNightHour(now)) {
          this._stored.sleepEnd = now.toISOString();
        }
      }
      this._stored.hiddenSince = null;
      this._persist();
      this._emit();
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  private _sleepHours(): number | null {
    const { sleepStart, sleepEnd } = this._stored;
    if (!sleepStart || !sleepEnd) return null;
    const hours = (new Date(sleepEnd).getTime() - new Date(sleepStart).getTime()) / 3_600_000;
    if (hours < MIN_SLEEP_HOURS) return null;
    return Math.round(hours * 10) / 10;
  }

  private _sleepQuality(): SleepQuality | null {
    const h = this._sleepHours();
    if (h === null) return null;
    if (h >= 7.5) return 'good';
    if (h >= 6) return 'fair';
    return 'poor';
  }

  private _activityType(): ActivityType {
    const now = Date.now();
    // Steps in last 30 s × 2 = steps per minute cadence
    const recent = this._recentSteps.filter(t => t > now - 30_000).length;
    const cadence = recent * 2;
    if (cadence === 0) return 'still';
    if (cadence < 80) return 'walking';
    return 'running';
  }

  private _emit() {
    const s = this.getSnapshot();
    this._subs.forEach(cb => cb(s));
  }
}
