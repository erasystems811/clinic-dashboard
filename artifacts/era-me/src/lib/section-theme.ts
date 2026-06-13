import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

// Applies the emerald CSS variable set for the weight loss section.
export function applyEmeraldVars(dark: boolean) {
  const r = document.documentElement;
  r.style.setProperty('--accent',              '#10b981');
  r.style.setProperty('--accent-light',        '#34d399');
  r.style.setProperty('--glow-rgb',            '16,185,129');
  r.style.setProperty('--btn-gradient',        'linear-gradient(135deg,#059669,#10b981)');
  r.style.setProperty('--bg-base',             dark ? '#011a13' : '#f0fdf4');
  r.style.setProperty('--bg-mid',              dark ? '#042f21' : '#dcfce7');
  r.style.setProperty('--light-bg-from',       '#f0fdf4');
  r.style.setProperty('--light-bg-to',         '#dcfce7');
  r.style.setProperty('--text-main',           dark ? '#d1fae5'                    : '#064e3b');
  r.style.setProperty('--text-sub',            dark ? 'rgba(110,231,183,0.75)'     : 'rgba(6,78,59,0.65)');
  r.style.setProperty('--text-dim',            dark ? 'rgba(52,211,153,0.45)'      : 'rgba(6,78,59,0.42)');
  r.style.setProperty('--glass-bg',            dark ? 'rgba(16,185,129,0.07)'      : 'rgba(255,255,255,0.55)');
  r.style.setProperty('--glass-border',        dark ? 'rgba(16,185,129,0.15)'      : 'rgba(16,185,129,0.22)');
  r.style.setProperty('--glass-track',         dark ? 'rgba(16,185,129,0.10)'      : 'rgba(16,185,129,0.15)');
  r.style.setProperty('--input-bg',            dark ? 'rgba(16,185,129,0.06)'      : 'rgba(255,255,255,0.60)');
  r.style.setProperty('--input-border',        dark ? 'rgba(16,185,129,0.14)'      : 'rgba(16,185,129,0.22)');
  r.style.setProperty('--accent-tint-bg',      dark ? 'rgba(16,185,129,0.08)'      : 'rgba(16,185,129,0.10)');
  r.style.setProperty('--accent-tint-border',  dark ? 'rgba(16,185,129,0.22)'      : 'rgba(16,185,129,0.30)');
}

export function useWLTheme() {
  const { account, restoreAppTheme } = useAuth();
  const dark = account?.darkMode ?? true;

  useEffect(() => {
    applyEmeraldVars(dark);
    return restoreAppTheme;
  }, [dark, restoreAppTheme]);
}

// Applies the crimson/rose CSS variable set for the intimacy mini-app.
export function applyCrimsonVars() {
  const r = document.documentElement;
  r.style.setProperty('--accent',              '#e11d48');
  r.style.setProperty('--accent-light',        '#fb7185');
  r.style.setProperty('--glow-rgb',            '225,29,72');
  r.style.setProperty('--btn-gradient',        'linear-gradient(135deg,#9f1239,#e11d48)');
  r.style.setProperty('--bg-base',             '#0d0006');
  r.style.setProperty('--bg-mid',              '#1a0008');
  r.style.setProperty('--text-main',           '#fecdd3');
  r.style.setProperty('--text-sub',            'rgba(253,164,175,0.75)');
  r.style.setProperty('--text-dim',            'rgba(253,164,175,0.40)');
  r.style.setProperty('--glass-bg',            'rgba(225,29,72,0.07)');
  r.style.setProperty('--glass-border',        'rgba(225,29,72,0.18)');
  r.style.setProperty('--glass-track',         'rgba(225,29,72,0.10)');
  r.style.setProperty('--input-bg',            'rgba(225,29,72,0.06)');
  r.style.setProperty('--input-border',        'rgba(225,29,72,0.16)');
  r.style.setProperty('--accent-tint-bg',      'rgba(225,29,72,0.09)');
  r.style.setProperty('--accent-tint-border',  'rgba(225,29,72,0.24)');
}

export function useIntimacyTheme() {
  const { restoreAppTheme } = useAuth();

  useEffect(() => {
    applyCrimsonVars();
    return restoreAppTheme;
  }, [restoreAppTheme]);
}
