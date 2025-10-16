// web/lib/assistance.ts
import { supabase } from "@/lib/supabaseClient";
import type { FileLite } from "@/lib/historyDetails";

/* ===== Config de endpoints IA (ajusta por entorno) ===== */
export const IA_ENDPOINTS = {
  PREDICT_URL:
    process.env.NEXT_PUBLIC_IA_PREDICT_URL || "http://127.0.0.1:8000/predict",
  // ✅ tu backend usa /predict_cams (devuelve base64), no /gradcam
  GRADCAM_URL:
    process.env.NEXT_PUBLIC_IA_GRADCAM_URL ||
    "http://127.0.0.1:8000/predict_cams",
  // Sin endpoint PNG directo en tu backend actual; dejamos este como no usado.
  GRADCAM_IMAGE_URL:
    process.env.NEXT_PUBLIC_IA_GRADCAM_IMAGE_URL || "",
};

/* ===== Tipos IA ===== */
export type TopK = { class: string; prob: number };

export type PredictResponse = {
  threshold: number;
  probabilities: Record<string, number>;
  present: string[];
  top_k: TopK[];
  model_version?: string;
};

export type GradcamStyle = {
  cmap: string;
  alpha_by_prob: boolean;
  prob_floor: number;
  cap: number;
  gamma: number;
};

export type GradcamResponse = {
  class: string;
  prob: number;
  heatmap_data_url: string; // data:image/png;base64,...
  layer?: string;
  model_hash?: string;
  style?: GradcamStyle;
};

export type IaMeta = {
  name?: string;
  version?: string;
  task?: string;
  classes: string[];
  num_classes: number;
  input_hw: [number, number];
  last_conv?: string | null;
  uses_featurewise_norm?: boolean;
};

/* ===== Roles (ajusta IDs si difieren) ===== */
export const ROLE_IDS = {
  PACIENTE: 4,
  DOCTOR: 2,
  RADIOLOGO: 5,
  ADMIN: 1,
};

/* ===== Utilidades ===== */
function toIso(dt?: string | Date | null) {
  if (!dt) return null;
  return dt instanceof Date ? dt.toISOString() : dt;
}

/* ===== Fallback de clases XRV (18 etiquetas de densenet121-res224-all) ===== */
const XRV_CLASSES_18 = [
  "Atelectasis",
  "Consolidation",
  "Infiltration",
  "Pneumothorax",
  "Edema",
  "Emphysema",
  "Fibrosis",
  "Effusion",
  "Pneumonia",
  "Pleural_Thickening",
  "Cardiomegaly",
  "Nodule",
  "Mass",
  "Hernia",
  "Lung Lesion",
  "Fracture",
  "Lung Opacity",
  "Enlarged Cardiomediastinum",
];

/* ====== IA meta (health + labels) ====== */
export async function getIaMeta(): Promise<{
  data: IaMeta | null;
  error: string | null;
}> {
  try {
    const base = IA_ENDPOINTS.PREDICT_URL;
    const healthUrl = base.replace(/\/predict(\?.*)?$/, "/health");
    const labelsUrl = base.replace(/\/predict(\?.*)?$/, "/labels");

    // Tu backend no expone /health ni /labels; intentamos y caemos a fallback.
    const [hRes, lRes] = await Promise.allSettled([
      fetch(healthUrl, { cache: "no-store" }),
      fetch(labelsUrl, { cache: "no-store" }),
    ]);

    const health =
      hRes.status === "fulfilled" && hRes.value.ok
        ? await hRes.value.json().catch(() => ({}))
        : {};
    const labels =
      lRes.status === "fulfilled" && lRes.value.ok
        ? await lRes.value.json().catch(() => ({}))
        : {};

    const classes = Array.isArray(labels?.classes)
      ? (labels.classes as string[])
      : XRV_CLASSES_18;

    const data: IaMeta = {
      name: health?.name ?? "torchxrayvision-densenet121",
      version:
        health?.model_hash?.slice?.(0, 8) ??
        labels?.version ??
        "res224-all",
      task: health?.task ?? "classification",
      classes,
      num_classes:
        typeof health?.num_classes === "number"
          ? health.num_classes
          : classes.length,
      input_hw:
        Array.isArray(health?.input_hw) && health.input_hw.length === 2
          ? (health.input_hw as [number, number])
          : [224, 224],
      last_conv: health?.last_conv ?? "features.denseblock4.denselayer16.conv2",
      uses_featurewise_norm: !!health?.uses_featurewise_norm,
    };
    return { data, error: null };
  } catch (e: any) {
    // Fallback completo
    return {
      data: {
        name: "torchxrayvision-densenet121",
        version: "res224-all",
        task: "classification",
        classes: XRV_CLASSES_18,
        num_classes: XRV_CLASSES_18.length,
        input_hw: [224, 224],
        last_conv: "features.denseblock4.denselayer16.conv2",
        uses_featurewise_norm: false,
      },
      error: null,
    };
  }
}

