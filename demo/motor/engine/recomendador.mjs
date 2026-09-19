/**
 * MOTOR DE RECOMENDACION  (el "cerebro" del portal de IA de la ferreteria)
 *
 * No es un chat generico: es un asesor que solo sabe de esta ferreteria y que
 * razona sobre datos reales (catalogo, stock, historial del cliente, nivel de
 * precio y la obra que se acaba de calcular).
 *
 * Familias de reglas, cada una con puntaje:
 *   1. COMPLEMENTO   - falta algo que la obra si o si necesita
 *   2. AHORRO        - misma compra, menos plata (presentacion mayor, sustituto)
 *   3. DISPONIBILIDAD- no hay stock: equivalente listo para hoy
 *   4. NIVEL         - cuanto falta para el siguiente escalon de descuento
 *   5. HISTORIAL     - lo que este cliente siempre pide y hoy no pidio
 *   6. TECNICA       - advertencia de obra que evita un reproceso costoso
 *   7. LOGISTICA     - domicilio gratis, corte de despacho, compra por fases
 *   8. OPORTUNIDAD   - producto con sobrestock que le sirve a esta obra
 */
import { estado, CONFIG, producto } from '../lib/store.mjs';
import { NIVELES, descuentoDe } from '../data/clientes.mjs';
import { alternativas } from './cotizador.mjs';
import { COP, redondear, techo } from '../lib/util.mjs';

/** Que producto "llama" a que otro. Base del asesor de complementos. */
const COMPLEMENTOS = {
  'CEM-GRIS-50': ['ARE-RIO-M3', 'HER-BAL-12', 'HER-PAL-8'],
  'LAD-TOL-MAC': ['CEM-GRIS-50', 'ARE-RIO-M3', 'HER-PLO'],
  'BLO-CON-15': ['CEM-GRIS-50', 'ARE-RIO-M3', 'HER-NIV-60'],
  'CER-PIS-45': ['PEG-CER-25', 'BOQ-2', 'HER-BOQ', 'HER-DIS-7'],
  'CER-PAR-30': ['PEG-CER-25', 'BOQ-2', 'HER-BOQ'],
  'POR-60': ['PEG-POR-25', 'BOQ-2', 'HER-DIS-7'],
  'PIN-V1-GL': ['IMP-SEL-GL', 'HER-ROD-9', 'HER-BRO-4'],
  'PIN-V1-CU': ['IMP-SEL-GL', 'HER-ROD-9', 'HER-BRO-4'],
  'PIN-V3-GL': ['HER-ROD-9', 'HER-BRO-4'],
  'EST-LIS-25': ['HER-FLO', 'IMP-SEL-GL'],
  'DRY-LAM-ST': ['DRY-PAR-89', 'DRY-CAN-89', 'DRY-TOR-1K', 'DRY-MAS-28', 'DRY-CIN-90'],
  'DRY-LAM-RH': ['DRY-PAR-89', 'DRY-CAN-89', 'DRY-TOR-1K', 'DRY-MAS-28'],
  'TEJ-ZIN-30': ['TOR-TEJ-100', 'MAD-2X4-3M'],
  'TEJ-ETE-305': ['TOR-TEJ-100', 'PER-C-80'],
  'ACE-38': ['ALA-NEG-KG', 'ACE-14'],
  'ACE-12': ['ALA-NEG-KG', 'ACE-14'],
  'MAL-ELE-60': ['ALA-NEG-KG'],
  'TUB-PVC-12': ['SOL-PVC-14', 'COD-PVC-12', 'CIN-TEF'],
  'TUB-SAN-4': ['SOL-PVC-14'],
  'CAB-12-100': ['TUB-CON-12', 'CAJ-2X4', 'CIN-TEF'],
  'TOM-DOB': ['CAJ-2X4'],
  'INT-SEN': ['CAJ-2X4'],
  'HER-DIS-7': ['HER-GAF-SE', 'HER-GUA-CA'],
};

/** Presentaciones grandes que salen mas baratas por unidad de medida. */
const PRESENTACIONES = [
  { de: 'PIN-V1-GL', a: 'PIN-V1-CU', factor: 5, etiqueta: 'cunete de 5 galones' },
];

