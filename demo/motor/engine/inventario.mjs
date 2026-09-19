/**
 * INVENTARIO: valorizacion, rotacion, alertas y kardex.
 * Mismo dato que consulta el bot cuando alguien pregunta "tiene cemento?".
 */
import { estado, moverInventario, registrarEvento, guardar, producto } from '../lib/store.mjs';
import { isoMas, redondear, hoyISO } from '../lib/util.mjs';

export function valorizacion() {
  let costo = 0, venta = 0, unidades = 0;
  const porCategoria = new Map();

  for (const p of estado.productos) {
    const c = p.stock * p.costo;
    const v = p.stock * p.precio;
    costo += c;
    venta += v;
    unidades += p.stock;
    const prev = porCategoria.get(p.categoria) || {
      categoria: p.categoria, nombre: p.categoriaNombre, costo: 0, venta: 0, referencias: 0, unidades: 0,
    };
    prev.costo += c;
    prev.venta += v;
    prev.referencias += 1;
    prev.unidades += p.stock;
    porCategoria.set(p.categoria, prev);
  }

  return {
    costoTotal: Math.round(costo),
    ventaPotencial: Math.round(venta),
    utilidadPotencial: Math.round(venta - costo),
    referencias: estado.productos.length,
    unidades: redondear(unidades, 2),
    porCategoria: [...porCategoria.values()]
      .map((c) => ({ ...c, costo: Math.round(c.costo), venta: Math.round(c.venta) }))
      .sort((a, b) => b.costo - a.costo),
  };
}

/** Consumo, cobertura y clasificacion ABC. */
export function rotacion(dias = 30) {
  const desde = isoMas(-dias);
  const consumo = new Map();
  for (const p of estado.pedidos) {
    if (p.fecha < desde || p.estado === 'cancelado') continue;
    for (const it of p.items) {
      const prev = consumo.get(it.sku) || { unidades: 0, ventas: 0 };
      prev.unidades += it.cantidad;
      prev.ventas += it.subtotal;
      consumo.set(it.sku, prev);
    }
  }

  const filas = estado.productos.map((p) => {
    const c = consumo.get(p.sku) || { unidades: 0, ventas: 0 };
    const diario = c.unidades / dias;
    return {
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.categoriaNombre,
      unidad: p.unidad,
      stock: p.stock,
      stockMin: p.stockMin,
      costo: p.costo,
      precio: p.precio,
      valorInventario: Math.round(p.stock * p.costo),
      consumoPeriodo: redondear(c.unidades, 2),
      ventasPeriodo: c.ventas,
      consumoDiario: redondear(diario, 3),
      diasCobertura: diario > 0 ? redondear(p.stock / diario, 1) : null,
      rotacionAnual: p.stock > 0 && diario > 0 ? redondear((diario * 365) / p.stock, 2) : 0,
    };
  });

  // Clasificacion ABC por participacion en ventas del periodo.
  const totalVentas = filas.reduce((a, f) => a + f.ventasPeriodo, 0) || 1;
  filas.sort((a, b) => b.ventasPeriodo - a.ventasPeriodo);
  let acum = 0;
  for (const f of filas) {
    acum += f.ventasPeriodo / totalVentas;
    f.participacion = redondear(f.ventasPeriodo / totalVentas, 4);
    f.abc = acum <= 0.8 ? 'A' : acum <= 0.95 ? 'B' : 'C';
  }
  return filas;
}

export function alertas() {
  const rot = rotacion(30);
  const porSku = Object.fromEntries(rot.map((r) => [r.sku, r]));

  const agotados = [];
  const criticos = [];
  const bajos = [];
  const sobrestock = [];

  for (const p of estado.productos) {
    const r = porSku[p.sku];
    const fila = {
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.categoriaNombre,
      unidad: p.unidad,
      stock: p.stock,
      stockMin: p.stockMin,
      stockMax: p.stockMax,
      diasCobertura: r?.diasCobertura ?? null,
      abc: r?.abc || 'C',
      sugerido: Math.max(1, Math.round(p.stockMin * 2 - p.stock)),
      valorInmovilizado: Math.round(p.stock * p.costo),
    };
    if (p.stock <= 0) agotados.push(fila);
    else if (p.stock <= p.stockMin * 0.5) criticos.push(fila);
    else if (p.stock <= p.stockMin) bajos.push(fila);
    else if (p.stock > p.stockMax * 1.3 && (r?.consumoPeriodo || 0) === 0) sobrestock.push(fila);
  }

  return {
    agotados,
    criticos,
    bajos,
    sobrestock: sobrestock.sort((a, b) => b.valorInmovilizado - a.valorInmovilizado).slice(0, 10),
    total: agotados.length + criticos.length + bajos.length,
  };
}

export function kardex(sku, limite = 40) {
  const p = producto(sku);
  if (!p) return null;
  return {
    producto: {
      sku: p.sku, nombre: p.nombre, unidad: p.unidad, stock: p.stock,
      stockMin: p.stockMin, costo: p.costo, precio: p.precio,
      margen: redondear((p.precio - p.costo) / p.precio, 4),
    },
    movimientos: estado.movimientos.filter((m) => m.sku === sku).slice(0, limite),
  };
}

/** Ajuste manual de inventario (conteo fisico, averia, robo). Queda trazado. */
export function ajustar(sku, nuevoStock, motivo = 'conteo fisico', por = 'admin') {
  const p = producto(sku);
  if (!p) throw Object.assign(new Error(`SKU ${sku} no existe`), { status: 404 });
  const delta = Number(nuevoStock) - p.stock;
  if (!delta) return { sin_cambio: true, producto: p };
  moverInventario({ sku, cantidad: delta, tipo: 'ajuste', referencia: `AJU-${hoyISO()}`, nota: motivo });
  registrarEvento('inventario', `Ajuste de ${p.nombre}: ${delta > 0 ? '+' : ''}${delta} (${motivo})`, { sku, delta, por });
  guardar();
  return { producto: p, delta };
}

/** Recepcion de mercancia contra una orden de compra. */
export function recibirCompra(ocId, por = 'admin') {
  const oc = estado.compras.find((c) => c.id === ocId);
  if (!oc) throw Object.assign(new Error(`Orden ${ocId} no existe`), { status: 404 });
  if (oc.estado === 'recibida') return { ok: false, mensaje: 'La orden ya estaba recibida.' };
  for (const it of oc.items) {
    moverInventario({ sku: it.sku, cantidad: it.cantidad, tipo: 'entrada', referencia: oc.id, nota: `Compra a ${oc.proveedor}` });
  }
  oc.estado = 'recibida';
  oc.recibida = hoyISO();
  registrarEvento('inventario', `Recepcion de ${oc.id} (${oc.proveedor})`, { id: oc.id, por });
  guardar();
  return { ok: true, orden: oc };
}
