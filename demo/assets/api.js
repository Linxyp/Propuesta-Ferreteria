/**
 * Transporte de la API — variante ESTATICA (GitHub Pages).
 *
 * Las pantallas siguen pidiendo "/api/admin/dashboard" como si hubiera un
 * servidor. Aqui no lo hay: esta capa resuelve la ruta contra el mismo router
 * y los mismos handlers del backend, que ahora corren dentro del navegador.
 *
 * Es decir: no es una demostracion con datos falsos. Es el motor completo
 * (calculo de obra, cotizador, bot, inventario, finanzas) ejecutandose del lado
 * del cliente, sobre un estado que se guarda en la sesion del visitante.
 */
import { crearRouter } from '../motor/lib/router.mjs';
import { iniciar } from '../motor/lib/store.mjs';
import { registrarRutas } from '../motor/api/routes.mjs';

iniciar();

const router = crearRouter();
registrarRutas(router);

/** Ejecuta un handler tal como lo haria el servidor y devuelve su JSON. */
async function despachar(metodo, ruta, cuerpo) {
  const [camino, consulta = ''] = String(ruta).split('?');
  const encontrada = router.resolver(metodo, camino);
  if (!encontrada) {
    throw Object.assign(new Error(`Ruta no encontrada: ${camino}`), { status: 404 });
  }
  try {
    const ctx = {
      params: encontrada.params,
      query: Object.fromEntries(new URLSearchParams(consulta)),
      body: cuerpo || {},
    };
    return (await encontrada.handler(ctx)) ?? { ok: true };
  } catch (e) {
    throw Object.assign(new Error(e.message), { detalle: e.detalle || null, status: e.status || 500 });
  }
}

export const api = {
  get: (ruta) => despachar('GET', ruta),
  post: (ruta, cuerpo) => despachar('POST', ruta, cuerpo),
};

/** Sin servidor las pantallas son archivos: /simulador pasa a simulador.html */
export const ruta = (p) => (p === '/' ? 'index.html' : p.replace(/^\//, '') + '.html');

/** La demostracion publica corre sin backend: el asistente usa el motor local. */
export const CON_BACKEND = false;
