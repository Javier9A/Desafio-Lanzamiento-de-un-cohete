/* Núcleo numérico: Euler, Heun, RK4 y solución analítica del cohete.
   Modelo: m v' = T - m g - k v ;  y' = v  */
(function (root) {
  const DEFAULTS = { m: 1000, T: 15000, g: 9.81, k: 100, v0: 0, y0: 0, t0: 0, tf: 20, h: 2 };

  // Coeficientes de v' = a - c v
  function coef(p) { return { a: p.T / p.m - p.g, c: p.k / p.m }; }

  // Solución analítica (caso general con v0, y0 y caso k = 0)
  function analytic(p, t) {
    const { a, c } = coef(p);
    const s = t - p.t0;
    if (Math.abs(c) < 1e-12) {
      return { v: p.v0 + a * s, y: p.y0 + p.v0 * s + 0.5 * a * s * s };
    }
    const vinf = a / c;
    const e = Math.exp(-c * s);
    return {
      v: vinf + (p.v0 - vinf) * e,
      y: p.y0 + vinf * s + ((p.v0 - vinf) / c) * (1 - e),
    };
  }

  function stepFn(method, p) {
    const { a, c } = coef(p);
    const f = (v) => a - c * v;
    if (method === 'euler') {
      return (v, y, s) => ({ v: v + s * f(v), y: y + s * v });
    }
    if (method === 'heun') {
      return (v, y, s) => {
        const k1v = f(v), k1y = v;
        const k2v = f(v + s * k1v), k2y = v + s * k1v;
        return { v: v + (s / 2) * (k1v + k2v), y: y + (s / 2) * (k1y + k2y) };
      };
    }
    // RK4
    return (v, y, s) => {
      const k1v = f(v), k1y = v;
      const k2v = f(v + (s / 2) * k1v), k2y = v + (s / 2) * k1v;
      const k3v = f(v + (s / 2) * k2v), k3y = v + (s / 2) * k2v;
      const k4v = f(v + s * k3v), k4y = v + s * k3v;
      return {
        v: v + (s / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
        y: y + (s / 6) * (k1y + 2 * k2y + 2 * k3y + k4y),
      };
    };
  }

  // Devuelve filas {i,t,v,y,vE,yE,errV,errY,relV,relY}
  function solve(method, p, h) {
    h = h || p.h;
    const step = stepFn(method, p);
    const rows = [];
    let t = p.t0, v = p.v0, y = p.y0, i = 0;
    const push = () => {
      const ex = analytic(p, t);
      const errV = Math.abs(ex.v - v), errY = Math.abs(ex.y - y);
      rows.push({
        i, t, v, y, vE: ex.v, yE: ex.y, errV, errY,
        relV: ex.v !== 0 ? (errV / Math.abs(ex.v)) * 100 : 0,
        relY: ex.y !== 0 ? (errY / Math.abs(ex.y)) * 100 : 0,
      });
    };
    push();
    while (t < p.tf - 1e-9) {
      const s = Math.min(h, p.tf - t);
      const r = step(v, y, s);
      v = r.v; y = r.y; t += s; i++;
      push();
    }
    return rows;
  }

  const api = { DEFAULTS, coef, analytic, solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
