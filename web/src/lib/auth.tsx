import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken, hasToken, type User, type Child, type Employer } from './api';
import { useI18n } from '../i18n';

/** One session at a time: a parent/admin, a child (username + PIN) or an employer's HR. */
type Ctx = {
  user: User | null; kid: Child | null; employer: Employer | null; loading: boolean;
  loginEmployer: (email: string, password: string) => Promise<Employer>;
  login: (email: string, password: string, portal?: 'parent' | 'admin') => Promise<User>;
  loginKid: (username: string, pin: string) => Promise<Child>;
  register: (b: Record<string, string>) => Promise<OtpSent>;
  requestCode: (nationalId: string, phone: string) => Promise<OtpSent>;
  loginOtp: (nationalId: string, phone: string, code: string) => Promise<User>;
  logout: () => void; refresh: () => Promise<void>; setUser: (u: User) => void;
};
/** The SMS went out; the sandbox also returns the code so it can be shown on screen. */
export type OtpSent = { codeSent: boolean; phone: string; devCode?: string };
const AuthCtx = createContext<Ctx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [kid, setKid] = useState<Child | null>(null);
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [loading, setLoading] = useState(hasToken());
  const { setLocale } = useI18n();

  const refresh = async () => {
    if (!hasToken()) return setLoading(false);
    try {
      const { user } = await api<{ user: User }>('/auth/me');
      setUser(user);
    } catch {
      try {
        const { child } = await api<{ child: Child }>('/kid/me');
        setKid(child);
      } catch {
        try {
          const { employer } = await api<{ employer: Employer }>('/employer/me');
          setEmployer(employer);
        } catch { setToken(null); }
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const finish = ({ token, user }: { token: string; user: User }) => {
    setToken(token);
    setKid(null);
    setEmployer(null);
    setUser(user);
    setLocale(user.locale);
    return user;
  };
  const value: Ctx = {
    user, kid, employer, loading, refresh, setUser,
    loginEmployer: async (email, password) => {
      const r = await api<{ token: string; employer: Employer }>('/employer/login', { body: { email, password } });
      setToken(r.token);
      setUser(null); setKid(null);
      setEmployer(r.employer);
      return r.employer;
    },
    login: async (email, password, portal) => finish(await api('/auth/login', { body: { email, password, portal } })),
    loginKid: async (username, pin) => {
      const r = await api<{ token: string; child: Child }>('/kid/login', { body: { username, pin } });
      setToken(r.token);
      setUser(null); setEmployer(null);
      setKid(r.child);
      return r.child;
    },
    register: (b) => api<OtpSent>('/auth/register', { body: b }),
    requestCode: (nationalId, phone) => api<OtpSent>('/auth/otp/request', { body: { nationalId, phone } }),
    loginOtp: async (nationalId, phone, code) => finish(await api('/auth/otp/verify', { body: { nationalId, phone, code } })),
    logout: () => { setToken(null); setUser(null); setKid(null); setEmployer(null); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
