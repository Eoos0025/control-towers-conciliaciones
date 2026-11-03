/* Utilidades: formato de números y fechas, escape de HTML. */
(function () {
  const NX = (window.NX = window.NX || {});

  // Todo texto que viene de la base se escapa antes de insertarlo en la página.
  NX.esc = function (v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  };

  const MENOS = "−";

  // Formato boliviano: punto de miles y coma decimal (igual en todos los navegadores).
  NX.num = function (v, dec = 0) {
    if (v === null || v === undefined || v === "" || isNaN(v)) return "—";
    v = Number(v);
    const [ent, d] = Math.abs(v).toFixed(dec).split(".");
    const t = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (d ? "," + d : "");
    return (v < 0 && Math.abs(v) >= Math.pow(10, -dec) / 2 ? MENOS : "") + t;
  };
  NX.signo = function (v, dec = 2) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    const t = NX.num(Math.abs(v), dec);
    if (Math.abs(v) < Math.pow(10, -dec) / 2) return t;
    return (v > 0 ? "+" : MENOS) + t;
  };
  NX.pct = function (v, dec = 1) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    return NX.num(v * 100, dec) + " %";
  };
  NX.corto = function (v) {
    if (v === null || v === undefined) return "—";
    const a = Math.abs(v);
    if (a >= 1e6) return NX.num(v / 1e6, 2) + " M";
    if (a >= 1e3) return NX.num(v / 1e3, 0) + " mil";
    return NX.num(v, 0);
  };

  // ---------- Fechas (siempre como texto AAAA-MM-DD, sin zonas horarias) ----------
  NX.aFecha = (s) => { const [a, m, d] = s.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d)); };
  NX.aTexto = (f) => f.toISOString().slice(0, 10);
  NX.sumarDias = (s, n) => { const f = NX.aFecha(s); f.setUTCDate(f.getUTCDate() + n); return NX.aTexto(f); };
  NX.difDias = (a, b) => Math.round((NX.aFecha(a) - NX.aFecha(b)) / 86400000);
  NX.hoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  NX.finDeMes = (s) => { const f = NX.aFecha(s); return NX.aTexto(new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0))); };
  NX.inicioDeMes = (s) => s.slice(0, 8) + "01";
  NX.lunes = (s) => { const f = NX.aFecha(s); const dia = (f.getUTCDay() + 6) % 7; return NX.sumarDias(s, -dia); };
  NX.semanaIso = (s) => {
    const f = NX.aFecha(s);
    const dia = (f.getUTCDay() + 6) % 7;
    f.setUTCDate(f.getUTCDate() - dia + 3);
    const primerJueves = new Date(Date.UTC(f.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((f - primerJueves) / 86400000 - 3 + ((primerJueves.getUTCDay() + 6) % 7)) / 7);
  };
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  NX.mes = (s) => MESES[Number(s.slice(5, 7)) - 1];
  NX.mesCorto = (s) => MESES_C[Number(s.slice(5, 7)) - 1];
  NX.ddmm = (s) => s.slice(8, 10) + "/" + s.slice(5, 7);
  NX.ddmmaaaa = (s) => s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4);
  NX.rango = (a, b) => {
    if (a.slice(0, 7) === b.slice(0, 7)) return Number(a.slice(8)) + "–" + Number(b.slice(8)) + " " + NX.mesCorto(a);
    return Number(a.slice(8)) + " " + NX.mesCorto(a) + " – " + Number(b.slice(8)) + " " + NX.mesCorto(b);
  };
  NX.fechaHora = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" }) + " · " +
      d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  NX.guardar = (k, v) => { try { localStorage.setItem("nx_" + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  NX.leer = (k, def) => { try { const v = localStorage.getItem("nx_" + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
})();
