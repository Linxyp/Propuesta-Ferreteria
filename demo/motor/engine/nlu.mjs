/**
 * NLU: entender lo que escribe un maestro de obra por WhatsApp.
 *
 * Detecta intencion, extrae cantidades + unidades + productos y resuelve fechas
 * relativas. Es deterministico a proposito: el mismo mensaje da siempre el mismo
 * resultado, se puede probar con tests y no cuesta un solo token.
 *
 * Cuando hay llave de Claude configurada, llm.mjs se encarga de los mensajes que
 * este modulo marca con baja confianza; los precios y el stock siguen saliendo
 * de aqui.
 */
import { normalizar, isoMas, hoyISO } from '../lib/util.mjs';
import { buscarProducto } from './cotizador.mjs';
import { INDICE } from '../data/conocimiento.mjs';

const NUMEROS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14,
  quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  doscientos: 200, quinientos: 500, mil: 1000, media: 0.5, medio: 0.5,
};

const UNIDADES = [
  ['bulto', /\bbultos?\b/], ['m3', /\b(m3|metros?\s+cubicos?|cubos?)\b/],
  ['m2', /\b(m2|metros?\s+cuadrados?)\b/], ['ml', /\b(ml|metros?\s+lineales?)\b/],
  ['galon', /\b(galon|galones|gl)\b/], ['cunete', /\bcunetes?\b/],
  ['caja', /\bcajas?\b/], ['rollo', /\brollos?\b/], ['und', /\b(und|unidades?|piezas?)\b/],
  ['kg', /\b(kg|kilos?|kilogramos?)\b/], ['par', /\bpares?\b/],
];

const PATRONES = [
  ['saludo', /\b(hola|buenas|buenos dias|buenas tardes|buenas noches|que mas|hey|holaa?)\b/],
  ['despedida', /\b(chao|adios|hasta luego|gracias por todo|nos vemos)\b/],
  ['gracias', /\b(gracias|mil gracias|muy amable|listo gracias)\b/],
  ['confirmar', /\b(si|confirmo|confirmar|listo|dale|de una|correcto|asi es|hagale|perfecto|ok|va)\b/],
  ['cancelar', /\b(no|cancelar|cancele|anular|olvidelo|dejelo asi|mejor no)\b/],
  ['repetir', /\b(lo de siempre|lo mismo|lo de la otra vez|pedido anterior|repetir|el mismo pedido|como la vez pasada)\b/],
  ['estado_pedido', /\b(mi pedido|el pedido|ya salio|donde va|cuando llega|estado del pedido|ya despacharon|va en camino)\b/],
  ['saldo', /\b(saldo|cartera|mi cuenta|estado de cuenta|mi cupo|cuanto\s+(?:le\s+|me\s+|te\s+)?debo|que\s+debo)\b/],
  ['calcular', /\b(cuanto material|cuanto cemento|cuantos? ladrillos?|cuanta pintura|calcular|calculo|me alcanza|cuanto necesito|cuanto me va|cuantas? cajas?|para una placa|para un muro)\b/],
  ['pedido', /\b(necesito|quiero|mandeme|enviame|enviame|envieme|me manda|me despacha|hagame|pedido|separe|aparte|me trae|regaleme|deme|vendame)\b/],
  ['precio', /\b(precio|cuanto vale|cuanto cuesta|a como|valor de|cuanto esta|cotice|cotizar|cuanto me sale)\b/],
  ['stock', /\b(tiene|tienen|hay|disponible|disponibilidad|queda|quedan|en existencia|cuantos tiene)\b/],
  ['catalogo', /\b(catalogo|que venden|que manejan|que productos|lista de precios|que tienen)\b/],
  ['humano', /\b(asesor|humano|persona|hablar con alguien|llamar|telefono|atiendame alguien)\b/],
  ['ayuda', /\b(ayuda|que puedes hacer|como funciona|opciones|menu)\b/],
];

/** Extrae cantidades numericas escritas en digitos o en letras. */
function leerCantidad(fragmento) {
  const t = normalizar(fragmento);
  const m = t.match(/(\d+(?:[.,]\d+)?)/);
  if (m) return Number(m[1].replace(',', '.'));
  for (const [palabra, valor] of Object.entries(NUMEROS)) {
    if (new RegExp(`\\b${palabra}\\b`).test(t)) return valor;
  }
  return null;
}

