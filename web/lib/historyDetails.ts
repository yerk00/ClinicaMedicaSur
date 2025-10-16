// web/lib/historyDetails.ts
import { supabase } from "@/lib/supabaseClient";
import { ReactNode } from "react";


/* ========= Tipos ========= */

export type PatientProfile = {
  ci: string;
  sexo_genero: string;
  fecha_nacimiento: string | number | Date;
  direccion: string;
  telefono: string;
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type MedicalRecordLite = {
  id: string;
  user_profile_id: string;

  // Nuevo esquema
  enfermedades_cronicas: string | null;
  alergias: string | null;
  medicacion_actual: string | null;
  cirugias_previas: string | null;
  grupo_sanguineo:
    | "A+"
    | "A-"
    | "B+"
    | "B-"
    | "AB+"
    | "AB-"
    | "O+"
    | "O-"
    | null;
  transfusiones_previas: boolean | null;
  transfusiones_detalle: string | null;
  antecedentes_familiares: string | null;
  consumo_sustancias: string | null;
  actividad_fisica: string | null;
  vacunas: string | null;

  created_at: string | null;
};

export type ConsultationLite = {
  id: string;
  fecha_hora: string;
  servicio: string | null;
  motivo_consulta: string | null;

  // Campos clínicos que usas en documento.tsx
  historia_enfermedad_actual: string | null;
  examen_fisico: string | null;
  estudios_solicitados: string[] | null;
  diagnostico_inicial: string | null;
  diagnostico_final: string | null;
  conducta_tratamiento: string | null;

  medico_responsable: string | null;
};

// Reemplaza el tipo HealthLogLite por:
export type HealthLogLite = {
  id: string;
  symptom_type: string | null;
  severity: number | null;
  mood: string | null;
  temperature_c: number | null;
  heart_rate_bpm: number | null;
  respiratory_rate_bpm: number | null;
  bp_systolic_mmhg: number | null;
  bp_diastolic_mmhg: number | null;
  spo2_percent: number | null;
  weight_kg: number | null;
  height_m: number | null;
  pain_score: number | null;
};


export type FileLite = {
  diagnosis_ia: ReactNode;
  id: string;
  filename: string;
  url: string;
  file_type: string | null;
  uploaded_at: string | null;
  tags: string[] | null;
};

/* ========= Fetchers ========= */

export async function getPatientProfile(patientId: string) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, avatar_url")
    .eq("id", patientId)
    .single();
  if (error) throw error;
  return data as PatientProfile;
}