/** Búsqueda de pacientes por nombre/email limitando al rol Paciente */
export async function searchPatients(
  q: string,
  limit = 10
): Promise<
  { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[]
> {
  if (!q.trim()) return [];
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, avatar_url, role_id")
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
    .eq("role_id", ROLE_IDS.PACIENTE)
    .limit(limit);

  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    avatar_url: r.avatar_url,
  }));
}

/** Lista archivos de un paciente (por defecto solo imágenes) + filtros */
export async function listPatientFiles(params: {
  patientId: string;
  page?: number;
  pageSize?: number;
  from?: string | Date | null;
  to?: string | Date | null;
  imagesOnly?: boolean;
  q?: string;
}) {
  const {
    patientId,
    page = 1,
    pageSize = 24,
    from,
    to,
    imagesOnly = true,
    q,
  } = params;

  const fromIso = toIso(from);
  const toIsoStr = toIso(to);
  const fromIdx = Math.max(0, (page - 1) * pageSize);
  const toIdx = fromIdx + pageSize - 1;

  let query = supabase
    .from("files")
    .select(
      "id, filename, url, file_type, uploaded_at, tags, diagnosis_ia, user_profile_id",
      { count: "exact" }
    )
    .eq("user_profile_id", patientId)
    .order("uploaded_at", { ascending: false, nullsFirst: false });

  if (imagesOnly) query = query.like("file_type", "image/%");
  if (fromIso) query = query.gte("uploaded_at", fromIso);
  if (toIsoStr) query = query.lte("uploaded_at", toIsoStr);

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    query = query.or(`filename.ilike.${like},tags.cs.{${q.trim()}}`);
  }

  const { data, count, error } = await query.range(fromIdx, toIdx);
  if (error) {
    return {
      data: [] as FileLite[],
      count: 0,
      error: error.message || "Error al listar archivos",
    };
  }
  return { data: (data ?? []) as FileLite[], count: count ?? 0, error: null };
}

/** Ejecuta IA predict: descarga el archivo y lo envía al backend (mapea a PredictResponse) */
export async function runPredictFromUrl(
  fileUrl: string,
  fileName: string,
  threshold = 0.5,
  signal?: AbortSignal
): Promise<{ data: PredictResponse | null; error: string | null; timeMs?: number }> {
  try {
    const t0 = performance.now();
    const resp = await fetch(fileUrl, { signal, cache: "no-store" });
    if (!resp.ok) throw new Error(`No se pudo descargar la imagen (${resp.status})`);
    const srcBlob = await resp.blob();
    const blob = new Blob([srcBlob], { type: srcBlob.type || "image/jpeg" });

    const fd = new FormData();
    fd.append("file", blob, fileName);

    const res = await fetch(`${IA_ENDPOINTS.PREDICT_URL}`, {
      method: "POST",
      body: fd,
      signal,
    });

    if (!res.ok) {
      let detail = "Error predict";
      try {
        const j = await res.json();
        detail = j?.detail || detail;
      } catch {}
      throw new Error(detail);
    }
    const j = await res.json();

    // Backend devuelve: { top4: [ [label, prob], ... ], all_scores: {label: prob}, ... }
    const probabilities: Record<string, number> = j?.all_scores || {};
    const top_k: TopK[] = Array.isArray(j?.top4)
      ? (j.top4 as [string, number][])?.map(([cls, p]) => ({ class: cls, prob: p }))
      : [];

    const present = Object.entries(probabilities)
      .filter(([_, p]) => (p as number) >= threshold)
      .map(([k]) => k);

    const data: PredictResponse = {
      threshold,
      probabilities,
      present,
      top_k,
      model_version: j?.model || undefined,
    };

    return { data, error: null, timeMs: Math.round(performance.now() - t0) };
  } catch (e: any) {
    return { data: null, error: e?.message || "Error al predecir" };
  }
}

