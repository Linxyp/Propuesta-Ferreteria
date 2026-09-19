/**
 * MOTOR DE CALCULO DE MATERIALES
 *
 * Diez tipos de obra con formulas reales de construccion (NSR-10 / practica
 * colombiana). Cada calculo devuelve:
 *   - resumen        : magnitudes de la obra (area, volumen, etc.)
 *   - items          : SKU + cantidad exacta a comprar (redondeada a unidad de venta)
 *   - memoria        : el paso a paso, para que el cliente confie en el numero
 *   - manoObra       : estimado de rendimiento y costo de instalacion
 *   - advertencias   : avisos tecnicos (dilataciones, curado, impermeabilizacion)
 *
 * El motor NO conoce precios: solo cantidades. El cotizador les pone precio
 * segun el nivel del cliente. Asi la formula se puede auditar por separado.
 */
import { techo, redondear } from '../lib/util.mjs';

// ------------------------------------------------------------ constantes ---

/** Dosificaciones por m3 de concreto (bultos de 50 kg, m3 de agregado). */
const CONCRETO = {
  2500: { cemento: 6.5, arena: 0.56, triturado: 0.58, nombre: '2.500 psi (17,5 MPa)' },
  3000: { cemento: 7.5, arena: 0.52, triturado: 0.58, nombre: '3.000 psi (21 MPa)' },
  4000: { cemento: 9.0, arena: 0.48, triturado: 0.56, nombre: '4.000 psi (28 MPa)' },
};

/** Mortero 1:4 por m3: cemento en bultos de 50 kg y arena en m3. */
const MORTERO = { cemento: 7.5, arena: 1.05 };

/** Piezas de mamposteria: unidades/m2 y mortero de pega por m2 de muro. */
const PIEZAS = {
  'LAD-TOL-MAC': { nombre: 'Ladrillo tolete macizo 6x12x24', porM2: 52, morteroM3xM2: 0.021, espesor: 12 },
  'LAD-E4': { nombre: 'Ladrillo estructural No.4', porM2: 12.5, morteroM3xM2: 0.012, espesor: 12 },
  'LAD-E5': { nombre: 'Ladrillo estructural No.5', porM2: 12.5, morteroM3xM2: 0.013, espesor: 12 },
  'LAD-FAR': { nombre: 'Ladrillo farol 10x20x30', porM2: 15, morteroM3xM2: 0.014, espesor: 10 },
  'BLO-CON-15': { nombre: 'Bloque concreto 15x20x40', porM2: 11.5, morteroM3xM2: 0.013, espesor: 15 },
  'BLO-CON-20': { nombre: 'Bloque concreto 20x20x40', porM2: 11.5, morteroM3xM2: 0.016, espesor: 20 },
};

/** Formatos de enchape: m2 por caja y consumo de pegante. */
const FORMATOS = {
  'CER-PIS-45': { nombre: 'Ceramica piso 45x45', m2Caja: 1.5, peganteKgM2: 5, pegante: 'PEG-CER-25' },
  'CER-PAR-30': { nombre: 'Ceramica pared 30x60', m2Caja: 1.44, peganteKgM2: 5, pegante: 'PEG-CER-25' },
  'POR-60': { nombre: 'Porcelanato 60x60', m2Caja: 1.44, peganteKgM2: 6.5, pegante: 'PEG-POR-25' },
};

const num = (v, def = 0) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : def;
};
const bool = (v) => v === true || v === 'true' || v === 'si' || v === 1 || v === '1';

const item = (sku, cantidad, motivo) => ({ sku, cantidad: techo(cantidad), motivo });

