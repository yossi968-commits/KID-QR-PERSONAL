/** Text where *one phrase* is highlighted, as in the headlines: "savings that *grows with your child*". */
export function Hl({ text }: { text: string }) {
  return <>{text.split(/\*([^*]+)\*/).map((part, i) => (i % 2 ? <em key={i} className="hl">{part}</em> : part))}</>;
}
