/**
 * NUCLEO DEL ESTADO  (sin dependencias de plataforma)
 *
 * Una sola fuente de verdad en memoria. Todos los canales (mostrador, web,
 * portal B2B y bot de WhatsApp) escriben aqui, que es exactamente lo que hace
 * que el inventario y la caja cuadren: no hay una base para la web y otra
 * para el local.
 *
 * Este archivo no toca disco ni navegador a proposito: lo usan igual el
 * servidor de Node (persistiendo en datos/estado.json) y la version estatica
 * del sitio (persistiendo en el navegador). Por eso el generador de datos demo
 * existe una sola vez y no hay dos verdades que mantener sincronizadas.
 *
 * En produccion la persistencia se reemplaza por PostgreSQL conservando esta
 * misma interfaz.
 */
import { PRODUCTOS } from '../data/catalogo.mjs';
import { CLIENTES, NIVELES, descuentoEfectivo } from '../data/clientes.mjs';
import { hoyISO, isoMas, diffDias, prng, elegir, entre, consecutivo, redondear } from './util.mjs';

export const IVA = 0.19;

export const CONFIG = {
  negocio: 'Ferreteria',
  moneda: 'COP',
  iva: IVA,
  horario: 'Lunes a viernes 7:00 am - 6:00 pm | Sabados 7:00 am - 4:00 pm | Domingos 8:00 am - 12:00 m',
  domicilio: {
    gratisDesde: 350000,
    valor: 18000,
    coberturaKm: 12,
    corteMismoDia: '14:00',
  },
  pagos: ['Efectivo', 'Transferencia (Bancolombia / Nequi / Daviplata)', 'Datafono', 'Credito aprobado'],
  gastosFijosMes: 10750000,
};

export const estado = {
  productos: [],
  clientes: [],
  pedidos: [],
  movimientos: [],
  compras: [],
  gastos: [],
  cotizaciones: [],
  conversaciones: {},
  eventos: [],
  contadores: { pedido: 0, cotizacion: 0, movimiento: 0, compra: 0 },
};

// ------------------------------------------------------------------ ayuda ---
export const nuevoId = (tipo, prefijo) => consecutivo(prefijo, ++estado.contadores[tipo]);

export function registrarEvento(tipo, detalle, meta = {}) {
  estado.eventos.unshift({
    id: estado.eventos.length + 1,
    tipo,
    detalle,
    meta,
    ts: new Date().toISOString(),
  });
  if (estado.eventos.length > 400) estado.eventos.length = 400;
}

export function producto(sku) {
  return estado.productos.find((p) => p.sku === sku) || null;
}

export function cliente(id) {
  return estado.clientes.find((c) => c.id === id) || null;
}

/**
 * Movimiento de inventario. Toda salida o entrada pasa por aqui, de modo que
 * el kardex siempre explica por que cambio el stock.
 */
export function moverInventario({ sku, cantidad, tipo, referencia, nota = '' }) {
  const p = producto(sku);
  if (!p) return null;
  const antes = p.stock;
  p.stock = redondear(p.stock + cantidad, 2);
  const mov = {
    id: nuevoId('movimiento', 'MOV'),
    fecha: new Date().toISOString(),
    sku,
    nombre: p.nombre,
    tipo,
    cantidad,
    antes,
    despues: p.stock,
    referencia,
    nota,
  };
  estado.movimientos.unshift(mov);
  if (estado.movimientos.length > 3000) estado.movimientos.length = 3000;
  return mov;
}

// -------------------------------------------------------------- generacion ---
/**
 * Datos demo deterministas: 75 dias de historia comercial coherente
 * (ventas, compras, gastos) + pedidos vivos para los proximos dias.
 */