// ---------------------------------------------------------------- 1. muro ---
const muro = {
  id: 'muro',
  nombre: 'Muro en ladrillo o bloque',
  descripcion: 'Mamposteria con mortero de pega, con o sin panete.',
  unidadObra: 'm2',
  campos: [
    { id: 'largo', label: 'Largo del muro', tipo: 'number', unidad: 'm', def: 6, min: 0.5 },
    { id: 'alto', label: 'Altura del muro', tipo: 'number', unidad: 'm', def: 2.5, min: 0.5 },
    { id: 'vanos', label: 'Area de puertas y ventanas a descontar', tipo: 'number', unidad: 'm2', def: 0, min: 0 },
    {
      id: 'pieza', label: 'Tipo de pieza', tipo: 'select', def: 'LAD-TOL-MAC',
      opciones: Object.entries(PIEZAS).map(([v, p]) => ({ valor: v, texto: p.nombre })),
    },
    { id: 'panete', label: 'Incluir panete (revoque)', tipo: 'bool', def: true },
    { id: 'carasPanete', label: 'Caras a panetar', tipo: 'select', def: '2', opciones: [{ valor: '1', texto: '1 cara' }, { valor: '2', texto: '2 caras' }] },
    { id: 'desperdicio', label: 'Desperdicio', tipo: 'number', unidad: '%', def: 5, min: 0, max: 20 },
  ],
  calcular(e) {
    const largo = num(e.largo, 6), alto = num(e.alto, 2.5), vanos = num(e.vanos, 0);
    const desp = 1 + num(e.desperdicio, 5) / 100;
    const spec = PIEZAS[e.pieza] || PIEZAS['LAD-TOL-MAC'];
    const areaBruta = largo * alto;
    const area = Math.max(0, areaBruta - vanos);

    const piezas = area * spec.porM2 * desp;
    const morteroPega = area * spec.morteroM3xM2 * desp;

    const caras = bool(e.panete) ? Number(e.carasPanete || 2) : 0;
    const areaPanete = area * caras;
    const morteroPanete = areaPanete * 0.02 * 1.1; // 2 cm de espesor + 10% desperdicio

    const morteroTotal = morteroPega + morteroPanete;
    const cemento = morteroTotal * MORTERO.cemento;
    const arena = morteroTotal * MORTERO.arena;

    const items = [
      item(e.pieza || 'LAD-TOL-MAC', piezas, `${spec.porM2} und/m2 x ${redondear(area, 2)} m2 + ${num(e.desperdicio, 5)}% desperdicio`),
      item('CEM-GRIS-50', cemento, `${redondear(morteroTotal, 3)} m3 de mortero x ${MORTERO.cemento} bultos/m3`),
      item('ARE-RIO-M3', arena, `${redondear(morteroTotal, 3)} m3 de mortero x ${MORTERO.arena} m3 arena/m3`),
      item('HER-PAL-8', 1, 'Herramienta de pega'),
      item('HER-PLO', 1, 'Control de verticalidad'),
      item('HER-BAL-12', 2, 'Mezcla y transporte de mortero'),
    ];
    if (caras) items.push(item('HER-FLO', 1, 'Afinado del panete'));

    return {
      resumen: [
        { etiqueta: 'Area bruta del muro', valor: redondear(areaBruta, 2), unidad: 'm2' },
        { etiqueta: 'Area neta (menos vanos)', valor: redondear(area, 2), unidad: 'm2' },
        { etiqueta: 'Area de panete', valor: redondear(areaPanete, 2), unidad: 'm2' },
        { etiqueta: 'Mortero total', valor: redondear(morteroTotal, 3), unidad: 'm3' },
        { etiqueta: 'Espesor de muro', valor: spec.espesor, unidad: 'cm' },
      ],
      items,
      memoria: [
        `Area neta = (${largo} m x ${alto} m) - ${vanos} m2 de vanos = ${redondear(area, 2)} m2.`,
        `Piezas = ${redondear(area, 2)} m2 x ${spec.porM2} und/m2 x ${desp} (desperdicio) = ${techo(piezas)} und.`,
        `Mortero de pega = ${redondear(area, 2)} m2 x ${spec.morteroM3xM2} m3/m2 = ${redondear(morteroPega, 3)} m3.`,
        caras
          ? `Panete ${caras} cara(s) = ${redondear(areaPanete, 2)} m2 x 0,02 m de espesor + 10% = ${redondear(morteroPanete, 3)} m3.`
          : 'Sin panete.',
        `Cemento = ${redondear(morteroTotal, 3)} m3 x ${MORTERO.cemento} bultos/m3 = ${techo(cemento)} bultos.`,
        `Arena = ${redondear(morteroTotal, 3)} m3 x ${MORTERO.arena} = ${techo(arena)} m3.`,
      ],
      manoObra: { unidad: 'm2', cantidad: redondear(area, 2), valorUnit: 38000, rendimiento: '8 a 10 m2 por oficial/dia' },
      advertencias: [
        alto > 3 ? 'Muros de mas de 3 m requieren columneta de confinamiento cada 3,5 m (NSR-10).' : null,
        'Humedezca la pieza antes de pegar: evita que absorba el agua del mortero.',
      ].filter(Boolean),
    };
  },
};

// --------------------------------------------------------------- 2. placa ---
const placa = {
  id: 'placa',
  nombre: 'Placa o piso en concreto',
  descripcion: 'Losa de contrapiso, placa de entrepiso o anden.',
  unidadObra: 'm2',
  campos: [
    { id: 'largo', label: 'Largo', tipo: 'number', unidad: 'm', def: 5, min: 0.5 },
    { id: 'ancho', label: 'Ancho', tipo: 'number', unidad: 'm', def: 4, min: 0.5 },
    { id: 'espesor', label: 'Espesor', tipo: 'number', unidad: 'cm', def: 10, min: 5, max: 40 },
    {
      id: 'resistencia', label: 'Resistencia del concreto', tipo: 'select', def: '3000',
      opciones: Object.entries(CONCRETO).map(([v, c]) => ({ valor: v, texto: c.nombre })),
    },
    { id: 'malla', label: 'Incluir malla electrosoldada', tipo: 'bool', def: true },
    { id: 'desperdicio', label: 'Desperdicio', tipo: 'number', unidad: '%', def: 7, min: 0, max: 20 },
  ],
  calcular(e) {
    const largo = num(e.largo, 5), ancho = num(e.ancho, 4), esp = num(e.espesor, 10) / 100;
    const desp = 1 + num(e.desperdicio, 7) / 100;
    const dos = CONCRETO[String(e.resistencia)] || CONCRETO['3000'];
    const area = largo * ancho;
    const vol = area * esp * desp;

    const cemento = vol * dos.cemento;
    const arena = vol * dos.arena;
    const triturado = vol * dos.triturado;

    const items = [
      item('CEM-GRIS-50', cemento, `${redondear(vol, 2)} m3 x ${dos.cemento} bultos/m3`),
      item('ARE-LAV-M3', arena, `${redondear(vol, 2)} m3 x ${dos.arena}`),
      item('TRI-34-M3', triturado, `${redondear(vol, 2)} m3 x ${dos.triturado}`),
    ];
    let mallas = 0;
    if (bool(e.malla)) {
      mallas = area / 13.0; // 2,35 x 6 m menos traslapos
      items.push(item('MAL-ELE-60', mallas, `${redondear(area, 2)} m2 / 13 m2 utiles por malla`));
      items.push(item('ALA-NEG-KG', area * 0.05, 'Amarre de malla: 0,05 kg/m2'));
    }
    items.push(item('HER-FLO', 1, 'Afinado de superficie'));
    items.push(item('HER-CAR-BU', 1, 'Transporte de mezcla'));

    return {
      resumen: [
        { etiqueta: 'Area', valor: redondear(area, 2), unidad: 'm2' },
        { etiqueta: 'Volumen de concreto', valor: redondear(vol, 2), unidad: 'm3' },
        { etiqueta: 'Resistencia', valor: dos.nombre, unidad: '' },
        { etiqueta: 'Agua aproximada', valor: redondear(vol * 180, 0), unidad: 'L' },
      ],
      items,
      memoria: [
        `Volumen = ${largo} m x ${ancho} m x ${num(e.espesor, 10)} cm = ${redondear(area * esp, 3)} m3.`,
        `Con ${num(e.desperdicio, 7)}% de desperdicio => ${redondear(vol, 2)} m3.`,
        `Dosificacion ${dos.nombre}: ${dos.cemento} bultos + ${dos.arena} m3 arena + ${dos.triturado} m3 triturado por m3.`,
        bool(e.malla) ? `Malla = ${redondear(area, 2)} m2 / 13 m2 utiles = ${techo(mallas)} unidades.` : 'Sin refuerzo de malla.',
      ],
      manoObra: { unidad: 'm2', cantidad: redondear(area, 2), valorUnit: 45000, rendimiento: '25 a 35 m2 por cuadrilla/dia' },
      advertencias: [
        'Cure la placa con agua durante 7 dias: es lo que evita las fisuras.',
        area > 25 ? 'Deje juntas de dilatacion cada 4 a 5 m para controlar retraccion.' : null,
        num(e.espesor, 10) < 8 ? 'Espesores menores a 8 cm solo para pisos sin trafico vehicular.' : null,
      ].filter(Boolean),
    };
  },
};

