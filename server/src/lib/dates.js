export const today = () => new Date().toISOString().slice(0, 10);

export function ageOn(birthDate, onDate = today()) {
  const b = new Date(birthDate), d = new Date(onDate);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  const m = d.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && d.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function nextBirthday(birthDate, from = today()) {
  const b = new Date(birthDate), f = new Date(from);
  let next = new Date(Date.UTC(f.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
  if (next < f) next = new Date(Date.UTC(f.getUTCFullYear() + 1, b.getUTCMonth(), b.getUTCDate()));
  return next.toISOString().slice(0, 10);
}

export function addYears(date, years) {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
