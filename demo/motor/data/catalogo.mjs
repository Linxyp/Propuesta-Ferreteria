/**
 * Catalogo maestro de la ferreteria.
 * Cada fila: [sku, nombre, categoria, unidad, precioLista, costo, stock, stockMin, marca, sinonimos]
 * Precios en COP. El costo alimenta margen, valorizacion de inventario y estado de resultados.
 */
const FILAS = [
  // --- Cemento, agregados y morteros ---
  ['CEM-GRIS-50', 'Cemento gris uso general 50 kg', 'cemento-agregados', 'bulto', 32500, 27300, 180, 60, 'Argos', 'cemento,bulto de cemento,cemento gris'],
  ['CEM-BLANCO-25', 'Cemento blanco 25 kg', 'cemento-agregados', 'bulto', 48000, 40320, 22, 8, 'Argos', 'cemento blanco'],
  ['ARE-LAV-M3', 'Arena lavada de pena', 'cemento-agregados', 'm3', 95000, 79800, 34, 10, 'Cantera', 'arena,arena lavada'],
  ['ARE-RIO-M3', 'Arena de rio', 'cemento-agregados', 'm3', 88000, 73920, 26, 10, 'Cantera', 'arena de rio,arena gruesa'],
  ['TRI-34-M3', 'Triturado 3/4 pulgada', 'cemento-agregados', 'm3', 115000, 96600, 21, 8, 'Cantera', 'triturado,grava,gravilla'],
  ['REC-M3', 'Recebo B-200', 'cemento-agregados', 'm3', 72000, 60480, 18, 6, 'Cantera', 'recebo,base'],
  ['MOR-SEC-40', 'Mortero seco de pega 40 kg', 'cemento-agregados', 'bulto', 18900, 15880, 64, 25, 'Argos', 'mortero,mortero seco,pega'],
  ['CAL-25', 'Cal hidratada 25 kg', 'cemento-agregados', 'bulto', 16500, 13860, 30, 12, 'Colcal', 'cal'],

  // --- Ladrillos y bloques ---
  ['LAD-TOL-MAC', 'Ladrillo tolete macizo 6x12x24', 'mamposteria', 'und', 1250, 1000, 4200, 1500, 'Santafe', 'ladrillo,tolete,ladrillo macizo'],
  ['LAD-E4', 'Ladrillo estructural No.4 12x23x33', 'mamposteria', 'und', 2150, 1720, 1800, 600, 'Santafe', 'ladrillo estructural,bloque no 4'],
  ['LAD-E5', 'Ladrillo estructural No.5 12x23x33', 'mamposteria', 'und', 2450, 1960, 1450, 600, 'Santafe', 'ladrillo estructural 5,no 5'],
  ['LAD-FAR', 'Ladrillo farol hueco 10x20x30', 'mamposteria', 'und', 1850, 1480, 2100, 800, 'Santafe', 'farol,ladrillo hueco'],
  ['BLO-CON-15', 'Bloque de concreto 15x20x40', 'mamposteria', 'und', 3200, 2560, 900, 300, 'Prefabricar', 'bloque,bloque 15'],
  ['BLO-CON-20', 'Bloque de concreto 20x20x40', 'mamposteria', 'und', 3900, 3120, 620, 250, 'Prefabricar', 'bloque 20'],
  ['ADO-VEH', 'Adoquin vehicular 20x10x8', 'mamposteria', 'und', 1900, 1520, 3100, 1000, 'Prefabricar', 'adoquin'],

  // --- Acero y refuerzo ---
  ['ACE-14', 'Varilla corrugada 1/4 x 6 m', 'acero', 'und', 9900, 8510, 320, 120, 'Diaco', 'varilla 1/4,fleje,estribo'],
  ['ACE-38', 'Varilla corrugada 3/8 x 6 m', 'acero', 'und', 22500, 19350, 260, 100, 'Diaco', 'varilla 3/8,hierro 3/8'],
  ['ACE-12', 'Varilla corrugada 1/2 x 6 m', 'acero', 'und', 39800, 34230, 140, 60, 'Diaco', 'varilla 1/2,hierro 1/2'],
  ['ALA-NEG-KG', 'Alambre negro calibre 18', 'acero', 'kg', 8900, 7650, 85, 30, 'Diaco', 'alambre,alambre negro,amarre'],
  ['MAL-ELE-60', 'Malla electrosoldada 6 mm 2.35x6 m', 'acero', 'und', 118000, 101480, 40, 15, 'Diaco', 'malla electrosoldada,malla'],
  ['MAL-GAL-RL', 'Malla gallinero 1 m x 25 m', 'acero', 'rollo', 65000, 55900, 14, 5, 'Generico', 'malla gallinero'],

  // --- Pinturas y acabados ---
  ['PIN-V1-GL', 'Vinilo tipo 1 lavable galon', 'pinturas', 'galon', 68000, 48960, 56, 20, 'Pintuco', 'pintura,vinilo,vinilo tipo 1'],
  ['PIN-V1-CU', 'Vinilo tipo 1 lavable cunete 5 gl', 'pinturas', 'cunete', 295000, 212400, 18, 6, 'Pintuco', 'cunete,vinilo cunete'],
  ['PIN-V3-GL', 'Vinilo tipo 3 economico galon', 'pinturas', 'galon', 38000, 27360, 48, 20, 'Pintuco', 'vinilo tipo 3,pintura economica'],
  ['EST-LIS-25', 'Estuco plastico listo 25 kg', 'pinturas', 'bulto', 29500, 21240, 42, 15, 'Pintuco', 'estuco,estuco listo'],
  ['PIN-ESM-GL', 'Esmalte sintetico galon', 'pinturas', 'galon', 79000, 56880, 26, 10, 'Pintuco', 'esmalte'],
  ['PIN-ANT-GL', 'Anticorrosivo galon', 'pinturas', 'galon', 62000, 44640, 22, 8, 'Pintuco', 'anticorrosivo'],
  ['IMP-SEL-GL', 'Sellador imprimante galon', 'pinturas', 'galon', 52000, 37440, 24, 10, 'Pintuco', 'sellador,imprimante'],
  ['THI-GL', 'Thinner corriente galon', 'pinturas', 'galon', 34000, 24480, 30, 12, 'Generico', 'thinner,disolvente'],

  // --- Adhesivos e impermeabilizantes ---
  ['PEG-CER-25', 'Pegante para ceramica 25 kg', 'adhesivos', 'bulto', 26500, 19610, 70, 25, 'Corona', 'pegacor,pegante ceramica,bondex'],
  ['PEG-POR-25', 'Pegante porcelanato 25 kg', 'adhesivos', 'bulto', 39000, 28860, 34, 12, 'Corona', 'pegante porcelanato'],
  ['BOQ-2', 'Boquilla para juntas 2 kg', 'adhesivos', 'und', 9800, 7250, 90, 30, 'Corona', 'boquilla,fragua,lechada'],
  ['IMP-ACR-GL', 'Impermeabilizante acrilico galon', 'adhesivos', 'galon', 74000, 54760, 20, 8, 'Sika', 'impermeabilizante,manto liquido'],
  ['SIK-1-4', 'Sika-1 impermeabilizante integral 4 kg', 'adhesivos', 'und', 42000, 31080, 24, 10, 'Sika', 'sika,sika 1'],

  // --- Ceramica y enchapes ---
  ['CER-PIS-45', 'Ceramica piso 45x45 caja 1.50 m2', 'ceramica', 'caja', 48000, 36480, 120, 40, 'Corona', 'ceramica,piso,baldosa'],
  ['CER-PAR-30', 'Ceramica pared 30x60 caja 1.44 m2', 'ceramica', 'caja', 56000, 42560, 86, 30, 'Corona', 'ceramica pared,enchape'],
  ['POR-60', 'Porcelanato 60x60 caja 1.44 m2', 'ceramica', 'caja', 92000, 69920, 54, 20, 'Corona', 'porcelanato'],
  ['GUA-CER-ML', 'Guardaescoba ceramico', 'ceramica', 'ml', 7800, 5930, 240, 80, 'Corona', 'guardaescoba,zocalo'],

  // --- Drywall y cielo raso ---
  ['DRY-LAM-ST', 'Lamina drywall 1/2 pulgada 1.22x2.44', 'drywall', 'und', 41000, 31980, 96, 30, 'Gyplac', 'drywall,lamina,panel yeso'],
  ['DRY-LAM-RH', 'Lamina drywall RH resistente humedad', 'drywall', 'und', 56000, 43680, 38, 15, 'Gyplac', 'drywall humedad,lamina rh'],
  ['DRY-PAR-89', 'Paral calibre 26 - 89 mm x 2.44', 'drywall', 'und', 12500, 9750, 150, 50, 'Gyplac', 'paral,parante'],
  ['DRY-CAN-89', 'Canal calibre 26 - 89 mm x 2.44', 'drywall', 'und', 11800, 9200, 130, 50, 'Gyplac', 'canal,riel'],
  ['DRY-TOR-1K', 'Tornillo drywall 1 pulgada caja x 1000', 'drywall', 'caja', 28000, 21840, 40, 15, 'Generico', 'tornillo drywall'],
  ['DRY-MAS-28', 'Masilla lista drywall 28 kg', 'drywall', 'und', 68000, 53040, 26, 10, 'Gyplac', 'masilla'],
  ['DRY-CIN-90', 'Cinta de papel para juntas 90 m', 'drywall', 'rollo', 9500, 7410, 60, 20, 'Gyplac', 'cinta juntas'],
  ['CIE-PVC-M2', 'Cielo raso PVC', 'drywall', 'm2', 34000, 26520, 180, 60, 'Generico', 'cielo raso pvc'],

  // --- Cubiertas y estructura ---
  ['TEJ-ZIN-30', 'Teja zinc calibre 35 - 3.0 m', 'cubiertas', 'und', 42000, 33600, 88, 30, 'Ajover', 'teja zinc,zinc'],
  ['TEJ-ETE-305', 'Teja fibrocemento 3.05 m', 'cubiertas', 'und', 78000, 62400, 46, 18, 'Eternit', 'eternit,teja fibrocemento'],
  ['TEJ-TRA-20', 'Teja traslucida 2.0 m', 'cubiertas', 'und', 38000, 30400, 34, 12, 'Ajover', 'teja traslucida,claraboya'],
  ['MAD-2X4-3M', 'Madera burra 2x4 x 3 m', 'cubiertas', 'und', 24000, 19200, 70, 25, 'Generico', 'madera,burra,correa'],
  ['TOR-TEJ-100', 'Tornillo para teja con arandela x 100', 'cubiertas', 'caja', 32000, 25600, 28, 10, 'Generico', 'tornillo teja'],
  ['PER-C-80', 'Perfil C 80x40x2 mm x 6 m', 'cubiertas', 'und', 98000, 78400, 24, 8, 'Generico', 'perfil c,correa metalica'],

  // --- Plomeria ---
  ['TUB-PVC-12', 'Tubo PVC presion 1/2 x 6 m', 'plomeria', 'und', 18500, 12580, 92, 30, 'Pavco', 'tubo,tubo pvc,tuberia'],
  ['TUB-SAN-4', 'Tubo sanitario 4 pulgadas x 3 m', 'plomeria', 'und', 52000, 35360, 40, 15, 'Pavco', 'tubo sanitario,tubo 4'],
  ['COD-PVC-12', 'Codo PVC presion 1/2 x 90 grados', 'plomeria', 'und', 900, 610, 480, 150, 'Pavco', 'codo'],
  ['TEE-PVC-12', 'Tee PVC presion 1/2', 'plomeria', 'und', 1100, 750, 360, 120, 'Pavco', 'tee'],
  ['SOL-PVC-14', 'Soldadura PVC 1/4 galon', 'plomeria', 'und', 28000, 19040, 34, 12, 'Pavco', 'soldadura pvc,limpiador'],
  ['LLA-PAS-12', 'Llave de paso 1/2', 'plomeria', 'und', 18900, 12850, 46, 15, 'Generico', 'llave de paso,registro'],
  ['SIF-LAV', 'Sifon para lavaplatos', 'plomeria', 'und', 14500, 9860, 30, 10, 'Generico', 'sifon'],
  ['CIN-TEF', 'Cinta teflon', 'plomeria', 'und', 1500, 1020, 300, 100, 'Generico', 'teflon'],

  // --- Electrico ---
  ['CAB-12-100', 'Cable THHN numero 12 rollo 100 m', 'electrico', 'rollo', 168000, 117600, 22, 8, 'Centelsa', 'cable 12,cable'],
  ['CAB-14-100', 'Cable THHN numero 14 rollo 100 m', 'electrico', 'rollo', 118000, 82600, 26, 10, 'Centelsa', 'cable 14'],
  ['TUB-CON-12', 'Tubo conduit PVC 1/2 x 3 m', 'electrico', 'und', 7900, 5530, 120, 40, 'Pavco', 'conduit,tubo electrico'],
  ['TOM-DOB', 'Toma doble con polo a tierra', 'electrico', 'und', 8900, 6230, 140, 50, 'Legrand', 'toma,tomacorriente'],
  ['INT-SEN', 'Interruptor sencillo', 'electrico', 'und', 7500, 5250, 130, 50, 'Legrand', 'interruptor,switche'],
  ['CAJ-2X4', 'Caja 2x4 PVC', 'electrico', 'und', 2200, 1540, 260, 80, 'Pavco', 'caja 2x4'],
  ['BOM-LED-9', 'Bombillo LED 9W luz blanca', 'electrico', 'und', 6900, 4830, 210, 60, 'Sylvania', 'bombillo,bombilla,led'],
  ['BRE-20A', 'Breaker enchufable 20A', 'electrico', 'und', 16500, 11550, 54, 20, 'Schneider', 'breaker,tarco'],

  // --- Herramienta y seguridad ---
  ['HER-PAL-8', 'Palustre 8 pulgadas', 'herramientas', 'und', 22000, 13640, 38, 12, 'Stanley', 'palustre'],
  ['HER-BOQ', 'Boquillera de caucho', 'herramientas', 'und', 13000, 8060, 30, 10, 'Generico', 'boquillera'],
  ['HER-FLO', 'Llana flotador de madera', 'herramientas', 'und', 18000, 11160, 26, 10, 'Generico', 'llana,flotador'],
  ['HER-NIV-60', 'Nivel de aluminio 60 cm', 'herramientas', 'und', 34000, 21080, 22, 8, 'Stanley', 'nivel'],
  ['HER-MET-5', 'Flexometro 5 m', 'herramientas', 'und', 16900, 10480, 45, 15, 'Stanley', 'metro,flexometro,cinta metrica'],
  ['HER-MAR-16', 'Martillo 16 oz', 'herramientas', 'und', 28000, 17360, 28, 10, 'Stanley', 'martillo'],
  ['HER-CAR-BU', 'Carretilla tipo buggy', 'herramientas', 'und', 165000, 102300, 12, 4, 'Generico', 'carretilla'],
  ['HER-BAL-12', 'Balde plastico 12 L', 'herramientas', 'und', 9500, 5890, 60, 20, 'Generico', 'balde,tarro'],
  ['HER-PLO', 'Plomada 300 g', 'herramientas', 'und', 14000, 8680, 20, 8, 'Generico', 'plomada'],
  ['HER-BRO-4', 'Brocha 4 pulgadas', 'herramientas', 'und', 12500, 7750, 55, 20, 'Generico', 'brocha'],
  ['HER-ROD-9', 'Rodillo 9 pulgadas con bandeja', 'herramientas', 'und', 24000, 14880, 40, 15, 'Generico', 'rodillo'],
  ['HER-DIS-7', 'Disco de corte 7 pulgadas', 'herramientas', 'und', 9900, 6140, 80, 25, 'Bosch', 'disco,disco corte'],
  ['HER-GUA-CA', 'Guantes de carnaza', 'herramientas', 'par', 11000, 6820, 70, 25, 'Generico', 'guantes'],
  ['HER-GAF-SE', 'Gafas de seguridad', 'herramientas', 'und', 8900, 5520, 65, 25, 'Generico', 'gafas'],
];

export const CATEGORIAS = {
  'cemento-agregados': 'Cemento y agregados',
  'mamposteria': 'Ladrillos y bloques',
  'acero': 'Acero y refuerzo',
  'pinturas': 'Pinturas y acabados',
  'adhesivos': 'Adhesivos e impermeabilizantes',
  'ceramica': 'Ceramica y enchapes',
  'drywall': 'Drywall y cielo raso',
  'cubiertas': 'Cubiertas y estructura',
  'plomeria': 'Plomeria',
  'electrico': 'Material electrico',
  'herramientas': 'Herramienta y seguridad',
};

export const PRODUCTOS = FILAS.map(
  ([sku, nombre, categoria, unidad, precio, costo, stock, stockMin, marca, sinonimos]) => ({
    sku,
    nombre,
    categoria,
    categoriaNombre: CATEGORIAS[categoria],
    unidad,
    precio,
    costo,
    stock,
    stockMin,
    stockMax: stockMin * 4,
    marca,
    sinonimos: sinonimos.split(','),
    activo: true,
  })
);

export const porSku = Object.fromEntries(PRODUCTOS.map((p) => [p.sku, p]));
