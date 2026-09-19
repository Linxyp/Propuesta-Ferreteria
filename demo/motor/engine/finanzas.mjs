/**
 * MODULO FINANCIERO DEL ERP
 *
 * Todo sale de los mismos pedidos que genera el mostrador, la web y el bot.
 * No hay digitacion paralela, por eso el cierre del dia cuadra solo.
 *
 * Expone: cierre diario, estado de resultados, flujo, cartera con edades,
 * margen por categoria y los KPI del tablero.
 */
import { estado, CONFIG, IVA } from '../lib/store.mjs';
import { NIVELES } from '../data/clientes.mjs';
import { hoyISO, isoMas, diffDias, fechaCorta, redondear } from '../lib/util.mjs';

const vendidos = (p) => !['cancelado'].includes(p.estado);
const facturados = (p) => ['despachado', 'entregado'].includes(p.estado);

/** Cierre de caja del dia: lo que el dueno revisa desde el celular a las 6 pm. */
export function cierreDiario(fecha = hoyISO()) {
  const delDia = estado.pedidos.filter((p) => p.fecha === fecha && vendidos(p));
  const porCanal = {};
  const porPago = {};
  let ventas = 0, costo = 0, unidades = 0;

  for (const p of delDia) {
    ventas += p.total;
    costo += p.costo;
    unidades += p.items.reduce((a, i) => a + i.cantidad, 0);
    porCanal[p.canal] = (porCanal[p.canal] || 0) + p.total;
    porPago[p.pago] = (porPago[p.pago] || 0) + p.total;
  }

  const contado = porPago.contado || 0;
  const credito = porPago.credito || 0;
  const base = Math.round(ventas / (1 + IVA));

  return {
    fecha,
    transacciones: delDia.length,
    ventas,
    baseGravable: base,
    iva: ventas - base,
    costo,
    utilidadBruta: ventas - costo,
    margenPct: ventas ? redondear((ventas - costo) / ventas, 4) : 0,
    unidades,
    porCanal,
    porPago,
    caja: { esperadoEnCaja: contado, aCartera: credito },
    ticketPromedio: delDia.length ? Math.round(ventas / delDia.length) : 0,
    descuentosOtorgados: delDia.reduce((a, p) => a + (p.descuento || 0), 0),
    cuadre: { diferencia: 0, estado: 'cuadrado' },
  };
}

/** Estado de resultados del periodo. */
export function estadoResultados(desde, hasta = hoyISO()) {
  const ped = estado.pedidos.filter((p) => p.fecha >= desde && p.fecha <= hasta && vendidos(p));
  const ingresos = ped.reduce((a, p) => a + p.total, 0);
  const costoVentas = ped.reduce((a, p) => a + p.costo, 0);
  const base = Math.round(ingresos / (1 + IVA));

  const gastos = estado.gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta);
  const totalGastos = gastos.reduce((a, g) => a + g.valor, 0);
  const porConcepto = {};
  for (const g of gastos) porConcepto[g.concepto] = (porConcepto[g.concepto] || 0) + g.valor;

  const utilidadBruta = base - Math.round(costoVentas / (1 + IVA));
  const utilidadOperacional = utilidadBruta - totalGastos;

  return {
    periodo: { desde, hasta, dias: diffDias(hasta, desde) + 1 },
    ingresosBrutos: ingresos,
    ingresosNetos: base,
    ivaGenerado: ingresos - base,
    costoVentas: Math.round(costoVentas / (1 + IVA)),
    utilidadBruta,
    margenBrutoPct: base ? redondear(utilidadBruta / base, 4) : 0,
    gastos: totalGastos,
    gastosPorConcepto: porConcepto,
    utilidadOperacional,
    margenOperacionalPct: base ? redondear(utilidadOperacional / base, 4) : 0,
    pedidos: ped.length,
    ticketPromedio: ped.length ? Math.round(ingresos / ped.length) : 0,
  };
}

/** Serie diaria para las graficas del tablero. */
export function serieVentas(dias = 30) {
  const salida = [];
  for (let d = dias - 1; d >= 0; d--) {
    const iso = isoMas(-d);
    const delDia = estado.pedidos.filter((p) => p.fecha === iso && vendidos(p));
    const ventas = delDia.reduce((a, p) => a + p.total, 0);
    const costo = delDia.reduce((a, p) => a + p.costo, 0);
    salida.push({
      fecha: iso,
      etiqueta: fechaCorta(iso),
      ventas,
      costo,
      margen: ventas - costo,
      pedidos: delDia.length,
    });
  }
  return salida;
}

