// Five-theme support for ShuttleTrack. Existing key and dark theme stay compatible.
export const THEME_OPTIONS = [
  { value: 'light', label: 'Classic Light' },
  { value: 'dark', label: 'Midnight Dark' },
  { value: 'ocean', label: 'Ocean Blue' },
  { value: 'forest', label: 'Forest Green' },
  { value: 'monochrome', label: 'Monochrome' },
];

const THEME_KEY = 'shuttleTheme';
const VALID_THEMES = new Set(THEME_OPTIONS.map((option) => option.value));

export function getSavedTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_KEY);
  return VALID_THEMES.has(stored) ? stored : 'light';
}

export function applyShuttleTheme(theme) {
  const nextTheme = VALID_THEMES.has(theme) ? theme : 'light';
  if (typeof document === 'undefined') return nextTheme;
  document.documentElement.setAttribute('data-theme', nextTheme);
  // Legacy body class, for existing CSS dark-mode selectors.
  document.body.classList.toggle('dark', nextTheme === 'dark');
  window.localStorage.setItem(THEME_KEY, nextTheme);
  return nextTheme;
}