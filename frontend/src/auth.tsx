import { createContext, useContext, useMemo, useState } from 'react';
import { api, loadSession, saveSession } from './api';
import type { Session } from './types';

type AuthValue = {
  session: Session | null;
  login: (email: string, senha: string) => Promise<Session>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const value = useMemo<AuthValue>(
    () => ({
      session,
      async login(email, senha) {
        const next = await api<Session>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, senha }),
        });
        saveSession(next);
        setSession(next);
        return next;
      },
      async logout() {
        const current = loadSession();
        try {
          await api('/api/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken: current?.refreshToken ?? undefined }),
          });
        } catch {
          /* a sessão local sai mesmo se o servidor já tiver expirado */
        }
        saveSession(null);
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider ausente');
  return value;
}
