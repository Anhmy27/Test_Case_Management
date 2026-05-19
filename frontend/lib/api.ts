const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

export async function apiRequest<T>(
  path: string,
  token?: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {};

  if (options?.headers) {
    const optionHeaders = new Headers(options.headers);
    optionHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  if (!(options?.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Safely handle empty responses (204 No Content or empty body)
  const text = await response.text();
  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      // If response is not JSON, preserve raw text
      data = text;
    }
  }

  if (!response.ok) {
    const message = (data && data.message) || String(text || 'Request failed');
    throw new Error(message);
  }

  return data as T;
}

export function getId(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id?: unknown })._id || '');
  }

  return '';
}

export function userName(value: unknown): string {
  if (!value) {
    return 'Unassigned';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as { name?: unknown; email?: unknown };
    return String(candidate.name || candidate.email || 'Unknown');
  }

  return 'Unknown';
}


