/**
 * ADAPTADOR DE MODELO — version estatica.
 *
 * En GitHub Pages no hay servidor donde guardar una llave de API, y meterla en
 * el navegador seria regalarla a cualquiera que abra el codigo fuente. Por eso
 * la demostracion publica corre siempre con el motor local.
 *
 * Eso no le quita nada al asistente: el motor local es el que entiende la
 * intencion, extrae cantidades y fechas, consulta stock y precios y arma el
 * pedido. Claude, cuando esta conectado en la instalacion real, solo redacta.
 */

export async function estadoIA() {
  return {
    modo: 'local',
    activo: false,
    modelo: 'motor local',
    motor: 'motor local deterministico',
    nota:
      'Demostracion publica sin servidor: el asistente responde con el motor propio, sin costo por mensaje. ' +
      'En la instalacion real se puede activar Claude encima para redactar, manteniendo precios y stock a cargo del sistema.',
  };
}

/** Sin backend no hay llamada al modelo: el motor local responde solo. */
export async function redactar() {
  return null;
}