// --------------------------------------------------------------- 3. enchape ---
const enchape = {
  id: 'enchape',
  nombre: 'Piso o enchape en ceramica',
  descripcion: 'Ceramica o porcelanato con pegante y boquilla.',
  unidadObra: 'm2',
  campos: [
    { id: 'largo', label: 'Largo del area', tipo: 'number', unidad: 'm', def: 4, min: 0.5 },
    { id: 'ancho', label: 'Ancho del area', tipo: 'number', unidad: 'm', def: 3, min: 0.5 },
    {
      id: 'formato', label: 'Formato', tipo: 'select', def: 'CER-PIS-45',
      opciones: Object.entries(FORMATOS).map(([v, f]) => ({ valor: v, texto: f.nombre })),
    },
    { id: 'guardaescoba', label: 'Metros de guardaescoba', tipo: 'number', unidad: 'ml', def: 0, min: 0 },
    { id: 'desperdicio', label: 'Desperdicio (cortes)', tipo: 'number', unidad: '%', def: 10, min: 5, max: 25 },
  ],
  calcular(e) {
    const largo = num(e.largo, 4), ancho = num(e.ancho, 3);
    const desp = 1 + num(e.desperdicio, 10) / 100;
    const f = FORMATOS[e.formato] || FORMATOS['CER-PIS-45'];
    const area = largo * ancho;
    const areaCompra = area * desp;
    const cajas = areaCompra / f.m2Caja;
    const pegante = (area * f.peganteKgM2) / 25;
    const boquilla = (area * 0.35) / 2;
    const guarda = num(e.guardaescoba, 0);

    const items = [
      item(e.formato || 'CER-PIS-45', cajas, `${redondear(areaCompra, 2)} m2 / ${f.m2Caja} m2 por caja`),
      item(f.pegante, pegante, `${f.peganteKgM2} kg/m2 en bultos de 25 kg`),
      item('BOQ-2', boquilla, '0,35 kg/m2 en presentacion de 2 kg'),
      item('HER-BOQ', 1, 'Aplicacion de boquilla'),
      item('HER-BAL-12', 1, 'Mezcla de pegante'),
      item('HER-DIS-7', Math.max(1, area / 25), 'Corte de piezas'),
      item('HER-NIV-60', 1, 'Control de nivel'),
    ];
    if (guarda > 0) items.push(item('GUA-CER-ML', guarda * 1.05, 'Guardaescoba + 5% de cortes'));

    return {
      resumen: [
        { etiqueta: 'Area util', valor: redondear(area, 2), unidad: 'm2' },
        { etiqueta: 'Area a comprar', valor: redondear(areaCompra, 2), unidad: 'm2' },
        { etiqueta: 'Cajas', valor: techo(cajas), unidad: 'caja' },
        { etiqueta: 'Pegante', valor: techo(pegante), unidad: 'bulto' },
      ],
      items,
      memoria: [
        `Area = ${largo} m x ${ancho} m = ${redondear(area, 2)} m2.`,
        `Con ${num(e.desperdicio, 10)}% por cortes => ${redondear(areaCompra, 2)} m2.`,
        `Cajas = ${redondear(areaCompra, 2)} / ${f.m2Caja} = ${techo(cajas)} cajas.`,
        `Pegante = ${redondear(area, 2)} m2 x ${f.peganteKgM2} kg/m2 / 25 kg = ${techo(pegante)} bultos.`,
        `Boquilla = ${redondear(area, 2)} m2 x 0,35 kg/m2 / 2 kg = ${techo(boquilla)} unidades.`,
      ],
      manoObra: { unidad: 'm2', cantidad: redondear(area, 2), valorUnit: 32000, rendimiento: '12 a 18 m2 por oficial/dia' },
      advertencias: [
        'Compre todas las cajas del mismo lote/tono: entre lotes hay diferencia de color.',
        e.formato === 'POR-60' ? 'El porcelanato exige pegante especifico; el pegacor comun se desprende.' : null,
      ].filter(Boolean),
    };
  },
};

