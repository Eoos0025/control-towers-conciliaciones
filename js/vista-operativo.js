/* Panel operativo: estado de los períodos, alertas y descuadres. */
(function () {
  const NX = (window.NX = window.NX || {});
  const e = NX.esc;
  const cfg = window.NX_CONFIG;
  const RUTINARIAS = new Set(["A03", "A04"]); // diferencias de redondeo frecuentes: no marcan la celda

  const listaEtiquetas = (l) => l.map((p) => e(NX.nombreCuenta(p._datos, p.cuenta).split(" ")[0] + " " + p.etiqueta)).join(", ");

  function contadores(datos, P, estado) {
    const c = P.conteo;
    const por = (est) => P.periodos.filter((p) => p.estado === est).map((p) => ({ ...p, _datos: datos }));
    const cerr = {};
    for (const p of por("cerrada")) { const a = datos.cuentas.find((x) => x.id === p.cuenta)?.agregador || p.cuenta; cerr[a] = (cerr[a] || 0) + 1; }
    const pend = por("pendiente");
    const ej = datos.ultimaEjecucion;
    const conteo = (ej && ej.resumen && ej.resumen.conteo) || {};
    const btn = (est, cls, det) => `
      <button type="button" class="tarjeta contador ${cls}" data-accion="estado" data-valor="${est}" aria-pressed="${estado.estado === est}">
        <span class="lbl" style="display:flex;align-items:center;gap:8px"><i class="cuadro c-${est}"></i>${NX.ESTADOS[est].plural}</span>
        <span class="valor n">${c[est]}</span>
        <span class="det">${det || "—"}</span>
      </button>`;
    return `
    <div class="rejilla r200">
      ${btn("cerrada", "", Object.entries(cerr).map(([a, n]) => n + " " + e(a)).join(" · "))}
      ${btn("proceso", "", listaEtiquetas(por("proceso")))}
      ${btn("pendiente", "", pend.length ? listaEtiquetas(pend.slice(0, 2)) + " · vence " + NX.ddmm(pend[0].vence) : "")}
      ${btn("atrasada", c.atrasada ? "alerta" : "", listaEtiquetas(por("atrasada")))}
      <div class="tarjeta oscura contador" style="cursor:default">
        <span class="lbl">Última ingesta</span>
        <span class="n" style="font-size:20px;font-weight:600">${ej ? NX.fechaHora(ej.fin || ej.inicio) : "Sin registro"}</span>
        <span class="det">${ej ? e(ej.resultado || "") + " · " + (conteo.publicaciones_nuevas || 0) + " nuevas · " + (conteo.rechazados || 0) + " rechazadas · " + datos.conc.length + " vigentes" : ""}</span>
      </div>
    </div>`;
  }

  function mapa(datos, P, estado) {
    const fin = P.hasta < P.hoy ? P.hasta : P.hoy;
    const ini = P.desde;
    const total = Math.max(1, NX.difDias(fin, ini) + 1);
    const pos = (a, b) => {
      const ia = a < ini ? ini : a, fb = b > fin ? fin : b;
      return { left: (NX.difDias(ia, ini) / total) * 100, width: ((NX.difDias(fb, ia) + 1) / total) * 100 };
    };
    const meses = [];
    for (let m = NX.inicioDeMes(ini); m <= fin; m = NX.sumarDias(NX.finDeMes(m), 1)) {
      const p = m < ini ? 0 : (NX.difDias(m, ini) / total) * 100;
      meses.push(`<span style="left:${p.toFixed(2)}%">${NX.mes(m < ini ? ini : m)}</span>`);
    }
    const hoyPos = P.hoy <= fin ? (NX.difDias(P.hoy, ini) / total) * 100 : null;

    const filas = P.cuentas.map((cu) => {
      const ps = P.periodos.filter((p) => p.cuenta === cu.id);
      const conc = P.conc.filter((c) => c.cuenta === cu.id);
      const negocios = [...new Set(conc.flatMap((c) => (datos.sucPorCarga.get(c.carga_id) || []).map((s) => s.negocio)).filter(Boolean))];
      const celdas = ps.map((p) => {
        const { left, width } = pos(p.inicio, p.fin);
        const at = estado.estado !== "Todos" && estado.estado !== p.estado ? " atenuada" : "";
        const cls = { cerrada: "cerrada", proceso: "proceso", pendiente: "pendiente", atrasada: "atrasada" }[p.estado];
        const adv = p.conc && p.conc.codigosLista.some((x) => !RUTINARIAS.has(x));
        const info = p.etiqueta + " · " + NX.rango(p.inicio, p.fin) + " · " + NX.ESTADOS[p.estado].nombre +
          (p.vence && p.estado !== "cerrada" ? " · vence " + NX.ddmmaaaa(p.vence) : "") +
          (p.diasAtraso ? " · " + p.diasAtraso + " días de atraso" : "") +
          (p.conc && p.conc.codigosLista.length ? " · validaciones: " + p.conc.codigosLista.join(" ") : "");
        const estilo = `left:${left.toFixed(3)}%;width:calc(${width.toFixed(3)}% - 3px)`;
        const txt = e(p.estado === "atrasada" ? "!" : p.etiqueta.split(" ")[0]);
        return p.conc
          ? `<a class="celda ${cls}${at}" href="#/periodo/${p.conc.carga_id}" style="${estilo}" title="${e(info)}" aria-label="${e(info)}">${adv ? '<span class="adv"></span>' : ""}${txt}</a>`
          : `<span class="celda ${cls}${at}" style="${estilo}" title="${e(info)}" role="img" aria-label="${e(info)}">${txt}</span>`;
      }).join("");
      return `<div class="mapa-fila">
        <div class="mapa-nombre">${e(cu.agregador)}<span>${e(negocios.join(" · ") || cu.nombre)} · ${e(cu.tipo_periodo)}</span></div>
        <div class="pista-mapa">${celdas}${hoyPos !== null ? `<span class="marca-hoy" style="left:${hoyPos.toFixed(2)}%" title="Hoy"></span>` : ""}</div>
      </div>`;
    }).join("");

    const futuros = P.filtros.agregador === "Todos"
      ? (cfg.agregadoresFuturos || []).filter((a) => !datos.cuentas.some((c) => c.agregador === a)) : [];
    const filasFuturas = futuros.map((a) => `<div class="mapa-fila">
      <div class="mapa-nombre" style="color:var(--tenue)">${e(a)}<span>pendiente de incorporar</span></div>
      <div class="pista-futura">La fila aparece sola cuando se publique su primera conciliación.</div></div>`).join("");

    const dias = [...new Set(P.cuentas.map((c) => {
      const p = P.periodos.find((x) => x.cuenta === c.id);
      return p ? e(c.agregador) + " " + p.diasAtrasoCfg + " días" : null;
    }).filter(Boolean))].join(" y ");

    return `
    <section class="tarjeta">
      <div class="cab-tarjeta">
        <div>
          <h2>Mapa de períodos</h2>
          <p class="desc">Atrasada: sin archivo pasado el plazo después del cierre${dias ? " (" + dias + ")" : ""}. Clic en un período publicado para ver su ficha.</p>
        </div>
        <div class="leyenda">
          <span><i class="cuadro c-cerrada"></i>Cerrada</span>
          <span><i class="cuadro c-proceso"></i>En proceso / parcial</span>
          <span><i class="cuadro c-pendiente"></i>Pendiente en plazo</span>
          <span><i class="cuadro c-atrasada"></i>Atrasada</span>
          <span><i class="cuadro" style="width:6px;height:6px;border-radius:3px;background:var(--ambar);box-shadow:0 0 0 2px var(--tinta)"></i>Con advertencias a revisar</span>
        </div>
      </div>
      <div class="scroll-x">
        <div class="mapa">
          <div class="mapa-fila"><span></span><div class="pista-meses">${meses.join("")}</div></div>
          ${filas || '<p class="vacio">No hay cuentas para este filtro.</p>'}
          ${filasFuturas}
        </div>
      </div>
    </section>`;
  }

  function ultimoCerrado(P, cuentaId) {
    return P.periodos.filter((p) => p.cuenta === cuentaId && p.estado === "cerrada").sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0];
  }

  function sucDe(datos, P, cargaId) {
    return (datos.sucPorCarga.get(cargaId) || []).filter((s) => P.filtros.negocio === "Todos" || s.negocio === P.filtros.negocio);
  }

  function alertas(datos, P, estado) {
    const items = [];
    const nom = (id) => NX.nombreCuenta(datos, id);
    for (const p of P.periodos.filter((x) => x.estado === "atrasada").sort((a, b) => b.diasAtraso - a.diasAtraso)) {
      items.push({ est: "atrasada", tag: "ATRASADA", cls: "e-atrasada", tit: nom(p.cuenta) + " · " + p.etiqueta + " (" + NX.rango(p.inicio, p.fin) + ")", det: "No llegó el archivo. Venció el " + NX.ddmmaaaa(p.vence) + ".", meta: p.diasAtraso + (p.diasAtraso === 1 ? " día" : " días"), metaCls: "color:var(--rojo-txt)" });
    }
    const vigentes = new Map(datos.conc.map((c) => [c.cuenta + c.inicio + c.fin, c]));
    const ids = new Set(P.cuentas.map((c) => c.id));
    for (const r of datos.cargas.filter((c) => c.estado === "rechazada" && ids.has(c.cuenta) && c.fin >= P.desde && c.inicio <= P.hasta)) {
      const v = vigentes.get(r.cuenta + r.inicio + r.fin);
      if (v && v.publicada_en && v.publicada_en > r.creada) continue; // ya se corrigió con una versión posterior
      items.push({ est: null, tag: "RECHAZADO", cls: "e-revisar", tit: nom(r.cuenta) + " · " + NX.rango(r.inicio, r.fin), det: "El archivo " + r.archivo + " no se publicó: " + r.bloqueantes + " validación(es) bloqueante(s)" + (r.codigos ? " (" + r.codigos + ")" : "") + ".", meta: NX.fechaHora(r.creada).split(" · ")[0], metaCls: "color:#8A4A0B" });
    }
    for (const p of P.periodos.filter((x) => x.estado === "proceso")) {
      const d = (p.conc.importe_agregador || 0) - (p.conc.importe_nexocorp || 0);
      items.push({ est: "proceso", tag: "EN PROCESO", cls: "e-proceso", href: "#/periodo/" + p.conc.carga_id, tit: nom(p.cuenta) + " · " + p.etiqueta, det: "Publicado solo " + NX.rango(p.conc.inicio, p.conc.fin) + " (diferencia Bs " + NX.signo(d, 0) + "). El período completo reemplazará esta parte.", meta: "vence " + NX.ddmm(p.vence), metaCls: "color:var(--texto2)" });
    }
    for (const p of P.periodos.filter((x) => x.estado === "pendiente" && x.diasParaVencer <= 2)) {
      items.push({ est: "pendiente", tag: "POR VENCER", cls: "e-info", tit: nom(p.cuenta) + " · " + p.etiqueta + " (" + NX.rango(p.inicio, p.fin) + ")", det: "Aún en plazo; vence el " + NX.ddmmaaaa(p.vence) + ".", meta: p.diasParaVencer === 0 ? "hoy" : p.diasParaVencer + (p.diasParaVencer === 1 ? " día" : " días"), metaCls: "color:var(--texto2)" });
    }
    for (const cu of P.cuentas) {
      const p = ultimoCerrado(P, cu.id);
      if (!p) continue;
      const s = sucDe(datos, P, p.conc.carga_id).filter((x) => Math.abs(x.diferencia) > cfg.umbralDescuadreBodega).sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
      if (!s.length) continue;
      const tot = sucDe(datos, P, p.conc.carga_id).length;
      items.push({ est: "cerrada", tag: "REVISAR", cls: "e-revisar", href: "#/periodo/" + p.conc.carga_id, tit: nom(cu.id) + " · " + p.etiqueta, det: s.length + " de " + tot + " sucursales con diferencia mayor a Bs " + cfg.umbralDescuadreBodega + "; " + (s[0].sucursal || s[0].bodega) + " (" + s[0].bodega + ") la más alta: Bs " + NX.signo(s[0].diferencia) + ".", meta: s.length + (s.length === 1 ? " bodega" : " bodegas"), metaCls: "color:#8A4A0B" });
    }
    const conSigno = P.conc.filter((c) => c.codigosLista.includes("A05"));
    if (conSigno.length) items.push({ est: "cerrada", tag: "REVISAR", cls: "e-revisar", tit: "Signo inesperado en un saldo", det: "Revisar el Resumen de: " + conSigno.map((c) => NX.etiquetaPeriodo(datos, c)).join(", ") + ".", meta: conSigno.length + (conSigno.length === 1 ? " período" : " períodos"), metaCls: "color:#8A4A0B" });
    const alias = P.conc.filter((c) => c.codigosLista.includes("A11"));
    if (alias.length) items.push({ est: "cerrada", tag: "INFO", cls: "e-info", tit: "Bodegas corregidas por alias", det: "Códigos de bodega mal escritos que se corrigieron automáticamente (ver validaciones en cada ficha).", meta: alias.length + (alias.length === 1 ? " período" : " períodos"), metaCls: "color:var(--texto2)" });

    const vis = estado.estado === "Todos" ? items : items.filter((i) => i.est === estado.estado);
    const html = vis.map((i) => {
      const tag = i.href ? "a" : "div";
      return `<${tag} class="alerta-item"${i.href ? ` href="${i.href}"` : ""}>
        <span class="etiqueta ${i.cls}">${i.tag}</span>
        <span style="min-width:0"><span class="tit">${e(i.tit)}</span><span class="det">${e(i.det)}</span></span>
        <span class="meta n" style="${i.metaCls}">${e(i.meta)}</span>
      </${tag}>`;
    }).join("");
    return `
    <section class="tarjeta" style="flex:1 1 520px">
      <div class="cab-tarjeta" style="margin-bottom:6px"><h2>Requiere atención</h2><span class="desc" style="margin:0">${vis.length} ${vis.length === 1 ? "elemento" : "elementos"} · por prioridad</span></div>
      ${html || '<p class="vacio">Todo al día: no hay pendientes que requieran atención.</p>'}
    </section>`;
  }

  function descuadres(datos, P, estado) {
    const opciones = [...P.conc].sort((a, b) => (a.fin < b.fin ? 1 : a.fin > b.fin ? -1 : a.cuenta < b.cuenta ? -1 : 1));
    if (!opciones.length) return `<section class="tarjeta" style="flex:1 1 520px"><h2>Sucursales con descuadre</h2><p class="vacio">Sin períodos publicados.</p></section>`;
    const sel = opciones.find((c) => c.carga_id === estado.cargaDescuadre) ||
      opciones.find((c) => sucDe(datos, P, c.carga_id).length > 0) || opciones[0];
    const s = sucDe(datos, P, sel.carga_id);
    const ex = cfg.umbralExacto, um = cfg.umbralDescuadreBodega;
    const b = [0, 0, 0, 0];
    for (const x of s) { const d = Math.abs(x.diferencia); b[d <= ex ? 0 : d <= 5 ? 1 : d <= um ? 2 : 3]++; }
    const top = [...s].filter((x) => Math.abs(x.diferencia) > ex).sort((a, b2) => Math.abs(b2.diferencia) - Math.abs(a.diferencia)).slice(0, 10);
    const maxD = top.length ? Math.abs(top[0].diferencia) : 1;
    return `
    <section class="tarjeta apilado" style="flex:1 1 520px">
      <div class="cab-tarjeta" style="margin:0">
        <div><h2>Sucursales con descuadre</h2><p class="desc">Agregador vs Nexocorp por bodega · ${s.length} sucursales</p></div>
        <label class="grupo"><span class="etq">Período</span>
          <select class="selector" data-accion="periodo-descuadre">
            ${opciones.map((c) => `<option value="${c.carga_id}" ${c.carga_id === sel.carga_id ? "selected" : ""}>${e(c.agregador)} · ${e(NX.etiquetaPeriodo(datos, c))}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="distribucion n">
        <div><b>${b[0]}</b><span>cuadran exacto</span></div>
        <div><b>${b[1]}</b><span>hasta Bs 5</span></div>
        <div class="medio"><b>${b[2]}</b><span>Bs 5 a ${um}</span></div>
        <div class="alto"><b>${b[3]}</b><span>más de Bs ${um}</span></div>
      </div>
      <div class="scroll-x">
        <table class="tabla">
          <thead><tr><th>Bodega</th><th>Sucursal</th><th>Negocio</th><th class="der">Órdenes</th><th class="der">Diferencia Bs</th></tr></thead>
          <tbody>
            ${top.map((x) => `<tr class="clic" data-accion="ir" data-valor="#/periodo/${sel.carga_id}/${encodeURIComponent(x.bodega || "")}">
              <td class="mono">${e(x.bodega)}</td><td>${e(x.sucursal)}</td><td style="color:var(--sub)">${e(x.negocio)}</td>
              <td class="der">${NX.num(x.ordenes)}</td>
              <td class="der" style="white-space:nowrap"><span class="mini-barra" style="width:${Math.round((Math.abs(x.diferencia) / maxD) * 56)}px;background:${Math.abs(x.diferencia) > um ? "var(--rojo)" : "var(--naranja)"}"></span><b>${NX.signo(x.diferencia)}</b></td>
            </tr>`).join("") || `<tr><td colspan="5" class="vacio">Todas las sucursales cuadran.</td></tr>`}
          </tbody>
        </table>
      </div>
      <p class="nota">Positivo: el agregador reporta más que lo facturado por Nexocorp. Clic en una fila para abrir la ficha del período.</p>
    </section>`;
  }

  function seguimiento(datos, P) {
    const filas = [];
    for (const cu of P.cuentas) {
      const p = ultimoCerrado(P, cu.id);
      if (!p) { filas.push(`<tr><td><b>${e(cu.agregador)}</b> · ${e(cu.nombre)}</td><td style="color:var(--sub)">Sin períodos cerrados</td><td class="der">—</td></tr>`); continue; }
      let segs = NX.segmentos(datos, p.conc.carga_id);
      if (P.filtros.negocio !== "Todos") segs = segs.filter((s) => s.segmento === P.filtros.negocio);
      if (!segs.length) segs = [{ segmento: cu.nombre, importe: { diferencia: (p.conc.importe_agregador || 0) - (p.conc.importe_nexocorp || 0) } }];
      for (const s of segs) {
        filas.push(`<tr class="clic" data-accion="ir" data-valor="#/periodo/${p.conc.carga_id}"><td><b>${e(cu.agregador)}</b> · ${e(s.segmento)}</td><td>${e(p.etiqueta)} · ${NX.rango(p.inicio, p.fin)}</td><td class="der">${NX.signo(s.importe.diferencia)}</td></tr>`);
      }
    }
    return `
    <section class="tarjeta apilado">
      <div><h2>Seguimiento por agregador y negocio</h2><p class="desc">Último período cerrado de cada cuenta</p></div>
      <div class="scroll-x"><table class="tabla"><thead><tr><th>Cuenta · segmento</th><th>Último cerrado</th><th class="der">Diferencia Bs</th></tr></thead><tbody>${filas.join("")}</tbody></table></div>
    </section>`;
  }

  function avance(datos, P) {
    const m = new Map();
    for (const p of P.periodos) {
      const k = p.fin.slice(0, 7);
      const g = m.get(k) || { cerrada: 0, proceso: 0, pendiente: 0, atrasada: 0, total: 0 };
      g[p.estado]++; g.total++;
      m.set(k, g);
    }
    const filas = [...m.entries()].sort().map(([k, g]) => {
      const w = (n) => ((n / g.total) * 100).toFixed(2) + "%";
      return `<div class="barra-h n" style="grid-template-columns:96px minmax(0,1fr) 60px">
        <span>${NX.mes(k + "-01").replace(/^./, (c) => c.toUpperCase())}</span>
        <div class="pista" style="display:flex;gap:2px;height:12px" aria-hidden="true">
          <div style="width:${w(g.cerrada)};background:var(--acento);border-radius:0"></div>
          ${g.proceso ? `<div style="width:${w(g.proceso)};background:var(--proceso);border-radius:0"></div>` : ""}
          ${g.atrasada ? `<div style="width:${w(g.atrasada)};background:var(--rojo);border-radius:0"></div>` : ""}
        </div>
        <span style="text-align:right;font-weight:600">${g.cerrada} de ${g.total}</span>
      </div>`;
    }).join("");
    return `
    <section class="tarjeta apilado">
      <div><h2>Evolución del avance</h2><p class="desc">Períodos cerrados sobre esperados, por mes de cierre</p></div>
      ${filas || '<p class="vacio">Sin períodos esperados en este rango.</p>'}
    </section>`;
  }

  function calidad(datos, P) {
    const m = new Map();
    for (const c of P.conc) for (const k of new Set(c.codigosLista)) m.set(k, (m.get(k) || 0) + 1);
    const filas = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) =>
      `<div class="barra-h n" style="grid-template-columns:40px minmax(0,1fr) 40px"><span class="mono" style="color:var(--sub)">${e(k)}</span><span>${e(NX.VALIDACIONES[k] || "Validación")}</span><span style="text-align:right;font-weight:600">${n}</span></div>`).join("");
    return `
    <section class="tarjeta apilado">
      <div><h2>Calidad de los archivos</h2><p class="desc">Advertencias en los ${P.conc.length} períodos vigentes del filtro (no bloquean la publicación)</p></div>
      ${filas || '<p class="vacio">Sin advertencias.</p>'}
    </section>`;
  }

  NX.vistaOperativo = function (datos, P, estado) {
    return `
      ${contadores(datos, P, estado)}
      ${mapa(datos, P, estado)}
      <div class="fila">${alertas(datos, P, estado)}${descuadres(datos, P, estado)}</div>
      <div class="rejilla r320">${seguimiento(datos, P)}${avance(datos, P)}${calidad(datos, P)}</div>
      <section class="futuro-caja">
        <div style="flex:1 1 280px">
          <p class="lbl">Fase 2 · Monitor de Anulaciones</p>
          <p style="margin:6px 0 0;line-height:1.5">Resumen que el monitor enviará a Supabase: casos pendientes, monto pendiente y bodegas sin respuesta. El seguimiento caso a caso sigue en su herramienta.</p>
        </div>
      </section>`;
  };
})();
