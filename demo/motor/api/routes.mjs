/**
 * API REST completa. Todos los canales consumen estos mismos endpoints,
 * que es justamente la garantia de que ven el mismo inventario y el mismo precio.
 */
import { estado, CONFIG, cliente as buscarCliente, producto, registrarEvento, guardar, reiniciar } from '../lib/store.mjs';
import { CLIENTES, NIVELES, descuentoEfectivo } from '../data/clientes.mjs';
import { CONOCIMIENTO } from '../data/conocimiento.mjs';
import { CATEGORIAS } from '../data/catalogo.mjs';
import { catalogoObras, calcular } from '../engine/calculadora.mjs';
import { cotizar, guardarCotizacion, buscarVarios, alternativas } from '../engine/cotizador.mjs';
import { recomendar, sugerenciasCompra } from '../engine/recomendador.mjs';
import { crearPedido, cambiarEstado, agenda, listaDeAlistamiento, pedidosDe, seguimiento, validarPedido } from '../engine/pedidos.mjs';
import { procesar, conversacion, reiniciarConversacion } from '../engine/bot.mjs';
import { interpretar } from '../engine/nlu.mjs';
import { redactar, estadoIA } from '../engine/llm.mjs';
import * as fin from '../engine/finanzas.mjs';
import * as inv from '../engine/inventario.mjs';
import { hoyISO, isoMas, normalizar } from '../lib/util.mjs';

