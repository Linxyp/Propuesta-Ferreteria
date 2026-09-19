/**
 * BOT DE WHATSAPP CON CONOCIMIENTO TOTAL
 *
 * Maquina de estados conversacional sobre los mismos datos que usa el ERP:
 * catalogo vivo, stock real, nivel de precio del cliente, su cartera y su
 * historial. No "parece" que sabe: consulta.
 *
 * Capacidades:
 *   - reconoce al cliente fijo por su numero y lo saluda por su nombre
 *   - arma el pedido conversando ("20 bultos de cemento y 3 m3 de arena")
 *   - repite el ultimo pedido ("lo de siempre")
 *   - cotiza, consulta stock, saldo de cartera y estado de despacho
 *   - calcula material de obra desde el chat
 *   - responde asesoria tecnica desde la base de conocimiento
 *   - agenda la fecha de entrega y deja el pedido cargado en el ERP
 *   - escala a un humano cuando corresponde
 */
import { estado, CONFIG, registrarEvento, guardar, producto } from '../lib/store.mjs';
import { clientePorWhatsapp, NIVELES } from '../data/clientes.mjs';
import { interpretar } from './nlu.mjs';
import { cotizar, buscarVarios } from './cotizador.mjs';
import { recomendar } from './recomendador.mjs';
import { crearPedido, ultimoPedidoDe, seguimiento, pedidosDe } from './pedidos.mjs';
import { calcular } from './calculadora.mjs';
import { COP, hoyISO, isoMas, etiquetaRelativa, normalizar, techo } from '../lib/util.mjs';

const CORTE_HOY = 14; // hora limite para despacho el mismo dia

/** "Ing. Marcela Vallejo" -> "Marcela". Los titulos no son nombres. */
function nombreDePila(nombre = '') {
  const partes = String(nombre)
    .split(/\s+/)
    .filter((p) => !/^(ing|arq|dr|dra|sr|sra|srta|lic|tec|esp)\.?$/i.test(p));
  return partes[0] || 'a la orden';
}

export function conversacion(telefono) {
  const key = String(telefono || 'anonimo');
  if (!estado.conversaciones[key]) {
    const cli = clientePorWhatsapp(key);
    estado.conversaciones[key] = {
      telefono: key,
      clienteId: cli?.id || null,
      clienteNombre: cli?.nombre || null,
      carrito: [],
      esperando: null,
      fechaEntrega: null,
      pago: null,
      mensajes: [],
      creada: new Date().toISOString(),
      escalada: false,
    };
  }
  return estado.conversaciones[key];
}

const msg = (texto, extra = {}) => ({ texto, ts: new Date().toISOString(), de: 'bot', ...extra });

function resumenCarrito(conv) {
  if (!conv.carrito.length) return null;
  return cotizar(conv.carrito, { clienteId: conv.clienteId, origen: 'whatsapp' });
}

function textoCarrito(cot) {
  const lineas = cot.lineas.map((l) => {
    const alerta = l.disponible ? '' : `  (!) solo hay ${l.stock}`;
    return `• ${l.cantidad} ${l.unidad} ${l.nombre} — ${COP(l.subtotal)}${alerta}`;
  });
  let txt = `*Su pedido va asi:*\n${lineas.join('\n')}\n\n`;
  if (cot.totales.descuento > 0) {
    txt += `Subtotal lista: ${COP(cot.totales.bruto)}\nDescuento ${cot.nivel.nombre} (${Math.round(cot.nivel.descuento * 100)}%): -${COP(cot.totales.descuento)}\n`;
  }
  txt += `*Total: ${COP(cot.totales.materiales)}* (IVA incluido)\n${cot.domicilio.mensaje}`;
  return txt;
}

// --------------------------------------------------------------- handlers ---

