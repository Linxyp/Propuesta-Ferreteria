/**
 * BASE DE CONOCIMIENTO DEL ASISTENTE
 *
 * Dos bloques:
 *  - POLITICAS : lo que el negocio responde siempre igual (horarios, pagos, credito).
 *  - TECNICA   : criterio de obra. Es lo que convierte al bot en un asesor y no
 *                en un catalogo hablado.
 *
 * Cada entrada declara sus palabras clave; el recuperador puntua por coincidencia
 * de terminos + similitud difusa, de modo que funciona con la forma real en que
 * escribe un maestro de obra por WhatsApp ("q pegante uso pal porcelanato").
 */

export const CONOCIMIENTO = [
  // ---------------------------------------------------------- politicas ---
  {
    id: 'horario',
    tema: 'politica',
    claves: ['horario', 'hora', 'abren', 'cierran', 'abierto', 'domingo', 'festivo', 'atencion'],
    pregunta: 'Que horario manejan?',
    respuesta:
      'Atendemos de lunes a viernes de 7:00 am a 6:00 pm, sabados de 7:00 am a 4:00 pm y domingos de 8:00 am a 12:00 m. Por este chat le recibo pedidos las 24 horas: los que entran de noche quedan alistados para primera hora.',
  },
  {
    id: 'domicilio',
    tema: 'politica',
    claves: ['domicilio', 'envio', 'llevan', 'entrega', 'transporte', 'flete', 'despacho'],
    pregunta: 'Hacen domicilios?',
    respuesta:
      'Si. Domicilio gratis en compras desde $350.000 dentro de 12 km. Por debajo de ese monto vale $18.000. Todo pedido confirmado antes de las 2:00 pm sale el mismo dia.',
  },
  {
    id: 'pagos',
    tema: 'politica',
    claves: ['pago', 'pagar', 'transferencia', 'nequi', 'daviplata', 'tarjeta', 'datafono', 'efectivo'],
    pregunta: 'Como puedo pagar?',
    respuesta:
      'Recibimos efectivo, transferencia (Bancolombia, Nequi o Daviplata), datafono y credito aprobado para clientes con cupo. Si paga por transferencia me manda el soporte por aqui mismo y le confirmo de una.',
  },
  {
    id: 'credito',
    tema: 'politica',
    claves: ['credito', 'cupo', 'plazo', 'fiado', 'cartera', 'saldo', 'debo'],
    pregunta: 'Manejan credito?',
    respuesta:
      'Si, para clientes fijos. El cupo y el plazo quedan registrados en su ficha; cuando hace un pedido yo valido automaticamente que no lo exceda. Si quiere conocer su saldo actual me escribe "saldo" y se lo consulto.',
  },
  {
    id: 'factura',
    tema: 'politica',
    claves: ['factura', 'facturacion', 'electronica', 'dian', 'rut', 'iva', 'nit'],
    pregunta: 'Facturan electronicamente?',
    respuesta:
      'Si, factura electronica validada DIAN. Llega al correo registrado apenas se despacha el pedido. Los precios que le doy ya incluyen IVA del 19%; en la factura va discriminado.',
  },
  {
    id: 'devolucion',
    tema: 'politica',
    claves: ['devolucion', 'devolver', 'cambio', 'garantia', 'sobro', 'sobrante'],
    pregunta: 'Puedo devolver material?',
    respuesta:
      'Material sin usar y en empaque original se recibe hasta 8 dias despues con la factura. No se reciben devoluciones de cemento abierto, pintura entonada ni material cortado a medida.',
  },
  {
    id: 'ubicacion',
    tema: 'politica',
    claves: ['donde', 'ubicacion', 'direccion', 'quedan', 'llegar', 'local'],
    pregunta: 'Donde quedan?',
    respuesta:
      'Estamos sobre la via principal del sector, con parqueadero para cargue y descargue. Si me dice su direccion le confirmo si entra en la ruta de domicilio de hoy.',
  },
  {
    id: 'cotizacion-formal',
    tema: 'politica',
    claves: ['cotizacion', 'cotizar', 'presupuesto', 'formal', 'papel', 'pdf'],
    pregunta: 'Me pueden pasar una cotizacion formal?',
    respuesta:
      'Claro. Yo le armo la cotizacion aqui mismo con numero y vigencia de 15 dias, y le llega en PDF al correo. Si la aprueba, se convierte en pedido sin volver a digitar nada.',
  },

  // ------------------------------------------------------------ tecnica ---
  {
    id: 'dosificacion-concreto',
    tema: 'tecnica',
    claves: ['dosificacion', 'mezcla', 'concreto', 'cuanto cemento', 'proporcion', 'psi', 'mortero'],
    pregunta: 'Cuanto cemento lleva un metro cubico de concreto?',
    respuesta:
      'Para 3.000 psi (lo normal en placas de vivienda): 7,5 bultos de cemento, 0,52 m3 de arena lavada y 0,58 m3 de triturado por cada m3. Para 2.500 psi baja a 6,5 bultos y para 4.000 psi sube a 9. El mortero de pega 1:4 lleva 7,5 bultos y 1,05 m3 de arena por m3 de mortero.',
  },
  {
    id: 'curado',
    tema: 'tecnica',
    claves: ['curar', 'curado', 'fisura', 'grieta', 'agrieta', 'secado'],
    pregunta: 'Como curo el concreto?',
    respuesta:
      'Mantengalo humedo 7 dias seguidos, empezando cuando el concreto ya no se marque al pisarlo (unas 8 a 12 horas). El 90% de las fisuras que veo en placas nuevas son por falta de curado, no por mala mezcla.',
  },
  {
    id: 'tipos-vinilo',
    tema: 'tecnica',
    claves: ['vinilo', 'tipo 1', 'tipo 3', 'diferencia pintura', 'lavable', 'que pintura'],
    pregunta: 'Cual es la diferencia entre vinilo tipo 1 y tipo 3?',
    respuesta:
      'El tipo 1 tiene mas resina: cubre mejor, se puede lavar y aguanta unos 5 anos en interior. El tipo 3 es para obra gris, arriendo o presupuesto ajustado, y toca repintar mucho antes. Para fachada no use ninguno de los dos comunes: pida vinilo para exteriores.',
  },
  {
    id: 'pegante-porcelanato',
    tema: 'tecnica',
    claves: ['porcelanato', 'pegante', 'pegacor', 'bondex', 'se despega', 'adhesivo'],
    pregunta: 'Que pegante uso para porcelanato?',
    respuesta:
      'Porcelanato exige pegante especifico (tipo porcelanato o alta adherencia). El pegacor comun no agarra porque el porcelanato casi no absorbe agua, y se le empieza a despegar entre 6 y 12 meses despues. Consumo aproximado: 6,5 kg/m2.',
  },
  {
    id: 'desperdicio-ceramica',
    tema: 'tecnica',
    claves: ['desperdicio', 'cuanta ceramica', 'de mas', 'cortes', 'sobra'],
    pregunta: 'Cuanta ceramica de mas debo comprar?',
    respuesta:
      'Un 10% adicional en instalacion recta y 15% si va en diagonal o el espacio tiene muchos quiebres. Compre todo del mismo lote: entre lotes distintos hay diferencia de tono que se nota con la luz de la tarde.',
  },
  {
    id: 'drywall-bano',
    tema: 'tecnica',
    claves: ['drywall bano', 'lamina rh', 'humedad', 'cocina', 'se pandea'],
    pregunta: 'Puedo poner drywall en el bano?',
    respuesta:
      'Si, pero con lamina RH (verde, resistente a la humedad) y en la zona de ducha va lamina cementicia, no drywall. La lamina estandar en zona humeda se pandea y despues hay que tumbar el muro completo.',
  },
  {
    id: 'pendiente-teja',
    tema: 'tecnica',
    claves: ['pendiente', 'teja', 'inclinacion', 'gotera', 'filtra', 'cubierta'],
    pregunta: 'Que pendiente minima lleva una cubierta?',
    respuesta:
      'Zinc y fibrocemento: minimo 15%, ideal 25% o mas. Por debajo del 15% el agua se devuelve por capilaridad en los traslapos y le filtra asi la teja este nueva. Traslape lateral de una onda y 15 cm en el sentido de la pendiente.',
  },
  {
    id: 'calibre-cable',
    tema: 'tecnica',
    claves: ['cable', 'calibre', 'numero 12', 'numero 14', 'electrico', 'circuito', 'breaker'],
    pregunta: 'Que calibre de cable uso?',
    respuesta:
      'Tomas de uso general: cable #12 con breaker de 20A. Iluminacion: #14 con breaker de 15A. Ducha electrica o estufa: #10 o #8 en circuito independiente. Nunca meta mas de 8 puntos en un solo circuito. La instalacion la debe certificar un tecnico con matricula (RETIE).',
  },
  {
    id: 'impermeabilizar',
    tema: 'tecnica',
    claves: ['impermeabilizar', 'terraza', 'humedad', 'filtracion', 'manto', 'goteras'],
    pregunta: 'Como impermeabilizo una terraza?',
    respuesta:
      'Superficie limpia y seca, resane fisuras, aplique imprimante y luego dos manos de acrilico cruzadas (la segunda perpendicular a la primera), con refuerzo de malla en juntas y bordes. Rendimiento aproximado: 1 galon por 4 m2 en las dos manos.',
  },
  {
    id: 'ladrillos-m2',
    tema: 'tecnica',
    claves: ['cuantos ladrillos', 'ladrillo por metro', 'm2 muro', 'bloques'],
    pregunta: 'Cuantos ladrillos lleva un metro cuadrado?',
    respuesta:
      'Tolete macizo 6x12x24 de soga: 52 unidades/m2. Ladrillo estructural No.4 o No.5: 12,5/m2. Farol 10x20x30: 15/m2. Bloque de concreto 15x20x40: 11,5/m2. Sume 5% de desperdicio y el mortero de pega aparte.',
  },
  {
    id: 'estuco-sellador',
    tema: 'tecnica',
    claves: ['estuco', 'sellador', 'imprimante', 'antes de pintar', 'rinde'],
    pregunta: 'Necesito sellador sobre estuco nuevo?',
    respuesta:
      'Si. El estuco nuevo es poroso y se traga la pintura: sin sellador va a necesitar una mano extra de vinilo, que cuesta mas que el sellador. Un bulto de estuco de 25 kg rinde unos 12 m2 a dos manos y un galon de sellador cubre 40 m2.',
  },
  {
    id: 'recubrimiento-acero',
    tema: 'tecnica',
    claves: ['recubrimiento', 'acero', 'varilla', 'estribos', 'columna', 'oxida'],
    pregunta: 'Que recubrimiento debe tener el acero?',
    respuesta:
      'Minimo 4 cm entre la varilla y la cara del elemento en columnas y vigas, y 5 cm en cimentacion contra el suelo. Menos que eso y el acero se oxida en pocos anos y revienta el concreto desde adentro.',
  },
  {
    id: 'placa-espesor',
    tema: 'tecnica',
    claves: ['espesor placa', 'grosor', 'piso concreto', 'anden', 'garaje'],
    pregunta: 'Que espesor debe tener una placa?',
    respuesta:
      'Piso interior sin trafico vehicular: 8 a 10 cm con malla. Garaje o zona de carro: 12 a 15 cm con malla o varilla. Anden peatonal: 8 cm. Deje juntas de dilatacion cada 4 o 5 metros.',
  },
  {
    id: 'mortero-panete',
    tema: 'tecnica',
    claves: ['panete', 'revoque', 'repello', 'espesor panete'],
    pregunta: 'Cuanto mortero lleva el panete?',
    respuesta:
      'A 2 cm de espesor: 0,02 m3 de mortero por m2, mas 10% de desperdicio. Eso da aproximadamente 0,17 bultos de cemento y 0,023 m3 de arena por cada m2 panetado. Espere 24 horas antes de estucar encima.',
  },
  {
    id: 'herramienta-basica',
    tema: 'tecnica',
    claves: ['herramienta', 'que necesito', 'kit', 'basico', 'empezar'],
    pregunta: 'Que herramienta basica necesito?',
    respuesta:
      'Para obra gris: palustre, plomada, nivel de 60 cm, flexometro, balde, carretilla y flotador. Para acabados sume boquillera, llana, rodillo, brocha y disco de corte. Y siempre gafas y guantes: el disco de 7" es la herramienta que mas accidentes causa en obra.',
  },
  {
    id: 'malla-placa',
    tema: 'tecnica',
    claves: ['malla', 'electrosoldada', 'refuerzo placa', 'necesito malla'],
    pregunta: 'La placa necesita malla?',
    respuesta:
      'Para contrapiso sobre terreno bien compactado, la malla electrosoldada de 6 mm controla la fisuracion por retraccion y vale la pena. Una malla de 2,35 x 6 m rinde unos 13 m2 utiles descontando traslapos.',
  },
  {
    id: 'arena-tipo',
    tema: 'tecnica',
    claves: ['arena', 'lavada', 'de rio', 'cual arena', 'diferencia arena'],
    pregunta: 'Que arena uso para cada cosa?',
    respuesta:
      'Arena lavada de pena para concreto (es mas limpia y da resistencia). Arena de rio para pega y panete (es mas fina y trabaja mejor con el palustre). Si usa arena sucia en concreto pierde resistencia aunque meta el cemento completo.',
  },
];

/** Indice de busqueda: tokens de claves + pregunta. */
export const INDICE = CONOCIMIENTO.map((k) => ({
  ...k,
  _texto: [k.pregunta, ...k.claves, k.respuesta.slice(0, 160)].join(' ').toLowerCase(),
}));