export function registrarRutas(app) {
  // =========================================================== publico ===
  app.get('/api/salud', () => ({
    ok: true,
    negocio: CONFIG.negocio,
    fecha: hoyISO(),
    productos: estado.productos.length,
    clientes: estado.clientes.length,
    pedidos: estado.pedidos.length,
    version: '1.0.0',
  }));

  app.get('/api/config', () => ({
    negocio: CONFIG.negocio,
    horario: CONFIG.horario,
    domicilio: CONFIG.domicilio,
    pagos: CONFIG.pagos,
    iva: CONFIG.iva,
    categorias: CATEGORIAS,
    niveles: NIVELES,
  }));

  app.get('/api/catalogo', (ctx) => {
    const { q, categoria, limite = '200' } = ctx.query;
    let lista = estado.productos.filter((p) => p.activo);
    if (categoria) lista = lista.filter((p) => p.categoria === categoria);
    if (q) {
      const encontrados = buscarVarios(q, 60);
      const set = new Set(encontrados.map((p) => p.sku));
      const nq = normalizar(q);
      lista = lista.filter((p) => set.has(p.sku) || normalizar(p.nombre).includes(nq));
    }
    return {
      total: lista.length,
      productos: lista.slice(0, Number(limite)).map((p) => ({
        sku: p.sku, nombre: p.nombre, categoria: p.categoria, categoriaNombre: p.categoriaNombre,
        unidad: p.unidad, precio: p.precio, marca: p.marca, stock: p.stock,
        disponible: p.stock > 0, bajoMinimo: p.stock <= p.stockMin,
      })),
    };
  });

  app.get('/api/producto/:sku', (ctx) => {
    const p = producto(ctx.params.sku);
    if (!p) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
    const { costo, ...publico } = p;
    return { producto: publico, alternativas: alternativas(p.sku, 4).map(({ costo, ...a }) => a) };
  });

  // ------------------------------------------------ simulador de obra ---
  app.get('/api/obras', () => ({ obras: catalogoObras() }));

  app.post('/api/calcular', (ctx) => {
    const { obra, entrada = {}, clienteId = null, incluirManoObra = false } = ctx.body;
    const calculo = calcular(obra, entrada);
    const cotizacion = cotizar(calculo.items, {
      clienteId,
      incluirManoObra,
      manoObra: calculo.manoObra,
      origen: 'simulador',
    });
    const recomendaciones = recomendar(cotizacion, { clienteId, calculo });
    return { calculo, cotizacion, recomendaciones };
  });

  app.post('/api/cotizar', (ctx) => {
    const { items = [], clienteId = null, incluirManoObra = false, manoObra = null } = ctx.body;
    const cotizacion = cotizar(items, { clienteId, incluirManoObra, manoObra, origen: ctx.body.origen || 'web' });
    return { cotizacion, recomendaciones: recomendar(cotizacion, { clienteId }) };
  });

  app.post('/api/cotizaciones', (ctx) => {
    const { items = [], clienteId = null, meta = {}, incluirManoObra = false, manoObra = null } = ctx.body;
    const cotizacion = cotizar(items, { clienteId, incluirManoObra, manoObra, origen: ctx.body.origen || 'web' });
    return { cotizacion: guardarCotizacion(cotizacion, meta) };
  });

  app.get('/api/cotizaciones/:id', (ctx) => {
    const c = estado.cotizaciones.find((x) => x.id === ctx.params.id);
    if (!c) throw Object.assign(new Error('Cotizacion no encontrada'), { status: 404 });
    return { cotizacion: c };
  });

  // ------------------------------------------------ portal de IA web ---
  app.get('/api/ia/estado', async () => ({ ia: await estadoIA() }));

  app.get('/api/ia/temas', () => ({
    temas: CONOCIMIENTO.map((k) => ({ id: k.id, tema: k.tema, pregunta: k.pregunta })),
  }));

  /**
   * Asistente del portal web. Misma cabeza que el bot de WhatsApp, pero
   * respondiendo en la pagina. Si hay llave de Claude, redacta; si no,
   * responde el motor local con el mismo contenido.
   */
  app.post('/api/asistente', async (ctx) => {
    const { mensaje = '', clienteId = null, sesion = 'web' } = ctx.body;
    if (!mensaje.trim()) throw Object.assign(new Error('Mensaje vacio'), { status: 400 });

    const telefono = clienteId ? buscarCliente(clienteId)?.whatsapp || `web-${sesion}` : `web-${sesion}`;
    const conv = conversacion(telefono);
    if (clienteId) conv.clienteId = clienteId;

    const resultado = procesar(telefono, mensaje);
    const local = resultado.respuestas.map((r) => r.texto).join('\n\n');

    // Contexto duro para el modelo: solo hechos verificados por el sistema.
    const interp = interpretar(mensaje, {});
    const datos = {
      intencion: resultado.interpretacion.intencion,
      productos: interp.items
        .filter((i) => i.encontrado)
        .map((i) => {
          const p = producto(i.sku);
          return { nombre: p.nombre, precio: p.precio, unidad: p.unidad, stock: p.stock, marca: p.marca };
        }),
      carrito: resultado.conversacion.carrito,
      politicas: { horario: CONFIG.horario, domicilio: CONFIG.domicilio, pagos: CONFIG.pagos },
      conocimiento: interp.conocimiento?.entrada
        ? { pregunta: interp.conocimiento.entrada.pregunta, respuesta: interp.conocimiento.entrada.respuesta }
        : null,
    };

    const mejorado = await redactar({
      mensaje,
      datos,
      historial: conv.mensajes.slice(-8),
      respuestaLocal: local,
    });

    return {
      respuestas: mejorado
        ? [{ texto: mejorado.texto, de: 'bot', chips: resultado.respuestas.at(-1)?.chips || [] }]
        : resultado.respuestas,
      motor: mejorado ? `claude (${mejorado.modelo})` : 'motor local',
      uso: mejorado?.uso || null,
      interpretacion: resultado.interpretacion,
      conversacion: resultado.conversacion,
    };
  });

  // =========================================================== portal B2B ===
  app.post('/api/portal/login', (ctx) => {
    const { identificador = '', pin = '' } = ctx.body;
    const id = normalizar(identificador);
    const c = estado.clientes.find(
      (x) =>
        x.id.toLowerCase() === id ||
        normalizar(x.nombre) === id ||
        normalizar(x.nit).replace(/\D/g, '') === id.replace(/\D/g, '') ||
        x.whatsapp.replace(/\D/g, '').endsWith(id.replace(/\D/g, '').slice(-10))
    );
    if (!c || String(c.pin) !== String(pin)) {
      throw Object.assign(new Error('Credenciales invalidas'), { status: 401 });
    }
    registrarEvento('portal', `${c.nombre} inicio sesion en el portal`, { cliente: c.id });
    return {
      cliente: {
        id: c.id, nombre: c.nombre, contacto: c.contacto, nivel: c.nivel,
        nivelNombre: NIVELES[c.nivel].nombre, descuento: NIVELES[c.nivel].descuento,
        cupoCredito: c.cupoCredito, saldoCartera: c.saldoCartera,
        disponible: c.cupoCredito - c.saldoCartera, plazoDias: c.plazoDias, obras: c.obras,
      },
    };
  });

  app.get('/api/portal/:id/resumen', (ctx) => {
    const c = buscarCliente(ctx.params.id);
    if (!c) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
    const pedidos = pedidosDe(c.id, 50);
    const activos = pedidos.filter((p) => !['entregado', 'cancelado'].includes(p.estado));
    const gastoAnual = pedidos.reduce((a, p) => a + p.total, 0);
    const habituales = (c.skusHabituales || [])
      .map((s) => producto(s))
      .filter(Boolean)
      .map((p) => ({
        sku: p.sku, nombre: p.nombre, unidad: p.unidad, stock: p.stock,
        precio: Math.round(p.precio * (1 - descuentoEfectivo(c, p.categoria))),
        precioLista: p.precio,
      }));
    return {
      cliente: {
        id: c.id, nombre: c.nombre, contacto: c.contacto, nivel: c.nivel,
        nivelNombre: NIVELES[c.nivel].nombre, descuento: NIVELES[c.nivel].descuento,
        cupoCredito: c.cupoCredito, saldoCartera: c.saldoCartera,
        disponible: c.cupoCredito - c.saldoCartera, plazoDias: c.plazoDias,
        obras: c.obras, direccion: c.direccion, whatsapp: c.whatsapp,
      },
      indicadores: {
        pedidosActivos: activos.length,
        pedidosTotales: pedidos.length,
        compraAcumulada: gastoAnual,
        ahorroPorNivel: Math.round(pedidos.reduce((a, p) => a + (p.descuento || 0), 0)),
        ultimoPedido: pedidos[0]?.fecha || null,
      },
      proximasEntregas: activos
        .slice(0, 6)
        .map((p) => ({ id: p.id, fechaEntrega: p.fechaEntrega, estado: p.estado, total: p.total, items: p.items.length })),
      habituales,
      cotizaciones: estado.cotizaciones.filter((q) => q.clienteId === c.id).slice(0, 8),
    };
  });

  app.get('/api/portal/:id/pedidos', (ctx) => ({
    pedidos: pedidosDe(ctx.params.id, Number(ctx.query.limite || 30)).map((p) => ({
      ...p, seguimiento: seguimiento(p.id),
    })),
  }));

  app.post('/api/portal/:id/pedido', (ctx) => {
    const c = buscarCliente(ctx.params.id);
    if (!c) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
    const { items = [], fechaEntrega = isoMas(1), pago = 'credito', entrega = 'domicilio', notas = '', obra = '' } = ctx.body;
    const r = crearPedido({
      clienteId: c.id, items, canal: 'portal', fechaEntrega, pago, entrega,
      notas, obra, creadoPor: 'cliente',
    });
    if (!r.ok) throw Object.assign(new Error('Pedido no valido'), { status: 409, detalle: r.problemas });
    return r;
  });

  app.post('/api/portal/:id/validar', (ctx) => {
    const { items = [], pago = 'credito' } = ctx.body;
    return validarPedido({ clienteId: ctx.params.id, items, pago });
  });

  // ========================================================== WhatsApp ===
  app.get('/api/whatsapp/contactos', () => ({
    contactos: CLIENTES.map((c) => ({
      id: c.id, nombre: c.nombre, contacto: c.contacto, whatsapp: c.whatsapp,
      nivel: c.nivel, nivelNombre: NIVELES[c.nivel].nombre, frecuencia: c.frecuencia,
    })),
    anonimo: { whatsapp: '+57 300 000 0000', nombre: 'Numero no registrado' },
  }));

  app.get('/api/whatsapp/conversacion/:telefono', (ctx) => {
    const conv = conversacion(ctx.params.telefono);
    return { conversacion: conv };
  });

  app.post('/api/whatsapp/mensaje', (ctx) => {
    const { telefono, texto } = ctx.body;
    if (!telefono || !texto) throw Object.assign(new Error('telefono y texto son obligatorios'), { status: 400 });
    return procesar(telefono, texto);
  });

  app.post('/api/whatsapp/reiniciar/:telefono', (ctx) => ({
    conversacion: reiniciarConversacion(ctx.params.telefono),
  }));

  /**
   * Webhook de WhatsApp Business Cloud API. En el simulador no se usa;
   * queda listo para produccion: se apunta Meta a esta URL y el mismo motor
   * que ves en el simulador atiende los mensajes reales.
   */
  app.get('/api/whatsapp/webhook', (ctx) => {
    const { 'hub.verify_token': token, 'hub.challenge': challenge } = ctx.query;
    if (token && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'ferreteria-360')) {
      return { challenge: Number(challenge) || challenge };
    }
    throw Object.assign(new Error('Token de verificacion invalido'), { status: 403 });
  });

  app.post('/api/whatsapp/webhook', (ctx) => {
    const entradas = ctx.body?.entry || [];
    const procesados = [];
    for (const e of entradas) {
      for (const cambio of e.changes || []) {
        for (const m of cambio.value?.messages || []) {
          if (m.type !== 'text') continue;
          procesados.push(procesar(m.from, m.text.body));
        }
      }
    }
    return { recibidos: procesados.length, resultados: procesados };
  });

  // ============================================================== ERP ===
  app.get('/api/admin/dashboard', () => ({
    kpis: fin.kpis(),
    cierreHoy: fin.cierreDiario(),
    serie: fin.serieVentas(30),
    canales: fin.ventasPorCanal(30),
    agenda: agenda(7),
    alertas: inv.alertas(),
    top: fin.topProductos(30, 8),
    eventos: estado.eventos.slice(0, 12),
  }));

  app.get('/api/admin/kpis', () => ({ kpis: fin.kpis() }));

  app.get('/api/admin/inventario', (ctx) => {
    const filas = inv.rotacion(Number(ctx.query.dias || 30));
    const q = ctx.query.q ? normalizar(ctx.query.q) : null;
    const cat = ctx.query.categoria;
    return {
      valorizacion: inv.valorizacion(),
      productos: filas.filter(
        (f) => (!q || normalizar(f.nombre).includes(q) || f.sku.toLowerCase().includes(q)) &&
               (!cat || estado.productos.find((p) => p.sku === f.sku)?.categoria === cat)
      ),
    };
  });

  app.get('/api/admin/inventario/alertas', () => ({ alertas: inv.alertas(), compras: sugerenciasCompra() }));

  app.get('/api/admin/inventario/kardex/:sku', (ctx) => {
    const k = inv.kardex(ctx.params.sku);
    if (!k) throw Object.assign(new Error('SKU no encontrado'), { status: 404 });
    return k;
  });

  app.post('/api/admin/inventario/ajuste', (ctx) => {
    const { sku, stock, motivo } = ctx.body;
    return inv.ajustar(sku, stock, motivo);
  });

  app.get('/api/admin/pedidos', (ctx) => {
    const { estado: est, fecha, canal, cliente: cli, limite = '80' } = ctx.query;
    let lista = estado.pedidos;
    if (est) lista = lista.filter((p) => p.estado === est);
    if (fecha) lista = lista.filter((p) => p.fechaEntrega === fecha);
    if (canal) lista = lista.filter((p) => p.canal === canal);
    if (cli) lista = lista.filter((p) => p.clienteId === cli);
    return { total: lista.length, pedidos: lista.slice(0, Number(limite)) };
  });

  app.get('/api/admin/pedidos/:id', (ctx) => {
    const p = estado.pedidos.find((x) => x.id === ctx.params.id);
    if (!p) throw Object.assign(new Error('Pedido no encontrado'), { status: 404 });
    return { pedido: p, seguimiento: seguimiento(p.id) };
  });

  app.post('/api/admin/pedidos/:id/estado', (ctx) =>
    ({ pedido: cambiarEstado(ctx.params.id, ctx.body.estado, ctx.body.por || 'asesor') }));

  app.post('/api/admin/pedidos', (ctx) => {
    const r = crearPedido({ ...ctx.body, canal: ctx.body.canal || 'mostrador', creadoPor: 'asesor' });
    if (!r.ok) throw Object.assign(new Error('Pedido no valido'), { status: 409, detalle: r.problemas });
    return r;
  });

  app.get('/api/admin/agenda', (ctx) => agenda(Number(ctx.query.dias || 7)));

  app.get('/api/admin/alistamiento', (ctx) => listaDeAlistamiento(ctx.query.fecha || hoyISO()));

  app.get('/api/admin/finanzas', (ctx) => {
    const dias = Number(ctx.query.dias || 30);
    return {
      resultados: fin.estadoResultados(isoMas(-dias + 1)),
      anterior: fin.estadoResultados(isoMas(-dias * 2 + 1), isoMas(-dias)),
      cierreHoy: fin.cierreDiario(),
      serie: fin.serieVentas(dias),
      canales: fin.ventasPorCanal(dias),
      categorias: fin.margenPorCategoria(dias),
      top: fin.topProductos(dias, 12),
      flujo: fin.flujoProyectado(30),
      cartera: fin.cartera(),
    };
  });

  app.get('/api/admin/cierre', (ctx) => fin.cierreDiario(ctx.query.fecha || hoyISO()));

  app.get('/api/admin/cartera', () => fin.cartera());

  app.get('/api/admin/compras', () => ({
    ordenes: estado.compras.slice(0, 20),
    sugerencias: sugerenciasCompra(),
  }));

  app.post('/api/admin/compras/:id/recibir', (ctx) => inv.recibirCompra(ctx.params.id));

  app.get('/api/admin/clientes', () => ({
    clientes: estado.clientes.map((c) => {
      const pedidos = pedidosDe(c.id, 200);
      return {
        id: c.id, nombre: c.nombre, contacto: c.contacto, whatsapp: c.whatsapp, nit: c.nit,
        nivel: c.nivel, nivelNombre: NIVELES[c.nivel].nombre,
        cupoCredito: c.cupoCredito, saldoCartera: c.saldoCartera,
        disponible: c.cupoCredito - c.saldoCartera,
        pedidos: pedidos.length,
        compraAcumulada: pedidos.reduce((a, p) => a + p.total, 0),
        activos: pedidos.filter((p) => !['entregado', 'cancelado'].includes(p.estado)).length,
        obras: c.obras, frecuencia: c.frecuencia,
      };
    }),
  }));

  app.get('/api/admin/eventos', (ctx) => ({ eventos: estado.eventos.slice(0, Number(ctx.query.limite || 50)) }));

  app.get('/api/admin/conversaciones', () => ({
    conversaciones: Object.values(estado.conversaciones).map((c) => ({
      telefono: c.telefono,
      cliente: c.clienteNombre,
      mensajes: c.mensajes.length,
      ultimo: c.mensajes.at(-1)?.texto?.slice(0, 90) || '',
      carrito: c.carrito.length,
      escalada: c.escalada,
    })),
  }));

  app.post('/api/admin/reiniciar-demo', () => {
    reiniciar();
    return { ok: true, mensaje: 'Datos demo regenerados', pedidos: estado.pedidos.length };
  });
}