function handleSaludo(conv, cli) {
  if (!cli) {
    return [
      msg(
        'Buen dia, le saluda el asistente de la ferreteria. Puedo cotizarle material, decirle si hay existencias, calcular cuanto necesita para su obra y tomarle el pedido.\n\nCuenteme que necesita.',
        { chips: ['Precio del cemento', 'Cuanto material para una placa de 5x4', 'Que horario tienen'] }
      ),
    ];
  }
  const pendientes = pedidosDe(cli.id, 10).filter((p) => !['entregado', 'cancelado'].includes(p.estado));
  const partes = [`Buen dia ${nombreDePila(cli.contacto)}, bienvenido de nuevo.`];
  if (pendientes.length) {
    const p = pendientes[0];
    partes.push(`Tiene ${pendientes.length} pedido(s) en curso. El ${p.id} esta *${p.estado}* para ${etiquetaRelativa(p.fechaEntrega)}.`);
  }
  if (cli.saldoCartera > 0) {
    partes.push(`Cartera al dia de hoy: ${COP(cli.saldoCartera)} de un cupo de ${COP(cli.cupoCredito)}.`);
  }
  partes.push('Digame que necesita y se lo dejo listo.');
  return [
    msg(partes.join('\n\n'), {
      chips: ['Lo de siempre', 'Necesito 20 bultos de cemento', 'Mi saldo', 'Estado de mi pedido'],
    }),
  ];
}

function handlePedido(conv, interp) {
  const encontrados = interp.items.filter((i) => i.encontrado);
  const perdidos = interp.items.filter((i) => !i.encontrado && i.texto.length > 3);

  for (const it of encontrados) {
    const existente = conv.carrito.find((c) => c.sku === it.sku);
    if (existente) existente.cantidad += it.cantidad;
    else conv.carrito.push({ sku: it.sku, cantidad: it.cantidad });
  }

  const salida = [];
  if (perdidos.length) {
    for (const p of perdidos) {
      const opciones = buscarVarios(p.texto, 3);
      if (opciones.length) {
        salida.push(
          msg(
            `No tengo exactamente "${p.texto}". Se parece a:\n${opciones
              .map((o) => `• ${o.nombre} — ${COP(o.precio)} (${o.stock} ${o.unidad})`)
              .join('\n')}\n\nCual le sirve?`,
            { chips: opciones.map((o) => `${p.cantidad} ${o.nombre}`) }
          )
        );
      } else {
        salida.push(msg(`No encontre "${p.texto}" en el catalogo. Lo consulto con un asesor o me lo describe de otra forma?`));
      }
    }
  }

  const cot = resumenCarrito(conv);
  if (!cot) return salida.length ? salida : [msg('No alcance a identificar el producto. Me lo escribe de nuevo?')];

  salida.push(msg(textoCarrito(cot)));

  const recos = recomendar(cot, { clienteId: conv.clienteId }).filter((r) =>
    ['complemento', 'ahorro', 'disponibilidad'].includes(r.tipo)
  );
  if (recos.length) {
    const r = recos[0];
    salida.push(msg(`*Sugerencia:* ${r.titulo}\n${r.detalle}`, { chips: ['Agregalo', 'Asi esta bien'] }));
  }

  conv.esperando = 'fecha';
  salida.push(
    msg('Para cuando lo necesita?', {
      chips: ['Hoy', 'Manana', 'Pasado manana', 'El lunes'],
    })
  );
  return salida;
}

function handleFecha(conv, interp) {
  const f = interp.fecha || { iso: isoMas(1), etiqueta: 'manana' };
  conv.fechaEntrega = f.iso;
  conv.esperando = 'confirmacion';
  const cot = resumenCarrito(conv);
  const hora = new Date().getHours();
  const aviso =
    f.iso === hoyISO() && hora >= CORTE_HOY
      ? `\n\n(!) Ya pasamos el corte de las ${CORTE_HOY}:00 para despacho del mismo dia. Lo puedo dejar de primero manana a primera hora.`
      : '';
  return [
    msg(
      `Perfecto, lo programo para *${etiquetaRelativa(f.iso)}*.${aviso}\n\n${textoCarrito(cot)}\n\nConfirmo el pedido?`,
      { chips: ['Si, confirmo', 'Agregar algo mas', 'Cancelar'] }
    ),
  ];
}

