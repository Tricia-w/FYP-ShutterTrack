// ShuttleTrack appearance: one theme per authenticated account, shared by both roles.
export const THEME_OPTIONS = [
  { value: 'light', label: 'Classic Light' },
  { value: 'dark', label: 'Midnight Dark' },
  { value: 'ocean', label: 'Ocean Blue' },
  { value: 'forest', label: 'Forest Green' },
  { value: 'monochrome', label: 'Monochrome' },
];

const THEME_KEY = 'shuttleTheme'; // Legacy browser-only key (anonymous compatibility).
const ACCOUNT_THEME_PREFIX = 'shuttleTheme:account:';
const VALID_THEMES = new Set(THEME_OPTIONS.map(option => option.value));
const normalise = value => VALID_THEMES.has(value) ? value : 'light';
const accountKey = userId => `${ACCOUNT_THEME_PREFIX}${userId}`;

export function getSavedTheme(userId = null) {
  if (typeof window === 'undefined') return 'light';
  try {
    const value = window.localStorage.getItem(userId ? accountKey(userId) : THEME_KEY);
    return normalise(value);
  } catch {
    return 'light';
  }
}

export function applyShuttleTheme(theme, userId = null) {
  const nextTheme = normalise(theme);
  if (typeof document === 'undefined') return nextTheme;
  document.documentElement.setAttribute('data-theme', nextTheme);
  document.body.classList.toggle('dark', nextTheme === 'dark');
  try {
    // A user's selection must never become another account's default.
    window.localStorage.setItem(userId ? accountKey(userId) : THEME_KEY, nextTheme);
  } catch { /* Local storage can be disabled. */ }
  window.dispatchEvent(new CustomEvent('shuttle-theme-changed', {
    detail: { theme: nextTheme, userId },
  }));
  return nextTheme;
}

// Requires public.user_settings.theme_preference (see the accompanying SQL).
export async function loadAccountTheme(supabase, userId) {
  if (!userId) return 'light';
  const { data, error } = await supabase
    .from('user_settings')
    .select('theme_preference')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  // For new accounts (no preference), always use Light, not the last user's theme.
  return normalise(data?.theme_preference);
}

export async function saveAccountTheme(supabase, userId, theme) {
  if (!userId) throw new Error('Please log in to save your theme.');
  const nextTheme = normalise(theme);
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, theme_preference: nextTheme }, { onConflict: 'user_id' });
  if (error) throw error;
  return nextTheme;
}