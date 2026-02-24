/**
 * Thin wrapper around Umami's custom event API.
 * Safe to call even if the Umami script hasn't loaded yet.
 */
export function trackEvent(name, data) {
  if (typeof window !== 'undefined' && window.umami?.track) {
    window.umami.track(name, data);
  }
}
