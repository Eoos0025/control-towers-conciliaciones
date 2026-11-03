/*
 * Cálculos del dashboard: calendario de períodos esperados, estados, filtros y totales.
 *
 * Estados de un período:
 *   cerrada   -> hay una conciliación publicada que cubre el período completo
 *   proceso   -> solo hay una parte publicada (p. ej. la 1ra quincena de Yango)
 *   pendiente -> el período terminó, no hay archivo, pero sigue dentro del plazo
 *   atrasada  -> el período terminó hace más de N días (config) y no hay archivo
 */
(function () {
  const NX = (window.NX = window.NX || {});
  const cfg = window.NX_CONFIG;

  NX.ESTADOS = {
    cerrada: { nombre: "Cerrada", plural: "Cerradas" },
    proceso: { nombre: "En proceso", plural: "En proceso" },
    pendiente: { nombre: "Pendiente en plazo", plural: "Pendientes en plazo" },
    atrasada: { nombre: "Atrasada", plural: "Atrasadas" }
  };

  NX.VALIDACIONES = {
    A01: "Advertencia de lectura del archivo",
    A02: "Revisión de nombres de sucursal",
    A03: "Detalle y Resumen no coinciden exacto",
    A04: "Aritmética del Resumen con redondeos",
    A05: "Signo inesperado en un saldo",
    A06: "Desfase de fechas Yango (explicado)",
    A07: "Rango de fechas del NAF por revisar",
    A08: "Período parcial (quincena)",
    A09: "Advertencia de validación",
    A10: "Períodos superpuestos",
    A11: "Bodega corregida por alias"
  };

  function configCuenta(cuenta, conc) {
    const c = cfg.cuentas[cuenta.id] || {};
    const propias = conc.filter((x) => x.cuenta === cuenta.id).map((x) => x.inicio).sort();
    return {
      inicio: c.inicio || propias[0] || cfg.inicioPorDefecto,
      diasAtraso: c.diasAtraso ?? cfg.diasAtrasoPorDefecto[cuenta.tipo_periodo] ?? 7
    };
  }

  function estadoSinArchivo(fin, dias, hoy) {
    const vence = NX.sumarDias(fin, dias);
    if (hoy > vence) return { estado: "atrasada", vence, diasAtraso: NX.difDias(hoy, vence) };
    return { estado: "pendiente", vence, diasParaVencer: NX.difDias(vence, hoy) };
  }

  // Calendario de períodos esperados de una cuenta, desde su fecha de inicio hasta hoy.
  NX.periodosEsperados = function (cuenta, conc, hoy) {
    const { inicio, diasAtraso } = configCuenta(cuenta, conc);
    const propias = conc.filter((x) => x.cuenta === cuenta.id);
    const lista = [];

    if (cuenta.tipo_periodo === "mensual") {
      for (let m = NX.inicioDeMes(inicio); m <= hoy; m = NX.sumarDias(NX.finDeMes(m), 1)) {
        const ini = m < inicio ? inicio : m;
        const fin = NX.finDeMes(m);
        const enMes = propias.filter((x) => x.inicio >= m && x.inicio <= fin);
        const completa = enMes.find((x) => x.fin === fin);
        const parcial = enMes.filter((x) => x.fin < fin).sort((a, b) => (a.fin < b.fin ? 1 : -1))[0];
        const base = { cuenta: cuenta.id, inicio: ini, fin, etiqueta: NX.mes(m).slice(0, 3).replace(/^./, (c) => c.toUpperCase()) + (ini > m ? " (desde " + Number(ini.slice(8)) + ")" : ""), diasAtrasoCfg: diasAtraso };
        if (completa) { lista.push({ ...base, estado: "cerrada", conc: completa }); continue; }
        const terminado = fin < hoy;
        if (parcial) {
          lista.push({ ...base, estado: "proceso", conc: parcial, parcial: true, vence: NX.sumarDias(fin, diasAtraso) });
          continue;
        }
        if (!terminado) continue; // mes en curso sin nada publicado: aún no se espera
        lista.push({ ...base, ...estadoSinArchivo(fin, diasAtraso, hoy) });
      }
    } else {
      // semanal (lunes a domingo) y cualquier otro tipo se tratan por semanas
      for (let l = NX.lunes(inicio); l <= hoy; l = NX.sumarDias(l, 7)) {
        const fin = NX.sumarDias(l, 6);
        const base = { cuenta: cuenta.id, inicio: l, fin, etiqueta: "S" + NX.semanaIso(l), diasAtrasoCfg: diasAtraso };
        const exacta = propias.find((x) => x.inicio === l && x.fin === fin);
        if (exacta) { lista.push({ ...base, estado: "cerrada", conc: exacta }); continue; }
        const parcial = propias.find((x) => x.inicio >= l && x.fin <= fin);
        if (parcial) { lista.push({ ...base, estado: "proceso", conc: parcial, parcial: true, vence: NX.sumarDias(fin, diasAtraso) }); continue; }
        if (fin >= hoy) continue; // semana en curso
        lista.push({ ...base, ...estadoSinArchivo(fin, diasAtraso, hoy) });
      }
    }
    return lista;
  };

  // Rango de fechas según el filtro de período.
  NX.rangoFiltro = function (datos, f) {
    const hoy = NX.hoy();
    const min = datos.conc.length ? datos.conc.map((c) => c.inicio).sort()[0] : cfg.inicioPorDefecto;
    const minimo = [min, cfg.inicioPorDefecto].sort()[0];
    switch (f.periodo) {
      case "4s": return { desde: NX.sumarDias(hoy, -28), hasta: hoy };
      case "3m": return { desde: NX.sumarDias(hoy, -91), hasta: hoy };
      case "pers": return { desde: f.desde || minimo, hasta: f.hasta || hoy };
      default:
        if (/^\d{4}-\d{2}$/.test(f.periodo)) return { desde: f.periodo + "-01", hasta: NX.finDeMes(f.periodo + "-01") };
        return { desde: minimo, hasta: hoy };
    }
  };

  NX.mesesDisponibles = function (datos) {
    const s = new Set(datos.conc.map((c) => c.fin.slice(0, 7)));
    return [...s].sort().reverse();
  };

  // Aplica los filtros y devuelve todo lo que necesitan las vistas.
  NX.preparar = function (datos, f) {
    const hoy = NX.hoy();
    const { desde, hasta } = NX.rangoFiltro(datos, f);
    const solapa = (x) => x.fin >= desde && x.inicio <= hasta;

    const cuentas = datos.cuentas.filter((c) => f.agregador === "Todos" || c.agregador === f.agregador);
    const idsCuentas = new Set(cuentas.map((c) => c.id));

    let conc = datos.conc.filter((c) => idsCuentas.has(c.cuenta) && solapa(c));
    let periodos = [];
    for (const c of cuentas) periodos.push(...NX.periodosEsperados(c, datos.conc, hoy).filter(solapa));

    // Filtro por negocio: usa el detalle por sucursal.
    const negocio = f.negocio;
    const sucDe = (cargaId) => (datos.sucPorCarga.get(cargaId) || []).filter((s) => negocio === "Todos" || s.negocio === negocio);
    if (negocio !== "Todos") {
      conc = conc.filter((c) => sucDe(c.carga_id).length > 0);
      const conDatos = new Set(conc.map((c) => c.cuenta));
      periodos = periodos.filter((p) => conDatos.has(p.cuenta));
    }

    const sucursales = conc.flatMap((c) => sucDe(c.carga_id).map((s) => ({ ...s, cuenta: c.cuenta, agregador: c.agregador, inicio: c.inicio, fin: c.fin })));

    // Valores por período (si hay filtro de negocio, ventas y órdenes salen del detalle por sucursal).
    const valores = conc.map((c) => {
      const s0 = sucDe(c.carga_id);
      const completo = negocio === "Todos" || s0.length === (datos.sucPorCarga.get(c.carga_id) || []).length;
      if (completo) return { c, ventas: c.importe_agregador, nexocorp: c.importe_nexocorp, ordenes: c.ordenes, comision: c.comision, saldo: c.saldo_neto, cxc: c.cxc, cxp: c.cxp };
      const s = sucDe(c.carga_id);
      const seg = (datos.indPorCarga.get(c.carga_id) || []).find((i) => i.bloque === "cuadre_exitoso" && i.metrica === "comision" && i.segmento === negocio);
      return {
        c,
        ventas: s.reduce((a, x) => a + (x.importe_agregador || 0), 0),
        nexocorp: s.reduce((a, x) => a + (x.importe_nexocorp || 0), 0),
        ordenes: s.reduce((a, x) => a + x.ordenes, 0),
        comision: seg ? seg.agregador : null,
        saldo: null, cxc: null, cxp: null
      };
    });

    const suma = (k) => valores.reduce((a, v) => (v[k] === null ? a : a + v[k]), 0);
    const hayNulos = (k) => valores.some((v) => v[k] === null);
    const contar = (e) => periodos.filter((p) => p.estado === e).length;

    return {
      hoy, desde, hasta, filtros: f, cuentas, conc, periodos, sucursales, valores,
      totales: {
        ventas: suma("ventas"), nexocorp: suma("nexocorp"), ordenes: suma("ordenes"),
        comision: hayNulos("comision") ? null : suma("comision"),
        saldo: hayNulos("saldo") ? null : suma("saldo"),
        cxc: hayNulos("cxc") ? null : suma("cxc"),
        cxp: hayNulos("cxp") ? null : suma("cxp")
      },
      conteo: { cerrada: contar("cerrada"), proceso: contar("proceso"), pendiente: contar("pendiente"), atrasada: contar("atrasada"), total: periodos.length }
    };
  };

  // Indicadores de un período ya leídos.
  NX.indicadores = (datos, cargaId) => datos.indPorCarga.get(cargaId) || [];

  NX.balance = function (datos, cargaId) {
    return NX.indicadores(datos, cargaId)
      .filter((i) => i.bloque === "balance" && i.valor !== null && /importe/.test(i.metrica || ""))
      .map((i) => {
        const tipo = NX.indicadores(datos, cargaId).find((t) => t.bloque === "balance" && t.concepto === i.concepto && t.metrica === "tipo");
        return { concepto: i.concepto, valor: i.valor, tipo: tipo ? tipo.tipo : "" };
      });
  };

  // Costos que asume Nexocorp (cargos por reclamos y cancelaciones; no entran al saldo).
  NX.esCostoAsumido = (b) => /asume/i.test(b.tipo || "") || /^cargos\s*x/i.test(b.concepto || "");
  NX.costosAsumidos = function (datos, cargaId) {
    return NX.balance(datos, cargaId).filter(NX.esCostoAsumido);
  };

  NX.segmentos = function (datos, cargaId) {
    const ind = NX.indicadores(datos, cargaId).filter((i) => i.bloque === "cuadre_exitoso" && i.segmento);
    const nombres = [...new Set(ind.map((i) => i.segmento))];
    return nombres.map((n) => {
      const g = (m) => ind.find((i) => i.segmento === n && i.metrica === m) || {};
      return { segmento: n, ordenes: g("ordenes"), importe: g("importe"), comision: g("comision") };
    });
  };

  NX.nombreCuenta = function (datos, id) {
    const c = datos.cuentas.find((x) => x.id === id);
    return c ? c.nombre : id;
  };
  NX.etiquetaPeriodo = function (datos, conc) {
    const cu = datos.cuentas.find((x) => x.id === conc.cuenta);
    if (cu && cu.tipo_periodo === "mensual") {
      const completo = conc.inicio.slice(8) === "01" && conc.fin === NX.finDeMes(conc.inicio);
      const nom = NX.mes(conc.inicio).replace(/^./, (c) => c.toUpperCase());
      return completo ? nom : nom + " " + Number(conc.inicio.slice(8)) + "–" + Number(conc.fin.slice(8));
    }
    if (NX.difDias(conc.fin, conc.inicio) === 6) return "S" + NX.semanaIso(conc.inicio);
    return NX.rango(conc.inicio, conc.fin);
  };
})();