/** Ejecuta Grad-CAM (usa /predict_cams). targetClass es opcional; si no se envía, usa el CAM del top-1 */
export async function runGradcamFromUrl(
  fileUrl: string,
  fileName: string,
  opts?: {
    targetClass?: string;
    targetLayer?: string;   // no usado por tu backend actual; conservado por compatibilidad
    probFloor?: number;     // no usado (estilo); conservado
    cap?: number;           // no usado (estilo); conservado
    curve?: number;         // no usado (estilo); conservado
    gamma?: number;         // no usado (estilo); conservado
    signal?: AbortSignal;
  }
): Promise<{ data: GradcamResponse | null; error: string | null; timeMs?: number }> {
  try {
    const t0 = performance.now();
    const resp = await fetch(fileUrl, { signal: opts?.signal, cache: "no-store" });
    if (!resp.ok) throw new Error(`No se pudo descargar la imagen (${resp.status})`);
    const srcBlob = await resp.blob();
    const blob = new Blob([srcBlob], { type: srcBlob.type || "image/jpeg" });

    const fd = new FormData();
    fd.append("file", blob, fileName);

    const params = new URLSearchParams({
      cam: "gradcampp",
      alpha: "0.45",
      cm: "JET",
      only_top4: "true",
    });
    // Si pides una clase concreta, la forzamos en el backend con ?labels=...
    if (opts?.targetClass) params.set("labels", opts.targetClass);

    const url = `${IA_ENDPOINTS.GRADCAM_URL}?${params.toString()}`;

    const res = await fetch(url, {
      method: "POST",
      body: fd,
      signal: opts?.signal,
    });

    if (!res.ok) {
      let detail = "Error gradcam";
      try {
        const j = await res.json();
        detail = j?.detail || detail;
      } catch {}
      throw new Error(detail);
    }

    const j = await res.json();
    // j.cams es un array: [{ label, prob, overlay_b64, heat_b64 }, ...]
    const cams: any[] = Array.isArray(j?.cams) ? j.cams : [];
    if (!cams.length) {
      return { data: null, error: "Backend no devolvió CAMs", timeMs: Math.round(performance.now() - t0) };
    }

    // Elegimos el CAM:
    let chosen = cams[0];
    if (opts?.targetClass) {
      const hit = cams.find((c) => c?.label === opts.targetClass);
      if (hit) chosen = hit;
    }

    const data: GradcamResponse = {
      class: chosen?.label || (j?.top4?.[0]?.[0] ?? "unknown"),
      prob: typeof chosen?.prob === "number" ? chosen.prob : (j?.top4?.[0]?.[1] ?? 0),
      heatmap_data_url: chosen?.overlay_b64
        ? `data:image/png;base64,${chosen.overlay_b64}`
        : "",
      layer: j?.cam_method || undefined,
      model_hash: undefined,
      style: {
        cmap: (j?.colormap || "JET") as string,
        alpha_by_prob: false,
        prob_floor: 0,
        cap: 1,
        gamma: 1,
      },
    };

    return { data, error: null, timeMs: Math.round(performance.now() - t0) };
  } catch (e: any) {
    return { data: null, error: e?.message || "Error en Grad-CAM" };
  }
}

/** (Opcional) Si alguna vez expones un endpoint que devuelve PNG directo, adapta aquí.
 *  Por ahora, reusamos /predict_cams y devolvemos un data URL tal cual.
 */
export async function runGradcamImageFromUrl(
  fileUrl: string,
  fileName: string,
  opts?: {
    targetClass?: string;
    targetLayer?: string;
    probFloor?: number;
    cap?: number;
    curve?: number;
    gamma?: number;
    signal?: AbortSignal;
  }
): Promise<{ url: string | null; error: string | null; timeMs?: number }> {
  const r = await runGradcamFromUrl(fileUrl, fileName, opts);
  return { url: r.data?.heatmap_data_url ?? null, error: r.error, timeMs: r.timeMs };
}

/** Guarda el informe IA en la fila del archivo (files.diagnosis_ia) */
export async function saveDiagnosisToFile(fileId: string, text: string) {
  const { error } = await supabase
    .from("files")
    .update({ diagnosis_ia: text })
    .eq("id", fileId);
  if (error) return { error: error.message || "No se pudo guardar el diagnóstico" };
  return { error: null };
}

