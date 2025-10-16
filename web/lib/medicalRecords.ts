import { supabase } from "@/lib/supabaseClient";

// Valores permitidos para grupo_sanguineo (opcionalmente puedes validar en UI)
export const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export type MedicalRecordDB = {
  user_profile_id: string;
  created_by: string | null;
  created_at: string | null;

  // NUEVOS CAMPOS
  enfermedades_cronicas: string | null;
  alergias: string | null;
  medicacion_actual: string | null;
  cirugias_previas: string | null;
  grupo_sanguineo: BloodGroup | string | null;
  transfusiones_previas: boolean | null;
  transfusiones_detalle: string | null;
  antecedentes_familiares: string | null;
  consumo_sustancias: string | null;
  actividad_fisica: string | null;
  vacunas: string | null;
};

export type MedicalRecordInput = {
  user_profile_id: string;
  created_by: string;

  enfermedades_cronicas?: string | null;
  alergias?: string | null;
  medicacion_actual?: string | null;
  cirugias_previas?: string | null;
  grupo_sanguineo?: BloodGroup | string | null;
  transfusiones_previas?: boolean | null;
  transfusiones_detalle?: string | null;
  antecedentes_familiares?: string | null;
  consumo_sustancias?: string | null;
  actividad_fisica?: string | null;
  vacunas?: string | null;
};

// --- Helpers internos ---

// Sanitiza payload para evitar enviar campos desconocidos
function sanitizeUpdates(updates: Partial<MedicalRecordInput>): Record<string, any> {
  const allowed: (keyof MedicalRecordInput)[] = [
    "user_profile_id",
    "created_by",
    "enfermedades_cronicas",
    "alergias",
    "medicacion_actual",
    "cirugias_previas",
    "grupo_sanguineo",
    "transfusiones_previas",
    "transfusiones_detalle",
    "antecedentes_familiares",
    "consumo_sustancias",
    "actividad_fisica",
    "vacunas",
  ];
  const out: Record<string, any> = {};
  for (const k of allowed) {
    if (k in updates) out[k] = (updates as any)[k];
  }
  return out;
}

// Opcional: normaliza grupo sanguíneo a formato permitido si viene en variantes
function normalizeBloodGroup(v?: string | null): string | null {
  if (!v) return null;
  let s = v.toUpperCase().trim().replace(/\s+/g, "");
  if (s === "0+" || s === "0-") s = s.replace(/^0/, "O");
  // Si coincide con lista, bien; si no, lo devolvemos tal cual y la DB lo validará
  return s;
}

// --- API ---

export async function getMedicalRecordByUserId(user_profile_id: string) {
  const { data, error } = await supabase
    .from("medical_records")
    .select("*")
    .eq("user_profile_id", user_profile_id)
    .maybeSingle();

  if (error) throw error;
  return data as MedicalRecordDB | null;
}

export async function updateMedicalRecord(user_profile_id: string, updates: Partial<MedicalRecordInput>) {
  const clean = sanitizeUpdates(updates);
  if ("grupo_sanguineo" in clean) {
    clean.grupo_sanguineo = normalizeBloodGroup(clean.grupo_sanguineo);
  }

  const { error } = await supabase
    .from("medical_records")
    .update(clean)
    .eq("user_profile_id", user_profile_id);

  if (error) throw error;
}

/**
 * Crea o actualiza (UPSERT) un registro médico por user_profile_id
 * - Requiere que exista un paciente (rol 4) si mantienes esa regla.
 * - Usa onConflict: "user_profile_id" para evitar duplicados.
 */
export async function createMedicalRecord(input: MedicalRecordInput) {
  // (Opcional) Validación de rol paciente (si tu user_profiles realmente tiene role_id)
  try {
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role_id")
      .eq("id", input.user_profile_id)
      .maybeSingle();

    // Si existe role_id y no es 4 => error
    if (!profileError && profile && "role_id" in profile && profile.role_id !== 4) {
      throw new Error("Solo se puede crear un registro médico para pacientes.");
    }
  } catch {
    // Si falla por no existir role_id, ignoramos (compatible con tu esquema)
  }

  const payload = sanitizeUpdates(input);
  payload.grupo_sanguineo = normalizeBloodGroup(payload.grupo_sanguineo);

  const { data, error } = await supabase
    .from("medical_records")
    .upsert([payload], { onConflict: "user_profile_id" })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating/upserting medical record:", error.message);
    return null;
  }

  return data as MedicalRecordDB;
}
