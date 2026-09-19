/**
 * Router — version navegador.
 *
 * Misma resolucion de rutas y parametros que src/lib/router.mjs, sin la parte
 * de servir archivos ni de leer cuerpos HTTP: aqui no hay red de por medio.
 */
export function crearRouter() {
  const rutas = [];

  const registrar = (metodo, patron, handler) => {
    rutas.push({ metodo, partes: patron.split('/').filter(Boolean), handler, patron });
  };

  const api = {
    get: (p, h) => registrar('GET', p, h),
    post: (p, h) => registrar('POST', p, h),
    put: (p, h) => registrar('PUT', p, h),
    delete: (p, h) => registrar('DELETE', p, h),
    rutas,
  };

  api.resolver = (metodo, ruta) => {
    const partes = ruta.split('/').filter(Boolean);
    for (const r of rutas) {
      if (r.metodo !== metodo || r.partes.length !== partes.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < r.partes.length; i++) {
        const esperado = r.partes[i];
        if (esperado.startsWith(':')) params[esperado.slice(1)] = decodeURIComponent(partes[i]);
        else if (esperado !== partes[i]) { ok = false; break; }
      }
      if (ok) return { handler: r.handler, params };
    }
    return null;
  };

  return api;
}
