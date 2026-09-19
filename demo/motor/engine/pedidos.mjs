/**
 * CICLO DE VIDA DEL PEDIDO
 *
 * Un pedido entra por cualquier canal (bot de WhatsApp, portal B2B, web o
 * mostrador) y desde ese momento existe en un solo lugar. Al confirmarse
 * descuenta inventario; si se cancela, lo devuelve. Eso es lo que hace que la
 * bodega y la caja cuadren sin que nadie los cuadre a mano.
 *
 * Estados: recibido -> alistando -> listo -> despachado -> entregado
 *          (cancelado en cualquier punto antes de entregado)
 */
import { estado, IVA, nuevoId, producto, cliente, moverInventario, registrarEvento, guardar } from '../lib/store.mjs';
import { NIVELES, descuentoDe, descuentoEfectivo } from '../data/clientes.mjs';
import { hoyISO, isoMas, diffDias, etiquetaRelativa, redondear } from '../lib/util.mjs';

export const ESTADOS = ['recibido', 'alistando', 'listo', 'despachado', 'entregado', 'cancelado'];

const FLUJO = {
  recibido: ['alistando', 'cancelado'],
  alistando: ['listo', 'cancelado'],
  listo: ['despachado', 'cancelado'],
  despachado: ['entregado'],
  entregado: [],
  cancelado: [],
};

/** Valida stock y cupo de credito antes de comprometer el pedido. */
export function validarPedido({ clienteId, items, pago = 'contado' }) {
  const problemas = [];
  const cli = clienteId ? cliente(clienteId) : null;
  const desc = descuentoDe(cli);
  let total = 0;

  for (const it of items) {
    const p = producto(it.sku);
    if (!p) {
      problemas.push({ tipo: 'sku', sku: it.sku, mensaje: `El codigo ${it.sku} no existe en el catalogo.` });
      continue;
    }
    if (p.stock < it.cantidad) {
      problemas.push({
        tipo: 'stock', sku: p.sku,
        mensaje: `${p.nombre}: hay ${p.stock} ${p.unidad} y se piden ${it.cantidad}.`,
        disponible: p.stock,
      });
    }
    total += Math.round(p.precio * (1 - descuentoEfectivo(cli, p.categoria))) * it.cantidad;
  }

  if (pago === 'credito') {
    if (!cli) {
      problemas.push({ tipo: 'credito', mensaje: 'El credito solo aplica para clientes registrados.' });
    } else {
      const disponible = cli.cupoCredito - cli.saldoCartera;
      if (total > disponible) {
        problemas.push({
          tipo: 'credito',
          mensaje: `Cupo disponible ${disponible.toLocaleString('es-CO')} COP y el pedido suma ${total.toLocaleString('es-CO')} COP.`,
          disponible,
        });
      }
    }
  }
  return { valido: problemas.length === 0, problemas, total };
}

export function crearPedido({
  clienteId = null,
  clienteNombre = 'Cliente mostrador',
  contacto = '',
  whatsapp = '',
  items = [],
  canal = 'mostrador',
  fechaEntrega = null,
  pago = 'contado',
  entrega = 'recoge en local',
  direccion = '',
  obra = '',
  notas = '',
  creadoPor = 'asesor',
  forzar = false,
}) {
  if (!items.length) throw Object.assign(new Error('El pedido no tiene items.'), { status: 400 });

  const cli = clienteId ? cliente(clienteId) : null;
  const desc = descuentoDe(cli);
  const validacion = validarPedido({ clienteId, items, pago });
  if (!validacion.valido && !forzar) {
    return { ok: false, ...validacion };
  }

  const detalle = [];
  for (const it of items) {
    const p = producto(it.sku);
    if (!p) continue;
    const cantidad = Math.min(it.cantidad, forzar ? it.cantidad : p.stock);
    if (cantidad <= 0) continue;
    const precioUnit = Math.round(p.precio * (1 - descuentoEfectivo(cli, p.categoria)));
    detalle.push({
      sku: p.sku,
      nombre: p.nombre,
      unidad: p.unidad,
      cantidad,
      precioLista: p.precio,
      precioUnit,
      costoUnit: p.costo,
      subtotal: precioUnit * cantidad,
    });
  }
  if (!detalle.length) return { ok: false, problemas: [{ tipo: 'stock', mensaje: 'No hay stock de ninguna linea.' }] };

  const bruto = detalle.reduce((a, d) => a + d.precioLista * d.cantidad, 0);
  const total = detalle.reduce((a, d) => a + d.subtotal, 0);
  const baseGravable = Math.round(total / (1 + IVA));

  const pedido = {
    id: nuevoId('pedido', 'PD'),
    fecha: hoyISO(),
    creado: new Date().toISOString(),
    fechaEntrega: fechaEntrega || hoyISO(),
    canal,
    clienteId: cli?.id || null,
    clienteNombre: cli?.nombre || clienteNombre,
    contacto: cli?.contacto || contacto,
    whatsapp: cli?.whatsapp || whatsapp,
    obra,
    items: detalle,
    bruto,
    descuento: bruto - total,
    nivel: cli?.nivel || 'mostrador',
    total,
    baseGravable,
    iva: total - baseGravable,
    costo: detalle.reduce((a, d) => a + d.costoUnit * d.cantidad, 0),
    pago,
    pagado: pago === 'contado',
    entrega,
    direccion: direccion || cli?.direccion || '',
    notas,
    estado: 'recibido',
    creadoPor,
    historial: [{ estado: 'recibido', ts: new Date().toISOString(), por: creadoPor }],
  };

  // Compromete inventario de inmediato: es lo que evita vender dos veces lo mismo.
  for (const d of detalle) {
    moverInventario({
      sku: d.sku, cantidad: -d.cantidad, tipo: 'salida',
      referencia: pedido.id, nota: `Pedido ${canal}`,
    });
  }
  if (cli && pago === 'credito') cli.saldoCartera += total;

  estado.pedidos.unshift(pedido);
  if (cli) cli.historial = [pedido.id, ...(cli.historial || [])].slice(0, 40);

  registrarEvento('pedido', `Pedido ${pedido.id} por ${total.toLocaleString('es-CO')} COP via ${canal}`, {
    id: pedido.id, canal, cliente: pedido.clienteNombre, total,
  });
  guardar();
  return { ok: true, pedido, advertencias: validacion.problemas };
}