// -------------------------------------------------------------- 4. pintura ---
const pintura = {
  id: 'pintura',
  nombre: 'Pintura de muros y techos',
  descripcion: 'Estuco, sellador y vinilo con rendimiento real por mano.',
  unidadObra: 'm2',
  campos: [
    { id: 'largo', label: 'Largo del espacio', tipo: 'number', unidad: 'm', def: 4, min: 0.5 },
    { id: 'ancho', label: 'Ancho del espacio', tipo: 'number', unidad: 'm', def: 3, min: 0.5 },
    { id: 'alto', label: 'Altura libre', tipo: 'number', unidad: 'm', def: 2.4, min: 1.5 },
    { id: 'vanos', label: 'Puertas y ventanas', tipo: 'number', unidad: 'm2', def: 3.5, min: 0 },
    { id: 'techo', label: 'Incluir techo', tipo: 'bool', def: true },
    { id: 'manos', label: 'Manos de pintura', tipo: 'number', unidad: 'manos', def: 2, min: 1, max: 4 },
    {
      id: 'tipo', label: 'Tipo de pintura', tipo: 'select', def: 'PIN-V1-GL',
      opciones: [
        { valor: 'PIN-V1-GL', texto: 'Vinilo tipo 1 lavable (galon)' },
        { valor: 'PIN-V3-GL', texto: 'Vinilo tipo 3 economico (galon)' },
      ],
    },
    { id: 'estuco', label: 'Incluir estuco', tipo: 'bool', def: true },
    { id: 'sellador', label: 'Incluir sellador', tipo: 'bool', def: true },
  ],
  calcular(e) {
    const largo = num(e.largo, 4), ancho = num(e.ancho, 3), alto = num(e.alto, 2.4);
    const vanos = num(e.vanos, 0), manos = Math.max(1, num(e.manos, 2));
    const areaMuros = Math.max(0, 2 * (largo + ancho) * alto - vanos);
    const areaTecho = bool(e.techo) ? largo * ancho : 0;
    const area = areaMuros + areaTecho;

    const rendimiento = e.tipo === 'PIN-V3-GL' ? 30 : 38; // m2 por galon por mano
    const galones = (area * manos) / rendimiento;
    const usarCunete = galones >= 5;

    const items = [];
    if (usarCunete) {
      const cunetes = Math.floor(galones / 5);
      const sueltos = galones - cunetes * 5;
      items.push(item('PIN-V1-CU', cunetes, `${techo(galones)} galones: conviene cunete de 5 gl`));
      if (sueltos > 0.1) items.push(item(e.tipo || 'PIN-V1-GL', sueltos, 'Galones sueltos restantes'));
    } else {
      items.push(item(e.tipo || 'PIN-V1-GL', galones, `${redondear(area, 2)} m2 x ${manos} manos / ${rendimiento} m2 por galon`));
    }

    let bultosEstuco = 0, galSellador = 0;
    if (bool(e.estuco)) {
      bultosEstuco = area / 12;
      items.push(item('EST-LIS-25', bultosEstuco, '1 bulto de 25 kg rinde 12 m2 a dos manos'));
      items.push(item('HER-FLO', 1, 'Aplicacion de estuco'));
    }
    if (bool(e.sellador)) {
      galSellador = area / 40;
      items.push(item('IMP-SEL-GL', galSellador, 'Sellador: 40 m2 por galon'));
    }
    items.push(item('HER-ROD-9', 1, 'Aplicacion en superficie amplia'));
    items.push(item('HER-BRO-4', 1, 'Remates y filos'));

    return {
      resumen: [
        { etiqueta: 'Area de muros', valor: redondear(areaMuros, 2), unidad: 'm2' },
        { etiqueta: 'Area de techo', valor: redondear(areaTecho, 2), unidad: 'm2' },
        { etiqueta: 'Area total', valor: redondear(area, 2), unidad: 'm2' },
        { etiqueta: 'Pintura necesaria', valor: redondear(galones, 2), unidad: 'galon' },
      ],
      items,
      memoria: [
        `Muros = 2 x (${largo} + ${ancho}) x ${alto} - ${vanos} m2 = ${redondear(areaMuros, 2)} m2.`,
        bool(e.techo) ? `Techo = ${largo} x ${ancho} = ${redondear(areaTecho, 2)} m2.` : 'Sin techo.',
        `Pintura = ${redondear(area, 2)} m2 x ${manos} manos / ${rendimiento} m2 por galon = ${redondear(galones, 2)} galones.`,
        bool(e.estuco) ? `Estuco = ${redondear(area, 2)} m2 / 12 m2 por bulto = ${techo(bultosEstuco)} bultos.` : 'Sin estuco.',
        bool(e.sellador) ? `Sellador = ${redondear(area, 2)} m2 / 40 = ${techo(galSellador)} galones.` : 'Sin sellador.',
      ],
      manoObra: { unidad: 'm2', cantidad: redondear(area, 2), valorUnit: 12000, rendimiento: '40 a 60 m2 por pintor/dia' },
      advertencias: [
        'El sellador no es opcional sobre estuco nuevo: sin el, la pintura se absorbe y pide una mano extra.',
        manos < 2 ? 'Con una sola mano casi nunca se logra cubrimiento parejo sobre color oscuro.' : null,
      ].filter(Boolean),
    };
  },
};

