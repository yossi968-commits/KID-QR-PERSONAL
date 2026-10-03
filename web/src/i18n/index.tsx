import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import he, { type Dict } from './he';
import en from './en';

export type Locale = 'he' | 'en';
const DICTS: Record<Locale, Dict> = { he, en };
export const RTL: Record<Locale, boolean> = { he: true, en: false };

type Key = keyof Dict;
type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (k: Key, vars?: Record<string, string | number>) => string; fmtMoney: (agorot: number, opts?: { cents?: boolean }) => string; fmtDate: (d: string) => string };
const I18n = createContext<Ctx>(null!);

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem('locale');
    if (saved === 'he' || saved === 'en') return saved;
  } catch {}
  return 'he'; // Hebrew-first product
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL[locale] ? 'rtl' : 'ltr';
    document.title = DICTS[locale].appName;
  }, [locale]);
  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem('locale', l); } catch {}
  };
  const t = (k: Key, vars?: Record<string, string | number>) => {
    let s: string = DICTS[locale][k] ?? he[k] ?? k;
    if (vars) for (const [n, v] of Object.entries(vars)) s = s.replaceAll(`{${n}}`, String(v));
    return s;
  };
  const nf = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
  const nfc = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });
  const fmtMoney = (agorot: number, opts?: { cents?: boolean }) => (opts?.cents ? nfc : nf).format(agorot / 100);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return <I18n.Provider value={{ locale, setLocale, t, fmtMoney, fmtDate }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);
