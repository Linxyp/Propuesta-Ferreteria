/** Utilidades compartidas: dinero, fechas, texto y numeros pseudo-aleatorios estables. */

export const COP = (n) =>
  '$' + Math.round(Number(n) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

export const redondear = (n, dec = 2) => {
  const f = 10 ** dec;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
};

/** Redondeo hacia arriba a la unidad de compra (no se venden medios bultos). */
export const techo = (n) => Math.ceil(Number(n) - 1e-9);

export const pct = (n) => `${redondear(Number(n) * 100, 1)}%`;

// ---------------------------------------------------------------- fechas ---
export const hoyISO = () => new Date().toISOString().slice(0, 10);

export function isoMas(dias, base) {
  const d = base ? new Date(base + 'T12:00:00') : new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function nombreDia(iso) {
  return DIAS[new Date(iso + 'T12:00:00').getDay()];
}

export function fechaCorta(iso) {
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function fechaLarga(iso) {
  const d = new Date(iso + 'T12:00:00');
  return `${nombreDia(iso)} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function etiquetaRelativa(iso) {
  const h = hoyISO();
  if (iso === h) return 'Hoy';
  if (iso === isoMas(1)) return 'Manana';
  if (iso === isoMas(-1)) return 'Ayer';
  return fechaLarga(iso);
}

export const diffDias = (a, b) =>
  Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000);

// ----------------------------------------------------------------- texto ---
/** Quita tildes, signos y pasa a minusculas: base de toda la busqueda difusa. */
export function normalizar(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s/."'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const tokens = (txt) => normalizar(txt).split(' ').filter((t) => t.length > 1);

/** Similitud de Dice sobre bigramas: robusta a errores de digitacion. */
export function similitud(a, b) {
  const A = normalizar(a).replace(/\s/g, '');
  const B = normalizar(b).replace(/\s/g, '');
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.length < 2 || B.length < 2) return A === B ? 1 : 0;
  const bigr = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const ma = bigr(A);
  const mb = bigr(B);
  let inter = 0;
  for (const [g, c] of ma) inter += Math.min(c, mb.get(g) || 0);
  return (2 * inter) / (A.length - 1 + B.length - 1);
}

// -------------------------------------------------------------- aleatorio ---
/** PRNG determinista (mulberry32): los datos demo siempre salen iguales. */
export function prng(semilla = 20260918) {
  let a = semilla >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const elegir = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
export const entre = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

export const consecutivo = (prefijo, n) => `${prefijo}-${String(n).padStart(5, '0')}`;
