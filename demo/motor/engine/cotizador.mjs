/**
 * COTIZADOR EN TIEMPO REAL
 *
 * Toma una lista de SKUs + cantidades (venga del simulador, del portal B2B,
 * del bot de WhatsApp o del mostrador) y devuelve una cotizacion valorizada
 * contra el inventario real y el nivel de precio del cliente.
 *
 * Reglas que hacen que el numero sea confiable:
 *  - el precio sale del catalogo vivo, nunca de una lista pegada en Excel;
 *  - el descuento sale del nivel del cliente, no del criterio del asesor;
 *  - la disponibilidad se marca linea por linea contra el stock del momento;
 *  - todo queda con numero de cotizacion y fecha de vigencia.
 */
import { estado, IVA, CONFIG, nuevoId, producto, cliente, registrarEvento, guardar } from '../lib/store.mjs';
import { NIVELES, descuentoDe, descuentoEfectivo } from '../data/clientes.mjs';
import { hoyISO, isoMas, redondear, similitud, normalizar } from '../lib/util.mjs';

export const VIGENCIA_DIAS = 15;

/** Busca un producto por SKU, nombre o sinonimo. Devuelve el mejor match con su puntaje. */
export function buscarProducto(texto) {
  const q = normalizar(texto);
  if (!q) return null;
  const directo = estado.productos.find((p) => p.sku.toLowerCase() === q);
  if (directo) return { producto: directo, puntaje: 1 };

  let mejor = null;
  for (const p of estado.productos) {
    if (!p.activo) continue;
    const candidatos = [p.nombre, ...p.sinonimos];
    let s = 0;
    for (const c of candidatos) {
      const n = normalizar(c);
      let local = similitud(q, n);
      if (n.includes(q) || q.includes(n)) local = Math.max(local, 0.82);
      // Todas las palabras de la consulta aparecen en el candidato.
      const palabras = q.split(' ').filter((w) => w.length > 2);
      if (palabras.length && palabras.every((w) => n.includes(w))) local = Math.max(local, 0.88);
      s = Math.max(s, local);
    }
    if (!mejor || s > mejor.puntaje) mejor = { producto: p, puntaje: s };
  }
  return mejor && mejor.puntaje >= 0.45 ? mejor : null;
}

export function buscarVarios(texto, limite = 6) {
  const q = normalizar(texto);
  if (!q) return [];
  return estado.productos
    .filter((p) => p.activo)
    .map((p) => {
      const campos = [p.nombre, p.categoriaNombre, p.marca, ...p.sinonimos];
      const s = Math.max(...campos.map((c) => {
        const n = normalizar(c);
        return n.includes(q) ? 0.9 : similitud(q, n);
      }));
      return { p, s };
    })
    .filter((x) => x.s >= 0.4)
    .sort((a, b) => b.s - a.s)
    .slice(0, limite)
    .map((x) => x.p);
}

/** Alternativas de la misma categoria para cuando no hay stock o se busca ahorro. */
export function alternativas(sku, limite = 3) {
  const p = producto(sku);
  if (!p) return [];
  return estado.productos
    .filter((o) => o.sku !== sku && o.categoria === p.categoria && o.activo && o.stock > 0)
    .sort((a, b) => Math.abs(a.precio - p.precio) - Math.abs(b.precio - p.precio))
    .slice(0, limite);
}

/**
 * Cotiza una lista de items.
 * @param {{sku:string,cantidad:number,motivo?:string}[]} items
 * @param {{clienteId?:string, manoObra?:object, incluirManoObra?:boolean, origen?:string}} opciones
 */
