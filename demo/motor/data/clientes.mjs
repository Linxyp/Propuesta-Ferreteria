/**
 * Clientes fijos (B2B) + niveles de precio.
 * El "nivel" define el descuento automatico que aplica el cotizador, el portal
 * y el bot de WhatsApp. El cupo de credito bloquea pedidos que excedan la cartera.
 */

export const NIVELES = {
  mostrador: { nombre: 'Mostrador', descuento: 0, color: '#64748b' },
  constructor: { nombre: 'Constructor', descuento: 0.06, color: '#0891b2' },
  mayorista: { nombre: 'Mayorista', descuento: 0.12, color: '#7c3aed' },
  aliado: { nombre: 'Aliado estrategico', descuento: 0.18, color: '#c2410c' },
};

export const CLIENTES = [
  {
    id: 'C-001',
    nombre: 'Constructora Vallejo S.A.S.',
    contacto: 'Ing. Marcela Vallejo',
    nit: '901.245.882-1',
    whatsapp: '+57 310 555 0142',
    email: 'compras@vallejo.com.co',
    nivel: 'aliado',
    cupoCredito: 28000000,
    plazoDias: 30,
    saldoCartera: 9450000,
    direccion: 'Cra 45 #22-18, Bodega 3',
    obras: ['Torre Miramonte - etapa 2', 'Bodega industrial Km 4'],
    pin: '1425',
    frecuencia: 'semanal',
    skusHabituales: ['CEM-GRIS-50', 'ARE-LAV-M3', 'TRI-34-M3', 'ACE-38', 'ACE-12', 'ALA-NEG-KG'],
  },
  {
    id: 'C-002',
    nombre: 'Remodelaciones El Roble',
    contacto: 'Jhon Fredy Ospina',
    nit: '79.882.145-3',
    whatsapp: '+57 320 555 0198',
    email: 'elroble.obras@gmail.com',
    nivel: 'mayorista',
    cupoCredito: 9000000,
    plazoDias: 15,
    saldoCartera: 2380000,
    direccion: 'Calle 12 #8-40',
    obras: ['Apto 501 Conjunto La Ceiba'],
    pin: '2210',
    frecuencia: 'quincenal',
    skusHabituales: ['CER-PIS-45', 'PEG-CER-25', 'BOQ-2', 'EST-LIS-25', 'PIN-V1-GL'],
  },
  {
    id: 'C-003',
    nombre: 'Maestro Hernan Quiroga',
    contacto: 'Hernan Quiroga',
    nit: '15.442.901-7',
    whatsapp: '+57 313 555 0077',
    email: '',
    nivel: 'constructor',
    cupoCredito: 3500000,
    plazoDias: 8,
    saldoCartera: 640000,
    direccion: 'Barrio San Jose, Mz D casa 7',
    obras: ['Casa 2 pisos Villa Luz'],
    pin: '0704',
    frecuencia: 'semanal',
    skusHabituales: ['CEM-GRIS-50', 'LAD-TOL-MAC', 'ARE-RIO-M3', 'MOR-SEC-40'],
  },
  {
    id: 'C-004',
    nombre: 'Drywall & Acabados JM',
    contacto: 'Julian Marroquin',
    nit: '900.774.120-9',
    whatsapp: '+57 300 555 0311',
    email: 'jm.acabados@outlook.com',
    nivel: 'mayorista',
    cupoCredito: 12000000,
    plazoDias: 21,
    saldoCartera: 4120000,
    direccion: 'Av. Industrial #90-12',
    obras: ['Oficinas Centro Empresarial', 'Clinica Santa Ana piso 3'],
    pin: '3388',
    frecuencia: 'semanal',
    skusHabituales: ['DRY-LAM-ST', 'DRY-PAR-89', 'DRY-CAN-89', 'DRY-TOR-1K', 'DRY-MAS-28', 'DRY-CIN-90'],
  },
  {
    id: 'C-005',
    nombre: 'Inversiones Hogar Nuevo',
    contacto: 'Diana Cardenas',
    nit: '901.010.445-2',
    whatsapp: '+57 318 555 0264',
    email: 'dcardenas@hogarnuevo.co',
    nivel: 'constructor',
    cupoCredito: 6000000,
    plazoDias: 15,
    saldoCartera: 0,
    direccion: 'Cra 9 #33-20 of 402',
    obras: ['Proyecto 6 casas Villa Sol'],
    pin: '5519',
    frecuencia: 'mensual',
    skusHabituales: ['BLO-CON-15', 'CEM-GRIS-50', 'MAL-ELE-60', 'TUB-PVC-12'],
  },
  {
    id: 'C-006',
    nombre: 'Electricos del Norte Ltda.',
    contacto: 'Oscar Beltran',
    nit: '830.221.554-6',
    whatsapp: '+57 315 555 0420',
    email: 'compras@electricosnorte.com',
    nivel: 'mayorista',
    cupoCredito: 10000000,
    plazoDias: 30,
    saldoCartera: 3150000,
    direccion: 'Calle 68 #14-55',
    obras: ['Redes conjunto Portal del Rio'],
    pin: '6642',
    frecuencia: 'quincenal',
    skusHabituales: ['CAB-12-100', 'CAB-14-100', 'TUB-CON-12', 'TOM-DOB', 'BRE-20A', 'CAJ-2X4'],
  },
  {
    id: 'C-007',
    nombre: 'Pinturas y Fachadas LP',
    contacto: 'Luis Alberto Pena',
    nit: '17.554.203-8',
    whatsapp: '+57 312 555 0505',
    email: '',
    nivel: 'constructor',
    cupoCredito: 4500000,
    plazoDias: 15,
    saldoCartera: 890000,
    direccion: 'Diagonal 5 #11-09',
    obras: ['Fachada Edificio Almendros'],
    pin: '7731',
    frecuencia: 'quincenal',
    skusHabituales: ['PIN-V1-CU', 'EST-LIS-25', 'IMP-SEL-GL', 'HER-ROD-9', 'HER-BRO-4'],
  },
  {
    id: 'C-008',
    nombre: 'Alcaldia - Secretaria de Obras',
    contacto: 'Arq. Paola Rincon',
    nit: '890.999.001-4',
    whatsapp: '+57 601 555 0900',
    email: 'obras@alcaldia.gov.co',
    nivel: 'aliado',
    cupoCredito: 40000000,
    plazoDias: 45,
    saldoCartera: 15200000,
    direccion: 'Plaza principal, Palacio Municipal',
    obras: ['Mantenimiento colegios', 'Parque lineal fase 1'],
    pin: '8890',
    frecuencia: 'mensual',
    skusHabituales: ['CEM-GRIS-50', 'ADO-VEH', 'PIN-V3-GL', 'TUB-SAN-4', 'REC-M3'],
  },
];