function handleConfirmar(conv, cli) {
  if (!conv.carrito.length) {
    conv.esperando = null;
    return [msg('No tengo nada pendiente por confirmar. Digame que necesita y se lo armo.')];
  }
  const pago = cli && cli.cupoCredito - cli.saldoCartera > 0 ? 'credito' : 'contado';
  const r = crearPedido({
    clienteId: conv.clienteId,
    clienteNombre: cli?.nombre || `WhatsApp ${conv.telefono}`,
    whatsapp: conv.telefono,
    items: conv.carrito,
    canal: 'whatsapp',
    fechaEntrega: conv.fechaEntrega || isoMas(1),
    pago,
    entrega: cli ? 'domicilio' : 'recoge en local',
    creadoPor: 'bot',
    obra: cli?.obras?.[0] || '',
  });

  if (!r.ok) {
    const detalle = r.problemas.map((p) => `• ${p.mensaje}`).join('\n');
    return [
      msg(`No pude cerrar el pedido:\n${detalle}\n\nQuiere que lo deje con lo que si hay disponible?`, {
        chips: ['Si, despache lo que haya', 'Cancelar'],
      }),
    ];
  }

  const p = r.pedido;
  conv.carrito = [];
  conv.esperando = null;
  conv.fechaEntrega = null;

  const extra = r.advertencias?.length
    ? `\n\nNota: ${r.advertencias.map((a) => a.mensaje).join(' ')}`
    : '';

  return [
    msg(
      `*Pedido ${p.id} confirmado.*\n\n` +
        `Entrega: ${etiquetaRelativa(p.fechaEntrega)}\n` +
        `Total: ${COP(p.total)} (${p.pago})\n` +
        `${p.items.length} lineas · ${p.entrega}\n\n` +
        `Ya quedo cargado en el sistema y bodega lo empieza a alistar. Le aviso por aqui cuando salga el despacho.${extra}`,
      { chips: ['Ver estado', 'Hacer otro pedido'], evento: 'pedido_creado', pedidoId: p.id }
    ),
  ];
}

function handleRepetir(conv, cli) {
  if (!cli) return [msg('Para repetir un pedido necesito reconocer su numero. Un asesor lo registra en 2 minutos y de ahi en adelante me dice "lo de siempre" y listo.')];
  const ultimo = ultimoPedidoDe(cli.id);
  if (!ultimo) return [msg('Todavia no tengo pedidos suyos en el historial. Digame que necesita y lo armamos.')];

  conv.carrito = ultimo.items.map((i) => ({ sku: i.sku, cantidad: i.cantidad }));
  const cot = resumenCarrito(conv);
  conv.esperando = 'fecha';
  return [
    msg(`Su ultimo pedido fue el ${ultimo.id} del ${ultimo.fecha}. Se lo dejo igual:\n\n${textoCarrito(cot)}`),
    msg('Para cuando se lo programo?', { chips: ['Hoy', 'Manana', 'El lunes'] }),
  ];
}

function handlePrecio(conv, interp) {
  const encontrados = interp.items.filter((i) => i.encontrado);
  if (!encontrados.length) return [msg('De cual producto le consulto el precio?')];
  const cot = cotizar(
    encontrados.map((i) => ({ sku: i.sku, cantidad: i.cantidadExplicita ? i.cantidad : 1 })),
    { clienteId: conv.clienteId, origen: 'whatsapp' }
  );
  const lineas = cot.lineas.map((l) => {
    const stock = l.stock > 0 ? `${l.stock} ${l.unidad} disponibles` : 'sin existencias';
    const desc = l.descuentoUnit > 0 ? ` (precio ${cot.nivel.nombre}, lista ${COP(l.precioLista)})` : '';
    return `• *${l.nombre}*\n  ${COP(l.precioUnit)} por ${l.unidad}${desc}\n  ${stock}`;
  });
  return [
    msg(`${lineas.join('\n\n')}\n\nLe separo alguna cantidad?`, {
      chips: encontrados.slice(0, 2).map((i) => `Necesito 10 ${i.nombre}`),
    }),
  ];
}

