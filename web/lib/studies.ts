// web/lib/studies.ts
import { supabase } from "@/lib/supabaseClient";

/** Tipos básicos */
export type StudyStatus = "pendiente" | "completado";

export interface RadiographStudyRow {
  consultation_id: string;
  patient_id: string;
  patient_name: string | null;
  patient_email: string | null;
  patient_avatar_url: string | null;

  fecha_hora: string; // ISO
  servicio: string | null;
  motivo_consulta: string | null;

  estudios_solicitados: string[] | null;
  estudios_estado: StudyStatus | null; // 'pendiente'|'completado'|null
}

export interface GetRadiographStudiesParams {
  page?: number;              // default 1
  pageSize?: number;          // default 20
  status?: StudyStatus | "todos";
  q?: string;                 // busca en servicio/motivo y luego en nombre paciente (client side)
  from?: string;              // 'YYYY-MM-DD'
  to?: string;                // 'YYYY-MM-DD'
  order?: "asc" | "desc";     // default 'desc' por fecha
}

/** Normaliza texto básico (minúsculas, sin tildes) */
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Heurística simple para detectar si un arreglo de estudios incluye radiografía */
export function detectRadiograph(estudios: string[] | null | undefined): boolean {
  if (!estudios || estudios.length === 0) return false;
  const keys = ["radiograf", "rx", "rayos x", "torax", "tórax"]; // añade más si necesitas
  return estudios.some((e) => {
    const t = normalize(String(e || ""));
    return keys.some((k) => t.includes(normalize(k)));
  });
}

/** Utilidad fecha → ISO inicio/fin del día */
function toDayStartISO(d: string) {
  return new Date(`${d}T00:00:00`).toISOString();
}
function toDayEndISO(d: string) {
  return new Date(`${d}T23:59:59.999`).toISOString();
}

/**
 * Lista de consultas que requieren radiografía (vista Radiólogo).
 * Usa la columna `requiere_rx` si está disponible; sino, hace fallback a filtrar en cliente.
 */
export async function getRadiographStudies(params: GetRadiographStudiesParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    status = "todos",
    q = "",
    from,
    to,
    order = "desc",
  } = params;

  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  let query = supabase
    .from("consultations")
    .select(
      "id, patient_id, fecha_hora, servicio, motivo_consulta, estudios_solicitados, estudios_estado, requiere_rx",
      { count: "exact" }
    )
    .order("fecha_hora", { ascending: order === "asc" });

  // Filtro fecha
  if (from) query = query.gte("fecha_hora", toDayStartISO(from));
  if (to)   query = query.lte("fecha_hora", toDayEndISO(to));

  // Filtro estado
  if (status !== "todos") {
    query = query.eq("estudios_estado", status);
  }

  // Preferimos usar la columna requiere_rx si existe (tras la migración)
  // No hay forma directa de chequear columns en runtime con Postgrest, asumimos que ya corriste la migración.
  query = query.eq("requiere_rx", true);

  // Búsqueda textual mínima en servicio/motivo (nombre paciente lo filtramos client-side al final)
  if (q?.trim()) {
    const qq = `%${q.trim()}%`;
    query = query.or(`servicio.ilike.${qq},motivo_consulta.ilike.${qq}`);
  }

  // Paginación
  query = query.range(fromIdx, toIdx);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = data || [];

  // Obtener los perfiles de paciente en batch
  const ids = Array.from(new Set(rows.map((r) => r.patient_id).filter(Boolean)));
  let patientMap = new Map<string, { full_name: string | null; email: string | null; avatar_url: string | null }>();

  if (ids.length) {
    const { data: patients, error: pErr } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", ids);
    if (pErr) throw pErr;
    patientMap = new Map(
      (patients || []).map((p) => [p.id, { full_name: p.full_name, email: p.email, avatar_url: p.avatar_url }])
    );
  }

  // Fallback client-side: por si alguna consulta no tiene requiere_rx pero sí pide RX (caso legacy)
  const filtered = rows.filter((r) => r.requiere_rx === true || detectRadiograph(r.estudios_solicitados));

  // Si quieres filtrar también por nombre de paciente con 'q'
  const qNorm = normalize(q.trim());
  const filteredByPatient =
    qNorm
      ? filtered.filter((r) => {
          const p = patientMap.get(r.patient_id);
          const name = normalize(p?.full_name || "");
          return name.includes(qNorm);
        })
      : filtered;

  const result: RadiographStudyRow[] = filteredByPatient.map((r) => {
    const p = patientMap.get(r.patient_id);
    return {
      consultation_id: r.id,
      patient_id: r.patient_id,
      patient_name: p?.full_name ?? null,
      patient_email: p?.email ?? null,
      patient_avatar_url: p?.avatar_url ?? null,

      fecha_hora: r.fecha_hora,
      servicio: r.servicio,
      motivo_consulta: r.motivo_consulta,
      estudios_solicitados: r.estudios_solicitados,
      estudios_estado: r.estudios_estado as StudyStatus | null,
    };
  });

  return { data: result, count: count ?? result.length };
}

/** Toggle/actualiza el estado del estudio en una consulta */
export async function updateStudyStatus(consultationId: string, status: StudyStatus) {
  const { data, error } = await supabase
    .from("consultations")
    .update({ estudios_estado: status })
    .eq("id", consultationId)
    .select("id, estudios_estado")
    .single();

  if (error) throw error;
  return data as { id: string; estudios_estado: StudyStatus };
}