export function sembrar() {
  const rnd = prng(20260918);

  estado.productos = PRODUCTOS.map((p) => ({ ...p }));
  estado.clientes = CLIENTES.map((c) => ({ ...c, historial: [] }));
  estado.pedidos = [];
  estado.movimientos = [];
  estado.compras = [];
  estado.gastos = [];
  estado.cotizaciones = [];
  estado.conversaciones = {};
  estado.eventos = [];
  estado.contadores = { pedido: 0, cotizacion: 0, movimiento: 0, compra: 0 };

  const canales = ['mostrador', 'mostrador', 'mostrador', 'whatsapp', 'whatsapp', 'portal', 'web'];
  const hoy = hoyISO();

  // ---- Historia de ventas (75 dias hacia atras) ----
  for (let d = 75; d >= 1; d--) {
    const fecha = isoMas(-d);
    const dow = new Date(fecha + 'T12:00:00').getDay();
    if (dow === 0 && rnd() < 0.6) continue; // domingos flojos
    const base = dow === 6 ? 11 : dow === 0 ? 4 : 8;
    const n = entre(rnd, base - 3, base + 4);
    for (let i = 0; i < n; i++) {
      const canal = elegir(rnd, canales);
      const esB2B = canal === 'portal' || (canal === 'whatsapp' && rnd() < 0.65);
      const cli = esB2B ? elegir(rnd, estado.clientes) : null;
      estado.pedidos.push(
        generarPedido(rnd, { fecha, canal, cli, estadoFinal: 'entregado' })
      );
    }
  }

  // ---- Pedidos vivos: hoy y proximos 6 dias ----
  const vivos = [
    { dia: 0, cant: 7, estados: ['alistando', 'listo', 'despachado', 'recibido'] },
    { dia: 1, cant: 6, estados: ['recibido', 'recibido', 'alistando'] },
    { dia: 2, cant: 4, estados: ['recibido'] },
    { dia: 3, cant: 3, estados: ['recibido'] },
    { dia: 4, cant: 2, estados: ['recibido'] },
    { dia: 5, cant: 2, estados: ['recibido'] },
    { dia: 6, cant: 1, estados: ['recibido'] },
  ];
  for (const v of vivos) {
    for (let i = 0; i < v.cant; i++) {
      const canal = v.dia === 0 ? elegir(rnd, canales) : elegir(rnd, ['whatsapp', 'whatsapp', 'portal']);
      const esB2B = canal !== 'mostrador' && canal !== 'web';
      const cli = esB2B ? elegir(rnd, estado.clientes) : null;
      const p = generarPedido(rnd, {
        fecha: isoMas(-Math.min(v.dia, 1)),
        canal,
        cli,
        estadoFinal: elegir(rnd, v.estados),
        fechaEntrega: isoMas(v.dia),
      });
      estado.pedidos.push(p);
    }
  }

  // ---- Compras a proveedor (reposicion) ----
  for (let s = 10; s >= 0; s--) {
    const fecha = isoMas(-s * 7 - entre(rnd, 0, 2));
    const items = [];
    const muestra = [...estado.productos].sort(() => rnd() - 0.5).slice(0, entre(rnd, 4, 9));
    for (const p of muestra) {
      const cant = Math.max(1, Math.round(p.stockMin * (0.8 + rnd())));
      items.push({ sku: p.sku, nombre: p.nombre, cantidad: cant, costoUnit: p.costo });
    }
    const total = items.reduce((a, it) => a + it.cantidad * it.costoUnit, 0);
    estado.compras.push({
      id: nuevoId('compra', 'OC'),
      fecha,
      proveedor: elegir(rnd, ['Argos', 'Diaco', 'Corona', 'Pavco', 'Pintuco', 'Gyplac', 'Distribuidora Andina']),
      items,
      total,
      estado: s === 0 ? 'en transito' : 'recibida',
    });
  }

  // ---- Gastos operativos de los ultimos 3 meses ----
  const conceptos = [
    ['Arriendo local', 2800000],
    ['Nomina y prestaciones', 5400000],
    ['Servicios publicos', 780000],
    ['Transporte y domicilios', 950000],
    ['Papeleria y aseo', 280000],
    ['Impuestos y camara de comercio', 380000],
  ];
  for (let m = 2; m >= 0; m--) {
    const f = new Date();
    f.setMonth(f.getMonth() - m, 5);
    const fecha = f.toISOString().slice(0, 10);
    for (const [concepto, valor] of conceptos) {
      estado.gastos.push({
        fecha,
        concepto,
        valor: Math.round(valor * (0.94 + rnd() * 0.12)),
        categoria: concepto.includes('Nomina') ? 'personal' : 'operacion',
      });
    }
  }

  // ---- Kardex de apertura ----
  for (const p of estado.productos) {
    estado.movimientos.push({
      id: nuevoId('movimiento', 'MOV'),
      fecha: new Date(isoMas(-76) + 'T08:00:00').toISOString(),
      sku: p.sku,
      nombre: p.nombre,
      tipo: 'apertura',
      cantidad: p.stock,
      antes: 0,
      despues: p.stock,
      referencia: 'INVENTARIO-INICIAL',
      nota: 'Carga inicial migrada desde Excel',
    });
  }

  // ---- Realidad de bodega: no todo esta completo ----
  // Sin esto el panel de alertas siempre sale vacio y no se ve el valor del modulo.
  const agotar = {
    'MAL-ELE-60': 0,        // agotado
    'PEG-POR-25': 3,        // critico
    'CAB-12-100': 5,        // critico
    'TEJ-ETE-305': 12,      // bajo minimo
    'DRY-LAM-RH': 11,       // bajo minimo
    'IMP-ACR-GL': 6,        // bajo minimo
    'HER-CAR-BU': 2,        // bajo minimo
    'POR-60': 14,           // bajo minimo
  };
  for (const [sku, valor] of Object.entries(agotar)) {
    const p = estado.productos.find((x) => x.sku === sku);
    if (!p) continue;
    const delta = valor - p.stock;
    p.stock = valor;
    estado.movimientos.unshift({
      id: nuevoId('movimiento', 'MOV'),
      fecha: new Date(isoMas(-2) + 'T10:30:00').toISOString(),
      sku, nombre: p.nombre, tipo: 'salida',
      cantidad: delta, antes: valor - delta, despues: valor,
      referencia: 'VENTA-MOSTRADOR', nota: 'Salida acumulada de la semana',
    });
  }

  // El resto del sistema asume que estado.pedidos[0] es el mas reciente
  // (de ahi salen "lo de siempre", el ultimo pedido del portal y los listados).
  estado.pedidos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id.localeCompare(a.id)));

  // ---- Cartera derivada de los pedidos a credito sin pagar ----
  for (const c of estado.clientes) {
    c.saldoCartera = estado.pedidos
      .filter((p) => p.clienteId === c.id && p.pago === 'credito' && !p.pagado && p.estado !== 'cancelado')
      .reduce((a, p) => a + p.total, 0);
  }

  // ---- Historial por cliente ----
  for (const c of estado.clientes) {
    c.historial = estado.pedidos
      .filter((p) => p.clienteId === c.id)
      .map((p) => p.id)
      .slice(-25);
  }

  registrarEvento('sistema', 'Datos demo generados', { pedidos: estado.pedidos.length, fecha: hoy });
  return estado;
}

