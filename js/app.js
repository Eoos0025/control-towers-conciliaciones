/* Arranque: inicio de sesión, filtros, navegación entre paneles. */
(function () {
  const NX = (window.NX = window.NX || {});
  const e = NX.esc;
  const cfg = window.NX_CONFIG;
  const $ = (id) => document.getElementById(id);

  let datos = null;
  const estado = Object.assign(
    { periodo: "todo", desde: "", hasta: "", agregador: "Todos", negocio: "Todos", estado: "Todos", cuentaGrafico: null },
    NX.leer("filtros", {})
  );
  estado.cargaDescuadre = null;
  const detalles = new Map();

  function guardarFiltros() {
    const { periodo, desde, hasta, agregador, negocio, estado: est, cuentaGrafico } = estado;
    NX.guardar("filtros", { periodo, desde, hasta, agregador, negocio, estado: est, cuentaGrafico });
  }

  // ---------------- Sesión ----------------
  function mostrarLogin(msg) {
    $("pantalla-app").classList.add("oculto");
    $("pantalla-login").classList.remove("oculto");
    $("login-error").textContent = msg || "";
    $("login-boton").disabled = false;
  }

  async function iniciar() {
    try {
      NX.iniciarCliente();
    } catch (err) {
      mostrarLogin(err.message);
      $("login-boton").disabled = true;
      return;
    }
    NX.db.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") { datos = null; mostrarLogin(""); }
    });
    const { data } = await NX.db.auth.getSession();
    if (data && data.session) entrar(); else mostrarLogin("");
  }

  $("form-login").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("login-boton").disabled = true;
    $("login-error").textContent = "";
    const { error } = await NX.db.auth.signInWithPassword({ email: $("login-correo").value.trim(), password: $("login-clave").value });
    if (error) {
      const msg = /invalid login/i.test(error.message) ? "Correo o contraseña incorrectos." :
        /fetch|network/i.test(error.message) ? "No se pudo conectar con Supabase. Revisa tu internet e intenta otra vez." : error.message;
      mostrarLogin(msg);
      return;
    }
    $("login-clave").value = "";
    entrar();
  });

  $("btn-salir").addEventListener("click", async () => { await NX.db.auth.signOut(); });
  $("btn-actualizar").addEventListener("click", () => cargar());

  async function entrar() {
    $("pantalla-login").classList.add("oculto");
    $("pantalla-app").classList.remove("oculto");
    if (!location.hash) location.hash = "#/ejecutivo";
    await cargar();
  }

  async function cargar() {
    $("btn-actualizar").disabled = true;
    $("estado-datos").innerHTML = `<span class="punto-estado" style="background:#F2B33D" aria-hidden="true"></span>Actualizando…`;
    if (!datos) $("contenido").innerHTML = `<div class="cargando">Cargando datos…</div>`;
    try {
      datos = await NX.cargarDatos();
      detalles.clear();
      const ej = datos.ultimaEjecucion;
      $("estado-datos").innerHTML = `<span class="punto-estado" aria-hidden="true"></span>Ingesta: ${ej ? NX.fechaHora(ej.fin || ej.inicio) : "sin registro"}`;
      $("estado-datos").title = "Datos leídos de Supabase a las " + datos.leidoEn.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
      render();
    } catch (err) {
      console.error(err);
      if (err && (err.code === "PGRST301" || /jwt/i.test(err.message || ""))) { await NX.db.auth.signOut(); return; }
      $("estado-datos").innerHTML = `<span class="punto-estado" style="background:#F87171" aria-hidden="true"></span>Sin conexión`;
      const aviso = `<div class="aviso error-red" role="alert"><span>No se pudieron leer los datos de Supabase (${e(err.message || "error de red")}). Si estás en la red de la oficina, espera unos minutos.</span><button class="btn-sec" type="button" data-accion="reintentar">Reintentar</button></div>`;
      if (datos) $("contenido").insertAdjacentHTML("afterbegin", aviso); else $("contenido").innerHTML = aviso;
    } finally {
      $("btn-actualizar").disabled = false;
    }
  }

  // ---------------- Filtros ----------------
  function htmlFiltros(vista) {
    if (vista === "ficha") return `<a href="#/operativo" class="btn-sec">‹ Volver al panel operativo</a>`;
    const meses = NX.mesesDisponibles(datos);
    const opt = (v, t) => `<option value="${v}" ${estado.periodo === v ? "selected" : ""}>${t}</option>`;
    const ags = [...new Set(datos.cuentas.map((c) => c.agregador))];
    const agsF = (cfg.agregadoresFuturos || []).filter((a) => !ags.includes(a));
    const negs = [...new Set(datos.sucursales.map((s) => s.negocio).filter(Boolean))].sort();
    const negsF = (cfg.negociosFuturos || []).filter((n) => !negs.includes(n));
    const chips = (accion, actual, lista, futuros) =>
      [`<button class="chip" type="button" data-accion="${accion}" data-valor="Todos" aria-pressed="${actual === "Todos"}">Todos</button>`]
        .concat(lista.map((x) => `<button class="chip" type="button" data-accion="${accion}" data-valor="${e(x)}" aria-pressed="${actual === x}">${e(x)}</button>`))
        .concat(futuros.map((x) => `<button class="chip" type="button" disabled title="Sin conciliaciones cargadas todavía">${e(x)}</button>`)).join("");
    return `
      <label class="grupo"><span class="etq">Período</span>
        <select class="selector" data-accion="periodo">
          ${opt("todo", "Todo el histórico")}${opt("4s", "Últimas 4 semanas")}${opt("3m", "Últimos 3 meses")}
          ${meses.map((m) => opt(m, NX.mes(m + "-01").replace(/^./, (c) => c.toUpperCase()) + " " + m.slice(0, 4))).join("")}
          ${opt("pers", "Rango personalizado…")}
        </select>
      </label>
      ${estado.periodo === "pers" ? `<label class="grupo"><span class="etq">Desde</span><input class="selector" type="date" data-accion="desde" value="${e(estado.desde)}"></label>
      <label class="grupo"><span class="etq">Hasta</span><input class="selector" type="date" data-accion="hasta" value="${e(estado.hasta)}"></label>` : ""}
      <div class="grupo" role="group" aria-label="Agregador"><span class="etq">Agregador</span>${chips("agregador", estado.agregador, ags, agsF)}</div>
      <div class="grupo" role="group" aria-label="Negocio"><span class="etq">Negocio</span>${chips("negocio", estado.negocio, negs, negsF)}</div>
      ${vista === "operativo" ? `<div class="grupo" role="group" aria-label="Estado"><span class="etq">Estado</span>${chips("estado", estado.estado === "Todos" ? "Todos" : NX.ESTADOS[estado.estado].plural, Object.values(NX.ESTADOS).map((x) => x.plural), [])}</div>` : ""}`;
  }

  // ---------------- Navegación ----------------
  function ruta() {
    const h = location.hash.replace(/^#\/?/, "").split("/");
    if (h[0] === "periodo" && h[1]) return { vista: "ficha", carga: Number(h[1]), bodega: h[2] ? decodeURIComponent(h[2]) : "" };
    if (h[0] === "operativo") return { vista: "operativo" };
    return { vista: "ejecutivo" };
  }

  function render() {
    if (!datos) return;
    const r = ruta();
    // valores de filtro que ya no existen
    if (estado.agregador !== "Todos" && !datos.cuentas.some((c) => c.agregador === estado.agregador)) estado.agregador = "Todos";
    if (estado.negocio !== "Todos" && !datos.sucursales.some((s) => s.negocio === estado.negocio)) estado.negocio = "Todos";
    if (/^\d{4}-\d{2}$/.test(estado.periodo) && !NX.mesesDisponibles(datos).includes(estado.periodo)) estado.periodo = "todo";

    $("tab-ejecutivo").toggleAttribute("aria-current", r.vista === "ejecutivo");
    $("tab-operativo").toggleAttribute("aria-current", r.vista !== "ejecutivo");
    if (r.vista === "ejecutivo") $("tab-ejecutivo").setAttribute("aria-current", "page");
    else $("tab-operativo").setAttribute("aria-current", "page");

    // insignia de atrasos (todas las cuentas, sin filtros)
    const hoy = NX.hoy();
    const atrasos = datos.cuentas.reduce((n, c) => n + NX.periodosEsperados(c, datos.conc, hoy).filter((p) => p.estado === "atrasada").length, 0);
    $("insignia-atrasos").textContent = atrasos;
    $("insignia-atrasos").classList.toggle("oculto", !atrasos);
    $("insignia-atrasos").title = atrasos + " períodos atrasados";

    $("filtros").innerHTML = htmlFiltros(r.vista);
    const P = r.vista === "ficha" ? null : NX.preparar(datos, estado);

    if (r.vista === "ejecutivo") $("contenido").innerHTML = NX.vistaEjecutivo(datos, P, estado);
    else if (r.vista === "operativo") $("contenido").innerHTML = NX.vistaOperativo(datos, P, estado);
    else {
      $("contenido").innerHTML = NX.vistaFicha(datos, r.carga, r.bodega);
      abrirDetalle(r.carga);
    }
    document.title = (r.vista === "ejecutivo" ? "Ejecutivo" : r.vista === "operativo" ? "Operativo" : "Período") + " · Torre de Control · Nexocorp";
  }

  async function abrirDetalle(cargaId) {
    if (!datos.conc.some((c) => c.carga_id === cargaId)) return;
    try {
      if (!detalles.has(cargaId)) detalles.set(cargaId, await NX.cargarDetalle(cargaId));
      if (ruta().carga === cargaId) NX.rellenarDetalleFicha(detalles.get(cargaId));
    } catch (err) {
      const t = "No se pudo cargar (" + e(err.message || "error de red") + ").";
      for (const id of ["ficha-validaciones", "ficha-incidencias"]) { const n = $(id); if (n) n.innerHTML = t; }
    }
  }

  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

  // ---------------- Acciones (delegación de eventos) ----------------
  const nombreAEstado = (txt) => Object.keys(NX.ESTADOS).find((k) => NX.ESTADOS[k].plural === txt) || "Todos";

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-accion]");
    if (!el || el.tagName === "SELECT" || el.tagName === "INPUT") return;
    const a = el.dataset.accion, v = el.dataset.valor;
    if (a === "agregador") { estado.agregador = v; estado.cuentaGrafico = null; estado.cargaDescuadre = null; }
    else if (a === "negocio") { estado.negocio = v; estado.cargaDescuadre = null; }
    else if (a === "estado") { const est = Object.keys(NX.ESTADOS).includes(v) ? v : nombreAEstado(v); estado.estado = estado.estado === est ? "Todos" : est; }
    else if (a === "cuenta-grafico") estado.cuentaGrafico = v;
    else if (a === "ir") { location.hash = v; return; }
    else if (a === "reintentar") { cargar(); return; }
    else return;
    guardarFiltros();
    render();
  });

  document.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-accion]");
    if (!el) return;
    const a = el.dataset.accion;
    if (a === "periodo") { estado.periodo = el.value; estado.cargaDescuadre = null; }
    else if (a === "desde") estado.desde = el.value;
    else if (a === "hasta") estado.hasta = el.value;
    else if (a === "periodo-descuadre") estado.cargaDescuadre = Number(el.value);
    else return;
    guardarFiltros();
    render();
  });

  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.accion === "buscar-sucursal") {
      const r = ruta();
      const suc = (datos.sucPorCarga.get(r.carga) || []).slice().sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
      $("tabla-sucursales").innerHTML = NX.filasSucursales(suc, el.value);
    }
  });

  iniciar();
})();
