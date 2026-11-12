(function () {
  const C = Core;
  const NAMES = { euler: 'Euler', heun: 'Heun', rk4: 'RK4' };
  const COLORS = { exact: '#ffffff', euler: '#ff6b6b', heun: '#4ecdc4', rk4: '#a78bfa' };
  const FIELDS = [
    ['m', 'Masa m (kg)'], ['T', 'Empuje T (N)'], ['g', 'Gravedad g (m/s²)'], ['k', 'Resistencia k (kg/s)'],
    ['v0', 'Velocidad inicial v₀ (m/s)'], ['y0', 'Altura inicial y₀ (m)'], ['t0', 'Tiempo inicial t₀ (s)'],
    ['tf', 'Tiempo final t_f (s)'], ['h', 'Paso h (s)'],
  ];
  const fmt = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '—');
  const $ = (id) => document.getElementById(id);

  // ---------- formulario ----------
  const box = $('params');
  FIELDS.forEach(([key, lab]) => {
    const l = document.createElement('label');
    l.innerHTML = `${lab}<input type="number" step="any" id="p_${key}" value="${C.DEFAULTS[key]}">`;
    box.appendChild(l);
  });

  function readParams() {
    const p = {};
    for (const [k] of FIELDS) p[k] = parseFloat($('p_' + k).value);
    if (Object.values(p).some((x) => !Number.isFinite(x))) throw new Error('Hay parámetros vacíos o inválidos.');
    if (p.m <= 0) throw new Error('La masa debe ser positiva.');
    if (p.h <= 0) throw new Error('El paso h debe ser positivo.');
    if (p.tf <= p.t0) throw new Error('t_f debe ser mayor que t₀.');
    if ((p.tf - p.t0) / p.h > 100000) throw new Error('Demasiados pasos; aumenta h.');
    return p;
  }

  // ---------- gráficas (canvas) ----------
  function drawChart(canvas, title, xlab, ylab, series, opts = {}) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H);
    const L = 58, R = 14, T = 30, B = 40;
    const pts = series.flatMap((s) => s.data);
    let xmin = Math.min(...pts.map((p) => p[0])), xmax = Math.max(...pts.map((p) => p[0]));
    let ymin = opts.zero ? 0 : Math.min(...pts.map((p) => p[1])), ymax = Math.max(...pts.map((p) => p[1]));
    if (ymax === ymin) ymax = ymin + 1;
    ymax += (ymax - ymin) * 0.05;
    const X = (x) => L + ((x - xmin) / (xmax - xmin || 1)) * (W - L - R);
    const Y = (y) => H - B - ((y - ymin) / (ymax - ymin)) * (H - T - B);
    g.font = '11px system-ui'; g.fillStyle = '#9aa6d6'; g.strokeStyle = '#2a3566'; g.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const yv = ymin + ((ymax - ymin) * i) / 5, py = Y(yv);
      g.beginPath(); g.moveTo(L, py); g.lineTo(W - R, py); g.stroke();
      g.textAlign = 'right'; g.fillText(yv.toPrecision(3).replace('.', ','), L - 6, py + 4);
      const xv = xmin + ((xmax - xmin) * i) / 5, px = X(xv);
      g.textAlign = 'center'; g.fillText(xv.toFixed(1).replace('.', ','), px, H - B + 15);
    }
    g.fillStyle = '#e8ecff'; g.font = 'bold 13px system-ui'; g.textAlign = 'left'; g.fillText(title, L, 18);
    g.font = '11px system-ui'; g.fillStyle = '#9aa6d6'; g.textAlign = 'center';
    g.fillText(xlab, (L + W - R) / 2, H - 6);
    g.save(); g.translate(13, (T + H - B) / 2); g.rotate(-Math.PI / 2); g.fillText(ylab, 0, 0); g.restore();
    series.forEach((s) => {
      g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = s.w || 2;
      if (s.dash) g.setLineDash(s.dash); else g.setLineDash([]);
      g.beginPath();
      s.data.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
      g.stroke(); g.setLineDash([]);
      if (s.dots) s.data.forEach((p) => { g.beginPath(); g.arc(X(p[0]), Y(p[1]), 3, 0, 7); g.fill(); });
    });
  }

  // ---------- estado ----------
  let P, R, tab = 'euler';

  function tableHTML(rows, method) {
    let h = `<tr><th>i</th><th>t (s)</th><th>v ${NAMES[method]} (m/s)</th><th>v exacta (m/s)</th><th>Error abs v</th><th>Error rel v (%)</th><th>y ${NAMES[method]} (m)</th><th>y exacta (m)</th><th>Error abs y</th><th>Error rel y (%)</th></tr>`;
    rows.forEach((r) => {
      h += `<tr><td>${r.i}</td><td>${fmt(r.t, 2)}</td><td>${fmt(r.v)}</td><td>${fmt(r.vE)}</td><td class="err">${fmt(r.errV)}</td><td>${fmt(r.relV, 3)}</td><td>${fmt(r.y)}</td><td>${fmt(r.yE)}</td><td class="err">${fmt(r.errY)}</td><td>${fmt(r.relY, 3)}</td></tr>`;
    });
    return h;
  }

  function renderTabs() {
    const t = $('tabs'); t.innerHTML = '';
    Object.keys(NAMES).forEach((m) => {
      const b = document.createElement('button');
      b.textContent = NAMES[m]; b.className = m === tab ? 'on' : '';
      b.onclick = () => { tab = m; renderTabs(); $('tbl').innerHTML = tableHTML(R[m], m); };
      t.appendChild(b);
    });
  }

  function renderCards() {
    const ex = R.euler[R.euler.length - 1];
    let h = `<div class="card" style="--c:#fff"><b>Solución exacta</b><span>v = ${fmt(ex.vE)} m/s</span><span>y = ${fmt(ex.yE)} m</span></div>`;
    Object.keys(NAMES).forEach((m) => {
      const r = R[m][R[m].length - 1];
      h += `<div class="card" style="--c:${COLORS[m]}"><b>${NAMES[m]}</b><span>v = ${fmt(r.v)} m/s</span><span>y = ${fmt(r.y)} m</span><span class="err">Error: ${fmt(r.errV)} m/s · ${fmt(r.errY)} m</span></div>`;
    });
    $('cards').innerHTML = h;
  }

  function renderCharts() {
    const ser = (key) => [
      { color: COLORS.exact, data: R.euler.map((r) => [r.t, r[key + 'E']]), w: 2.5 },
      ...Object.keys(NAMES).map((m) => ({ color: COLORS[m], data: R[m].map((r) => [r.t, r[key]]), dots: m === 'euler', w: 1.8, dash: m === 'euler' ? null : [6, 3] })),
    ];
    drawChart($('cV'), 'Velocidad v(t)', 't (s)', 'v (m/s)', ser('v'), { zero: true });
    drawChart($('cY'), 'Altura y(t)', 't (s)', 'y (m)', ser('y'), { zero: true });
    const err = (key) => Object.keys(NAMES).map((m) => ({ color: COLORS[m], data: R[m].map((r) => [r.t, r[key]]), w: 2 }));
    drawChart($('cEV'), 'Error absoluto en velocidad', 't (s)', '|error| (m/s)', err('errV'), { zero: true });
    drawChart($('cEY'), 'Error absoluto en altura', 't (s)', '|error| (m)', err('errY'), { zero: true });
  }

  function renderSteps() {
    const base = P.h, hs = [base * 2, base, base / 2, base / 4, base / 8].filter((h) => h <= P.tf - P.t0);
    let h = `<tr><th>h (s)</th><th>Pasos</th><th>Euler |err v|</th><th>Euler |err y|</th><th>Heun |err v|</th><th>Heun |err y|</th><th>RK4 |err v|</th><th>RK4 |err y|</th></tr>`;
    const lastEuler = [];
    hs.forEach((hh) => {
      const row = {};
      Object.keys(NAMES).forEach((m) => { row[m] = C.solve(m, P, hh).pop(); });
      lastEuler.push(row.euler.errY);
      h += `<tr><td>${fmt(hh, 3)}</td><td>${Math.ceil((P.tf - P.t0) / hh - 1e-9)}</td>` +
        Object.keys(NAMES).map((m) => `<td>${fmt(row[m].errV, 6)}</td><td>${fmt(row[m].errY, 6)}</td>`).join('') + '</tr>';
    });
    $('hTbl').innerHTML = h;
    $('hNote').textContent = 'Al dividir h entre 2, el error de Euler se reduce aproximadamente a la mitad (orden 1), el de Heun a la cuarta parte (orden 2) y el de RK4 a la dieciseisava parte (orden 4).';
  }

  function renderAnalytic() {
    const { a, c } = C.coef(P);
    const vinf = a / c;
    if (Math.abs(c) < 1e-12) {
      $('analitica').innerHTML = `k = 0: v(t) = v₀ + a·(t−t₀),&nbsp; y(t) = y₀ + v₀·(t−t₀) + ½·a·(t−t₀)²,&nbsp; con a = ${fmt(a, 4)} m/s²`;
      return;
    }
    $('analitica').innerHTML =
      `Ecuación lineal v' + ${fmt(c, 4)}·v = ${fmt(a, 4)} (factor integrante e<sup>${fmt(c, 4)}t</sup>)<br><br>` +
      `v(t) = v<sub>∞</sub> + (v₀ − v<sub>∞</sub>)·e<sup>−${fmt(c, 4)}(t−t₀)</sup>,&nbsp; v<sub>∞</sub> = ${fmt(vinf, 4)} m/s<br>` +
      `y(t) = y₀ + v<sub>∞</sub>(t−t₀) + ((v₀−v<sub>∞</sub>)/${fmt(c, 4)})·(1 − e<sup>−${fmt(c, 4)}(t−t₀)</sup>)<br><br>` +
      `Con los datos del desafío: v(t) = 51,9·(1 − e<sup>−0,1t</sup>),&nbsp; y(t) = 51,9·t − 519·(1 − e<sup>−0,1t</sup>).`;
  }

  function renderConclusions() {
    const e = R.euler.at(-1), hh = R.heun.at(-1), r4 = R.rk4.at(-1);
    const { a, c } = C.coef(P);
    const vinf = a / c, tau = 1 / c;
    $('concl').innerHTML = `
      <p><b>Interpretación física.</b> ${Math.abs(c) > 1e-12 ? `La velocidad tiende a la velocidad terminal v<sub>∞</sub> = (T − mg)/k = ${fmt(vinf, 2)} m/s con constante de tiempo τ = m/k = ${fmt(tau, 1)} s: el empuje neto acelera el cohete, pero la resistencia del aire crece con v hasta equilibrarlo. A t = ${fmt(P.tf, 0)} s ya alcanzó el ${fmt((e.vE / vinf) * 100, 1)} % de v<sub>∞</sub>.` : 'Sin resistencia (k = 0) la aceleración es constante.'}</p>
      <p><b>Euler.</b> v = ${fmt(e.v)} m/s y y = ${fmt(e.y)} m frente a los valores exactos ${fmt(e.vE)} m/s y ${fmt(e.yE)} m (error ${fmt(e.errV)} m/s y ${fmt(e.errY)} m; ${fmt(e.relV, 2)} % y ${fmt(e.relY, 2)} %). Sobreestima v porque usa la pendiente al inicio de cada intervalo, donde la aceleración es mayor que su promedio, y subestima y porque integra v con valores desfasados (usa la velocidad del inicio de cada intervalo, menor que la real).</p>
      <p><b>Método más preciso con el mismo paso (h = ${fmt(P.h, 2)} s):</b> RK4 (error en altura ${fmt(r4.errY, 6)} m), seguido de Heun (${fmt(hh.errY, 4)} m) y Euler (${fmt(e.errY, 4)} m). Se justifica por el orden: Euler O(h), Heun O(h²) y RK4 O(h⁴); además RK4 evalúa la pendiente 4 veces por paso, un costo pequeño frente a la mejora.</p>
      <p><b>Conclusión.</b> Obtener un número no basta: hay que contrastarlo con la solución exacta o con un método de mayor orden y decidir si el error es aceptable. Es el mismo criterio que llevó a verificar los cálculos de la misión Friendship 7.</p>`;
  }

  // ---------- animación ----------
  let anim = null;
  function frameAt(tt) {
    const ex = C.analytic(P, P.t0 + tt);
    const maxY = C.analytic(P, P.tf).y || 1;
    $('rk').style.bottom = 10 + Math.min(1, ex.y / maxY) * 70 + 'px';
    $('simInfo').textContent = `t = ${fmt(P.t0 + tt, 1)} s · y = ${fmt(ex.y, 1)} m · v = ${fmt(ex.v, 2)} m/s`;
  }
  $('play').onclick = () => {
    if (anim) cancelAnimationFrame(anim);
    const dur = Math.max(P.tf - P.t0, 1), t0 = performance.now(), speed = 2.5;
    const loop = (now) => {
      const tt = Math.min(((now - t0) / 1000) * speed, dur);
      frameAt(tt);
      if (tt < dur) anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
  };

  // ---------- ejecución ----------
  function run() {
    try { P = readParams(); $('msg').textContent = ''; } catch (e) { $('msg').textContent = '⚠ ' + e.message; return; }
    const { a, c } = C.coef(P);
    $('modelo').textContent = `v' = ${fmt(a, 4)} − ${fmt(c, 4)}·v ,  y' = v ,  v(${P.t0}) = ${P.v0} , y(${P.t0}) = ${P.y0}`;
    R = {}; Object.keys(NAMES).forEach((m) => { R[m] = C.solve(m, P); });
    renderCards(); renderTabs(); $('tbl').innerHTML = tableHTML(R[tab], tab);
    renderCharts(); renderSteps(); renderAnalytic(); renderConclusions(); frameAt(0);
  }
  $('run').onclick = run;
  $('reset').onclick = () => { FIELDS.forEach(([k]) => ($('p_' + k).value = C.DEFAULTS[k])); run(); };
  window.addEventListener('resize', () => R && renderCharts());
  run();
})();
