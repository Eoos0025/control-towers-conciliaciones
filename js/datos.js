/*
 * Lectura de datos desde Supabase (solo lectura, con la sesión del usuario).
 * Supabase devuelve como máximo 1000 filas por consulta: se pagina automáticamente.
 */
(function () {
  const NX = (window.NX = window.NX || {});
  const cfg = window.NX_CONFIG;

  NX.iniciarCliente = function () {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("No se pudo cargar la librería de Supabase (revisa la conexión a internet).");
    }
    if (!cfg.supabaseClavePublica || cfg.supabaseClavePublica.startsWith("PEGAR_")) {
      throw new Error("Falta la clave pública en js/config.js.");
    }
    if (/^sb_secret_/.test(cfg.supabaseClavePublica)) {
      throw new Error("En js/config.js hay una clave SECRETA. Bórrala y usa la publishable (sb_publishable_...).");
    }
    NX.db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseClavePublica, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  };

  async function todo(tabla, select, orden, filtro) {
    const filas = [];
    for (let desde = 0; ; desde += 1000) {
      let q = NX.db.from(tabla).select(select);
      if (filtro) q = filtro(q);
      for (const o of orden) q = q.order(o, { ascending: true });
      const { data, error } = await q.range(desde, desde + 999);
      if (error) throw error;
      filas.push(...data);
      if (data.length < 1000) break;
    }
    return filas;
  }

  const num = (v) => (v === null || v === undefined ? null : Number(v));

  NX.cargarDatos = async function () {
    const [cuentas, conc, suc, ind, cargas, ejec] = await Promise.all([
      todo("cuentas", "id,agregador,nombre,tipo_periodo", ["id"]),
      todo("v_conciliaciones",
        "cuenta,agregador,nombre_cuenta,inicio,fin,tipo_periodo,carga_id,archivo,version_reglas,ordenes," +
        "importe_agregador,importe_nexocorp,comision,cxc,cxp,saldo_neto,codigos,publicada_en,actualizado",
        ["inicio", "cuenta"]),
      todo("v_sucursales",
        "carga_id,bodega,negocio,sucursal,departamento,ordenes,importe_agregador,importe_nexocorp",
        ["carga_id", "id"]),
      todo("v_indicadores", "carga_id,bloque,concepto,segmento,metrica,agregador,nexocorp,diferencia,valor,tipo",
        ["carga_id", "id"], (q) => q.in("bloque", ["cuadre_exitoso", "balance", "facturas"])),
      todo("v_estado_cargas", "carga_id,cuenta,inicio,fin,archivo,estado,codigos,creada,publicada_en,bloqueantes,advertencias",
        ["carga_id"]),
      NX.db.from("ejecuciones").select("id,inicio,fin,entorno,resultado,resumen").order("id", { ascending: false }).limit(1)
        .then(({ data, error }) => { if (error) throw error; return data; })
    ]);

    for (const c of conc) {
      for (const k of ["ordenes", "importe_agregador", "importe_nexocorp", "comision", "cxc", "cxp", "saldo_neto"]) c[k] = num(c[k]);
      c.codigosLista = (c.codigos || "").split(/[\s,;]+/).filter(Boolean);
    }
    for (const s of suc) {
      s.ordenes = num(s.ordenes) || 0;
      s.importe_agregador = num(s.importe_agregador);
      s.importe_nexocorp = num(s.importe_nexocorp);
      s.diferencia = (s.importe_agregador ?? 0) - (s.importe_nexocorp ?? 0);
    }
    for (const i of ind) for (const k of ["agregador", "nexocorp", "diferencia", "valor"]) i[k] = num(i[k]);

    const porCarga = (lista) => {
      const m = new Map();
      for (const x of lista) { if (!m.has(x.carga_id)) m.set(x.carga_id, []); m.get(x.carga_id).push(x); }
      return m;
    };

    return {
      cuentas, conc, cargas,
      sucursales: suc,
      sucPorCarga: porCarga(suc),
      indPorCarga: porCarga(ind),
      ultimaEjecucion: ejec[0] || null,
      leidoEn: new Date()
    };
  };

  // Detalle que solo hace falta al abrir la ficha de un período.
  NX.cargarDetalle = async function (cargaId) {
    const [inc, val] = await Promise.all([
      todo("v_incidencias", "bodega,tipo,cantidad,importe", ["id"], (q) => q.eq("carga_id", cargaId)),
      todo("carga_validaciones", "codigo,severidad,mensaje", ["id"], (q) => q.eq("carga_id", cargaId))
    ]);
    return { incidencias: inc, validaciones: val };
  };
})();