export function cambiarEstado(id, nuevo, por = 'asesor') {
  const p = estado.pedidos.find((x) => x.id === id);
  if (!p) throw Object.assign(new Error(`Pedido ${id} no existe`), { status: 404 });
  if (!FLUJO[p.estado]?.includes(nuevo)) {
    throw Object.assign(new Error(`No se puede pasar de "${p.estado}" a "${nuevo}"`), { status: 400 });
  }

  if (nuevo === 'cancelado') {
    for (const it of p.items) {
      moverInventario({
        sku: it.sku, cantidad: it.cantidad, tipo: 'devolucion',
        referencia: p.id, nota: 'Cancelacion de pedido',
      });
    }
    const cli = p.clienteId ? cliente(p.clienteId) : null;
    if (cli && p.pago === 'credito' && !p.pagado) cli.saldoCartera = Math.max(0, cli.saldoCartera - p.total);
  }

  p.estado = nuevo;
  p.historial = [...(p.historial || []), { estado: nuevo, ts: new Date().toISOString(), por }];
  registrarEvento('pedido', `Pedido ${p.id} pasa a ${nuevo}`, { id: p.id, estado: nuevo });
  guardar();
  return p;
}

/** Agenda de despacho para los proximos dias: la pantalla que abre el dueno cada manana. */
export function agenda(dias = 7) {
  const hoy = hoyISO();
  const activos = estado.pedidos.filter(
    (p) => !['entregado', 'cancelado'].includes(p.estado) && p.fechaEntrega >= hoy
  );
  const grupos = [];
  for (let d = 0; d < dias; d++) {
    const iso = isoMas(d);
    const delDia = activos
      .filter((p) => p.fechaEntrega === iso)
      .sort((a, b) => (b.total || 0) - (a.total || 0));
    grupos.push({
      fecha: iso,
      etiqueta: etiquetaRelativa(iso),
      pedidos: delDia,
      cantidad: delDia.length,
      total: delDia.reduce((a, p) => a + p.total, 0),
      unidades: delDia.reduce((a, p) => a + p.items.reduce((s, i) => s + i.cantidad, 0), 0),
      domicilios: delDia.filter((p) => p.entrega === 'domicilio').length,
    });
  }
  const atrasados = estado.pedidos.filter(
    (p) => !['entregado', 'cancelado'].includes(p.estado) && p.fechaEntrega < hoy
  );
  return { grupos, atrasados, totalActivos: activos.length + atrasados.length };
}

/** Lo que hay que alistar hoy, agrupado por producto: la lista que baja a bodega. */
export function listaDeAlistamiento(fecha = hoyISO()) {
  const delDia = estado.pedidos.filter(
    (p) => p.fechaEntrega === fecha && ['recibido', 'alistando', 'listo'].includes(p.estado)
  );
  const mapa = new Map();
  for (const p of delDia) {
    for (const it of p.items) {
      const prev = mapa.get(it.sku) || { sku: it.sku, nombre: it.nombre, unidad: it.unidad, cantidad: 0, pedidos: [] };
      prev.cantidad = redondear(prev.cantidad + it.cantidad, 2);
      prev.pedidos.push(p.id);
      mapa.set(it.sku, prev);
    }
  }
  return {
    fecha,
    etiqueta: etiquetaRelativa(fecha),
    pedidos: delDia.length,
    lineas: [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad),
  };
}

export function pedidosDe(clienteId, limite = 20) {
  return estado.pedidos.filter((p) => p.clienteId === clienteId).slice(0, limite);
}

export function ultimoPedidoDe(clienteId) {
  return estado.pedidos.find((p) => p.clienteId === clienteId && p.estado !== 'cancelado') || null;
}

/** Semaforo de entrega para la vista de seguimiento. */
export function seguimiento(id) {
  const p = estado.pedidos.find((x) => x.id === id);
  if (!p) return null;
  const pasos = ['recibido', 'alistando', 'listo', 'despachado', 'entregado'];
  const idx = pasos.indexOf(p.estado);
  return {
    id: p.id,
    estado: p.estado,
    pasos: pasos.map((e, i) => ({ estado: e, hecho: i <= idx, actual: i === idx })),
    fechaEntrega: p.fechaEntrega,
    etiqueta: etiquetaRelativa(p.fechaEntrega),
    diasRestantes: diffDias(p.fechaEntrega, hoyISO()),
    total: p.total,
    items: p.items.length,
  };
}
