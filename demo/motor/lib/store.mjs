/**
 * Persistencia en el NAVEGADOR (version estatica del sitio).
 *
 * Sustituye a src/lib/store.mjs en la compilacion para GitHub Pages. El estado,
 * los ayudantes y el generador de datos demo son exactamente los mismos:
 * se importan de nucleo.mjs sin tocar una linea.
 *
 * Diferencias propias del navegador:
 *  - guarda en sessionStorage, no en disco;
 *  - cada visitante tiene su propia copia de la demostracion, asi que puede
 *    crear pedidos sin afectar a nadie mas;
 *  - si la fecha cambia o el almacenamiento falla, regenera los datos. Como la
 *    semilla es determinista, siempre queda una demostracion coherente y con
 *    fechas de hoy.
 */
import { estado, sembrar } from './nucleo.mjs';
import { hoyISO } from './util.mjs';

export * from './nucleo.mjs';

const LLAVE = 'ferreteria360:estado';
const LLAVE_FECHA = 'ferreteria360:fecha';

/** sessionStorage puede lanzar en ventana privada o con cookies bloqueadas. */
function almacen() {
  try {
    const s = window.sessionStorage;
    s.setItem('ferreteria360:test', '1');
    s.removeItem('ferreteria360:test');
    return s;
  } catch {
    return null;
  }
}

export function guardar() {
  const s = almacen();
  if (!s) return false;
  try {
    s.setItem(LLAVE, JSON.stringify(estado));
    s.setItem(LLAVE_FECHA, hoyISO());
    return true;
  } catch {
    // Sin cupo: la demostracion sigue viva en memoria hasta recargar.
    return false;
  }
}

export function cargar() {
  const s = almacen();
  if (!s) return false;
  try {
    // Los datos demo se generan relativos a hoy: de otro dia ya no sirven.
    if (s.getItem(LLAVE_FECHA) !== hoyISO()) return false;
    const raw = s.getItem(LLAVE);
    if (!raw) return false;
    Object.assign(estado, JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

export function reiniciar() {
  const s = almacen();
  try {
    if (s) { s.removeItem(LLAVE); s.removeItem(LLAVE_FECHA); }
  } catch {}
  sembrar();
  guardar();
  return estado;
}

export function iniciar() {
  if (!cargar()) {
    sembrar();
    guardar();
  }
  return estado;
}