// -------------------------------------------------------------- 5. drywall ---
const drywall = {
  id: 'drywall',
  nombre: 'Muro o cielo raso en drywall',
  descripcion: 'Laminas, perfileria, tornilleria y acabado de juntas.',
  unidadObra: 'm2',
  campos: [
    { id: 'largo', label: 'Largo', tipo: 'number', unidad: 'm', def: 4, min: 0.5 },
    { id: 'alto', label: 'Alto (o ancho si es cielo)', tipo: 'number', unidad: 'm', def: 2.44, min: 0.5 },
    {
      id: 'tipo', label: 'Tipo de elemento', tipo: 'select', def: 'muro',
      opciones: [{ valor: 'muro', texto: 'Muro divisorio' }, { valor: 'cielo', texto: 'Cielo raso' }],
    },
    { id: 'dosCaras', label: 'Muro a dos caras', tipo: 'bool', def: true },
    { id: 'humedad', label: 'Zona humeda (lamina RH)', tipo: 'bool', def: false },
  ],
  calcular(e) {
    const largo = num(e.largo, 4), alto = num(e.alto, 2.44);
    const esMuro = (e.tipo || 'muro') === 'muro';
    const caras = esMuro && bool(e.dosCaras) ? 2 : 1;
    const area = largo * alto;
    const areaLamina = area * caras * 1.1; // 10% de desperdicio
    const laminas = areaLamina / 2.98;
    const skuLamina = bool(e.humedad) ? 'DRY-LAM-RH' : 'DRY-LAM-ST';

    const parales = esMuro ? largo / 0.61 + 1 : area / 1.2 / 0.61;
    const canales = esMuro ? (2 * largo) / 2.44 : (2 * largo) / 2.44 + (2 * alto) / 2.44;
    const tornillos = (area * caras * 25) / 1000;
    const masilla = (area * caras * 0.6) / 28;
    const cinta = (area * caras * 2.2) / 90;

    return {
      resumen: [
        { etiqueta: 'Area del elemento', valor: redondear(area, 2), unidad: 'm2' },
        { etiqueta: 'Caras a forrar', valor: caras, unidad: '' },
        { etiqueta: 'Area de lamina', valor: redondear(areaLamina, 2), unidad: 'm2' },
        { etiqueta: 'Laminas', valor: techo(laminas), unidad: 'und' },
      ],
      items: [
        item(skuLamina, laminas, `${redondear(areaLamina, 2)} m2 / 2,98 m2 por lamina`),
        item('DRY-PAR-89', parales, esMuro ? 'Un paral cada 0,61 m + remate' : 'Estructura de cielo cada 1,20 m'),
        item('DRY-CAN-89', canales, 'Canal superior e inferior'),
        item('DRY-TOR-1K', tornillos, '25 tornillos por m2, caja de 1.000'),
        item('DRY-MAS-28', masilla, '0,6 kg/m2 de masilla, presentacion 28 kg'),
        item('DRY-CIN-90', cinta, '2,2 ml de cinta por m2, rollo de 90 m'),
        item('HER-MET-5', 1, 'Trazado y modulacion'),
        item('HER-NIV-60', 1, 'Aplome de perfileria'),
      ],
      memoria: [
        `Area = ${largo} m x ${alto} m = ${redondear(area, 2)} m2 (${caras} cara/s).`,
        `Laminas = ${redondear(area, 2)} x ${caras} x 1,10 / 2,98 m2 = ${techo(laminas)} und.`,
        esMuro ? `Parales = ${largo} m / 0,61 m + 1 = ${techo(parales)} und.` : `Estructura = ${redondear(area, 2)} m2 modulada a 1,20 x 0,61 m.`,
        `Tornillos = ${redondear(area * caras, 2)} m2 x 25 = ${techo(area * caras * 25)} und (${techo(tornillos)} caja/s).`,
      ],
      manoObra: { unidad: 'm2', cantidad: redondear(area, 2), valorUnit: 48000, rendimiento: '10 a 14 m2 por cuadrilla/dia' },
      advertencias: [
        bool(e.humedad) ? 'Lamina RH en banos y cocinas: la estandar se pandea con la humedad.' : 'En banos y cocinas cambie a lamina RH.',
        'Las juntas piden tres manos de masilla con lijado intermedio; sin eso se marcan con la pintura.',
      ],
    };
  },
};

// ------------------------------------------------------- 6. columnas/vigas ---
const estructura = {
  id: 'estructura',
  nombre: 'Columnas y vigas en concreto',
  descripcion: 'Concreto y acero de refuerzo con estribos.',
  unidadObra: 'ml',
  campos: [
    {
      id: 'elemento', label: 'Elemento', tipo: 'select', def: 'columna',
      opciones: [{ valor: 'columna', texto: 'Columna' }, { valor: 'viga', texto: 'Viga' }],
    },
    { id: 'cantidad', label: 'Cantidad de elementos', tipo: 'number', unidad: 'und', def: 4, min: 1 },
    { id: 'largo', label: 'Largo de cada uno', tipo: 'number', unidad: 'm', def: 2.6, min: 0.3 },
    { id: 'b', label: 'Seccion: base', tipo: 'number', unidad: 'cm', def: 25, min: 10 },
    { id: 'h', label: 'Seccion: altura', tipo: 'number', unidad: 'cm', def: 25, min: 10 },
    {
      id: 'refuerzo', label: 'Refuerzo longitudinal', tipo: 'select', def: '4-38',
      opciones: [
        { valor: '4-38', texto: '4 varillas de 3/8"' },
        { valor: '4-12', texto: '4 varillas de 1/2"' },
        { valor: '6-12', texto: '6 varillas de 1/2"' },
      ],
    },
    { id: 'estribos', label: 'Estribos cada', tipo: 'number', unidad: 'cm', def: 15, min: 7, max: 30 },
    {
      id: 'resistencia', label: 'Resistencia', tipo: 'select', def: '3000',
      opciones: Object.entries(CONCRETO).map(([v, c]) => ({ valor: v, texto: c.nombre })),
    },
  ],
  calcular(e) {
    const cant = Math.max(1, num(e.cantidad, 4));
    const largo = num(e.largo, 2.6);
    const b = num(e.b, 25) / 100, h = num(e.h, 25) / 100;
    const sep = num(e.estribos, 15) / 100;
    const dos = CONCRETO[String(e.resistencia)] || CONCRETO['3000'];

    const mlTotal = cant * largo;
    const vol = mlTotal * b * h * 1.07;
    const [nBarras, calibre] = (e.refuerzo || '4-38').split('-');
    const skuBarra = calibre === '12' ? 'ACE-12' : 'ACE-38';
    const largoBarra = largo + 0.5; // traslapo/anclaje
    const barras = (cant * Number(nBarras) * largoBarra) / 6;

    const perimEstribo = 2 * (b - 0.05 + (h - 0.05)) + 0.2;
    const numEstribos = cant * (Math.floor(largo / sep) + 1);
    const mlEstribo = numEstribos * perimEstribo;
    const barrasEstribo = mlEstribo / 6;
    const alambre = numEstribos * 0.035;

    return {
      resumen: [
        { etiqueta: 'Metros lineales', valor: redondear(mlTotal, 2), unidad: 'ml' },
        { etiqueta: 'Volumen de concreto', valor: redondear(vol, 3), unidad: 'm3' },
        { etiqueta: 'Estribos', valor: numEstribos, unidad: 'und' },
        { etiqueta: 'Seccion', valor: `${num(e.b, 25)} x ${num(e.h, 25)}`, unidad: 'cm' },
      ],
      items: [
        item('CEM-GRIS-50', vol * dos.cemento, `${redondear(vol, 3)} m3 x ${dos.cemento} bultos/m3`),
        item('ARE-LAV-M3', vol * dos.arena, 'Arena para concreto'),
        item('TRI-34-M3', vol * dos.triturado, 'Triturado para concreto'),
        item(skuBarra, barras, `${nBarras} barras x ${cant} elementos x ${redondear(largoBarra, 2)} m / 6 m`),
        item('ACE-14', barrasEstribo, `${numEstribos} estribos x ${redondear(perimEstribo, 2)} m / 6 m`),
        item('ALA-NEG-KG', alambre, '0,035 kg de alambre por estribo'),
        item('HER-BAL-12', 2, 'Vaciado de concreto'),
      ],
      memoria: [
        `Volumen = ${cant} und x ${largo} m x ${num(e.b, 25)}/100 x ${num(e.h, 25)}/100 x 1,07 = ${redondear(vol, 3)} m3.`,
        `Refuerzo longitudinal = ${cant} x ${nBarras} x ${redondear(largoBarra, 2)} m = ${redondear(cant * Number(nBarras) * largoBarra, 2)} ml => ${techo(barras)} varillas de 6 m.`,
        `Estribos = ${Math.floor(largo / sep) + 1} por elemento x ${cant} = ${numEstribos} und; perimetro ${redondear(perimEstribo, 2)} m c/u.`,
      ],
      manoObra: { unidad: 'ml', cantidad: redondear(mlTotal, 2), valorUnit: 120000, rendimiento: '6 a 9 ml por cuadrilla/dia' },
      advertencias: [
        'Recubrimiento minimo de 4 cm entre el acero y la formaleta (NSR-10).',
        sep > 0.2 ? 'Estribos a mas de 20 cm: revise con su ingeniero, en zona confinada suele exigirse 10 cm.' : null,
      ].filter(Boolean),
    };
  },
};

