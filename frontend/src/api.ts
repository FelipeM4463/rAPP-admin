import type { Session } from './types';

const KEY = 'rapp.session';

export function loadSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  if (!session) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(session));
}

function messageFrom(data: unknown) {
  if (!data || typeof data !== 'object') return 'Não foi possível concluir a operação.';
  const message = (data as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message.trim()) return message;
  return 'Não foi possível concluir a operação.';
}

async function refreshSession() {
  const session = loadSession();
  if (!session?.refreshToken) return false;
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!response.ok) {
    saveSession(null);
    return false;
  }
  saveSession((await response.json()) as Session);
  return true;
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const session = loadSession();
  const headers = new Headers(options.headers);
  const isForm = options.body instanceof FormData;
  if (!isForm && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);

  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && retry && !path.startsWith('/api/auth/login')) {
    const refreshed = session?.refreshToken ? await refreshSession() : false;
    if (refreshed) return api<T>(path, options, false);
    saveSession(null);
    if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    throw new Error('Sessão expirada. Entre novamente.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(messageFrom(data));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
