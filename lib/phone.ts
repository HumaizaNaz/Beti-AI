/** Normalises Pakistani mobile numbers to +92XXXXXXXXXX. Returns null for anything else. */
export function normalizePkPhone(input: string): string | null {
  let d = input.replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '92' + d.slice(1);
  else if (/^3\d{9}$/.test(d)) d = '92' + d;
  if (!/^923\d{9}$/.test(d)) return null;
  return '+' + d;
}