// -------------------------------------------------------------- 7. cubierta ---
const cubierta = {
  id: 'cubierta',
  nombre: 'Cubierta o techo',
  descripcion: 'Teja, correas y tornilleria con correccion por pendiente.',
  unidadObra: 'm2',
  campos: [
    { id: 'largo', label: 'Largo en planta', tipo: 'number', unidad: 'm', def: 8, min: 1 },
    { id: 'ancho', label: 'Ancho en planta', tipo: 'number', unidad: 'm', def: 5, min: 1 },
    { id: 'pendiente', label: 'Pendiente', tipo: 'number', unidad: '%', def: 25, min: 5, max: 100 },
    {
      id: 'teja', label: 'Tipo de teja', tipo: 'select', def: 'TEJ-ZIN-30',
      opciones: [
        { valor: 'TEJ-ZIN-30', texto: 'Zinc calibre 35 - 3,0 m' },
        { valor: 'TEJ-ETE-305', texto: 'Fibrocemento 3,05 m' },
      ],
    },
    { id: 'traslucidas', label: 'Tejas traslucidas', tipo: 'number', unidad: 'und', def: 2, min: 0 },
    {
      id: 'estructura', label: 'Estructura', tipo: 'select', def: 'madera',
      opciones: [{ valor: 'madera', texto: 'Madera 2x4' }, { valor: 'metalica', texto: 'Perfil C metalico' }],
    },
  ],
  calcular(e) {
    const largo = num(e.largo, 8), ancho = num(e.ancho, 5), p = num(e.pendiente, 25) / 100;
    const factor = Math.sqrt(1 + p * p);
    const areaPlanta = largo * ancho;
    const areaReal = areaPlanta * factor;
    const utilTeja = e.teja === 'TEJ-ETE-305' ? 2.67 : 2.28;
    const tejas = (areaReal * 1.08) / utilTeja;
    const traslucidas = num(e.traslucidas, 0);

    const filas = Math.floor((ancho * factor) / 0.9) + 1;
    const esMadera = (e.estructura || 'madera') === 'madera';
    const correas = esMadera ? filas * Math.ceil(largo / 3) : filas * Math.ceil(largo / 6);
    const tornillos = (tejas + traslucidas) * 8 / 100;

    const items = [
      item(e.teja || 'TEJ-ZIN-30', Math.max(0, tejas - traslucidas * (utilTeja / 1.6)), `${redondear(areaReal, 2)} m2 reales / ${utilTeja} m2 utiles por teja + 8%`),
      item(esMadera ? 'MAD-2X4-3M' : 'PER-C-80', correas, `${filas} filas de correa cada 0,90 m`),
      item('TOR-TEJ-100', tornillos, '8 tornillos por teja, caja de 100'),
      item('HER-MET-5', 1, 'Trazado de correas'),
    ];
    if (traslucidas > 0) items.push(item('TEJ-TRA-20', traslucidas, 'Iluminacion natural solicitada'));

    return {
      resumen: [
        { etiqueta: 'Area en planta', valor: redondear(areaPlanta, 2), unidad: 'm2' },
        { etiqueta: 'Factor de pendiente', valor: redondear(factor, 3), unidad: 'x' },
        { etiqueta: 'Area real de cubierta', valor: redondear(areaReal, 2), unidad: 'm2' },
        { etiqueta: 'Filas de correa', valor: filas, unidad: '' },
      ],
      items,
      memoria: [
        `Factor de pendiente = raiz(1 + ${p}^2) = ${redondear(factor, 3)}.`,
        `Area real = ${redondear(areaPlanta, 2)} m2 x ${redondear(factor, 3)} = ${redondear(areaReal, 2)} m2.`,
        `Tejas = ${redondear(areaReal, 2)} x 1,08 (traslapos) / ${utilTeja} m2 utiles = ${techo(tejas)} und.`,
        `Correas cada 0,90 m => ${filas} filas.`,
      ],
      manoObra: { unidad: 'm2', cantidad: redondear(areaReal, 2), valorUnit: 35000, rendimiento: '20 a 30 m2 por cuadrilla/dia' },
      advertencias: [
        p < 0.15 ? 'Pendiente menor al 15%: alto riesgo de filtracion por capilaridad en los traslapos.' : null,
        'Traslape lateral minimo de una onda y 15 cm en el sentido de la pendiente.',
      ].filter(Boolean),
    };
  },
};