/* ===== Persistencia de inferencias (tabla: ia_inferencias) ===== */
export type InferenceInsert = {
  archivo_id: string;
  modelo_nombre: string;
  modelo_version: string;
  modelo_tarea?: string | null;
  modelo_parametros?: any;
  umbral: number;
  clase_top1?: string | null;
  prob_top1?: number | null;
  presentes: string[];
  probabilidades: Record<string, number>;
  topk?: TopK[];
  clase_seleccionada?: string | null;
  url_mapa_calor?: string | null;
  tiempo_ms_prediccion?: number | null;
  tiempo_ms_gradcam?: number | null;
};

export async function saveInferenceRow(payload: InferenceInsert) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("ia_inferencias")
    .insert({
      ...payload,
      creado_por: auth?.user?.id ?? null,
    })
    .select("id")
    .single();

  return { id: (data?.id as string) || undefined, error: error?.message || null };
}

export async function updateInferenceRow(
  id: string,
  patch: Partial<InferenceInsert>
) {
  const { error } = await supabase.from("ia_inferencias").update(patch).eq("id", id);
  return { error: error?.message || null };
}

/* ===== Lectura/hidratación de inferencias ===== */

export type IaInferenceRow = {
  id: string;
  archivo_id: string;
  modelo_nombre: string | null;
  modelo_version: string | null;
  modelo_tarea: string | null;
  modelo_parametros: any | null;
  umbral: number | null;
  clase_top1: string | null;
  prob_top1: number | null;
  presentes: string[] | null;
  probabilidades: Record<string, number> | null;
  topk: TopK[] | null;
  clase_seleccionada: string | null;
  url_mapa_calor: string | null;
  tiempo_ms_prediccion: number | null;
  tiempo_ms_gradcam: number | null;
  creado_en: string;
  creado_por: string | null;
};

/** Devuelve la última inferencia del archivo (o null si no hay) */
export async function getLastInferenceForFile(archivo_id: string) {
  const { data, error } = await supabase
    .from("ia_inferencias")
    .select("*")
    .eq("archivo_id", archivo_id)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle<IaInferenceRow>();

  return { data: data ?? null, error: error?.message ?? null };
}

/** Helper para reconstruir PredictResponse desde una fila de ia_inferencias */
export function predictFromInference(row: IaInferenceRow): PredictResponse {
  const top_k: TopK[] =
    Array.isArray(row.topk) && row.topk.length
      ? row.topk
      : row.clase_top1
      ? [{ class: row.clase_top1, prob: row.prob_top1 ?? 0 }]
      : [];

  return {
    threshold: row.umbral ?? 0.5,
    probabilities: (row.probabilidades ?? {}) as Record<string, number>,
    present: Array.isArray(row.presentes) ? row.presentes : [],
    top_k,
    model_version: row.modelo_version ?? undefined,
  };
}

/* (opcional) Crear un informe vinculado a la inferencia */
export async function saveIaReport(params: {
  archivo_id: string;
  inferencia_id?: string | null;
  narrativa: string;
  hallazgos_seleccionados?: string[];
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("ia_informes").insert({
    archivo_id: params.archivo_id,
    inferencia_id: params.inferencia_id ?? null,
    autor_id: auth?.user?.id ?? null,
    narrativa: params.narrativa,
    hallazgos_seleccionados: params.hallazgos_seleccionados ?? [],
    estado: "final",
  });
  return { error: error?.message || null };
}

// === Lote: última inferencia para varios archivos ===
export async function getLastInferencesForFiles(fileIds: string[]) {
  if (!fileIds?.length) return { data: {} as Record<string, IaInferenceRow>, error: null };

  const { data, error } = await supabase
    .from("ia_inferencias")
    .select("*")
    .in("archivo_id", fileIds)
    .order("creado_en", { ascending: false });

  if (error) return { data: {} as Record<string, IaInferenceRow>, error: error.message };

  const map: Record<string, IaInferenceRow> = {};
  for (const row of (data as IaInferenceRow[])) {
    if (!map[row.archivo_id]) map[row.archivo_id] = row; // nos quedamos con la última por archivo
  }
  return { data: map, error: null };
}
