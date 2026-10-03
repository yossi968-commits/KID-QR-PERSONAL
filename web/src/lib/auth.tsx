import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken, hasToken, type User } from './api';
import { useI18n } from '../i18n';

type Ctx = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<User>; register: (b: Record<string, string>) => Promise<User>; logout: () => void; refresh: () => Promise<void>; setUser: (u: User) => void };
const AuthCtx = createContext<Ctx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(hasToken());
  const { setLocale } = useI18n();

  const refresh = async () => {
    if (!hasToken()) return setLoading(false);
    try {
      const { user } = await api<{ user: User }>('/auth/me');
      setUser(user);
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const finish = ({ token, user }: { token: string; user: User }) => {
    setToken(token);
    setUser(user);
    setLocale(user.locale);
    return user;
  };
  const value: Ctx = {
    user, loading, refresh, setUser,
    login: async (email, password) => finish(await api('/auth/login', { body: { email, password } })),
    register: async (b) => finish(await api('/auth/register', { body: b })),
    logout: () => { setToken(null); setUser(null); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