/**
 * Productos que cumplen la misma funcion. Si el carrito ya trae uno del grupo,
 * no tiene sentido sugerir otro: evita el clasico "le falta arena" cuando ya
 * lleva arena, solo que de otro tipo.
 */
const EQUIVALENTES = [
  ['ARE-LAV-M3', 'ARE-RIO-M3'],
  ['CEM-GRIS-50', 'MOR-SEC-40'],
  ['PIN-V1-GL', 'PIN-V1-CU', 'PIN-V3-GL'],
  ['PEG-CER-25', 'PEG-POR-25'],
  ['DRY-LAM-ST', 'DRY-LAM-RH'],
  ['MAD-2X4-3M', 'PER-C-80'],
  ['ACE-38', 'ACE-12'],
];

/** True si el carrito ya cubre la funcion de ese SKU. */
function yaCubierto(sku, enCarrito) {
  if (enCarrito.has(sku)) return true;
  const grupo = EQUIVALENTES.find((g) => g.includes(sku));
  return grupo ? grupo.some((s) => enCarrito.has(s)) : false;
}

const rec = (tipo, titulo, detalle, opts = {}) => ({
  tipo,
  titulo,
  detalle,
  peso: opts.peso ?? 50,
  impacto: opts.impacto || null,
  accion: opts.accion || null,
  skus: opts.skus || [],
});

/**
 * Genera recomendaciones para una cotizacion.
 * @param {object} cotizacion  salida de cotizador.cotizar()
 * @param {object} ctx { clienteId, obra, calculo }
 */