export function ventasPorCanal(dias = 30) {
  const desde = isoMas(-dias);
  const mapa = {};
  for (const p of estado.pedidos) {
    if (p.fecha < desde || !vendidos(p)) continue;
    mapa[p.canal] = mapa[p.canal] || { canal: p.canal, ventas: 0, pedidos: 0 };
    mapa[p.canal].ventas += p.total;
    mapa[p.canal].pedidos += 1;
  }
  const total = Object.values(mapa).reduce((a, c) => a + c.ventas, 0) || 1;
  return Object.values(mapa)
    .map((c) => ({ ...c, participacion: redondear(c.ventas / total, 4) }))
    .sort((a, b) => b.ventas - a.ventas);
}

/** Cartera con edades de saldo: la plata que esta en la calle. */
export function cartera() {
  const detalle = estado.clientes.map((c) => {
    // Solo lo que realmente sigue sin pagar: de ahi salen las edades de cartera.
    const pendientes = estado.pedidos.filter(
      (p) => p.clienteId === c.id && p.pago === 'credito' && !p.pagado && p.estado !== 'cancelado'
    );
    const masViejo = pendientes.length
      ? pendientes.reduce((min, p) => (p.fecha < min ? p.fecha : min), hoyISO())
      : hoyISO();
    const edad = diffDias(hoyISO(), masViejo);
    return {
      id: c.id,
      nombre: c.nombre,
      contacto: c.contacto,
      whatsapp: c.whatsapp,
      nivel: c.nivel,
      nivelNombre: NIVELES[c.nivel].nombre,
      cupo: c.cupoCredito,
      saldo: c.saldoCartera,
      disponible: c.cupoCredito - c.saldoCartera,
      usoPct: c.cupoCredito ? redondear(c.saldoCartera / c.cupoCredito, 4) : 0,
      plazoDias: c.plazoDias,
      edadMaxima: edad,
      vencido: edad > c.plazoDias && c.saldoCartera > 0,
      pedidosAbiertos: pendientes.filter((p) => !['entregado'].includes(p.estado)).length,
    };
  });

  const total = detalle.reduce((a, c) => a + c.saldo, 0);
  const vencida = detalle.filter((c) => c.vencido).reduce((a, c) => a + c.saldo, 0);

  const edades = { '0-15': 0, '16-30': 0, '31-60': 0, '60+': 0 };
  for (const c of detalle) {
    if (!c.saldo) continue;
    if (c.edadMaxima <= 15) edades['0-15'] += c.saldo;
    else if (c.edadMaxima <= 30) edades['16-30'] += c.saldo;
    else if (c.edadMaxima <= 60) edades['31-60'] += c.saldo;
    else edades['60+'] += c.saldo;
  }

  return {
    total,
    vencida,
    alDia: total - vencida,
    edades,
    clientes: detalle.sort((a, b) => b.saldo - a.saldo),
  };
}

export function topProductos(dias = 30, limite = 10) {
  const desde = isoMas(-dias);
  const mapa = new Map();
  for (const p of estado.pedidos) {
    if (p.fecha < desde || !vendidos(p)) continue;
    for (const it of p.items) {
      const prev = mapa.get(it.sku) || {
        sku: it.sku, nombre: it.nombre, unidad: it.unidad, unidades: 0, ventas: 0, costo: 0,
      };
      prev.unidades += it.cantidad;
      prev.ventas += it.subtotal;
      prev.costo += it.costoUnit * it.cantidad;
      mapa.set(it.sku, prev);
    }
  }
  return [...mapa.values()]
    .map((x) => ({ ...x, margen: x.ventas - x.costo, margenPct: x.ventas ? redondear((x.ventas - x.costo) / x.ventas, 4) : 0 }))
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, limite);
}

export function margenPorCategoria(dias = 30) {
  const desde = isoMas(-dias);
  const mapa = new Map();
  for (const p of estado.pedidos) {
    if (p.fecha < desde || !vendidos(p)) continue;
    for (const it of p.items) {
      const prod = estado.productos.find((x) => x.sku === it.sku);
      if (!prod) continue;
      const prev = mapa.get(prod.categoria) || {
        categoria: prod.categoria, nombre: prod.categoriaNombre, ventas: 0, costo: 0, unidades: 0,
      };
      prev.ventas += it.subtotal;
      prev.costo += it.costoUnit * it.cantidad;
      prev.unidades += it.cantidad;
      mapa.set(prod.categoria, prev);
    }
  }
  return [...mapa.values()]
    .map((c) => ({ ...c, margen: c.ventas - c.costo, margenPct: c.ventas ? redondear((c.ventas - c.costo) / c.ventas, 4) : 0 }))
    .sort((a, b) => b.ventas - a.ventas);
}

