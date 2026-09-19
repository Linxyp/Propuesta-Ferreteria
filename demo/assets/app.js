/* Utilidades compartidas del front: formato, graficas SVG y navegacion.
 * El transporte de datos vive en api.js, que cambia entre la version con
 * servidor y la version estatica sin tocar las pantallas. */

import { api, ruta, CON_BACKEND } from './api.js';
export { api, ruta, CON_BACKEND };

export const COP = (n) =>
  '$' + Math.round(Number(n) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

export const COPcorto = (n) => {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e9) return '$' + (n / 1e9).toFixed(1).replace('.', ',') + ' MM';
  if (v >= 1e6) return '$' + (n / 1e6).toFixed(1).replace('.', ',') + ' M';
  if (v >= 1e3) return '$' + Math.round(n / 1e3) + ' k';
  return '$' + Math.round(n);
};

export const pct = (n, dec = 1) => `${((Number(n) || 0) * 100).toFixed(dec).replace('.', ',')}%`;
export const numero = (n, dec = 0) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: dec });

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Barra de navegacion comun a todas las pantallas. */
export function barra(activa = '') {
  const enlaces = [
    ['/', 'Inicio'],
    ['/simulador', 'Simulador de obra'],
    ['/asistente', 'Asistente IA'],
    ['/portal', 'Portal de clientes'],
    ['/whatsapp', 'Bot WhatsApp'],
    ['/admin', 'Sistema interno'],
  ];
  return `
  <header class="barra"><div class="contenedor barra-in">
    <a class="marca" href="${ruta('/')}"><span class="marca-icono">F</span><span>Ferreteria <b style="color:var(--acento)">360</b></span></a>
    <nav class="nav">
      ${enlaces.map(([h, t]) => `<a href="${ruta(h)}" class="${activa === h ? 'activo' : ''}">${t}</a>`).join('')}
    </nav>
  </div></header>`;
}

export function pie() {
  return `<footer class="pie"><div class="contenedor fila-sb wrap">
    <span>Plataforma Ferreteria 360 &middot; demostracion funcional</span>
    <span class="micro">Datos de ejemplo generados por el sistema. Ningun precio es una oferta comercial.</span>
  </div></footer>`;
}

// ------------------------------------------------------------- graficas ---
/** Grafica de area + linea, SVG puro (sin librerias externas). */
export function grafLinea(datos, { alto = 190, clave = 'ventas', color = '#f5a524', etiquetas = 6 } = {}) {
  if (!datos?.length) return '<p class="nada">Sin datos</p>';
  const w = 800, h = alto, pad = { t: 12, r: 10, b: 24, l: 10 };
  const vals = datos.map((d) => Number(d[clave]) || 0);
  const max = Math.max(...vals, 1) * 1.12;
  const px = (i) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, datos.length - 1);
  const py = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);

  const linea = vals.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const area = `${linea} L${px(vals.length - 1).toFixed(1)},${h - pad.b} L${px(0).toFixed(1)},${h - pad.b} Z`;
  const paso = Math.max(1, Math.floor(datos.length / etiquetas));

  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${alto}px" preserveAspectRatio="none">
    <defs><linearGradient id="g${clave}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".34"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${[0.25, 0.5, 0.75].map((f) => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${py(max * f)}" y2="${py(max * f)}" stroke="#23314d" stroke-width="1"/>`).join('')}
    <path d="${area}" fill="url(#g${clave})"/>
    <path d="${linea}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
    ${datos.map((d, i) => (i % paso === 0
      ? `<text x="${px(i)}" y="${h - 7}" fill="#6b7f9e" font-size="11" text-anchor="middle">${esc(d.etiqueta || '')}</text>`
      : '')).join('')}
  </svg>`;
}

/** Barras horizontales con valor y participacion. */
export function grafBarras(filas, { clave = 'valor', etiqueta = 'nombre', color = '#22b8cf', formato = COPcorto } = {}) {
  if (!filas?.length) return '<p class="nada">Sin datos</p>';
  const max = Math.max(...filas.map((f) => Number(f[clave]) || 0), 1);
  return `<div style="display:grid;gap:9px">${filas
    .map((f) => {
      const v = Number(f[clave]) || 0;
      return `<div>
        <div class="fila-sb" style="margin-bottom:4px">
          <span class="mini negro">${esc(f[etiqueta])}</span>
          <span class="mono" style="color:${color}">${formato(v)}</span>
        </div>
        <div class="barra-prog"><i style="width:${(v / max) * 100}%;background:${color}"></i></div>
      </div>`;
    })
    .join('')}</div>`;
}

/** Dona de participacion. */
export function grafDona(partes, { tamano = 150 } = {}) {
  const total = partes.reduce((a, p) => a + p.valor, 0) || 1;
  const r = 52, c = 2 * Math.PI * r;
  let off = 0;
  const arcos = partes
    .map((p) => {
      const frac = p.valor / total;
      const dash = `${(frac * c).toFixed(2)} ${c.toFixed(2)}`;
      const el = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${p.color}" stroke-width="17"
        stroke-dasharray="${dash}" stroke-dashoffset="${(-off * c).toFixed(2)}" transform="rotate(-90 70 70)"/>`;
      off += frac;
      return el;
    })
    .join('');
  return `<div class="fila" style="gap:18px;align-items:center;flex-wrap:wrap">
    <svg viewBox="0 0 140 140" style="width:${tamano}px;height:${tamano}px;flex:0 0 auto">
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="#1c2740" stroke-width="17"/>${arcos}
    </svg>
    <div style="display:grid;gap:7px;flex:1;min-width:150px">
      ${partes.map((p) => `<div class="fila-sb">
        <span class="mini"><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${p.color};margin-right:7px"></i>${esc(p.nombre)}</span>
        <span class="mono">${pct(p.valor / total, 0)}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

// -------------------------------------------------------------- avisos ---
let contenedorAvisos = null;
export function aviso(texto, tipo = 'ok') {
  if (!contenedorAvisos) {
    contenedorAvisos = document.createElement('div');
    contenedorAvisos.style.cssText =
      'position:fixed;right:18px;bottom:18px;z-index:999;display:grid;gap:9px;max-width:370px';
    document.body.appendChild(contenedorAvisos);
  }
  const colores = { ok: 'verde', error: 'roja', info: 'cian', warn: '' };
  const el = document.createElement('div');
  el.className = `aviso ${colores[tipo] ?? ''}`;
  el.style.cssText = 'box-shadow:var(--sombra);animation:entra .22s ease';
  el.textContent = texto;
  contenedorAvisos.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 320);
  }, 4200);
}

const estilo = document.createElement('style');
estilo.textContent = '@keyframes entra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}';
document.head.appendChild(estilo);

export const ESTADO_COLOR = {
  recibido: 'gris',
  alistando: '',
  listo: 'cian',
  despachado: 'morada',
  entregado: 'verde',
  cancelado: 'roja',
};

export const CANAL_ICONO = {
  whatsapp: 'WhatsApp',
  portal: 'Portal B2B',
  web: 'Web',
  mostrador: 'Mostrador',
  simulador: 'Simulador',
};