// ---------------------------------------------------------------- 8. panete ---
const panete = {
  id: 'panete',
  nombre: 'Panete o revoque',
  descripcion: 'Solo el mortero de revoque sobre muros existentes.',
  unidadObra: 'm2',
  campos: [
    { id: 'area', label: 'Area a panetar', tipo: 'number', unidad: 'm2', def: 30, min: 1 },
    { id: 'espesor', label: 'Espesor', tipo: 'number', unidad: 'cm', def: 2, min: 1, max: 4 },
    { id: 'desperdicio', label: 'Desperdicio', tipo: 'number', unidad: '%', def: 10, min: 0, max: 25 },
  ],
  calcular(e) {
    const area = num(e.area, 30), esp = num(e.espesor, 2) / 100;
    const desp = 1 + num(e.desperdicio, 10) / 100;
    const vol = area * esp * desp;
    return {
      resumen: [
        { etiqueta: 'Area', valor: redondear(area, 2), unidad: 'm2' },
        { etiqueta: 'Volumen de mortero', valor: redondear(vol, 3), unidad: 'm3' },
      ],
      items: [
        item('CEM-GRIS-50', vol * MORTERO.cemento, `${redondear(vol, 3)} m3 x ${MORTERO.cemento} bultos/m3`),
        item('ARE-RIO-M3', vol * MORTERO.arena, 'Arena de panete'),
        item('HER-FLO', 1, 'Afinado'),
        item('HER-PAL-8', 1, 'Aplicacion'),
        item('HER-BAL-12', 2, 'Mezcla'),
      ],
      memoria: [
        `Volumen = ${area} m2 x ${num(e.espesor, 2)} cm x ${desp} = ${redondear(vol, 3)} m3.`,
        `Mortero 1:4 => ${MORTERO.cemento} bultos y ${MORTERO.arena} m3 de arena por m3.`,
      ],
      manoObra: { unidad: 'm2', cantidad: redondear(area, 2), valorUnit: 22000, rendimiento: '12 a 16 m2 por oficial/dia' },
      advertencias: ['Deje 24 horas entre el panete y el estuco para evitar fisuras de retraccion.'],
    };
  },
};

// ----------------------------------------------------------- 9. cimentacion ---
const cimentacion = {
  id: 'cimentacion',
  nombre: 'Cimentacion: zapatas y vigas',
  descripcion: 'Zapatas aisladas y viga de amarre con su refuerzo.',
  unidadObra: 'm3',
  campos: [
    { id: 'zapatas', label: 'Numero de zapatas', tipo: 'number', unidad: 'und', def: 6, min: 0 },
    { id: 'zLado', label: 'Lado de zapata', tipo: 'number', unidad: 'm', def: 1, min: 0.4 },
    { id: 'zAlto', label: 'Espesor de zapata', tipo: 'number', unidad: 'm', def: 0.3, min: 0.2 },
    { id: 'vigaMl', label: 'Metros de viga de amarre', tipo: 'number', unidad: 'ml', def: 24, min: 0 },
    { id: 'vigaB', label: 'Viga: base', tipo: 'number', unidad: 'cm', def: 25, min: 15 },
    { id: 'vigaH', label: 'Viga: altura', tipo: 'number', unidad: 'cm', def: 30, min: 15 },
    {
      id: 'resistencia', label: 'Resistencia', tipo: 'select', def: '3000',
      opciones: Object.entries(CONCRETO).map(([v, c]) => ({ valor: v, texto: c.nombre })),
    },
  ],
  calcular(e) {
    const nz = num(e.zapatas, 6), lado = num(e.zLado, 1), zAlto = num(e.zAlto, 0.3);
    const vigaMl = num(e.vigaMl, 24), vb = num(e.vigaB, 25) / 100, vh = num(e.vigaH, 30) / 100;
    const dos = CONCRETO[String(e.resistencia)] || CONCRETO['3000'];

    const volZapatas = nz * lado * lado * zAlto;
    const volViga = vigaMl * vb * vh;
    const vol = (volZapatas + volViga) * 1.08;

    const parrillaMl = nz * 2 * (Math.floor(lado / 0.15) + 1) * lado;
    const barrasParrilla = parrillaMl / 6;
    const barrasViga = (vigaMl * 4 * 1.1) / 6;
    const estribosViga = Math.floor(vigaMl / 0.2) + 1;
    const barrasEstribo = (estribosViga * (2 * (vb - 0.05 + (vh - 0.05)) + 0.2)) / 6;

    return {
      resumen: [
        { etiqueta: 'Volumen zapatas', valor: redondear(volZapatas, 3), unidad: 'm3' },
        { etiqueta: 'Volumen viga', valor: redondear(volViga, 3), unidad: 'm3' },
        { etiqueta: 'Concreto total (+8%)', valor: redondear(vol, 2), unidad: 'm3' },
        { etiqueta: 'Estribos de viga', valor: estribosViga, unidad: 'und' },
      ],
      items: [
        item('CEM-GRIS-50', vol * dos.cemento, `${redondear(vol, 2)} m3 x ${dos.cemento} bultos/m3`),
        item('ARE-LAV-M3', vol * dos.arena, 'Arena para concreto'),
        item('TRI-34-M3', vol * dos.triturado, 'Triturado para concreto'),
        item('ACE-12', barrasParrilla + barrasViga, 'Parrilla de zapatas + refuerzo longitudinal de viga'),
        item('ACE-14', barrasEstribo, `${estribosViga} estribos de viga cada 20 cm`),
        item('ALA-NEG-KG', (estribosViga + nz * 8) * 0.035, 'Amarres'),
        item('HER-CAR-BU', 1, 'Transporte de concreto'),
      ],
      memoria: [
        `Zapatas = ${nz} x ${lado} m x ${lado} m x ${zAlto} m = ${redondear(volZapatas, 3)} m3.`,
        `Viga = ${vigaMl} ml x ${num(e.vigaB, 25)}/100 x ${num(e.vigaH, 30)}/100 = ${redondear(volViga, 3)} m3.`,
        `Total con 8% de desperdicio = ${redondear(vol, 2)} m3.`,
        `Parrilla = ${redondear(parrillaMl, 1)} ml de varilla de 1/2".`,
      ],
      manoObra: { unidad: 'm3', cantidad: redondear(vol, 2), valorUnit: 95000, rendimiento: '2 a 3 m3 por cuadrilla/dia' },
      advertencias: [
        'Verifique la capacidad portante del suelo antes de dimensionar zapatas: esto es un predimensionamiento, no un diseno estructural.',
        'Use solado de limpieza de 5 cm antes de armar el acero.',
      ],
    };
  },
};