export async function getMedicalRecordByUserIdLite(patientId: string) {
  const { data, error } = await supabase
    .from("medical_records")
    .select(
      `
      id,
      user_profile_id,
      enfermedades_cronicas,
      alergias,
      medicacion_actual,
      cirugias_previas,
      grupo_sanguineo,
      transfusiones_previas,
      transfusiones_detalle,
      antecedentes_familiares,
      consumo_sustancias,
      actividad_fisica,
      vacunas,
      created_at
      `
    )
    .eq("user_profile_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as MedicalRecordLite | null;
}

function rangeFromPage(page = 1, pageSize = 10) {
  const p = Math.max(1, page);
  const s = Math.max(1, pageSize);
  const from = (p - 1) * s;
  const to = from + s - 1;
  return { from, to };
}

/** Consultas (orden desc por fecha) */
export async function getConsultationsPage(
  patientId: string,
  page = 1,
  pageSize = 10
) {
  const { from, to } = rangeFromPage(page, pageSize);
  const { data, error, count } = await supabase
    .from("consultations")
    .select(
      `
      id,
      fecha_hora,
      servicio,
      motivo_consulta,
      historia_enfermedad_actual,
      examen_fisico,
      estudios_solicitados,
      diagnostico_inicial,
      diagnostico_final,
      conducta_tratamiento,
      medico_responsable
      `,
      { count: "exact" }
    )
    .eq("patient_id", patientId)
    .order("fecha_hora", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: (data ?? []) as ConsultationLite[], count: count ?? 0 };
}

/** Health logs (síntomas) (orden desc por inicio) */
export async function getHealthLogsPage(
  patientId: string,
  page = 1,
  pageSize = 10
) {
  const { from, to } = rangeFromPage(page, pageSize);
  // En getHealthLogsPage(...)
  const { data, error, count } = await supabase
    .from("health_logs")
    .select(
      `id,
      symptom_type, severity, mood,
      temperature_c, heart_rate_bpm, respiratory_rate_bpm,
      bp_systolic_mmhg, bp_diastolic_mmhg, spo2_percent,
      weight_kg, height_m, pain_score`,
      { count: "exact" }
    )
    .eq("user_profile_id", patientId)
    .order("id", { ascending: false })   // antes: start_date
    .range(from, to);

  if (error) throw error;
  return { data: (data ?? []) as HealthLogLite[], count: count ?? 0 };
}

/** Archivos (radiografías u otros). Filtramos radiología en el cliente. */
export async function getFilesPage(patientId: string, page = 1, pageSize = 12) {
  const { from, to } = rangeFromPage(page, pageSize);
  const { data, error, count } = await supabase
    .from("files")
    .select("id, filename, url, file_type, uploaded_at, tags", {
      count: "exact",
    })
    .eq("user_profile_id", patientId)
    .order("uploaded_at", { ascending: false, nullsFirst: false })
    .range(from, to);
  if (error) throw error;
  return { data: (data ?? []) as FileLite[], count: count ?? 0 };
}

/* ========= Heurísticas Radiografías ========= */

export function isRadiograph(file: FileLite) {
  const t = (file.file_type || "").toLowerCase();
  const name = (file.filename || "").toLowerCase();
  const tags = file.tags || [];
  return (
    t.includes("radio") ||
    tags.some((x) => (x || "").toLowerCase().includes("radio")) ||
    name.includes("rx") ||
    name.includes("radi")
  );
}

export function isRadiographStrict(file: FileLite) {
  const t = (file.file_type || "").toLowerCase();
  const name = (file.filename || "").toLowerCase();
  const tags = (file.tags || []).map((x) => (x || "").toLowerCase());

  const tagHit = tags.some((k) =>
    ["rx", "radiografia", "radiografía", "rayosx", "rayos x", "xray"].includes(
      k
    )
  );
  const nameHit = ["rx", "radi", "xray"].some((k) => name.includes(k));
  return t.startsWith("image/") && (tagHit || nameHit);
}

/**
 * Usa el día LOCAL LA PAZ (UTC-4) para crear el rango [00:00, 24:00) y convertir a UTC.
 * Devuelve radiografías del paciente tomadas “ese día local”.
 */
export async function getRadiographsOfDay(
  patientId: string,
  dateISO: string
) {
  const dUTC = new Date(dateISO);
  const offsetH = 4; // America/La_Paz = UTC-4

  // Convertimos el instante de la consulta a "marcador" en hora local restando 4h
  const localMarker = new Date(dUTC.getTime() - offsetH * 60 * 60 * 1000);
  const y = localMarker.getUTCFullYear();
  const m = localMarker.getUTCMonth();
  const d = localMarker.getUTCDate();

  // El "inicio de día local" equivale a 04:00Z del mismo día; fin = 04:00Z del día siguiente
  const startUTC = new Date(Date.UTC(y, m, d, offsetH, 0, 0));
  const endUTC = new Date(Date.UTC(y, m, d + 1, offsetH, 0, 0));

  const { data, error } = await supabase
    .from("files")
    .select("id, filename, url, file_type, uploaded_at, tags")
    .eq("user_profile_id", patientId)
    .gte("uploaded_at", startUTC.toISOString())
    .lt("uploaded_at", endUTC.toISOString())
    .order("uploaded_at", { ascending: false });

  if (error) throw error;
  const all = (data ?? []) as FileLite[];

  // Estricto primero
  const rxStrict = all.filter(isRadiographStrict);
  if (rxStrict.length) return rxStrict;

  // Fallback: cualquier imagen del día
  return all.filter((f) =>
    (f.file_type || "").toLowerCase().startsWith("image/")
  );
}
