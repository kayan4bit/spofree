// HiFi API instances (public endpoints from hifi-instances community).
// Ordered: fastest / most reliable first. Dead or rate-limited instances are
// removed from the default set but can be re-added if they come back online.
export const API_INSTANCES = [
  'https://triton.squid.wtf',
  'https://hund.qqdl.site',
  'https://katze.qqdl.site',
  'https://vogel.qqdl.site',
  'https://wolf.qqdl.site',
  'https://maus.qqdl.site',
];

// Select the first instance by default
export const API_BASE_URL = API_INSTANCES[0];

export const DEFAULT_VOLUME = 0.5;

// App-wide branding
export const APP_NAME = 'Atomic Player';
export const APP_TAGLINE = 'Hi-Res, ad-free streaming';
export const APP_TITLE = `${APP_NAME} — ${APP_TAGLINE}`;

// Default neon-cyan accent
export const DEFAULT_ACCENT = '#22d3ee';
