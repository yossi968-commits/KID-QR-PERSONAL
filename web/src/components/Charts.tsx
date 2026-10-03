import { useI18n } from '../i18n';

const W = 640, H = 240, P = { l: 56, r: 12, t: 12, b: 28 };

function compact(agorot: number, locale: string) {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-IL', { notation: 'compact', maximumFractionDigits: 1 }).format(agorot / 100);
}

function ticks(max: number, n = 4) {
  const raw = max / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  return Array.from({ length: n + 1 }, (_, i) => i * step);
}

/** Value vs. cumulative deposits over time. Time always runs left-to-right. */
export function GrowthChart({ data }: { data: { date: string; value: number; deposited: number }[] }) {
  const { t, locale } = useI18n();
  if (data.length < 2) return <p className="muted">—</p>;
  const yt = ticks(Math.max(...data.map((d) => Math.max(d.value, d.deposited))));
  const ymax = yt[yt.length - 1];
  const x = (i: number) => P.l + (i / (data.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / ymax) * (H - P.t - P.b);
  const line = (k: 'value' | 'deposited') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join('');
  const area = line('value') + `L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const years = [...new Set(data.map((d) => d.date.slice(0, 4)))];
  const yearStep = Math.ceil(years.length / 6);
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ direction: "ltr" }} role="img" aria-label={t('child.chartTitle')}>
        {yt.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">₪{compact(v, locale)}</text>
          </g>
        ))}
        {years.filter((_, i) => i % yearStep === 0).map((yr) => {
          const i = data.findIndex((d) => d.date.startsWith(yr));
          return <text key={yr} x={x(i)} y={H - 8} fontSize="11" fill="var(--muted)" textAnchor="middle">{yr}</text>;
        })}
        <path d={area} fill="var(--chart-value)" opacity="0.12" />
        <path d={line('deposited')} fill="none" stroke="var(--chart-dep)" strokeWidth="2.5" strokeDasharray="5 4" />
        <path d={line('value')} fill="none" stroke="var(--chart-value)" strokeWidth="2.5" />
      </svg>
      <div className="legend">
        <span><i style={{ background: 'var(--chart-value)' }} />{t('child.chartValue')}</span>
        <span><i style={{ background: 'var(--chart-dep)' }} />{t('child.chartDeposited')}</span>
      </div>
    </div>
  );
}

/** Fan of low / mid / high scenarios by age. */
export function ProjectionChart({ points }: { points: { age: number; low: number; mid: number; high: number }[] }) {
  const { t, locale } = useI18n();
  if (points.length < 2) return null;
  const yt = ticks(Math.max(...points.map((p) => p.high)));
  const ymax = yt[yt.length - 1];
  const x = (i: number) => P.l + (i / (points.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / ymax) * (H - P.t - P.b);
  const path = (k: 'low' | 'mid' | 'high') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  const band = path('high') + points.slice().reverse().map((p, i) => `L${x(points.length - 1 - i).toFixed(1)},${y(p.low).toFixed(1)}`).join('') + 'Z';
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ direction: "ltr" }} role="img" aria-label={t('child.projTitle')}>
        {yt.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">₪{compact(v, locale)}</text>
          </g>
        ))}
        {points.map((p, i) => (i % Math.ceil(points.length / 8) === 0 || i === points.length - 1) && (
          <text key={p.age} x={x(i)} y={H - 8} fontSize="11" fill="var(--muted)" textAnchor="middle">{p.age}</text>
        ))}
        <path d={band} fill="var(--gold)" opacity="0.22" />
        <path d={path('mid')} fill="none" stroke="var(--chart-value)" strokeWidth="2.5" />
      </svg>
      <div className="legend">
        <span><i style={{ background: 'var(--chart-value)' }} />{t('child.projMid')}</span>
        <span><i style={{ background: 'var(--gold)', opacity: 0.5 }} />{t('child.projLow')} – {t('child.projHigh')}</span>
      </div>
    </div>
  );
}

export function Bars({ data }: { data: { label: string; value: number }[] }) {
  const { locale } = useI18n();
  if (!data.length) return <p className="muted">—</p>;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const bw = (W - P.l - P.r) / data.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ direction: "ltr" }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (H - P.t - P.b - 14);
        return (
          <g key={d.label}>
            <rect x={P.l + i * bw + 6} y={H - P.b - h} width={bw - 12} height={h} rx="6" fill="var(--chart-value)" />
            <text x={P.l + i * bw + bw / 2} y={H - P.b - h - 4} textAnchor="middle" fontSize="10" fill="var(--ink-2)">₪{compact(d.value, locale)}</text>
            <text x={P.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
