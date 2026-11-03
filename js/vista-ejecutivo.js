/* Panel ejecutivo: resultados consolidados. */
(function () {
  const NX = (window.NX = window.NX || {});
  const e = NX.esc;
  const COLORES = ["#0E1B2C", "#5B86C9", "#B9C9E3", "#8592A3", "#2E4A6E", "#D5DEEA"];

  function techo(max) {
    if (!max || max <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(max)));
    for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10]) if (k * mag >= max) return k * mag;
    return 10 * mag;
  }

  function posicion(saldo) {
    if (saldo === null) return { txt: "—", cls: "", lado: "" };
    if (Math.abs(saldo) < 0.005) return { txt: "Bs 0", cls: "", lado: "en cero" };
    return saldo < 0
      ? { txt: "Bs " + NX.num(-saldo), cls: "nos-deben", lado: "nos deben" }
      : { txt: "Bs " + NX.num(saldo), cls: "debemos", lado: "debemos" };
  }

  function resumen(datos, P) {
    const t = P.totales;
    if (!P.conc.length) return "No hay conciliaciones publicadas para los filtros elegidos.";
    let s = "Los agregadores reportaron <span class=\"n\">Bs " + NX.corto(t.ventas) + "</span> en ventas";
    if (P.filtros.negocio !== "Todos") s += " de " + e(P.filtros.negocio);
    s += ".";
    if (t.saldo !== null) {
      const p = posicion(t.saldo);
      if (p.lado === "nos deben") s += " La posición neta es de <span class=\"n nos-deben\">" + p.txt + " a favor de Nexocorp</span>";
      else if (p.lado === "debemos") s += " La posición neta es de <span class=\"n debemos\">" + p.txt + " a pagar por Nexocorp</span>";
      else s += " La posición neta está en cero";
    }
    const atr = P.conteo.atrasada;
    if (atr) s += (t.saldo !== null ? " y hay " : " Hay ") + "<span style=\"color:var(--rojo)\">" + atr + (atr === 1 ? " período atrasado" : " períodos atrasados") + "</span>.";
    else s += (t.saldo !== null ? "; " : " ") + "no hay períodos atrasados.";
    return s;
  }

  function kpis(datos, P) {
    const t = P.totales, c = P.conteo;
    const pos = posicion(t.saldo);
    const pct = c.total ? c.cerrada / c.total : 0;
    const w = (n) => (c.total ? (n / c.total) * 100 : 0).toFixed(2) + "%";
    let costos = null, reclamos = 0, cancel = 0;
    if (P.filtros.negocio === "Todos") {
      costos = 0;
      for (const k of P.conc) for (const b of NX.costosAsumidos(datos, k.carga_id)) {
        costos += b.valor;
        if (/reclamo/i.test(b.concepto)) reclamos += b.valor; else cancel += b.valor;
      }
    }
    return `
    <div class="rejilla r200">
      <div class="tarjeta kpi">
        <p class="lbl">Ventas reportadas</p>
        <p class="valor n">Bs ${NX.num(t.ventas)}</p>
        <p class="det n">${NX.num(t.ordenes)} órdenes · ${P.conc.length} ${P.conc.length === 1 ? "período publicado" : "períodos publicados"}</p>
      </div>
      <div class="tarjeta kpi">
        <p class="lbl">Comisión de agregadores</p>
        <p class="valor n">${t.comision === null ? "—" : "Bs " + NX.num(t.comision)}</p>
        <p class="det n">${t.comision === null ? "No disponible por negocio en esta cuenta" : NX.pct(t.ventas ? t.comision / t.ventas : null, 2) + " efectiva sobre ventas"}</p>
      </div>
      <div class="tarjeta kpi destacado ${pos.cls === "debemos" ? "debemos" : ""}">
        <p class="lbl">Posición neta</p>
        <p class="valor n ${pos.cls}">${pos.txt} <small class="${pos.cls}">${pos.lado}</small></p>
        <p class="det n">${t.cxc === null ? "El saldo solo existe por cuenta (quita el filtro de negocio)" : "Por cobrar Bs " + NX.num(Math.abs(t.cxc)) + " · Por pagar Bs " + NX.num(t.cxp)}</p>
      </div>
      <div class="tarjeta kpi">
        <p class="lbl">Avance de conciliación</p>
        <p class="valor n">${NX.num(pct * 100)} % <small>${c.cerrada} de ${c.total} períodos</small></p>
        <div class="barra-avance" aria-hidden="true">
          <div style="width:${w(c.cerrada)};background:var(--acento)"></div>
          <div style="width:${w(c.proceso)};background:var(--proceso)"></div>
          <div style="width:${w(c.atrasada)};background:var(--rojo)"></div>
        </div>
        <p class="det">${c.proceso} en proceso · ${c.atrasada} ${c.atrasada === 1 ? "atrasado" : "atrasados"} · ${c.pendiente} en plazo</p>
      </div>
      <div class="tarjeta kpi">
        <p class="lbl">Costo asumido por Nexocorp</p>
        <p class="valor n">${costos === null ? "—" : "Bs " + NX.num(Math.abs(costos))}</p>
        <p class="det n">${costos === null ? "Disponible solo para el total de la cuenta" : "Reclamos Bs " + NX.num(Math.abs(reclamos)) + " · Cancelaciones Bs " + NX.num(Math.abs(cancel))}</p>
      </div>
    </div>`;
  }

  function evolucion(datos, P, estado) {
    const porCuenta = new Map();
    for (const v of P.valores) { if (!porCuenta.has(v.c.cuenta)) porCuenta.set(v.c.cuenta, []); porCuenta.get(v.c.cuenta).push(v); }
    if (!porCuenta.size) return "";
    let sel = estado.cuentaGrafico;
    if (!porCuenta.has(sel)) sel = [...porCuenta.entries()].sort((a, b) => b[1].length - a[1].length)[0][0];
    const serie = porCuenta.get(sel).sort((a, b) => (a.c.inicio < b.c.inicio ? -1 : 1));
    const max = techo(Math.max(...serie.map((v) => v.ventas || 0)));
    const maxSaldo = Math.max(1, ...serie.map((v) => Math.abs(v.saldo || 0)));
    const conSaldo = serie.some((v) => v.saldo !== null);

    const pestanas = porCuenta.size > 1 ? `<div class="sub-pestanas" role="group" aria-label="Cuenta del gráfico">${[...porCuenta.keys()].map((id) =>
      `<button class="chip" type="button" data-accion="cuenta-grafico" data-valor="${e(id)}" aria-pressed="${id === sel}">${e(NX.nombreCuenta(datos, id))}</button>`).join("")}</div>` : "";

    const cols = serie.map((v, i) => {
      const h = Math.round(((v.ventas || 0) / max) * 176);
      const sh = v.saldo === null ? 0 : Math.max(2, Math.round((Math.abs(v.saldo) / maxSaldo) * 32));
      const et = NX.etiquetaPeriodo(datos, v.c);
      const titulo = et + " (" + NX.rango(v.c.inicio, v.c.fin) + "): ventas Bs " + NX.num(v.ventas, 2) + (v.saldo === null ? "" : " · saldo " + NX.signo(v.saldo));
      return `<a class="columna n" href="#/periodo/${v.c.carga_id}" title="${e(titulo)}">
        <div class="col-ventas"><span class="v">${NX.num((v.ventas || 0) / 1000)}</span><div class="b ${i === serie.length - 1 ? "ultima" : ""}" style="height:${h}px"></div></div>
        ${conSaldo ? `<div class="col-saldo arriba">${v.saldo > 0 ? `<div class="s pos" style="height:${sh}px"></div>` : ""}</div>
        <div class="linea-cero"></div>
        <div class="col-saldo abajo">${v.saldo < 0 ? `<div class="s neg" style="height:${sh}px"></div>` : ""}</div>
        <span class="st">${v.saldo === null ? "" : NX.signo(v.saldo, 0)}</span>` : ""}
        <span class="nom">${e(et)}</span>
      </a>`;
    }).join("");

    return `
    <section class="tarjeta ancha">
      <div class="cab-tarjeta">
        <div>
          <h2>Ventas por período${conSaldo ? " y saldo neto" : ""} · ${e(NX.nombreCuenta(datos, sel))}</h2>
          <p class="desc">Miles de Bs. Clic en una barra para ver el detalle del período.</p>
        </div>
        <div class="leyenda">
          <span><i class="cuadro c-tinta"></i>Ventas</span>
          ${conSaldo ? `<span><i class="cuadro c-cerrada"></i>Nos deben</span><span><i class="cuadro c-naranja"></i>Debemos</span>` : ""}
        </div>
      </div>
      ${pestanas}
      <div class="scroll-x" style="margin-top:12px">
        <div class="grafico" role="img" aria-label="Ventas por período de ${e(NX.nombreCuenta(datos, sel))}" style="min-width:${Math.max(560, serie.length * 40)}px">
          <div class="eje-y n" aria-hidden="true"><span>${NX.corto(max)}</span><span>${NX.corto(max / 2)}</span><span>0</span></div>
          ${cols}
        </div>
      </div>
      ${conSaldo ? `<p class="nota" style="margin-top:12px">Saldo neto: negativo = el agregador nos debe (cuentas por cobrar) · positivo = Nexocorp debe (cuentas por pagar).</p>` : ""}
    </section>`;
  }

  function comparacion(datos, P) {
    const ags = [...new Set(P.cuentas.map((c) => c.agregador))];
    const futuros = P.filtros.agregador === "Todos"
      ? (window.NX_CONFIG.agregadoresFuturos || []).filter((a) => !datos.cuentas.some((c) => c.agregador === a)) : [];
    const total = P.totales.ventas || 0;
    const fila = (nombre, fn) => `<tr><th scope="row">${nombre}</th>${ags.map((a) => `<td class="der">${fn(a)}</td>`).join("")}${futuros.map(() => `<td class="der futuro">—</td>`).join("")}</tr>`;
    const val = (a) => P.valores.filter((v) => v.c.agregador === a);
    const s = (a, k) => { const l = val(a); return l.some((v) => v[k] === null) ? null : l.reduce((x, v) => x + (v[k] || 0), 0); };
    const per = (a) => { const ids = new Set(P.cuentas.filter((c) => c.agregador === a).map((c) => c.id)); const l = P.periodos.filter((p) => ids.has(p.cuenta)); return l.filter((p) => p.estado === "cerrada").length + " de " + l.length; };
    return `
    <section class="tarjeta angosta apilado">
      <h2>Comparación entre agregadores</h2>
      <div class="scroll-x">
        <table class="tabla">
          <thead><tr><th></th>${ags.map((a) => `<th class="der" style="color:var(--tinta);font-weight:600">${e(a)}</th>`).join("")}${futuros.map((a) => `<th class="der futuro">${e(a)}</th>`).join("")}</tr></thead>
          <tbody>
            ${fila("Ventas (Bs)", (a) => NX.num(s(a, "ventas")))}
            ${fila("Participación", (a) => NX.pct(total ? s(a, "ventas") / total : null))}
            ${fila("Órdenes", (a) => NX.num(s(a, "ordenes")))}
            ${fila("Ticket promedio", (a) => { const o = s(a, "ordenes"); return o ? "Bs " + NX.num(s(a, "ventas") / o, 2) : "—"; })}
            ${fila("Comisión efectiva", (a) => { const c = s(a, "comision"); return c === null ? "—" : NX.pct(c / s(a, "ventas"), 2); })}
            ${fila("Posición neta (Bs)", (a) => { const x = s(a, "saldo"); return x === null ? "—" : `<span class="${x < 0 ? "nos-deben" : x > 0 ? "debemos" : ""}">${NX.signo(x, 0)}</span>`; })}
            ${fila("Períodos cerrados", per)}
          </tbody>
        </table>
      </div>
      <p class="nota">Las columnas se arman solas con los agregadores que existen en Supabase.${futuros.length ? " " + e(futuros.join(", ")) + " aparecerá con su primera conciliación." : ""}</p>
    </section>`;
  }

  function agrupar(lista, clave) {
    const m = new Map();
    for (const s of lista) {
      const k = s[clave] || "Sin asignar";
      const g = m.get(k) || { nombre: k, ventas: 0, ordenes: 0 };
      g.ventas += s.importe_agregador || 0; g.ordenes += s.ordenes || 0;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.ventas - a.ventas);
  }

  function participacion(datos, P) {
    const g = agrupar(P.sucursales, "negocio");
    const tot = g.reduce((a, x) => a + x.ventas, 0);
    const futuros = (window.NX_CONFIG.negociosFuturos || []).filter((n) => !g.some((x) => x.nombre === n));
    if (!g.length) return `<section class="tarjeta apilado"><h2>Participación por negocio</h2><p class="vacio">Sin detalle por sucursal para este filtro.</p></section>`;
    return `
    <section class="tarjeta apilado">
      <div><h2>Participación por negocio</h2><p class="desc">${NX.rango(P.desde, P.hasta)} · ventas del detalle por sucursal</p></div>
      <div class="apilada" aria-hidden="true">${g.map((x, i) => `<div style="width:${((x.ventas / tot) * 100).toFixed(2)}%;background:${COLORES[i % COLORES.length]}"></div>`).join("")}</div>
      <div class="lista-neg n">
        ${g.map((x, i) => `<div><i class="cuadro" style="background:${COLORES[i % COLORES.length]}"></i><span class="nom">${e(x.nombre)}</span><span style="color:var(--sub)">${NX.num(x.ordenes)} órd.</span><span style="width:104px;text-align:right">${NX.num(x.ventas)}</span><span style="width:60px;text-align:right;font-weight:600">${NX.pct(x.ventas / tot)}</span></div>`).join("")}
        ${futuros.map((n) => `<div style="color:var(--tenue)"><i class="cuadro c-pendiente"></i><span class="nom">${e(n)}</span><span>sin datos aún</span></div>`).join("")}
      </div>
    </section>`;
  }

  function departamentos(datos, P) {
    const g = agrupar(P.sucursales, "departamento");
    if (!g.length) return `<section class="tarjeta apilado"><h2>Ventas por departamento</h2><p class="vacio">Sin detalle por sucursal para este filtro.</p></section>`;
    const max = g[0].ventas || 1;
    return `
    <section class="tarjeta apilado">
      <div><h2>Ventas por departamento</h2><p class="desc">Miles de Bs · ${NX.rango(P.desde, P.hasta)}</p></div>
      ${g.map((x) => `<div class="barra-h n"><span>${e(x.nombre)}</span><div class="pista"><div style="width:${Math.max(0.5, (x.ventas / max) * 100).toFixed(1)}%"></div></div><span style="text-align:right">${NX.num(x.ventas / 1000, 1)}</span></div>`).join("")}
    </section>`;
  }

  function tendencias(datos, P) {
    const items = [];
    const porCuenta = new Map();
    for (const v of P.valores) { if (!porCuenta.has(v.c.cuenta)) porCuenta.set(v.c.cuenta, []); porCuenta.get(v.c.cuenta).push(v); }
    const principal = [...porCuenta.values()].sort((a, b) => b.length - a.length)[0];
    if (principal && principal.length >= 2) {
      const s = principal.sort((a, b) => (a.c.inicio < b.c.inicio ? -1 : 1));
      const u = s[s.length - 1], a = s[s.length - 2];
      const var1 = a.ventas ? u.ventas / a.ventas - 1 : null;
      const esMax = s.every((x) => x.ventas <= u.ventas);
      items.push([NX.signo(var1 * 100, 1) + " %", `${e(NX.etiquetaPeriodo(datos, u.c))} ${esMax ? "fue el período de mayor venta del rango" : "cerró"} con <span class="n">Bs ${NX.num(u.ventas)}</span>, frente a ${e(NX.etiquetaPeriodo(datos, a.c))}.`, ""]);
      if (s.length >= 4 && s[0].ventas) {
        items.push([NX.signo((u.ventas / s[0].ventas - 1) * 100, 1) + " %", `Variación de la venta de ${e(NX.nombreCuenta(datos, u.c.cuenta))} entre ${e(NX.etiquetaPeriodo(datos, s[0].c))} y ${e(NX.etiquetaPeriodo(datos, u.c))}.`, ""]);
      }
    }
    for (const ag of [...new Set(P.valores.map((v) => v.c.agregador))]) {
      const l = P.valores.filter((v) => v.c.agregador === ag && !P.periodos.some((p) => p.parcial && p.conc && p.conc.carga_id === v.c.carga_id));
      const vt = l.reduce((x, v) => x + (v.ventas || 0), 0), nx = l.reduce((x, v) => x + (v.nexocorp || 0), 0);
      if (vt) items.push([NX.pct(Math.abs(vt - nx) / vt, 2), `Diferencia entre lo que reporta ${e(ag)} y lo facturado por Nexocorp (<span class="n">Bs ${NX.signo(vt - nx, 0)}</span>) en ${l.length} ${l.length === 1 ? "período cerrado" : "períodos cerrados"}.`, ""]);
    }
    for (const p of P.periodos.filter((x) => x.parcial && x.conc)) {
      const d = (p.conc.importe_agregador || 0) - (p.conc.importe_nexocorp || 0);
      items.push([NX.signo(d, 0), `${e(NX.nombreCuenta(datos, p.cuenta))} · ${e(NX.etiquetaPeriodo(datos, p.conc))}: período parcial; la diferencia se cierra con el reporte completo.`, "color:var(--naranja-txt)"]);
    }
    if (!items.length) return "";
    return `
    <section class="tarjeta apilado">
      <h2>Tendencias y variaciones</h2>
      <div class="tendencias">${items.slice(0, 5).map(([c, t, st]) => `<div><span class="cifra n" style="${st}">${c}</span><span>${t}</span></div>`).join("")}</div>
    </section>`;
  }

  NX.vistaEjecutivo = function (datos, P, estado) {
    return `
      <div class="apilado" style="gap:6px">
        <p class="lbl">Resumen · ${NX.rango(P.desde, P.hasta)} ${P.hasta.slice(0, 4)}</p>
        <h1 class="resumen">${resumen(datos, P)}</h1>
      </div>
      ${kpis(datos, P)}
      <div class="fila">${evolucion(datos, P, estado)}${comparacion(datos, P)}</div>
      <div class="rejilla r320">${participacion(datos, P)}${departamentos(datos, P)}${tendencias(datos, P)}</div>
      <section class="futuro-caja">
        <p class="lbl">Próximas fases</p>
        <span>Tiempo de ciclo: días entre el cierre y la publicación</span>
        <span>Nuevas cuentas: Turbo · PedidosYa Brands · Yango Brands</span>
        <span>Resumen del Monitor de Anulaciones</span>
      </section>`;
  };
})();
