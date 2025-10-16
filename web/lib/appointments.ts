// web/lib/appointments.ts
import { supabase } from "@/lib/supabaseClient";

/** Debe coincidir con el ENUM public.appointment_status en la BD */
export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "canceled"
  | "no_show";

/** Etiquetas en español (UI) */
export const STATUS_LABEL_ES: Record<AppointmentStatus, string> = {
  scheduled:   "Programado",
  confirmed:   "Reprogramado",
  in_progress: "Atendiendo",
  checked_in:  "Atendiendo",
  completed:   "Completada",
  canceled:    "Cancelada",
  no_show:     "No asistió",
};

export function statusToES(s: AppointmentStatus): string {
  return STATUS_LABEL_ES[s] ?? s;
}

export type AppointmentRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  service: string | null;
  reason: string | null;
  appointment_time: string; // ISO
  location: string | null;
  status: AppointmentStatus;
  notes: string | null;
  canceled_reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateAppointmentInput = {
  patient_id: string;
  doctor_id: string;
  appointment_time: string | Date;

  service?: string | null;
  reason?: string | null;
  location?: string | null;
  status?: AppointmentStatus; // default 'scheduled'
  notes?: string | null;
};

export type UpdateAppointmentInput = Partial<
  Omit<
    AppointmentRow,
    | "id"
    | "created_at"
    | "updated_at"
    | "created_by"
    | "updated_by"
    | "patient_id"
    | "doctor_id"
  >
> & {
  appointment_time?: string | Date;
};

/** Para UPDATE restringido (Doctor): solo puede tocar `status` y `notes` */
export type UpdateStatusNotesInput = {
  status?: AppointmentStatus;
  notes?: string | null;
};

/** Parámetros de listado/paginación */
export type ListAppointmentsParams = {
  page?: number; // 1-based
  pageSize?: number;

  doctorId?: string;
  patientId?: string;
  from?: string | Date; // rango inicio
  to?: string | Date; // rango fin
  status?: AppointmentStatus[]; // filtrar por estados
  q?: string; // búsqueda (service, reason, location, notes)
  order?: "asc" | "desc"; // por appointment_time
};

type ListResult<T> = { data: T[]; count: number; error: string | null };

const DEFAULT_PAGE_SIZE = 20;

function toIso(dt?: string | Date | null): string | null {
  if (!dt) return null;
  return dt instanceof Date ? dt.toISOString() : dt;
}

function rangeFromPage(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const p = Math.max(1, page);
  const s = Math.max(1, pageSize);
  const from = (p - 1) * s;
  const to = from + s - 1;
  return { from, to };
}

function asArray<T>(v: T | T[] | undefined | null): T[] | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v.length ? v : null) : [v];
}

/** Crea cita (Operador/Admin). Doctor también podría crear si habilitas política. */
export async function createAppointment(
  input: CreateAppointmentInput
): Promise<{ data: AppointmentRow | null; error: string | null }> {
  try {
    if (!input.patient_id) throw new Error("patient_id requerido");
    if (!input.doctor_id) throw new Error("doctor_id requerido");
    if (!input.appointment_time) throw new Error("appointment_time requerido");

    const payload: Record<string, any> = {
      patient_id: input.patient_id,
      doctor_id: input.doctor_id,
      appointment_time: toIso(input.appointment_time)!,
      service: input.service ?? null,
      reason: input.reason ?? null,
      location: input.location ?? null,
      status: input.status ?? "scheduled", // Programado por defecto
      notes: input.notes ?? null,
    };

    const { data, error } = await supabase
      .from("appointments")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      // Único conflicto por índice (doctor, appointment_time)
      if ((error as any).code === "23505") {
        return {
          data: null,
          error:
            "Conflicto de horario: el doctor ya tiene una cita registrada en ese momento.",
        };
      }
      return { data: null, error: error.message || "Error al crear la cita" };
    }
    return { data: data as AppointmentRow, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || "Error al crear la cita" };
  }
}

/** Listado con filtros + paginación */
export async function listAppointments(
  params: ListAppointmentsParams = {}
): Promise<ListResult<AppointmentRow>> {
  try {
    const {
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
      doctorId,
      patientId,
      from,
      to,
      status,
      q,
      order = "desc",
    } = params;

    const { from: rFrom, to: rTo } = rangeFromPage(page, pageSize);
    let query = supabase
      .from("appointments")
      .select("*", { count: "exact" })
      .order("appointment_time", { ascending: order === "asc" });

    if (doctorId) query = query.eq("doctor_id", doctorId);
    if (patientId) query = query.eq("patient_id", patientId);

    const fIso = toIso(from);
    const tIso = toIso(to);
    if (fIso) query = query.gte("appointment_time", fIso);
    if (tIso) query = query.lte("appointment_time", tIso);

    const st = asArray(status);
    if (st) query = query.in("status", st);

    // Búsqueda simple en varios campos
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      query = query.or(
        `service.ilike.${like},reason.ilike.${like},location.ilike.${like},notes.ilike.${like}`
      );
    }

    const { data, error, count } = await query.range(rFrom, rTo);

    if (error) {
      return {
        data: [],
        count: 0,
        error: error.message || "Error al listar citas",
      };
    }
    return { data: (data ?? []) as AppointmentRow[], count: count ?? 0, error: null };
  } catch (e: any) {
    return { data: [], count: 0, error: e?.message || "Error al listar citas" };
  }
}

/** Obtener 1 cita por id */
export async function getAppointmentById(
  id: string
): Promise<{ data: AppointmentRow | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return { data: null, error: error.message || "Error al obtener cita" };
    return { data: (data as AppointmentRow) ?? null, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || "Error al obtener cita" };
  }
}