function handleStock(conv, interp) {
  const encontrados = interp.items.filter((i) => i.encontrado);
  if (!encontrados.length) return [msg('De cual producto reviso existencias?')];
  const lineas = encontrados.map((i) => {
    const p = producto(i.sku);
    const pedida = i.cantidadExplicita ? i.cantidad : null;
    if (!p.stock) return `• ${p.nombre}: agotado. Llega en 48 h con el proveedor.`;
    if (pedida && pedida > p.stock) return `• ${p.nombre}: hay ${p.stock} ${p.unidad} de las ${pedida} que necesita. Le despacho ${p.stock} hoy y el resto en 48 h.`;
    return `• ${p.nombre}: *si hay* (${p.stock} ${p.unidad} en bodega).`;
  });
  return [msg(lineas.join('\n'), { chips: ['Separalo', 'Cuanto vale'] })];
}

function handleSaldo(conv, cli) {
  if (!cli) return [msg('Esa consulta es para clientes con cupo registrado. Si quiere le paso los requisitos para abrir credito.')];
  const disponible = cli.cupoCredito - cli.saldoCartera;
  const pend = pedidosDe(cli.id, 30).filter((p) => !['entregado', 'cancelado'].includes(p.estado));
  return [
    msg(
      `*Estado de cuenta — ${cli.nombre}*\n\n` +
        `Cupo aprobado: ${COP(cli.cupoCredito)}\n` +
        `Saldo pendiente: ${COP(cli.saldoCartera)}\n` +
        `Disponible: *${COP(disponible)}*\n` +
        `Plazo: ${cli.plazoDias} dias\n` +
        `Nivel de precio: ${NIVELES[cli.nivel].nombre} (${Math.round(NIVELES[cli.nivel].descuento * 100)}% de descuento)\n` +
        (pend.length ? `\nPedidos en curso: ${pend.length}` : '')
    ),
  ];
}

function handleEstado(conv, cli) {
  if (!cli) return [msg('Me pasa el numero del pedido (empieza por PD-) y se lo consulto.')];
  const activos = pedidosDe(cli.id, 20).filter((p) => !['entregado', 'cancelado'].includes(p.estado));
  if (!activos.length) return [msg('No tiene pedidos en curso. El ultimo ya fue entregado.')];
  const lineas = activos.slice(0, 3).map((p) => {
    const s = seguimiento(p.id);
    const barra = s.pasos.map((x) => (x.hecho ? '●' : '○')).join('—');
    return `*${p.id}* · ${COP(p.total)}\n${barra}\nEstado: ${p.estado} · Entrega ${etiquetaRelativa(p.fechaEntrega)}`;
  });
  return [msg(lineas.join('\n\n'))];
}

