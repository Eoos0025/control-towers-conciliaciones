/*
 * Configuración del dashboard.
 *
 * - supabaseUrl: la Project URL de Supabase (no es secreta).
 * - supabaseClavePublica: la clave PÚBLICA (Settings > API Keys > Publishable key, empieza con sb_publishable_).
 *   Está hecha para usarse en el navegador: sin iniciar sesión no da acceso a nada (lo protege RLS).
 *   NUNCA pongas aquí la clave secreta (sb_secret_...) ni la service_role.
 */
window.NX_CONFIG = {
  supabaseUrl: "https://odzcolulohykhnhqcqas.supabase.co",
  supabaseClavePublica: "sb_publishable_dNv_7V62nd_qT3s6mj6dCQ_jFB6Roj-",

  // Desde qué fecha se esperan conciliaciones y cuántos días después del cierre se considera atrasada.
  // Si llega una cuenta nueva (Turbo, PedidosYa Brands...) y no está aquí, usa los valores por defecto.
  cuentas: {
    peya_farmacorp: { inicio: "2026-07-06", diasAtraso: 7 },
    yango_amarket: { inicio: "2026-08-15", diasAtraso: 10 }
  },
  inicioPorDefecto: "2026-07-06",
  diasAtrasoPorDefecto: { semanal: 7, quincenal: 7, mensual: 10 },

  // Se muestran en los filtros (desactivados) hasta que tengan su primera conciliación publicada.
  agregadoresFuturos: ["Turbo"],
  negociosFuturos: ["Pizza Hut"],

  // Diferencia por sucursal (Bs, valor absoluto) para considerarla "a revisar".
  umbralDescuadreBodega: 20,
  // Hasta este valor se considera que la sucursal cuadra exacto (redondeos).
  umbralExacto: 0.05
};