// ---------------------------------------------------------------- 10. red ---
const electrico = {
  id: 'electrico',
  nombre: 'Instalacion electrica basica',
  descripcion: 'Puntos de toma, iluminacion e interruptores con su canalizacion.',
  unidadObra: 'punto',
  campos: [
    { id: 'tomas', label: 'Puntos de toma', tipo: 'number', unidad: 'und', def: 12, min: 0 },
    { id: 'luces', label: 'Puntos de iluminacion', tipo: 'number', unidad: 'und', def: 8, min: 0 },
    { id: 'interruptores', label: 'Interruptores', tipo: 'number', unidad: 'und', def: 8, min: 0 },
    { id: 'distancia', label: 'Distancia promedio al tablero', tipo: 'number', unidad: 'm', def: 9, min: 2 },
    { id: 'bombillos', label: 'Incluir bombillos LED', tipo: 'bool', def: true },
  ],
  calcular(e) {
    const tomas = num(e.tomas, 12), luces = num(e.luces, 8);
    const inter = num(e.interruptores, 8), dist = num(e.distancia, 9);

    const mlCable12 = tomas * dist * 3 * 1.1;
    const mlCable14 = (luces * dist * 2 + inter * 4) * 1.1;
    const rollos12 = mlCable12 / 100;
    const rollos14 = mlCable14 / 100;
    const mlTubo = (tomas + luces) * dist * 1.05;
    const tubos = mlTubo / 3;
    const cajas = tomas + luces + inter;
    const breakers = Math.ceil((tomas + luces) / 8) + 1;

    const items = [
      item('CAB-12-100', rollos12, `${redondear(mlCable12, 0)} m de cable #12 (fase, neutro, tierra)`),
      item('CAB-14-100', rollos14, `${redondear(mlCable14, 0)} m de cable #14 para iluminacion`),
      item('TUB-CON-12', tubos, `${redondear(mlTubo, 0)} m de canalizacion / 3 m por tubo`),
      item('CAJ-2X4', cajas, 'Una caja por punto'),
      item('TOM-DOB', tomas, 'Tomas dobles con polo a tierra'),
      item('INT-SEN', inter, 'Interruptores sencillos'),
      item('BRE-20A', breakers, 'Un breaker por circuito de 8 puntos + reserva'),
      item('CIN-TEF', 1, 'Sellado y marcacion'),
    ];
    if (bool(e.bombillos)) items.push(item('BOM-LED-9', luces, 'Bombillo LED por punto de luz'));

    return {
      resumen: [
        { etiqueta: 'Puntos totales', valor: tomas + luces + inter, unidad: 'und' },
        { etiqueta: 'Cable #12', valor: redondear(mlCable12, 0), unidad: 'm' },
        { etiqueta: 'Cable #14', valor: redondear(mlCable14, 0), unidad: 'm' },
        { etiqueta: 'Circuitos', valor: breakers - 1, unidad: '' },
      ],
      items,
      memoria: [
        `Cable #12 = ${tomas} tomas x ${dist} m x 3 hilos x 1,10 = ${redondear(mlCable12, 0)} m.`,
        `Cable #14 = (${luces} luces x ${dist} m x 2 + ${inter} x 4) x 1,10 = ${redondear(mlCable14, 0)} m.`,
        `Canalizacion = ${redondear(mlTubo, 0)} m => ${techo(tubos)} tubos de 3 m.`,
        `Circuitos = 1 por cada 8 puntos => ${breakers - 1} + 1 de reserva.`,
      ],
      manoObra: { unidad: 'punto', cantidad: tomas + luces + inter, valorUnit: 55000, rendimiento: '6 a 10 puntos por tecnico/dia' },
      advertencias: [
        'Instalacion sujeta a RETIE: la debe ejecutar y certificar un tecnico con matricula.',
        'Tomas de cocina y bano en circuito independiente con proteccion diferencial.',
      ],
    };
  },
};

// ---------------------------------------------------------------- registro ---
export const OBRAS = [muro, placa, enchape, pintura, drywall, estructura, cubierta, panete, cimentacion, electrico];
export const porObra = Object.fromEntries(OBRAS.map((o) => [o.id, o]));

/** Metadatos para pintar el formulario en el front sin exponer las formulas. */
export function catalogoObras() {
  return OBRAS.map(({ id, nombre, descripcion, unidadObra, campos }) => ({
    id, nombre, descripcion, unidadObra, campos,
  }));
}

/**
 * Ejecuta un calculo validando la obra.
 *
 * Separa materiales de herramienta: el total de la obra no debe inflarse con una
 * carretilla que el maestro probablemente ya tiene. La herramienta se devuelve
 * aparte para ofrecerla como sugerencia, no como obligacion.
 */
export function calcular(obraId, entrada = {}) {
  const obra = porObra[obraId];
  if (!obra) throw Object.assign(new Error(`Tipo de obra desconocido: ${obraId}`), { status: 400 });

  // Completa los campos que el llamador no envio con el valor por defecto
  // declarado en el formulario: una llamada parcial nunca debe perder la malla
  // de la placa ni el panete del muro por omision.
  const completa = { ...entrada };
  for (const campo of obra.campos) {
    if (completa[campo.id] === undefined || completa[campo.id] === null || completa[campo.id] === '') {
      completa[campo.id] = campo.def;
    }
  }

  const r = obra.calcular(completa);
  entrada = completa;
  const validos = r.items.filter((i) => i.cantidad > 0);
  return {
    obra: { id: obra.id, nombre: obra.nombre, unidadObra: obra.unidadObra },
    entrada,
    ...r,
    items: validos.filter((i) => !i.sku.startsWith('HER-')),
    herramientas: validos.filter((i) => i.sku.startsWith('HER-')),
  };
}