/** Calculo de obra directamente desde el chat. */
function handleCalcular(conv, interp) {
  const t = normalizar(interp.texto);
  const dim = t.match(/(\d+(?:[.,]\d+)?)\s*(?:x|por)\s*(\d+(?:[.,]\d+)?)/);
  const a = dim ? Number(dim[1].replace(',', '.')) : null;
  const b = dim ? Number(dim[2].replace(',', '.')) : null;

  let obraId = null;
  if (/\b(placa|losa|piso en concreto|contrapiso|anden)\b/.test(t)) obraId = 'placa';
  else if (/\b(muro|pared|mamposteria|ladrillo|bloque)\b/.test(t)) obraId = 'muro';
  else if (/\b(ceramica|porcelanato|enchape|baldosa|piso)\b/.test(t)) obraId = 'enchape';
  else if (/\b(pintura|pintar|vinilo|estuco)\b/.test(t)) obraId = 'pintura';
  else if (/\b(drywall|cielo raso|panel)\b/.test(t)) obraId = 'drywall';
  else if (/\b(teja|cubierta|techo)\b/.test(t)) obraId = 'cubierta';

  if (!obraId || !dim) {
    return [
      msg(
        'Se lo calculo de una. Digame el tipo de obra y las medidas, por ejemplo:\n\n' +
          '• "cuanto material para una placa de 5x4"\n' +
          '• "cuantos ladrillos para un muro de 6x2.5"\n' +
          '• "cuanta ceramica para 4x3"\n\n' +
          'O si prefiere el simulador completo con presupuesto, le paso el enlace.',
        { chips: ['Placa de 5x4', 'Muro de 6x2.5', 'Ceramica para 4x3'] }
      ),
    ];
  }

  const entradas = {
    placa: { largo: a, ancho: b, espesor: 10, resistencia: '3000', malla: true },
    muro: { largo: a, alto: b, pieza: 'LAD-TOL-MAC', panete: true, carasPanete: '2' },
    enchape: { largo: a, ancho: b, formato: 'CER-PIS-45' },
    pintura: { largo: a, ancho: b, alto: 2.4, manos: 2, tipo: 'PIN-V1-GL', estuco: true, sellador: true },
    drywall: { largo: a, alto: b, tipo: 'muro', dosCaras: true },
    cubierta: { largo: a, ancho: b, pendiente: 25, teja: 'TEJ-ZIN-30' },
  }[obraId];

  const calculo = calcular(obraId, entradas);
  const cot = cotizar(calculo.items, { clienteId: conv.clienteId, origen: 'whatsapp' });

  const detalle = cot.lineas
    .slice(0, 8)
    .map((l) => `• ${l.cantidad} ${l.unidad} ${l.nombre} — ${COP(l.subtotal)}`)
    .join('\n');

  conv.carrito = calculo.items.map((i) => ({ sku: i.sku, cantidad: i.cantidad }));
  conv.esperando = 'fecha';

  return [
    msg(
      `*${calculo.obra.nombre} de ${a} x ${b} m*\n` +
        calculo.resumen.map((r) => `${r.etiqueta}: ${r.valor} ${r.unidad}`).join(' · ') +
        `\n\n*Material:*\n${detalle}\n\n*Total materiales: ${COP(cot.totales.materiales)}*` +
        (calculo.advertencias[0] ? `\n\n_${calculo.advertencias[0]}_` : '')
    ),
    msg('Ya se lo deje armado como pedido. Para cuando lo necesita?', {
      chips: ['Manana', 'El lunes', 'Solo era la cotizacion'],
    }),
  ];
}

function handleAsesoria(conv, interp) {
  const k = interp.conocimiento?.entrada;
  if (!k) {
    return [
      msg(
        'Esa no la tengo resuelta de memoria. Se la paso a un asesor y le responde en minutos, o si me la plantea con las medidas se la calculo.',
        { chips: ['Hablar con un asesor'] }
      ),
    ];
  }
  return [msg(k.respuesta, { fuente: k.id, chips: ['Cotizar eso', 'Otra pregunta'] })];
}

function handleCatalogo() {
  const porCat = new Map();
  for (const p of estado.productos) {
    porCat.set(p.categoriaNombre, (porCat.get(p.categoriaNombre) || 0) + 1);
  }
  const lineas = [...porCat.entries()].map(([c, n]) => `• ${c} (${n} referencias)`);
  return [
    msg(`Manejamos ${estado.productos.length} referencias:\n\n${lineas.join('\n')}\n\nDigame que busca y le paso precio y existencias.`, {
      chips: ['Precio del cemento', 'Tienen porcelanato', 'Cable numero 12'],
    }),
  ];
}

function handleHumano(conv, cli) {
  conv.escalada = true;
  registrarEvento('escalamiento', `${cli?.nombre || conv.telefono} pidio hablar con un asesor`, {
    telefono: conv.telefono, cliente: cli?.id || null,
  });
  return [
    msg(
      'Listo, le aviso a un asesor. Mientras tanto le dejo el resumen de lo que hablamos para que no tenga que repetir nada.\n\n' +
        `Horario de atencion: ${CONFIG.horario}`
    ),
  ];
}

