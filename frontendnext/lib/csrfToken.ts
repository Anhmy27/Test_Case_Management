const CSRF_COOKIE = 'tcm_csrf';

function readBrowserCookie(name: string): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : '';
}

let cachedCsrfToken = '';

export function captureAuthCsrfToken(data: unknown) {
  if (!data || typeof data !== 'object' || !('csrfToken' in data)) {
    return;
  }

  const token = String((data as { csrfToken?: unknown }).csrfToken || '').trim();
  if (token) {
    cachedCsrfToken = token;
  }
}

export function clearAuthCsrfToken() {
  cachedCsrfToken = '';
}

export function getCsrfTokenForRequest(): string {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  return readBrowserCookie(CSRF_COOKIE);
}
