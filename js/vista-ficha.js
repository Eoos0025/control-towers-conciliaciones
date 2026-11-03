/* Ficha de un período: de dónde sale el saldo, cuadre por negocio y sucursales. */
(function () {
  const NX = (window.NX = window.NX || {});
  const e = NX.esc;
  const cfg = window.NX_CONFIG;
  const TIPOS_INC = { reintegro: "Reintegros", cargo_cancelacion: "Cargos por cancelación", cargo_reclamo: "Cargos por reclamo" };

  function titulo(datos, c) {
    const cu = datos.cuentas.find((x) => x.id === c.cuenta);
    if (cu && cu.tipo_periodo === "mensual") return NX.etiquetaPeriodo(datos, c);
    if (NX.difDias(c.fin, c.inicio) === 6) return "Semana " + NX.semanaIso(c.inicio);
    return NX.rango(c.inicio, c.fin);
  }

  NX.filasSucursales = function (lista, texto) {
    const t = (texto || "").trim().toLowerCase();
    const f = lista.filter((s) => !t || (s.bodega || "").toLowerCase().includes(t) || (s.sucursal || "").toLowerCase().includes(t) || (s.departamento || "").toLowerCase().includes(t));
    if (!f.length) return `<tr><td colspan="7" class="vacio">Ninguna sucursal coincide con la búsqueda.</td></tr>`;
    return f.map((s) => {
      const alto = Math.abs(s.diferencia) > cfg.umbralDescuadreBodega;
      return `<tr>
        <td class="mono">${e(s.bodega)}</td><td>${e(s.sucursal)}</td><td style="color:var(--sub)">${e(s.negocio)}</td><td style="color:var(--sub)">${e(s.departamento)}</td>
        <td class="der">${NX.num(s.ordenes)}</td><td class="der">${NX.num(s.importe_agregador, 2)}</td>
        <td class="der" style="font-weight:600;${alto ? "color:var(--rojo-txt)" : ""}">${NX.signo(s.diferencia)}</td>
      </tr>`;
    }).join("");
  };

  NX.vistaFicha = function (datos, cargaId, bodega) {
    const c = datos.conc.find((x) => x.carga_id === cargaId);
    if (!c) {
      return `<div class="tarjeta"><h2>Período no encontrado</h2><p class="desc">Puede que haya sido reemplazado por una versión más nueva.</p><p><a href="#/operativo">Volver al panel operativo</a></p></div>`;
    }
    const cu = datos.cuentas.find((x) => x.id === c.cuenta) || { tipo_periodo: "" };
    const propias = datos.conc.filter((x) => x.cuenta === c.cuenta).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    const i = propias.indexOf(c);
    const ant = propias[i - 1], sig = propias[i + 1];
    const esParcial = cu.tipo_periodo === "mensual" ? c.fin !== NX.finDeMes(c.inicio) : NX.difDias(c.fin, c.inicio) < 6;
    const suc = (datos.sucPorCarga.get(cargaId) || []).slice().sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
    const negocios = [...new Set(suc.map((s) => s.negocio).filter(Boolean))];

    // Balance: lo que nos deben (−) y debemos (+); los cargos que asume Nexocorp van aparte.
    const bal = NX.balance(datos, cargaId);
    const costos = NX.costosAsumidos(datos, cargaId);
    const filasBal = bal.filter((b) => !NX.esCostoAsumido(b));
    const maxB = Math.max(1, ...filasBal.map((b) => Math.abs(b.valor)));
    const htmlBal = filasBal.map((b) => {
      const total = /saldo\s*neto/i.test(b.concepto);
      const w = b.valor === 0 ? 0 : Math.max(0.6, (Math.abs(b.valor) / maxB) * 48);
      const lado = b.valor < 0 ? "right:50%" : "left:50%";
      const color = b.valor < 0 ? "var(--acento)" : "var(--naranja)";
      return `<div class="balance-fila n ${total ? "total" : ""}">
        <span style="${total ? "" : "color:var(--texto2)"}">${e(b.concepto.replace(/\s+/g, " "))}</span>
        <div class="balance-pista"><div class="cero"></div><div class="b" style="${lado};width:${w}%;background:${color}"></div></div>
        <span style="text-align:right">${NX.signo(b.valor)}</span>
      </div>`;
    }).join("");

    // Cruce de facturas (bloque "facturas" del Resumen)
    const fac = NX.indicadores(datos, cargaId).filter((x) => x.bloque === "facturas");
    const conceptos = [...new Set(fac.map((x) => x.concepto))];
    const v = (con, m) => (fac.find((x) => x.concepto === con && x.metrica === m) || {}).valor;
    let htmlFac = conceptos.map((con) => `<tr><th scope="row">${e(con)}</th><td class="der">${NX.num(v(con, "cantidad"))}</td><td class="der">${NX.num(v(con, "importe"), 2)}</td></tr>`).join("");
    if (conceptos.length === 2) {
      const [a, b] = conceptos;
      htmlFac += `<tr><th scope="row" style="font-weight:600;color:var(--tinta)">Diferencia (1ra − 2da)</th><td class="der"><b>${NX.signo((v(a, "cantidad") || 0) - (v(b, "cantidad") || 0), 0)}</b></td><td class="der"><b>${NX.signo((v(a, "importe") || 0) - (v(b, "importe") || 0))}</b></td></tr>`;
    }

    const segs = NX.segmentos(datos, cargaId);
    const pos = c.saldo_neto === null ? null : c.saldo_neto;

    return `
    <div class="fila" style="justify-content:space-between;align-items:flex-end">
      <div class="apilado" style="gap:8px">
        <nav class="migas" aria-label="Ruta"><a href="#/operativo">Operativo</a><span aria-hidden="true">›</span><span>${e(c.agregador)}</span><span aria-hidden="true">›</span><span style="color:var(--tinta)">${e(NX.etiquetaPeriodo(datos, c))}</span></nav>
        <div class="titulo-ficha">
          <h1>${e(c.nombre_cuenta)} · ${e(titulo(datos, c))}</h1>
          <span class="etiqueta ${esParcial ? "e-proceso" : "e-cerrada"}" style="font-size:12px;padding:4px 10px">${esParcial ? "PARCIAL" : "CERRADA"}</span>
        </div>
        <p class="desc n" style="font-size:14px">${NX.ddmmaaaa(c.inicio)} al ${NX.ddmmaaaa(c.fin)}${negocios.length ? " · " + e(negocios.join(", ")) : ""} · publicada ${NX.fechaHora(c.publicada_en || c.actualizado)} · reglas ${e(c.version_reglas)}</p>
        <p class="nota">Archivo: ${e(c.archivo)}</p>
      </div>
      <div style="display:flex;gap:8px">
        ${ant ? `<a class="btn-sec" href="#/periodo/${ant.carga_id}">‹ ${e(NX.etiquetaPeriodo(datos, ant))}</a>` : `<span class="btn-sec inactivo">Primer período</span>`}
        ${sig ? `<a class="btn-sec" href="#/periodo/${sig.carga_id}">${e(NX.etiquetaPeriodo(datos, sig))} ›</a>` : `<span class="btn-sec inactivo">Último publicado</span>`}
      </div>
    </div>

    <div class="rejilla r200">
      <div class="tarjeta kpi"><p class="lbl">Órdenes</p><p class="valor n" style="font-size:26px">${NX.num(c.ordenes)}</p></div>
      <div class="tarjeta kpi"><p class="lbl">Reportado por ${e(c.agregador)}</p><p class="valor n" style="font-size:26px">Bs ${NX.num(c.importe_agregador, 2)}</p></div>
      <div class="tarjeta kpi"><p class="lbl">Facturado Nexocorp</p><p class="valor n" style="font-size:26px">Bs ${NX.num(c.importe_nexocorp, 2)}</p></div>
      <div class="tarjeta kpi"><p class="lbl">Comisión</p><p class="valor n" style="font-size:26px">Bs ${NX.num(c.comision, 2)}</p></div>
      <div class="tarjeta kpi destacado ${pos > 0 ? "debemos" : ""}"><p class="lbl">Saldo neto</p><p class="valor n ${pos < 0 ? "nos-deben" : pos > 0 ? "debemos" : ""}" style="font-size:26px">${NX.signo(pos)} <small class="${pos < 0 ? "nos-deben" : "debemos"}">${pos < 0 ? "nos deben" : pos > 0 ? "debemos" : ""}</small></p></div>
    </div>

    <div class="fila">
      <section class="tarjeta ancha apilado">
        <div><h2>De dónde sale el saldo</h2><p class="desc">Balance del Resumen: lo que nos deben (−) y lo que debemos (+)</p></div>
        ${htmlBal || '<p class="vacio">El archivo no trae la tabla de balance.</p>'}
        ${costos.length ? `<div style="border-top:1px solid var(--linea);padding-top:14px" class="apilado">
          <p class="lbl">Costos asumidos por Nexocorp · no entran al saldo</p>
          <div class="n" style="display:flex;flex-wrap:wrap;gap:12px 32px;font-size:14px">${costos.map((b) => `<span>${e(b.concepto.replace(/\s+/g, " "))} <b style="margin-left:8px">${NX.signo(b.valor)}</b></span>`).join("")}</div>
        </div>` : ""}
      </section>
      <section class="tarjeta angosta apilado">
        <h2>Cruce de facturas</h2>
        ${htmlFac ? `<table class="tabla grande"><thead><tr><th></th><th class="der">Cantidad</th><th class="der">Importe Bs</th></tr></thead><tbody>${htmlFac}</tbody></table>` : '<p class="vacio">Sin datos de facturas.</p>'}
        <div style="border-top:1px solid var(--linea);padding-top:14px" class="apilado">
          <p class="lbl">Validaciones</p>
          <div id="ficha-validaciones" class="desc">Cargando…</div>
        </div>
      </section>
    </div>

    ${segs.length ? `<section class="tarjeta apilado">
      <h2>Cuadre por ${cu.tipo_periodo === "mensual" ? "sucursal" : "negocio"}</h2>
      <div class="scroll-x"><table class="tabla grande" style="min-width:720px">
        <thead><tr><th>Segmento</th><th class="der">Órdenes</th><th class="der">${e(c.agregador)} Bs</th><th class="der">Nexocorp Bs</th><th class="der">Diferencia</th><th class="der">Tasa comisión</th><th class="der">Comisión Bs</th></tr></thead>
        <tbody>${segs.map((s) => `<tr><th scope="row" style="color:var(--tinta);font-weight:600">${e(s.segmento)}</th><td class="der">${NX.num(s.ordenes.agregador)}</td><td class="der">${NX.num(s.importe.agregador, 2)}</td><td class="der">${NX.num(s.importe.nexocorp, 2)}</td><td class="der"><b>${NX.signo(s.importe.diferencia)}</b></td><td class="der">${e(s.comision.tipo || "—")}</td><td class="der">${NX.num(s.comision.agregador, 2)}</td></tr>`).join("")}</tbody>
      </table></div>
    </section>` : ""}

    <div class="fila">
      <section class="tarjeta ancha apilado">
        <div class="cab-tarjeta" style="margin:0">
          <h2>Sucursales · ${suc.length} bodegas</h2>
          <label class="grupo"><span class="etq">Buscar</span><input class="buscador" type="search" placeholder="Código, nombre o departamento" data-accion="buscar-sucursal" value="${e(bodega || "")}"></label>
        </div>
        <div class="scroll-x" style="max-height:560px;overflow-y:auto">
          <table class="tabla" style="min-width:720px">
            <thead><tr><th>Bodega</th><th>Sucursal</th><th>Negocio</th><th>Departamento</th><th class="der">Órdenes</th><th class="der">${e(c.agregador)} Bs</th><th class="der">Diferencia Bs ↓</th></tr></thead>
            <tbody id="tabla-sucursales">${NX.filasSucursales(suc, bodega)}</tbody>
          </table>
        </div>
        <p class="nota">Ordenadas por diferencia (valor absoluto). ${suc.filter((s) => Math.abs(s.diferencia) <= cfg.umbralExacto).length} cuadran exacto.</p>
      </section>
      <section class="tarjeta angosta apilado">
        <div><h2>Incidencias por sucursal</h2><p class="desc">Reintegros, cancelaciones y reclamos registrados en el archivo</p></div>
        <div id="ficha-incidencias" class="desc">Cargando…</div>
      </section>
    </div>`;
  };

  NX.rellenarDetalleFicha = function (det) {
    const val = document.getElementById("ficha-validaciones");
    const inc = document.getElementById("ficha-incidencias");
    if (val) {
      val.innerHTML = det.validaciones.length
        ? det.validaciones.map((x) => `<div style="display:flex;gap:10px;align-items:baseline;font-size:13px;color:var(--tinta);margin-bottom:6px"><span class="mono" style="color:${x.severidad === "bloquea" ? "var(--rojo-txt)" : "#8A4A0B"}">${e(x.codigo)}</span><span>${e(x.mensaje || NX.VALIDACIONES[x.codigo] || "")}</span></div>`).join("")
        : "Sin advertencias.";
    }
    if (inc) {
      if (!det.incidencias.length) { inc.innerHTML = "El archivo no trae incidencias por sucursal."; return; }
      const porTipo = new Map(), porBod = new Map();
      for (const x of det.incidencias) {
        const n = Number(x.cantidad) || 0;
        porTipo.set(x.tipo, (porTipo.get(x.tipo) || 0) + n);
        porBod.set(x.bodega || "—", (porBod.get(x.bodega || "—") || 0) + n);
      }
      const top = [...porBod.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const max = top[0][1] || 1;
      inc.innerHTML = `
        <div class="n" style="display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;color:var(--tinta);margin-bottom:14px">${[...porTipo.entries()].map(([t, n]) => `<span>${e(TIPOS_INC[t] || t)}: <b>${NX.num(n)}</b></span>`).join("")}</div>
        <div class="apilado" style="gap:10px">${top.map(([b, n]) => `<div class="barra-h n" style="grid-template-columns:52px minmax(0,1fr) 32px;color:var(--tinta)"><span class="mono">${e(b)}</span><div class="pista"><div style="width:${((n / max) * 100).toFixed(1)}%"></div></div><span style="text-align:right;font-weight:600">${n}</span></div>`).join("")}</div>`;
    }
  };
})();
