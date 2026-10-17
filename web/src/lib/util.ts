export const daysUntil = (date: string) => Math.max(0, Math.round((Date.parse(date) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000));
