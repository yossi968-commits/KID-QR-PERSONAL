/** A tree that grows with the portfolio: more leaves and fruit as value rises. */
export default function MoneyTree({ value, deposited, size = 280 }: { value: number; deposited: number; size?: number }) {
  const growth = Math.min(1, Math.log10(1 + value / 100) / 5.3); // ~₪200k fills the tree
  const leaves = 6 + Math.round(growth * 34);
  const fruit = deposited ? Math.min(14, Math.max(0, Math.round(((value - deposited) / deposited) * 12))) : 0;
  const trunkH = 70 + growth * 50;
  const crownR = 45 + growth * 65;
  const cx = 150, cy = 250 - trunkH - crownR * 0.55;
  let s = 3;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts = Array.from({ length: leaves }, () => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * crownR;
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 14 + r() * 16] as const;
  });
  const fr = Array.from({ length: fruit }, () => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * crownR * 0.85;
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8] as const;
  });
  return (
    <svg viewBox="0 0 300 280" width={size} height={size * 280 / 300} role="img" aria-label="money tree">
      <ellipse cx="150" cy="255" rx="110" ry="14" fill="#7cc06a" opacity=".6" />
      <path d={`M${cx - 10},252 Q${cx - 6},${252 - trunkH / 2} ${cx - 4},${252 - trunkH} L${cx + 4},${252 - trunkH} Q${cx + 6},${252 - trunkH / 2} ${cx + 12},252 Z`} fill="#8a5a2b" />
      {pts.map(([x, y, rr], i) => <circle key={i} cx={x} cy={y} r={rr} fill={i % 3 ? '#3fa34d' : '#5cbf5f'} />)}
      {fr.map(([x, y], i) => (
        <g key={'f' + i}>
          <circle cx={x} cy={y} r="9" fill="#f2b84b" stroke="#c98a12" strokeWidth="1.5" />
          <text x={x} y={y + 3.5} fontSize="10" textAnchor="middle" fill="#7a4d00" fontWeight="700">₪</text>
        </g>
      ))}
    </svg>
  );
}