/** Última cita (por fecha/hora) del paciente */
export async function getLatestAppointmentForPatient(
  patientId: string
): Promise<{ data: AppointmentRow | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", patientId)
      .order("appointment_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { data: null, error: error.message || "Error al obtener cita" };
    return { data: (data as AppointmentRow) ?? null, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message ?? "Error" };
  }
}

/**
 * Update completo (Operador/Admin). Doctor NO debe usar este método,
 * pues el trigger en BD restringe columnas para Doctor.
 */
export async function updateAppointment(
  id: string,
  updates: UpdateAppointmentInput
): Promise<{ data: AppointmentRow | null; error: string | null }> {
  try {
    const payload: Record<string, any> = { ...updates };
    if (updates.appointment_time) {
      payload.appointment_time = toIso(updates.appointment_time);
    }

    const { data, error } = await supabase
      .from("appointments")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        return {
          data: null,
          error:
            "Conflicto de horario: el doctor ya tiene una cita registrada en ese momento.",
        };
      }
      return { data: null, error: error.message || "Error al actualizar cita" };
    }
    return { data: data as AppointmentRow, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || "Error al actualizar cita" };
  }
}

/** Update acotado para Doctor: SOLO status y/o notes */
export async function updateAppointmentStatusNotes(
  id: string,
  input: UpdateStatusNotesInput
): Promise<{ data: AppointmentRow | null; error: string | null }> {
  try {
    const payload: Record<string, any> = {};
    if (typeof input.status !== "undefined") payload.status = input.status;
    if (typeof input.notes !== "undefined") payload.notes = input.notes;

    const { data, error } = await supabase
      .from("appointments")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return {
        data: null,
        error: error.message || "Error al actualizar estado/notas",
      };
    }
    return { data: data as AppointmentRow, error: null };
  } catch (e: any) {
    return {
      data: null,
      error: e?.message || "Error al actualizar estado/notas",
    };
  }
}

/** Reprogramar (Operador/Admin): cambia fecha/hora y (opcional) location) y marca estado = confirmed (Reprogramado) */
export async function rescheduleAppointment(params: {
  id: string;
  appointment_time: string | Date;
  location?: string | null;
}): Promise<{ data: AppointmentRow | null; error: string | null }> {
  const updates: UpdateAppointmentInput = {
    appointment_time: params.appointment_time,
    status: "confirmed", // ⇐ Reprogramado
  };
  if (typeof params.location !== "undefined") {
    updates.location = params.location;
  }
  return updateAppointment(params.id, updates);
}

/** Cancelar (Operador/Admin): status = canceled + motivo */
export async function cancelAppointment(params: {
  id: string;
  reason?: string | null;
}): Promise<{ data: AppointmentRow | null; error: string | null }> {
  return updateAppointment(params.id, {
    status: "canceled",
    canceled_reason: params.reason ?? null,
  });
}

/** Eliminar (Operador/Admin) */
export async function deleteAppointment(
  id: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) return { error: error.message || "Error al eliminar cita" };
    return { error: null };
  } catch (e: any) {
    return { error: e?.message || "Error al eliminar cita" };
  }
}

/** Utilidad: agenda del doctor en un día dado (UTC-friendly) */
export async function getDoctorDayAppointments(params: {
  doctorId: string;
  date: string | Date; // día base
}): Promise<ListResult<AppointmentRow>> {
  try {
    const base = new Date(toIso(params.date)!);
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    const d = base.getUTCDate();

    const start = new Date(Date.UTC(y, m, d, 0, 0, 0)).toISOString();
    const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0)).toISOString();

    const { data, error, count } = await supabase
      .from("appointments")
      .select("*", { count: "exact" })
      .eq("doctor_id", params.doctorId)
      .gte("appointment_time", start)
      .lt("appointment_time", end)
      .order("appointment_time", { ascending: true });

    if (error) {
      return {
        data: [],
        count: 0,
        error: error.message || "Error al listar agenda del día",
      };
    }
    return { data: (data ?? []) as AppointmentRow[], count: count ?? 0, error: null };
  } catch (e: any) {
    return { data: [], count: 0, error: e?.message || "Error al listar agenda del día" };
  }
}

/** Próximas citas del doctor (desde ahora) */
export async function getUpcomingForDoctor(params: {
  doctorId: string;
  limit?: number;
}): Promise<{ data: AppointmentRow[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("doctor_id", params.doctorId)
      .gte("appointment_time", new Date().toISOString())
      .order("appointment_time", { ascending: true })
      .limit(params.limit ?? 10);

    if (error) {
      return {
        data: [],
        error: error.message || "Error al listar próximas citas",
      };
    }
    return { data: (data ?? []) as AppointmentRow[], error: null };
  } catch (e: any) {
    return { data: [], error: e?.message || "Error al listar próximas citas" };
  }
}

/** Próximas citas del paciente (si luego decides mostrarlas en otra vista) */
export async function getUpcomingForPatient(params: {
  patientId: string;
  limit?: number;
}): Promise<{ data: AppointmentRow[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", params.patientId)
      .gte("appointment_time", new Date().toISOString())
      .order("appointment_time", { ascending: true })
      .limit(params.limit ?? 10);

    if (error) {
      return {
        data: [],
        error: error.message || "Error al listar próximas citas del paciente",
      };
    }
    return { data: (data ?? []) as AppointmentRow[], error: null };
  } catch (e: any) {
    return {
      data: [],
      error: e?.message || "Error al listar próximas citas del paciente",
    };
  }
}