export function cotizar(items = [], opciones = {}) {
  const cli = opciones.clienteId ? cliente(opciones.clienteId) : null;
  const desc = descuentoDe(cli);
  const nivel = cli ? NIVELES[cli.nivel] : NIVELES.mostrador;

  const lineas = [];
  const noEncontrados = [];

  for (const it of items) {
    const p = producto(it.sku);
    if (!p) {
      noEncontrados.push(it.sku);
      continue;
    }
    const cantidad = Math.max(0, Number(it.cantidad) || 0);
    if (!cantidad) continue;

    const precioLista = p.precio;
    const descLinea = descuentoEfectivo(cli, p.categoria);
    const precioUnit = Math.round(precioLista * (1 - descLinea));
    const subtotal = precioUnit * cantidad;
    const disponible = p.stock >= cantidad;

    lineas.push({
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.categoria,
      categoriaNombre: p.categoriaNombre,
      unidad: p.unidad,
      marca: p.marca,
      cantidad,
      precioLista,
      precioUnit,
      descuentoUnit: precioLista - precioUnit,
      descuentoPct: descLinea,
      topeAplicado: descLinea < desc,
      subtotal,
      costoUnit: p.costo,
      stock: p.stock,
      disponible,
      faltante: disponible ? 0 : redondear(cantidad - p.stock, 2),
      motivo: it.motivo || '',
      alternativas: disponible ? [] : alternativas(p.sku).map((a) => ({
        sku: a.sku, nombre: a.nombre,
        precio: Math.round(a.precio * (1 - descuentoEfectivo(cli, a.categoria))), stock: a.stock,
      })),
    });
  }

  const bruto = lineas.reduce((a, l) => a + l.precioLista * l.cantidad, 0);
  const totalMateriales = lineas.reduce((a, l) => a + l.subtotal, 0);
  const ahorro = bruto - totalMateriales;
  const costo = lineas.reduce((a, l) => a + l.costoUnit * l.cantidad, 0);

  let manoObra = null;
  if (opciones.incluirManoObra && opciones.manoObra) {
    const mo = opciones.manoObra;
    const valor = Math.round((Number(mo.cantidad) || 0) * (Number(mo.valorUnit) || 0));
    manoObra = { ...mo, valor };
  }

  const total = totalMateriales + (manoObra?.valor || 0);
  const baseGravable = Math.round(totalMateriales / (1 + IVA));

  return {
    lineas,
    noEncontrados,
    cliente: cli ? { id: cli.id, nombre: cli.nombre, nivel: cli.nivel, nivelNombre: nivel.nombre } : null,
    nivel: { id: cli?.nivel || 'mostrador', nombre: nivel.nombre, descuento: desc },
    totales: {
      bruto,
      descuento: ahorro,
      materiales: totalMateriales,
      manoObra: manoObra?.valor || 0,
      total,
      baseGravable,
      iva: totalMateriales - baseGravable,
      costo,
      margen: totalMateriales - costo,
      margenPct: totalMateriales ? redondear((totalMateriales - costo) / totalMateriales, 4) : 0,
      items: lineas.length,
      unidades: redondear(lineas.reduce((a, l) => a + l.cantidad, 0), 2),
    },
    manoObra,
    disponibilidad: {
      completo: lineas.every((l) => l.disponible),
      faltantes: lineas.filter((l) => !l.disponible).map((l) => ({ sku: l.sku, nombre: l.nombre, faltante: l.faltante })),
    },
    domicilio: calcularDomicilio(totalMateriales),
    origen: opciones.origen || 'web',
  };
}

export function calcularDomicilio(total) {
  const cfg = CONFIG.domicilio;
  const gratis = total >= cfg.gratisDesde;
  return {
    gratis,
    valor: gratis ? 0 : cfg.valor,
    mensaje: gratis
      ? 'Domicilio sin costo por el monto del pedido.'
      : `Domicilio ${cfg.valor.toLocaleString('es-CO')} COP. Gratis desde ${cfg.gratisDesde.toLocaleString('es-CO')}.`,
  };
}

/** Persiste la cotizacion para que el cliente la retome o el asesor la convierta en pedido. */
export function guardarCotizacion(cotizacion, meta = {}) {
  const id = nuevoId('cotizacion', 'CT');
  const registro = {
    id,
    fecha: hoyISO(),
    vence: isoMas(VIGENCIA_DIAS),
    clienteId: cotizacion.cliente?.id || null,
    clienteNombre: cotizacion.cliente?.nombre || meta.nombre || 'Visitante web',
    origen: cotizacion.origen,
    obra: meta.obra || '',
    proyecto: meta.proyecto || '',
    lineas: cotizacion.lineas.map(({ sku, nombre, unidad, cantidad, precioUnit, subtotal }) => ({
      sku, nombre, unidad, cantidad, precioUnit, subtotal,
    })),
    manoObra: cotizacion.manoObra,
    totales: cotizacion.totales,
    estado: 'vigente',
  };
  estado.cotizaciones.unshift(registro);
  if (estado.cotizaciones.length > 500) estado.cotizaciones.length = 500;
  registrarEvento('cotizacion', `Cotizacion ${id} por ${registro.totales.total.toLocaleString('es-CO')} COP`, {
    id, cliente: registro.clienteNombre, origen: registro.origen,
  });
  guardar();
  return registro;
}
