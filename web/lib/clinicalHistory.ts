// web/lib/clinicalHistory.ts
import { supabase } from "@/lib/supabaseClient";

/**
 * Estructura esperada desde la VIEW `public.clinical_history_summary`
 * (ver SQL recomendado en la planificación):
 *
 *  patient_id                uuid (user_profiles.id)
 *  full_name                 text
 *  email                     text
 *  avatar_url                text
 *  consultations_count       number
 *  last_consultation_at      timestamptz | null
 *  has_medical_record        boolean
 */
export type ClinicalHistoryRow = {
  patient_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  consultations_count: number;
  last_consultation_at: string | null;
  has_medical_record: boolean;
};

export type ClinicalHistoryQuery = {
  page?: number;      // 1-based
  pageSize?: number;  // default 20
  search?: string;    // filtra por nombre/email (ILIKE)
  onlyWithHistory?: boolean; // default true: (consultas > 0 OR has_medical_record = true)
};

export type PageResult<T> = {
  data: T[];
  count: number;              // total rows (sin paginar)
  error: string | null;
};

/** Normaliza paginación (1-based) y devuelve rango inclusive [from, to] */
function paginate(page = 1, pageSize = 20) {
  const p = Math.max(1, page);
  const s = Math.max(1, pageSize);
  const from = (p - 1) * s;
  const to = from + s - 1;
  return { from, to, size: s, page: p };
}

/** Sanitiza término de búsqueda para usarlo en `.or()` */
function sanitizeSearchTerm(term: string) {
  return term
    .trim()
    .replace(/[%]/g, "")     // evita interferir con wildcard
    .replace(/[,\n\r]/g, " ") // no romper separadores de `.or`
    .replace(/\s+/g, " ");
}

/**
 * Obtiene página del resumen de historial clínico desde la VIEW `clinical_history_summary`.
 * - Ordenado por `last_consultation_at` DESC (los más recientes primero).
 * - `search` aplica sobre `full_name` y `email` (ILIKE).
 * - Por defecto, filtra SOLO pacientes con historial (consultas > 0 o con antecedentes).
 */
export async function getClinicalHistoryPage(
  params: ClinicalHistoryQuery = {}
): Promise<PageResult<ClinicalHistoryRow>> {
  const {
    page = 1,
    pageSize = 20,
    search,
    onlyWithHistory = true,
  } = params;
  const { from, to } = paginate(page, pageSize);

  try {
    let query = supabase
      .from("clinical_history_summary")
      .select(
        "patient_id, full_name, email, avatar_url, consultations_count, last_consultation_at, has_medical_record",
        { count: "exact" }
      )
      .order("last_consultation_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (search && search.trim()) {
      const term = sanitizeSearchTerm(search);
      const ilike = `%${term}%`;
      // Aplica OR sobre nombre y email
      query = query.or(`full_name.ilike.${ilike},email.ilike.${ilike}`);
    }

    if (onlyWithHistory) {
      // Muestra SOLO pacientes con historial
      // (consultas > 0) OR (tiene registro médico)
      query = query.or("consultations_count.gt.0,has_medical_record.eq.true");
    }

    const { data, error, count } = await query;

    if (error) {
      return {
        data: [],
        count: 0,
        error: error.message || "Error querying clinical history",
      };
    }

    return {
      data: (data ?? []) as ClinicalHistoryRow[],
      count: count ?? 0,
      error: null,
    };
  } catch (e: any) {
    return {
      data: [],
      count: 0,
      error: e?.message || "Unexpected error querying clinical history",
    };
  }
}

/**
 * Obtiene una fila del resumen por `patient_id`.
 */
export async function getClinicalHistoryByPatientId(
  patientId: string
): Promise<{ data: ClinicalHistoryRow | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("clinical_history_summary")
      .select(
        "patient_id, full_name, email, avatar_url, consultations_count, last_consultation_at, has_medical_record"
      )
      .eq("patient_id", patientId)
      .maybeSingle();

    if (error) {
      return {
        data: null,
        error: error.message || "Error fetching clinical history by patient",
      };
    }
    return { data: (data as ClinicalHistoryRow) ?? null, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || "Unexpected error" };
  }
}
