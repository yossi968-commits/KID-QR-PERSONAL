import { useI18n } from '../i18n';

/**
 * A coloured badge per investment house, so houses are told apart at a glance.
 * Placeholder colours and initials, not the houses' own logos.
 */
const MARKS: Record<string, [string, string, string]> = {
  altshuler: ['#D7263D', 'אש', 'AS'],
  meitav: ['#F28C28', 'מי', 'Me'],
  more: ['#00A19B', 'מור', 'Mo'],
  analyst: ['#5B2C83', 'אנ', 'An'],
  yelin: ['#0072CE', 'יל', 'YL'],
  harel: ['#00843D', 'הר', 'Ha'],
  migdal: ['#1F4E9E', 'מג', 'Mi'],
  clal: ['#2A9FD8', 'כל', 'Cl'],
  phoenix: ['#E35205', 'הפ', 'Ph'],
  menora: ['#6E9E1F', 'ממ', 'MM'],
};

export function ProviderMark({ id, size = 28 }: { id: string; size?: number }) {
  const { locale } = useI18n();
  const [color, he, en] = MARKS[id] || ['#5B7083', '?', '?'];
  return (
    <span className="pmark" aria-hidden style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}>
      {locale === 'he' ? he : en}
    </span>
  );
}

/** The house's badge and name on one line. */
export function ProviderName({ id, name, size }: { id: string; name: string; size?: number }) {
  return <span className="pname"><ProviderMark id={id} size={size} />{name}</span>;
}
