const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

// short in-memory cache + in-flight dedupe for GET requests to reduce burst pressure
const _inflight = new Map<string, Promise<unknown>>();
const _cache = new Map<string, { ts: number; data: unknown }>();
const _CACHE_TTL_MS = 800;

export async function apiRequest<T>(
  path: string,
  token?: string,
  options?: RequestInit
): Promise<T> {
  const method = (options && options.method) ? String(options.method).toUpperCase() : 'GET';
  const isGetNoBody = method === 'GET' && options?.body == null;
  const isVolatileGet = isGetNoBody && (
    path.startsWith('/api/test-runs') ||
    path.startsWith('/api/dashboard')
  );

  // build a stable key including authorization to avoid leaking other users' cache
  const authKey = token ? `|${token}` : '';
  const cacheKey = `${method}:${path}${authKey}`;

  if (isGetNoBody && !isVolatileGet) {
    // return recent cached response
    const cached = _cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < _CACHE_TTL_MS) {
      return Promise.resolve(cached.data as T);
    }
    // if identical request already in flight, reuse its promise
    const inflight = _inflight.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }
  }
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

  const fetchPromise = fetch(`${API_BASE}${path}`, {
    ...options,
    cache: "no-store",
    headers,
  }).then(async (response) => {
    // Safely handle empty responses (204 No Content or empty body)
    const text = await response.text();
    let data: unknown = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // If response is not JSON, preserve raw text
        data = text;
      }
    }

    if (response.status === 304 && isGetNoBody) {
      const cached = _cache.get(cacheKey);
      if (cached) {
        return cached.data as T;
      }
    }

    if (!response.ok) {
      const message =
        typeof data === "object" && data && "message" in data
          ? String((data as { message?: unknown }).message || text || "Request failed")
          : String(text || "Request failed");
      throw new Error(message);
    }

    // cache GET responses briefly
    if (isGetNoBody && !isVolatileGet) {
      try {
        _cache.set(cacheKey, { ts: Date.now(), data });
      } catch {}
    }

    return data as T;
  }).finally(() => {
    if (isGetNoBody && !isVolatileGet) {
      _inflight.delete(cacheKey);
    }
  });

  if (isGetNoBody && !isVolatileGet) {
    _inflight.set(cacheKey, fetchPromise as Promise<unknown>);
  }

  const response = await fetchPromise;
  return response as T;
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