function handleAyuda() {
  return [
    msg(
      '*Esto es lo que puedo hacer por aqui:*\n\n' +
        '1. Cotizar cualquier producto con su precio y existencias\n' +
        '2. Tomarle el pedido y programarlo para el dia que necesite\n' +
        '3. Repetir su pedido habitual ("lo de siempre")\n' +
        '4. Calcular el material de su obra (placa, muro, piso, pintura, drywall, cubierta)\n' +
        '5. Consultarle saldo, cupo y estado de despacho\n' +
        '6. Resolverle dudas tecnicas de obra\n' +
        '7. Pasarlo con un asesor cuando lo necesite',
      { chips: ['Lo de siempre', 'Cuanto material para una placa de 5x4', 'Mi saldo'] }
    ),
  ];
}

// ------------------------------------------------------------------ nucleo ---
export function procesar(telefono, texto) {
  const conv = conversacion(telefono);
  const cli = conv.clienteId ? estado.clientes.find((c) => c.id === conv.clienteId) : clientePorWhatsapp(telefono);
  if (cli && !conv.clienteId) {
    conv.clienteId = cli.id;
    conv.clienteNombre = cli.nombre;
  }

  conv.mensajes.push({ de: 'cliente', texto, ts: new Date().toISOString() });
  const interp = interpretar(texto, { esperando: conv.esperando });

  let respuestas;
  switch (interp.intencion) {
    case 'saludo': respuestas = handleSaludo(conv, cli); break;
    case 'pedido': respuestas = handlePedido(conv, interp); break;
    case 'fecha_entrega': respuestas = handleFecha(conv, interp); break;
    case 'confirmar':
      respuestas = conv.esperando === 'confirmacion' || conv.carrito.length
        ? handleConfirmar(conv, cli)
        : [msg('Perfecto. Algo mas en lo que le ayude?')];
      break;
    case 'cancelar':
      conv.carrito = [];
      conv.esperando = null;
      respuestas = [msg('Listo, cancelo el pedido. Aqui quedo por si lo necesita despues.')];
      break;
    case 'repetir': respuestas = handleRepetir(conv, cli); break;
    case 'precio': respuestas = handlePrecio(conv, interp); break;
    case 'stock': respuestas = handleStock(conv, interp); break;
    case 'saldo': respuestas = handleSaldo(conv, cli); break;
    case 'estado_pedido': respuestas = handleEstado(conv, cli); break;
    case 'calcular': respuestas = handleCalcular(conv, interp); break;
    case 'asesoria': respuestas = handleAsesoria(conv, interp); break;
    case 'catalogo': respuestas = handleCatalogo(); break;
    case 'humano': respuestas = handleHumano(conv, cli); break;
    case 'ayuda': respuestas = handleAyuda(); break;
    case 'despedida':
      respuestas = [msg('Con gusto. Aqui estoy 24/7 para cuando necesite material.')];
      break;
    default:
      respuestas = [
        msg(
          'No estoy seguro de haber entendido. Puedo cotizarle, revisarle existencias, tomarle el pedido o calcularle el material de la obra.\n\nComo se lo ayudo?',
          { chips: ['Ver que puedes hacer', 'Hablar con un asesor'] }
        ),
      ];
  }

  for (const r of respuestas) conv.mensajes.push(r);
  if (conv.mensajes.length > 120) conv.mensajes = conv.mensajes.slice(-120);
  guardar();

  return {
    respuestas,
    interpretacion: { intencion: interp.intencion, confianza: interp.confianza, items: interp.items.length },
    conversacion: {
      telefono: conv.telefono,
      cliente: cli ? { id: cli.id, nombre: cli.nombre, nivel: cli.nivel } : null,
      carrito: conv.carrito,
      esperando: conv.esperando,
      escalada: conv.escalada,
    },
  };
}

export function reiniciarConversacion(telefono) {
  delete estado.conversaciones[String(telefono)];
  guardar();
  return conversacion(telefono);
}