export function recomendar(cotizacion, ctx = {}) {
  const out = [];
  // El carrito, mas lo que el calculo de obra ya propuso aparte (herramienta):
  // no tiene sentido "recomendar" algo que la pantalla ya esta mostrando.
  const enCarrito = new Set([
    ...cotizacion.lineas.map((l) => l.sku),
    ...(ctx.yaSugeridos || []),
    ...(ctx.calculo?.herramientas || []).map((h) => h.sku),
  ]);
  const cli = ctx.clienteId ? estado.clientes.find((c) => c.id === ctx.clienteId) : null;
  const desc = descuentoDe(cli);
  const total = cotizacion.totales.materiales;

  // ---- 1. COMPLEMENTOS ----
  const sugeridos = new Map();
  for (const l of cotizacion.lineas) {
    for (const sku of COMPLEMENTOS[l.sku] || []) {
      if (yaCubierto(sku, enCarrito)) continue;
      const p = producto(sku);
      if (!p || p.stock <= 0) continue;
      const prev = sugeridos.get(sku);
      sugeridos.set(sku, { p, razon: l.nombre, veces: (prev?.veces || 0) + 1 });
    }
  }
  for (const [sku, { p, razon, veces }] of [...sugeridos.entries()].sort((a, b) => b[1].veces - a[1].veces).slice(0, 4)) {
    out.push(
      rec(
        'complemento',
        `Le falta: ${p.nombre}`,
        `Lleva ${razon} y esta linea casi siempre se usa junto con el. Sin esto la obra se detiene a mitad de jornada.`,
        {
          peso: 70 + veces * 5,
          skus: [sku],
          accion: { tipo: 'agregar', sku, cantidad: 1, precio: Math.round(p.precio * (1 - desc)) },
          impacto: `+ ${COP(Math.round(p.precio * (1 - desc)))}`,
        }
      )
    );
  }

  // ---- 2. AHORRO POR PRESENTACION ----
  for (const regla of PRESENTACIONES) {
    const linea = cotizacion.lineas.find((l) => l.sku === regla.de);
    if (!linea || linea.cantidad < regla.factor) continue;
    const grande = producto(regla.a);
    if (!grande || grande.stock <= 0) continue;
    const cajas = Math.floor(linea.cantidad / regla.factor);
    const resto = linea.cantidad - cajas * regla.factor;
    const actual = linea.precioUnit * linea.cantidad;
    const nuevo = Math.round(grande.precio * (1 - desc)) * cajas + linea.precioUnit * resto;
    const ahorro = actual - nuevo;
    if (ahorro > 0) {
      out.push(
        rec('ahorro', `Cambie ${cajas * regla.factor} galones por ${cajas} ${regla.etiqueta}`,
          `Es exactamente el mismo producto y misma cantidad, solo en otra presentacion.`,
          {
            peso: 95,
            skus: [regla.de, regla.a],
            impacto: `Ahorra ${COP(ahorro)}`,
            accion: { tipo: 'reemplazar', sku: regla.de, porSku: regla.a, cantidad: cajas, dejar: resto },
          })
      );
    }
  }

  // ---- 3. DISPONIBILIDAD ----
  for (const l of cotizacion.lineas.filter((x) => !x.disponible)) {
    const alt = l.alternativas?.[0];
    out.push(
      rec('disponibilidad', `Solo hay ${l.stock} de ${l.cantidad} ${l.unidad} de ${l.nombre}`,
        alt
          ? `Le puedo despachar ${l.stock} hoy y el resto en 48 h, o cambiarlo por ${alt.nombre} que si esta completo.`
          : `Le puedo despachar ${l.stock} hoy y programar el faltante para 48 h con el proveedor.`,
        {
          peso: 100,
          skus: [l.sku],
          impacto: `Faltan ${l.faltante} ${l.unidad}`,
          accion: alt ? { tipo: 'sustituir', sku: l.sku, porSku: alt.sku } : { tipo: 'parcial', sku: l.sku, disponible: l.stock },
        })
    );
  }

  // ---- 4. SIGUIENTE NIVEL DE PRECIO ----
  const escalera = [
    { nivel: 'constructor', desde: 1500000 },
    { nivel: 'mayorista', desde: 4500000 },
    { nivel: 'aliado', desde: 12000000 },
  ];
  const actualIdx = escalera.findIndex((e) => e.nivel === (cli?.nivel || ''));
  const siguiente = escalera[actualIdx + 1] || (cli ? null : escalera[0]);
  if (siguiente && total > 0) {
    const falta = siguiente.desde - total;
    if (falta > 0 && falta < siguiente.desde * 0.4) {
      const d = NIVELES[siguiente.nivel];
      out.push(
        rec('nivel', `Le faltan ${COP(falta)} para precio ${d.nombre}`,
          `Con ese monto el descuento pasa a ${Math.round(d.descuento * 100)}% sobre toda la compra, no solo sobre lo adicional.`,
          { peso: 80, impacto: `Ahorraria ${COP(Math.round(siguiente.desde * d.descuento))}` })
      );
    } else if (falta <= 0) {
      const d = NIVELES[siguiente.nivel];
      out.push(
        rec('nivel', `Esta compra califica a precio ${d.nombre}`,
          `Por volumen le aplica ${Math.round(d.descuento * 100)}%. Pidale al asesor que active el nivel en su ficha.`,
          { peso: 85, impacto: `Hasta ${COP(Math.round(total * (d.descuento - desc)))} menos` })
      );
    }
  }

  // ---- 5. HISTORIAL DEL CLIENTE ----
  if (cli?.skusHabituales?.length) {
    const olvidados = cli.skusHabituales.filter((s) => !yaCubierto(s, enCarrito)).slice(0, 2);
    for (const sku of olvidados) {
      const p = producto(sku);
      if (!p || p.stock <= 0) continue;
      out.push(
        rec('historial', `Usted normalmente pide ${p.nombre}`,
          `Esta en su lista habitual y hoy no aparece. Si lo necesita, lo sumo al mismo despacho y no paga otro domicilio.`,
          {
            peso: 60,
            skus: [sku],
            accion: { tipo: 'agregar', sku, cantidad: 1, precio: Math.round(p.precio * (1 - desc)) },
          })
      );
    }
  }

  // ---- 6. TECNICAS DE LA OBRA ----
  for (const adv of ctx.calculo?.advertencias || []) {
    out.push(rec('tecnica', 'Recomendacion tecnica', adv, { peso: 75 }));
  }

  // ---- 7. LOGISTICA ----
  const dom = cotizacion.domicilio;
  if (!dom.gratis) {
    const falta = CONFIG.domicilio.gratisDesde - total;
    out.push(
      rec('logistica', `Le faltan ${COP(falta)} para domicilio gratis`,
        `El envio le cuesta ${COP(CONFIG.domicilio.valor)}. Si suma material que igual va a necesitar, sale mejor.`,
        { peso: 55, impacto: `Ahorra ${COP(CONFIG.domicilio.valor)}` })
    );
  } else {
    out.push(
      rec('logistica', 'Domicilio sin costo',
        `Pedidos confirmados antes de las ${CONFIG.domicilio.corteMismoDia} salen el mismo dia dentro de ${CONFIG.domicilio.coberturaKm} km.`,
        { peso: 40 })
    );
  }

  const pesado = cotizacion.lineas.filter((l) => ['m3', 'bulto'].includes(l.unidad));
  if (pesado.length >= 3) {
    out.push(
      rec('logistica', 'Le conviene partir el despacho en dos',
        'Arena, triturado y cemento juntos ocupan mas de lo que suele caber en un solo viaje y el cemento se endurece si queda a la intemperie. Programe los agregados primero y el cemento el dia que vaya a mezclar.',
        { peso: 65 })
    );
  }

  // ---- 8. OPORTUNIDAD POR SOBRESTOCK ----
  const categorias = new Set(cotizacion.lineas.map((l) => l.categoria));
  const oportunidad = estado.productos
    .filter((p) => categorias.has(p.categoria) && !enCarrito.has(p.sku) && p.stock > p.stockMax * 1.1)
    .sort((a, b) => b.stock / b.stockMax - a.stock / a.stockMax)[0];
  if (oportunidad) {
    out.push(
      rec('oportunidad', `Tenemos sobrestock de ${oportunidad.nombre}`,
        `Esta en la misma linea de lo que va a comprar. Pidale al asesor precio especial por llevarlo en este pedido.`,
        { peso: 45, skus: [oportunidad.sku] })
    );
  }

  return out.sort((a, b) => b.peso - a.peso).slice(0, 8);
}

