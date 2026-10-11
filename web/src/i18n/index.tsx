import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import heBase from './he';
import enBase from './en';
import { heMore, enMore } from './more';
import { heSector, enSector, arSector } from './sector';
import { arBase } from './ar';
import { heDesign, enDesign, arDesign } from './design';
import { heCalc, enCalc, arCalc } from './calc';

const he = { ...heBase, ...heMore, ...heSector, ...heDesign, ...heCalc };
const en = { ...enBase, ...enMore, ...enSector, ...enDesign, ...enCalc };
type Dict = typeof he;
const ar = { ...arBase, ...arSector, ...arDesign, ...arCalc } as Dict;

export type Locale = 'he' | 'en' | 'ar';
export const LOCALES: Locale[] = ['he', 'en', 'ar'];
const DICTS: Record<Locale, Dict> = { he, en, ar };
export const RTL: Record<Locale, boolean> = { he: true, en: false, ar: true };
/** Intl locale per UI language; Arabic in Israel is written with Western digits. */
export const INTL: Record<Locale, string> = { he: 'he-IL', en: 'en-IL', ar: 'ar-IL-u-nu-latn' };

type Key = keyof Dict;
type Ctx = { locale: Locale; intl: string; name: (x: { name: string; nameEn?: string; nameAr?: string | null } | undefined) => string; setLocale: (l: Locale) => void; t: (k: Key, vars?: Record<string, string | number>) => string; fmtMoney: (agorot: number, opts?: { cents?: boolean }) => string; fmtDate: (d: string) => string };
const I18n = createContext<Ctx>(null!);

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem('locale');
    if (saved === 'he' || saved === 'en' || saved === 'ar') return saved;
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
  const nf = new Intl.NumberFormat(INTL[locale], { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
  const nfc = new Intl.NumberFormat(INTL[locale], { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });
  const fmtMoney = (agorot: number, opts?: { cents?: boolean }) => (opts?.cents ? nfc : nf).format(agorot / 100);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale === 'en' ? 'en-GB' : INTL[locale], { day: 'numeric', month: 'short', year: 'numeric' });
  // Names of houses and partners: Hebrew, English, or Arabic where one is given (else English).
  const name: Ctx['name'] = (x) => (!x ? '' : locale === 'he' ? x.name : locale === 'ar' ? x.nameAr || x.nameEn || x.name : x.nameEn || x.name);
  return <I18n.Provider value={{ locale, intl: INTL[locale], name, setLocale, t, fmtMoney, fmtDate }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);
