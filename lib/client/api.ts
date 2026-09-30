// lib/client/api.ts
export interface ApiResult<T> {
  ok: boolean;
  /** 0 means the request never reached the server (offline). */
  status: number;
  data: (T & { error?: string }) | null;
}

export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const hasBody = init.body !== undefined;
  try {
    const res = await fetch(url, {
      method: init.method ?? (hasBody ? 'POST' : 'GET'),
      headers: hasBody ? { 'content-type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}
