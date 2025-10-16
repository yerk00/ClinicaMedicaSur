// web/lib/consultations.ts
import { supabase } from "@/lib/supabaseClient";

/**
 * Estructura de entrada para crear una consulta.
 * Coincide con tu tabla `public.consultations`.
 */
export type CreateConsultationInput = {
  // Requeridos
  patient_id: string;   // uuid del paciente (user_profiles.id)
  doctor_id: string;    // uuid del doctor (user_profiles.id)

  // Opcionales (si no pasas fecha_hora, Postgres usará default now())
  id_consulta?: string;                 // Si no lo pasas, se genera uno legible
  fecha_hora?: string | Date | null;    // ISO o Date

  servicio?: string | null;
  motivo_consulta?: string | null;
  historia_enfermedad_actual?: string | null;
  examen_fisico?: string | null;
  estudios_solicitados?: string[] | null; // chips/array
  diagnostico_inicial?: string | null;
  diagnostico_final?: string | null;
  conducta_tratamiento?: string | null;
  estado_salida?: string | null;

  // Si no lo pasas y `autopopulateMedicoResponsable` es true,
  // se intentará completar con full_name/email del doctor.
  medico_responsable?: string | null;

  // NUEVO: estado de los estudios solicitados + flag para RX
  estudios_estado?: "pendiente" | "completado" | null;
  requiere_rx?: boolean | null;
};

export type ConsultationRow = {
  id: string;
  id_consulta: string;
  patient_id: string;
  doctor_id: string;
  fecha_hora: string;
  servicio: string | null;
  motivo_consulta: string | null;
  historia_enfermedad_actual: string | null;
  examen_fisico: string | null;
  estudios_solicitados: string[] | null;
  diagnostico_inicial: string | null;
  diagnostico_final: string | null;
  conducta_tratamiento: string | null;
  estado_salida: string | null;
  medico_responsable: string | null;
  created_at: string | null;

  // NUEVO
  estudios_estado: "pendiente" | "completado" | null;
  requiere_rx: boolean | null;
};

/** Fila reducida para listar en Home */
export type ConsultationListRow = {
  id: string;
  fecha_hora: string;
  servicio: string | null;
  motivo_consulta: string | null;
  diagnostico_inicial: string | null;
  diagnostico_final: string | null;
  estado_salida: string | null;
  medico_responsable: string | null;

  // NUEVO (lo que quieres mostrar)
  estudios_estado: "pendiente" | "completado" | null;
  requiere_rx: boolean | null;
};

type CreateOptions = {
  autogenerateId?: boolean;                 // default: true
  autopopulateMedicoResponsable?: boolean;  // default: true
};

/**
 * Genera un id legible y razonablemente único para `id_consulta`.
 * Ejemplo: CONS-20250813-104523-4F7C
 */
export function generateConsultationId(prefix = "CONS"): string {
  const d = new Date();
  const pad = (n: number, s = 2) => String(n).padStart(s, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `${prefix}-${y}${m}${day}-${hh}${mm}${ss}-${rnd}`;
}

/** Normaliza fecha/hora a ISO (si viene como Date la convierte). */
function toIso(dt?: string | Date | null): string | null {
  if (!dt) return null;
  return dt instanceof Date ? dt.toISOString() : dt;
}

/**
 * Intenta obtener un nombre visible del doctor (full_name o email)
 * para completar `medico_responsable` cuando no se pasa explícito.
 */
async function fetchDoctorDisplayName(doctor_id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("full_name, email")
    .eq("id", doctor_id)
    .maybeSingle();

  if (error) return null;
  return (data?.full_name || data?.email || null) as string | null;
}

/**
 * Crea una fila en `public.consultations`.
 * - Si no se pasa `id_consulta`, se genera automáticamente (CONS-...).
 * - Si `autopopulateMedicoResponsable` es true y no se pasa `medico_responsable`,
 *   se buscará el nombre del doctor en `user_profiles` para completarlo.
 * - Devuelve `{ data, error }` con la fila insertada (select * .single()).
 */
export async function createConsultation(
  input: CreateConsultationInput,
  opts: CreateOptions = {}
): Promise<{ data: ConsultationRow | null; error: string | null }> {
  const {
    autogenerateId = true,
    autopopulateMedicoResponsable = true,
  } = opts;

  try {
    if (!input.patient_id) throw new Error("patient_id requerido");
    if (!input.doctor_id) throw new Error("doctor_id requerido");

    const id_consulta =
      input.id_consulta || (autogenerateId ? generateConsultationId() : undefined);

    let medico_responsable = input.medico_responsable ?? null;
    if (autopopulateMedicoResponsable && !medico_responsable) {
      medico_responsable = await fetchDoctorDisplayName(input.doctor_id);
    }

    const payload: Record<string, any> = {
      id_consulta,
      patient_id: input.patient_id,
      doctor_id: input.doctor_id,
      fecha_hora: toIso(input.fecha_hora) ?? undefined, // si es null/undefined, deja default de DB
      servicio: input.servicio ?? null,
      motivo_consulta: input.motivo_consulta ?? null,
      historia_enfermedad_actual: input.historia_enfermedad_actual ?? null,
      examen_fisico: input.examen_fisico ?? null,
      estudios_solicitados: input.estudios_solicitados ?? null,
      diagnostico_inicial: input.diagnostico_inicial ?? null,
      diagnostico_final: input.diagnostico_final ?? null,
      conducta_tratamiento: input.conducta_tratamiento ?? null,
      estado_salida: input.estado_salida ?? null,
      medico_responsable,
    };

    // NUEVO: incluir en el insert si vienen definidos
    if (typeof input.estudios_estado !== "undefined") {
      payload.estudios_estado = input.estudios_estado;
    }
    if (typeof input.requiere_rx !== "undefined") {
      payload.requiere_rx = input.requiere_rx;
    }

    const { data, error } = await supabase
      .from("consultations")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return { data: null, error: error.message || "Error al crear consulta" };
    }
    return { data: data as ConsultationRow, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || "Error al crear consulta" };
  }
}

/**
 * Listado de consultas por paciente (para el Home),
 * incluyendo `estudios_estado` y `requiere_rx`.
 */
export async function getConsultationsByPatient(
  patientId: string,
  page = 1,
  pageSize = 50,
  order: "desc" | "asc" = "desc"
): Promise<{ data: ConsultationListRow[]; count: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("consultations")
    .select(
      "id, fecha_hora, servicio, motivo_consulta, diagnostico_inicial, diagnostico_final, estado_salida, medico_responsable, estudios_estado, requiere_rx",
      { count: "exact" }
    )
    .eq("patient_id", patientId)
    .order("fecha_hora", { ascending: order === "asc" })
    .range(from, to);

  if (error) throw error;

  return {
    data: (data ?? []) as ConsultationListRow[],
    count: count ?? (data?.length ?? 0),
  };
}