function leerUnidad(fragmento) {
  const t = normalizar(fragmento);
  for (const [u, re] of UNIDADES) if (re.test(t)) return u;
  return null;
}

/** Fechas relativas tipicas de obra. */
export function leerFecha(texto) {
  const t = normalizar(texto);
  if (/\b(hoy|ya|ahora|de una|urgente)\b/.test(t)) return { iso: hoyISO(), etiqueta: 'hoy' };
  if (/\bpasado manana\b/.test(t)) return { iso: isoMas(2), etiqueta: 'pasado manana' };
  if (/\bmanana\b/.test(t)) return { iso: isoMas(1), etiqueta: 'manana' };
  const enDias = t.match(/\ben (\d+) dias?\b/);
  if (enDias) return { iso: isoMas(Number(enDias[1])), etiqueta: `en ${enDias[1]} dias` };
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  for (let i = 0; i < dias.length; i++) {
    if (new RegExp(`\\b${dias[i]}\\b`).test(t)) {
      const hoyDow = new Date().getDay();
      let delta = (i - hoyDow + 7) % 7;
      if (delta === 0) delta = 7;
      return { iso: isoMas(delta), etiqueta: `el ${dias[i]}` };
    }
  }
  if (/\b(semana entrante|proxima semana|la otra semana)\b/.test(t)) {
    return { iso: isoMas(7), etiqueta: 'la proxima semana' };
  }
  return null;
}

const UNIDADES_TXT =
  /\b(bultos?|m3|m2|ml|metros?\s+cubicos?|metros?\s+cuadrados?|metros?\s+lineales?|galones?|galon|gl|cunetes?|cajas?|rollos?|unidades?|und|piezas?|kilos?|kilogramos?|kg|pares?|laminas?|varillas?|tejas?|tarros?|metros?)\b/g;

const RELLENO =
  /\b(necesito|necesitamos|quiero|queria|mandeme|mandame|envieme|enviame|me\s+manda|me\s+despacha|hagame|regaleme|deme|vendame|separe|aparte|porfa|por\s+favor|tambien|adicional|adicionalmente|de|del|la|el|los|las|un|una|unos|unas|para|por|que|con|uso|usar|mi|su|al|lo|y|e|en|es|me|te|le)\b/g;

/**
 * Parte el mensaje en fragmentos "cantidad + producto".
 * Ejemplo real: "necesito 20 bultos de cemento, 3 m3 de arena y 2 galones de vinilo"
 *
 * El corte se hace sobre el texto ORIGINAL (la normalizacion quita las comas,
 * que son justamente el separador mas usado al dictar una lista de materiales).
 */