/**
 * Sugerencias de compra para la ferreteria (no para el cliente):
 * que reponer, que esta quieto y que se va a agotar.
 */
export function sugerenciasCompra() {
  const salidas = new Map();
  const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  for (const p of estado.pedidos) {
    if (p.fecha < desde || p.estado === 'cancelado') continue;
    for (const it of p.items) salidas.set(it.sku, (salidas.get(it.sku) || 0) + it.cantidad);
  }

  const reponer = [];
  const quietos = [];
  for (const p of estado.productos) {
    const consumo30 = salidas.get(p.sku) || 0;
    const diario = consumo30 / 30;
    const dias = diario > 0 ? redondear(p.stock / diario, 1) : null;
    // Objetivo de reposicion: cubrir 14 dias de consumo real, sin pasarse del
    // nivel maximo definido para la referencia. Comprar mas que eso es
    // convertir caja en bodega.
    const objetivo = Math.min(p.stockMax, Math.max(p.stockMin * 2, techo(diario * 14)));
    const sugerido = techo(objetivo - p.stock);

    if ((p.stock <= p.stockMin || (dias !== null && dias < 10)) && sugerido > 0) {
      reponer.push({
        sku: p.sku, nombre: p.nombre, categoria: p.categoriaNombre, unidad: p.unidad,
        stock: p.stock, stockMin: p.stockMin, consumo30, diasCobertura: dias,
        sugerido, costoUnit: p.costo, inversion: sugerido * p.costo,
        urgencia: p.stock <= 0 ? 'agotado' : p.stock <= p.stockMin * 0.5 ? 'critico' : 'bajo',
      });
    } else if (consumo30 === 0 && p.stock > 0) {
      quietos.push({
        sku: p.sku, nombre: p.nombre, categoria: p.categoriaNombre,
        stock: p.stock, valorInmovilizado: p.stock * p.costo,
      });
    }
  }

  reponer.sort((a, b) => {
    const orden = { agotado: 0, critico: 1, bajo: 2 };
    return orden[a.urgencia] - orden[b.urgencia] || (a.diasCobertura ?? 99) - (b.diasCobertura ?? 99);
  });
  quietos.sort((a, b) => b.valorInmovilizado - a.valorInmovilizado);

  return {
    reponer: reponer.slice(0, 25),
    quietos: quietos.slice(0, 12),
    inversionSugerida: reponer.reduce((a, r) => a + r.inversion, 0),
    capitalQuieto: quietos.reduce((a, q) => a + q.valorInmovilizado, 0),
  };
}