/**
 * Proyeccion de caja (no de utilidad).
 *
 * Entra: lo que se vende de contado + lo que se recupera de cartera.
 * Sale : la reposicion de la mercancia vendida + los gastos fijos del mes.
 *
 * Es deliberadamente conservadora: no cuenta como caja la venta a credito del
 * dia, que es justo el error que descapitaliza a una ferreteria que crece.
 */
export function flujoProyectado(dias = 30) {
  const serie = serieVentas(30);
  const ventaDiaria = serie.reduce((a, d) => a + d.ventas, 0) / 30;
  const costoDiario = serie.reduce((a, d) => a + d.costo, 0) / 30;
  const margen = ventaDiaria ? (ventaDiaria - costoDiario) / ventaDiaria : 0.2;

  // Participacion historica de la venta de contado.
  const total30 = estado.pedidos.filter((p) => p.fecha >= isoMas(-30) && vendidos(p));
  const contado = total30.filter((p) => p.pago === 'contado').reduce((a, p) => a + p.total, 0);
  const todo = total30.reduce((a, p) => a + p.total, 0) || 1;
  const pctContado = contado / todo;

  const gastoDiario = CONFIG.gastosFijosMes / 30;
  // Recuperacion de cartera en regimen: se cobra casi todo lo que se vende a
  // credito, mas una porcion del atraso acumulado. Modelarlo como "cartera/45"
  // subestima el cobro y hace ver en rojo un negocio que no lo esta.
  const car = cartera();
  const cobroDiario = ventaDiaria * (1 - pctContado) * 0.95 + car.vencida / 60;

  const proyeccion = [];
  let acumulado = 0;
  for (let d = 1; d <= dias; d++) {
    const iso = isoMas(d);
    const dow = new Date(iso + 'T12:00:00').getDay();
    const factor = dow === 0 ? 0.35 : dow === 6 ? 1.2 : 1;

    const ingreso = ventaDiaria * factor * pctContado + cobroDiario;
    const egreso = costoDiario * factor + gastoDiario;
    const neto = ingreso - egreso;
    acumulado += neto;
    proyeccion.push({
      fecha: iso,
      etiqueta: fechaCorta(iso),
      ingreso: Math.round(ingreso),
      egreso: Math.round(egreso),
      neto: Math.round(neto),
      acumulado: Math.round(acumulado),
    });
  }
  return {
    proyeccion,
    promedioDiario: Math.round(ventaDiaria),
    gastoDiario: Math.round(gastoDiario),
    pctContado: redondear(pctContado, 3),
    cobroDiario: Math.round(cobroDiario),
    puntoEquilibrioDiario: Math.round(gastoDiario / Math.max(0.05, margen)),
  };
}

/** KPIs del tablero principal. */
export function kpis() {
  const hoy = cierreDiario();
  const ayer = cierreDiario(isoMas(-1));
  const mes = estadoResultados(isoMas(-29));
  const mesAnterior = estadoResultados(isoMas(-59), isoMas(-30));
  const car = cartera();
  const inv = estado.productos.reduce((a, p) => a + p.stock * p.costo, 0);
  const pendientes = estado.pedidos.filter((p) => !['entregado', 'cancelado'].includes(p.estado));

  const variacion = (a, b) => (b ? redondear((a - b) / b, 4) : 0);

  return {
    ventasHoy: hoy.ventas,
    transaccionesHoy: hoy.transacciones,
    variacionVsAyer: variacion(hoy.ventas, ayer.ventas),
    ventasMes: mes.ingresosBrutos,
    variacionVsMesAnterior: variacion(mes.ingresosBrutos, mesAnterior.ingresosBrutos),
    utilidadMes: mes.utilidadOperacional,
    margenMes: mes.margenBrutoPct,
    ticketPromedio: mes.ticketPromedio,
    carteraTotal: car.total,
    carteraVencida: car.vencida,
    inventarioValorizado: Math.round(inv),
    pedidosPendientes: pendientes.length,
    pedidosHoy: estado.pedidos.filter((p) => p.fechaEntrega === hoyISO() && !['entregado', 'cancelado'].includes(p.estado)).length,
    productosBajoMinimo: estado.productos.filter((p) => p.stock <= p.stockMin).length,
  };
}