function generarPedido(rnd, { fecha, canal, cli, estadoFinal, fechaEntrega }) {
  const pool = cli?.skusHabituales?.length && rnd() < 0.75 ? cli.skusHabituales : null;
  const cuantos = entre(rnd, 1, cli ? 5 : 3);
  const items = [];
  const usados = new Set();

  for (let i = 0; i < cuantos; i++) {
    const sku = pool ? elegir(rnd, pool) : elegir(rnd, estado.productos).sku;
    if (usados.has(sku)) continue;
    usados.add(sku);
    const p = estado.productos.find((x) => x.sku === sku);
    if (!p) continue;
    const grande = ['m3', 'bulto', 'und'].includes(p.unidad);
    const cantidad = cli
      ? entre(rnd, grande ? 3 : 2, grande ? 22 : 8)
      : entre(rnd, 1, grande ? 5 : 3);
    const precioUnit = Math.round(p.precio * (1 - descuentoEfectivo(cli, p.categoria)));
    items.push({
      sku: p.sku,
      nombre: p.nombre,
      unidad: p.unidad,
      cantidad,
      precioLista: p.precio,
      precioUnit,
      costoUnit: p.costo,
      subtotal: cantidad * precioUnit,
    });
  }
  if (!items.length) {
    const p = estado.productos[0];
    items.push({
      sku: p.sku, nombre: p.nombre, unidad: p.unidad, cantidad: 1,
      precioUnit: p.precio, costoUnit: p.costo, subtotal: p.precio,
    });
  }

  const bruto = items.reduce((a, it) => a + it.precioLista * it.cantidad, 0);
  const total = items.reduce((a, it) => a + it.subtotal, 0);
  const descuento = bruto - total;

  // Cobranza: lo vendido a credito se paga dentro del plazo del cliente, salvo
  // un porcentaje que se atrasa. Asi la cartera y sus edades son coherentes con
  // los pedidos, no un numero suelto.
  const pago = cli ? (rnd() < 0.7 ? 'credito' : 'contado') : 'contado';
  const antiguedad = diffDias(hoyISO(), fecha);
  const pagado = pago === 'contado' ? true : antiguedad > (cli?.plazoDias || 15) ? rnd() < 0.93 : false;

  return {
    id: nuevoId('pedido', 'PD'),
    fecha,
    fechaEntrega: fechaEntrega || fecha,
    canal,
    clienteId: cli?.id || null,
    clienteNombre: cli?.nombre || 'Cliente mostrador',
    contacto: cli?.contacto || '',
    whatsapp: cli?.whatsapp || '',
    obra: cli?.obras?.length ? elegir(rnd, cli.obras) : '',
    items,
    bruto,
    descuento,
    total,
    baseGravable: Math.round(total / (1 + IVA)),
    iva: total - Math.round(total / (1 + IVA)),
    costo: items.reduce((a, it) => a + it.cantidad * it.costoUnit, 0),
    pago,
    pagado,
    estado: estadoFinal,
    entrega: cli && rnd() < 0.6 ? 'domicilio' : 'recoge en local',
    notas: '',
    creadoPor: canal === 'whatsapp' ? 'bot' : canal === 'portal' ? 'cliente' : 'asesor',
  };
}