export const porId = Object.fromEntries(CLIENTES.map((c) => [c.id, c]));

/** Normaliza un numero de WhatsApp a solo digitos para hacer match. */
export const soloDigitos = (v) => String(v || '').replace(/\D/g, '');

export function clientePorWhatsapp(numero) {
  const d = soloDigitos(numero);
  if (!d) return null;
  return (
    CLIENTES.find((c) => {
      const cd = soloDigitos(c.whatsapp);
      return cd.endsWith(d.slice(-10)) || d.endsWith(cd.slice(-10));
    }) || null
  );
}

export function descuentoDe(cliente) {
  if (!cliente) return 0;
  return NIVELES[cliente.nivel]?.descuento ?? 0;
}

/**
 * Tope de descuento por categoria.
 *
 * Ninguna ferreteria da 18% sobre cemento: el cemento se vende casi a costo y
 * lo que deja plata es la herramienta, la pintura y el material electrico. El
 * sistema aplica el descuento del nivel PERO nunca por encima del tope de la
 * categoria, que es exactamente la regla que un buen vendedor lleva en la
 * cabeza y que se pierde cuando cada asesor cotiza a su criterio.
 */
export const TOPE_DESCUENTO = {
  'cemento-agregados': 0.05,
  'acero': 0.05,
  'mamposteria': 0.07,
  'cubiertas': 0.08,
  'ceramica': 0.10,
  'drywall': 0.10,
  'adhesivos': 0.12,
  'pinturas': 0.14,
  'plomeria': 0.15,
  'electrico': 0.15,
  'herramientas': 0.20,
};

/** Descuento que realmente aplica a una linea: el menor entre nivel y tope. */
export function descuentoEfectivo(cliente, categoria) {
  const nivel = descuentoDe(cliente);
  const tope = TOPE_DESCUENTO[categoria];
  return tope === undefined ? nivel : Math.min(nivel, tope);
}
