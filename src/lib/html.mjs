// Tiny HTML templating: every ${value} is escaped unless it is itself html`` or raw().
export class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export const raw = (s) => new Raw(String(s ?? ''));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

const out = (v) =>
  v == null || v === false || v === true ? ''
    : Array.isArray(v) ? v.map(out).join('')
      : v instanceof Raw ? v.s
        : esc(v);

export function html(strings, ...values) {
  let s = strings[0];
  for (let i = 0; i < values.length; i++) s += out(values[i]) + strings[i + 1];
  return new Raw(s);
}

// "+91 90000 00000" -> "919000000000"
export const digits = (s) => String(s ?? '').replace(/\D/g, '');

export const waLink = (number, text = '') => {
  const n = digits(number);
  if (!n) return '#';
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

export const telLink = (number) => `tel:+${digits(number)}`;

export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

export const formatDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