export function extraerItems(texto) {
  const partes = String(texto || '')
    .split(/\s*(?:,|;|\+|\by\b|\be\b|\btambien\b|\bmas\b|\badicional(?:mente)?\b)\s*/i)
    .map((p) => normalizar(p))
    .filter((p) => p.length > 2);

  const items = [];

  for (const parte of partes) {
    const cantidad = leerCantidad(parte);
    const unidad = leerUnidad(parte);
    // Primero la unidad (puede contener digitos, como "m3"), luego los numeros.
    let nombre = parte
      .replace(UNIDADES_TXT, ' ')
      .replace(/\d+(?:[.,]\d+)?/g, ' ')
      .replace(RELLENO, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (nombre.length < 3) continue;
    const match = buscarProducto(nombre);
    if (!match) {
      items.push({ texto: nombre, cantidad: cantidad || 1, unidad, sku: null, encontrado: false });
      continue;
    }
    items.push({
      texto: nombre,
      sku: match.producto.sku,
      nombre: match.producto.nombre,
      unidad: match.producto.unidad,
      cantidad: cantidad || 1,
      cantidadExplicita: cantidad !== null,
      puntaje: match.puntaje,
      encontrado: true,
    });
  }
  return items;
}

/** Recupera la mejor entrada de la base de conocimiento. */
export function buscarConocimiento(texto) {
  const t = normalizar(texto);
  const palabras = t.split(' ').filter((w) => w.length > 3);
  let mejor = null;
  for (const k of INDICE) {
    let puntaje = 0;
    for (const clave of k.claves) {
      const c = normalizar(clave);
      if (t.includes(c)) puntaje += c.includes(' ') ? 3 : 2;
    }
    for (const w of palabras) if (k._texto.includes(w)) puntaje += 0.5;
    if (!mejor || puntaje > mejor.puntaje) mejor = { entrada: k, puntaje };
  }
  return mejor && mejor.puntaje >= 2 ? mejor : null;
}

/**
 * Interpreta un mensaje completo.
 * @returns {{intencion:string, confianza:number, items:Array, fecha:object|null, conocimiento:object|null, texto:string}}
 */
export function interpretar(texto, ctx = {}) {
  const t = normalizar(texto);
  const marcadas = PATRONES.filter(([, re]) => re.test(t)).map(([nombre]) => nombre);
  const items = extraerItems(texto);
  const encontrados = items.filter((i) => i.encontrado);
  const fecha = leerFecha(texto);
  const conocimiento = buscarConocimiento(texto);

  let intencion = 'desconocido';
  let confianza = 0.3;

  // Si el bot esta esperando una confirmacion, eso manda sobre todo lo demas.
  if (ctx.esperando === 'confirmacion' && (marcadas.includes('confirmar') || marcadas.includes('cancelar'))) {
    intencion = marcadas.includes('cancelar') && !marcadas.includes('confirmar') ? 'cancelar' : 'confirmar';
    return { intencion, confianza: 0.95, items, fecha, conocimiento, texto, marcadas };
  }
  if (ctx.esperando === 'fecha' && fecha) {
    return { intencion: 'fecha_entrega', confianza: 0.9, items, fecha, conocimiento, texto, marcadas };
  }

  const tiene = (n) => marcadas.includes(n);

  // Una pregunta tecnica fuerte ("que pegante uso para porcelanato") gana sobre
  // la coincidencia de producto: el cliente pide criterio, no precio.
  const esPregunta = /\?|^\s*(que|cual|como|cuando|por que|porque|se puede|puedo|sirve|conviene|debo|necesito saber)\b/.test(t);
  const conocimientoFuerte = conocimiento && conocimiento.puntaje >= 4;

  if (tiene('repetir')) { intencion = 'repetir'; confianza = 0.9; }
  else if (tiene('saldo')) { intencion = 'saldo'; confianza = 0.9; }
  else if (tiene('estado_pedido')) { intencion = 'estado_pedido'; confianza = 0.85; }
  else if (tiene('humano')) { intencion = 'humano'; confianza = 0.9; }
  else if (tiene('calcular')) { intencion = 'calcular'; confianza = 0.85; }
  else if (conocimientoFuerte && esPregunta && !tiene('pedido')) { intencion = 'asesoria'; confianza = 0.85; }
  else if (tiene('pedido') && encontrados.length) { intencion = 'pedido'; confianza = 0.9; }
  else if (tiene('precio') && encontrados.length) { intencion = 'precio'; confianza = 0.9; }
  else if (tiene('stock') && encontrados.length) { intencion = 'stock'; confianza = 0.85; }
  else if (encontrados.length && encontrados.some((i) => i.cantidadExplicita)) { intencion = 'pedido'; confianza = 0.7; }
  // Un saludo gana sobre una coincidencia floja de producto: "buenas tardes" no
  // es una consulta de precio solo porque "tardes" se parezca a alguna referencia.
  else if (tiene('saludo') && !encontrados.some((i) => i.puntaje >= 0.75)) { intencion = 'saludo'; confianza = 0.85; }
  else if (encontrados.some((i) => i.puntaje >= 0.62)) { intencion = 'precio'; confianza = 0.6; }
  else if (conocimiento && conocimiento.puntaje >= 3) { intencion = 'asesoria'; confianza = 0.75; }
  else if (tiene('catalogo')) { intencion = 'catalogo'; confianza = 0.8; }
  else if (tiene('ayuda')) { intencion = 'ayuda'; confianza = 0.8; }
  else if (tiene('saludo')) { intencion = 'saludo'; confianza = 0.85; }
  else if (tiene('gracias') || tiene('despedida')) { intencion = 'despedida'; confianza = 0.8; }
  else if (conocimiento) { intencion = 'asesoria'; confianza = 0.5; }

  return { intencion, confianza, items, fecha, conocimiento, texto, marcadas };
}
