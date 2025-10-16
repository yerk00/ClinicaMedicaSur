// lib/iaResults.ts
// ------------------------------------------------------------------------------------
// Vista "Resultados IA": consultas combinadas (files + ia_inferencias + ia_informes)
// con filtros, paginación, orden y helpers para detalle, stats y export CSV.
// ------------------------------------------------------------------------------------

import { supabase } from "./supabaseClient";

// ===========================
// Tipos (contrato de la UI)
// ===========================

export type IaResultsOrderBy =
  | "date_desc"
  | "date_asc"
  | "prob_desc"
  | "prob_asc"
  | "filename_asc"
  | "filename_desc";

export type IaReportState = "borrador" | "final" | null;

export interface ListIaResultsArgs {
  patientId: string;
  // Filtros
  from?: string; // ISO/date-only (inclusive) aplicado a ia_inferencias.creado_en; fallback files.uploaded_at
  to?: string;   // ISO/date-only (inclusive)
  classes?: string[]; // filtra por top1 o presentes[] (overlaps) y ahora también por topk
  model?: string;
  version?: string;
  minThreshold?: number; // PROBABILIDAD mínima (0..1) -> se aplica en memoria
  reportState?: IaReportState | "sin_informe"; // 'borrador'|'final'|null|'sin_informe'
  hasHeatmap?: boolean;
  tags?: string[];      // overlaps con files.tags
  search?: string;      // ilike filename
  fileTypes?: string[]; // in file_type
  // Paginación / orden
  page?: number;     // 1-based
  pageSize?: number; // default 20
  orderBy?: IaResultsOrderBy;
}

export interface IaResultRow {
  // File
  file_id: string;
  filename: string;
  url: string;
  file_type: string | null;
  uploaded_at: string | null;
  tags: string[];
  uploaded_by?: string | null;

  // Última inferencia del file (ya filtrada)
  inference_id: string;
  creado_en: string; // fecha de la inferencia
  modelo_nombre: string;
  modelo_version: string;
  umbral: number;
  clase_top1: string | null;
  prob_top1: number | null;
  presentes: string[]; // text[]
  has_heatmap: boolean;
  tiempo_ms_prediccion: number | null;

  // Informe más reciente para ese file (si existe)
  report_state: IaReportState; // 'borrador'|'final'|null (null = sin informe)
  report_author_name?: string | null;
  report_updated_at?: string | null;
  report_id?: string | null;
}

export interface ListIaResultsResponse {
  rows: IaResultRow[];
  count: number; // total tras filtros (para paginación)
}

export interface IaResultDetail {
  file: {
    id: string;
    filename: string;
    url: string;
    file_type: string | null;
    tags: string[];
    uploaded_at: string | null;
    uploaded_by?: string | null;
  };
  inference: {
    id: string;
    creado_en: string;
    modelo_nombre: string;
    modelo_version: string;
    umbral: number;
    clase_top1: string | null;
    prob_top1: number | null;
    presentes: string[];
    probabilidades: Record<string, number> | null; // jsonb
    topk: Array<{ class: string; prob: number }> | null; // <- normalizado
    url_mapa_calor: string | null;
    tiempo_ms_prediccion: number | null;
    tiempo_ms_gradcam: number | null;
  } | null;
  report: {
    id: string;
    estado: IaReportState;
    autor_id: string | null;
    autor_nombre?: string | null;
    creado_en: string | null;
    actualizado_en: string | null;
  } | null;
}

export interface IaResultsStats {
  total_estudios_ia: number;
  top_clases: Array<{ clase: string; count: number }>;
  serie_diaria: Array<{ date: string; count: number }>; // YYYY-MM-DD, cantidad de inferencias
}

// ===========================
// Helpers internos
// ===========================

const isUuid = (s?: string) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

const isDateOnly = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// Inclusivo (inicio del día para from / fin del día para to)
const normalizeFromISO = (d?: string) => {
  if (!d) return undefined;
  return isDateOnly(d) ? new Date(`${d}T00:00:00.000Z`).toISOString() : new Date(d).toISOString();
};
const normalizeToISO = (d?: string) => {
  if (!d) return undefined;
  return isDateOnly(d)
    ? new Date(`${d}T23:59:59.999Z`).toISOString()
    : new Date(d).toISOString();
};

const applyOrder = (rows: IaResultRow[], orderBy?: IaResultsOrderBy) => {
  const by = orderBy ?? "date_desc";
  return [...rows].sort((a, b) => {
    switch (by) {
      case "date_desc":
        return (b.creado_en || "").localeCompare(a.creado_en || "");
      case "date_asc":
        return (a.creado_en || "").localeCompare(b.creado_en || "");
      case "prob_desc":
        return (b.prob_top1 ?? -1) - (a.prob_top1 ?? -1);
      case "prob_asc":
        return (a.prob_top1 ?? 999) - (b.prob_top1 ?? 999);
      case "filename_asc":
        return (a.filename || "").localeCompare(b.filename || "");
      case "filename_desc":
        return (b.filename || "").localeCompare(a.filename || "");
      default:
        return 0;
    }
  });
};

const paginate = <T>(arr: T[], page = 1, pageSize = 20) => {
  const p = Math.max(1, page);
  const size = Math.max(1, pageSize);
  const start = (p - 1) * size;
  return arr.slice(start, start + size);
};

// Normaliza topk: acepta {class,prob} y {label,prob}
const normalizeTopk = (topk: any): Array<{ class: string; prob: number }> | null => {
  if (!Array.isArray(topk)) return null;
  const out: Array<{ class: string; prob: number }> = [];
  for (const it of topk) {
    if (!it) continue;
    const cls = (it.class ?? it.label ?? "").toString();
    const p = Number(it.prob);
    if (!cls) continue;
    out.push({ class: cls, prob: isFinite(p) ? p : 0 });
  }
  return out.length ? out : null;
};

// ===========================
// Consultas base
// ===========================

/**
 * Devuelve los FILE IDs del paciente con filtros de archivo aplicados (tags, file_type, uploaded_at, search).
 * No pagina aún; si existe riesgo de volumen muy alto, puedes incorporar un tope MAX.
 */
async function fetchPatientFileRecords(args: ListIaResultsArgs) {
  const {
    patientId,
    tags,
    search,
    fileTypes,
    from,
    to,
  } = args;

  if (!isUuid(patientId)) {
    throw new Error("patientId inválido");
  }

  let q = supabase
    .from("files")
    .select(
      "id, user_profile_id, filename, url, file_type, uploaded_at, tags, uploaded_by",
      { count: "exact" }
    )
    .eq("user_profile_id", patientId);

  if (search && search.trim().length > 0) {
    q = q.ilike("filename", `%${search.trim()}%`);
  }

  if (tags && tags.length > 0) {
    q = q.overlaps("tags", tags);
  }

  if (fileTypes && fileTypes.length > 0) {
    q = q.in("file_type", fileTypes);
  }

  // Filtro temporal en archivos (fallback si inferencias no lo tienen)
  const fromIso = normalizeFromISO(from);
  const toIso = normalizeToISO(to);
  if (fromIso) q = q.gte("uploaded_at", fromIso);
  if (toIso) q = q.lte("uploaded_at", toIso);

  // Orden preliminar por fecha de subida desc (no definitivo)
  q = q.order("uploaded_at", { ascending: false });

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    user_profile_id: string;
    filename: string;
    url: string;
    file_type: string | null;
    uploaded_at: string | null;
    tags: string[] | null;
    uploaded_by?: string | null;
  }>;
}

/**
 * Trae inferencias por archivo_id (subset) aplicando filtros de inferencia.
 * No agrupa: retorna todas las inferencias que calzan; luego se tomará la última por archivo en memoria.
 *
 * NOTA IMPORTANTE: filtramos por **prob_top1 >= minThreshold** en memoria (clínico).
 */
async function fetchInferencesForFiles(
  fileIds: string[],
  args: ListIaResultsArgs
) {
  if (fileIds.length === 0) return [];

  const {
    from,
    to,
    classes,
    model,
    version,
    minThreshold, // 0..1 (clínico)
    hasHeatmap,
  } = args;

  let qi = supabase
    .from("ia_inferencias")
    .select(
      "id, archivo_id, modelo_nombre, modelo_version, modelo_tarea, umbral, clase_top1, prob_top1, presentes, probabilidades, topk, url_mapa_calor, tiempo_ms_prediccion, tiempo_ms_gradcam, creado_en",
      { count: "exact" }
    )
    .in("archivo_id", fileIds);

  const fromIso = normalizeFromISO(from);
  const toIso = normalizeToISO(to);
  if (fromIso) qi = qi.gte("creado_en", fromIso);
  if (toIso) qi = qi.lte("creado_en", toIso);

  if (model) qi = qi.eq("modelo_nombre", model);
  if (version) qi = qi.eq("modelo_version", version);

  if (hasHeatmap === true) {
    // Considera “con heatmap” solo si el campo tiene contenido real
    qi = qi.not("url_mapa_calor", "is", null).neq("url_mapa_calor", "");
  } else if (hasHeatmap === false) {
    qi = qi.or("url_mapa_calor.is.null,url_mapa_calor.eq.");
  }

  // Orden por creado_en desc para que la "última por archivo" sea la primera encontrada
  qi = qi.order("creado_en", { ascending: false });

  const { data, error } = await qi;
  if (error) throw error;

  let infs = (data ?? []) as Array<{
    id: string;
    archivo_id: string;
    modelo_nombre: string;
    modelo_version: string;
    modelo_tarea: string | null;
    umbral: number;
    clase_top1: string | null;
    prob_top1: number | null;
    presentes: string[] | null;
    probabilidades: any | null;
    topk: any | null;
    url_mapa_calor: string | null;
    tiempo_ms_prediccion: number | null;
    tiempo_ms_gradcam: number | null;
    creado_en: string;
  }>;

  // Filtrado por clases (top1 o presentes o dentro de topk), case-insensitive
  if (classes && classes.length > 0) {
    const clsSet = new Set(classes.map((s) => s.toLowerCase()));
    infs = infs.filter((it) => {
      const top1 = (it.clase_top1 || "").toLowerCase();
      const pres = (it.presentes || []).map((s) => s.toLowerCase());
      const tk  = normalizeTopk(it.topk) || [];
      const tkSet = new Set(tk.map((x) => x.class.toLowerCase()));
      const hitTop = top1 && clsSet.has(top1);
      const hitPres = pres.some((p) => clsSet.has(p));
      const hitTopk = Array.from(clsSet).some((c) => tkSet.has(c));
      return hitTop || hitPres || hitTopk;
    });
  }

  // Filtrado clínico por probabilidad mínima (en memoria)
  if (typeof minThreshold === "number") {
    infs = infs.filter((it) => (it.prob_top1 ?? -1) >= minThreshold);
  }

  return infs;
}

/**
 * Trae el informe más reciente por archivo (opcionalmente filtra por estado).
 * Devuelve un mapa: file_id -> último informe.
 *
 * Para "sin_informe", NO filtramos aquí; filtramos en la etapa final (rows).
 */
async function fetchLatestReportsMap(
  fileIds: string[],
  reportState?: IaReportState | "sin_informe"
) {
  if (fileIds.length === 0) return new Map<string, null>();

  let qr = supabase
    .from("ia_informes")
    .select("id, archivo_id, inferencia_id, autor_id, narrativa, estado, creado_en, actualizado_en")
    .in("archivo_id", fileIds)
    .order("actualizado_en", { ascending: false });

  if (reportState && reportState !== "sin_informe") {
    qr = qr.eq("estado", reportState);
  }

  const { data, error } = await qr;
  if (error) throw error;

  const map = new Map<string, any | null>();
  for (const r of data ?? []) {
    const fid = (r as any).archivo_id as string;
    if (!map.has(fid)) {
      map.set(fid, r);
    }
  }
  return map;
}

// ===========================
// API principal (lista)
// ===========================

export async function listIaResultsByPatient(args: ListIaResultsArgs): Promise<ListIaResultsResponse> {
  const {
    patientId,
    page = 1,
    pageSize = 20,
    orderBy,
    reportState,
  } = args;

  // 1) Files del paciente (con filtros de archivo)
  const files = await fetchPatientFileRecords(args);
  const fileById = new Map(files.map((f) => [f.id, f]));
  if (!files.length) return { rows: [], count: 0 };

  // 2) Inferencias filtradas para esos files
  const infs = await fetchInferencesForFiles(files.map((f) => f.id), args);
  if (!infs.length) return { rows: [], count: 0 };

  // 3) Nos quedamos con la ÚLTIMA inferencia por archivo
  const seen = new Set<string>();
  const latestByFile = new Map<string, (typeof infs)[number]>();
  for (const inf of infs) {
    if (!seen.has(inf.archivo_id)) {
      seen.add(inf.archivo_id);
      latestByFile.set(inf.archivo_id, inf);
    }
  }

  // 4) Informe más reciente por archivo (no aplicamos "sin_informe" aquí)
  const latestReports = await fetchLatestReportsMap(Array.from(latestByFile.keys()), reportState);

  // 5) Ensamblar filas IaResultRow
  let rows: IaResultRow[] = [];
  for (const [fileId, inf] of latestByFile.entries()) {
    const f = fileById.get(fileId);
    if (!f) continue;

    const rep = latestReports.get(fileId) ?? null;

    // Filtrado por estado del informe:
    if (reportState === "sin_informe" && rep) continue;
    if (reportState === "final" && (!rep || rep.estado !== "final")) continue;
    if (reportState === "borrador" && (!rep || rep.estado !== "borrador")) continue;

    rows.push({
      // File
      file_id: f.id,
      filename: f.filename,
      url: f.url,
      file_type: f.file_type,
      uploaded_at: f.uploaded_at,
      tags: f.tags ?? [],
      uploaded_by: f.uploaded_by ?? null,

      // Inferencia
      inference_id: inf.id,
      creado_en: inf.creado_en,
      modelo_nombre: inf.modelo_nombre,
      modelo_version: inf.modelo_version,
      umbral: inf.umbral,
      clase_top1: inf.clase_top1,
      prob_top1: inf.prob_top1,
      presentes: inf.presentes ?? [],
      has_heatmap: !!(inf.url_mapa_calor && String(inf.url_mapa_calor).length > 10),
      tiempo_ms_prediccion: inf.tiempo_ms_prediccion,

      // Informe
      report_state: rep ? ((rep as any).estado as IaReportState) : null,
      report_author_name: null,
      report_updated_at: rep ? ((rep as any).actualizado_en as string | null) : null,
      report_id: rep ? ((rep as any).id as string) : null,
    });
  }

  // 6) Orden final + conteo + paginación
  rows = applyOrder(rows, orderBy);
  const count = rows.length;
  rows = paginate(rows, page, pageSize);

  return { rows, count };
}

// ===========================
// Detalle para drawer
// ===========================

export async function getIaResultDetail(params: { fileId: string }): Promise<IaResultDetail> {
  const { fileId } = params;
  if (!isUuid(fileId)) throw new Error("fileId inválido");

  // File
  const { data: fdata, error: ferr } = await supabase
    .from("files")
    .select("id, filename, url, file_type, tags, uploaded_at, uploaded_by")
    .eq("id", fileId)
    .single();

  if (ferr) throw ferr;
  if (!fdata) throw new Error("Archivo no encontrado");

  // Última inferencia del file
  const { data: idata, error: ierr } = await supabase
    .from("ia_inferencias")
    .select("id, archivo_id, modelo_nombre, modelo_version, umbral, clase_top1, prob_top1, presentes, probabilidades, topk, url_mapa_calor, tiempo_ms_prediccion, tiempo_ms_gradcam, creado_en")
    .eq("archivo_id", fileId)
    .order("creado_en", { ascending: false })
    .limit(1);

  if (ierr) throw ierr;

  const inf = (idata && idata.length > 0) ? idata[0] : null;

  // Informe más reciente del file
  const { data: rdata, error: rerr } = await supabase
    .from("ia_informes")
    .select("id, archivo_id, inferencia_id, autor_id, estado, creado_en, actualizado_en")
    .eq("archivo_id", fileId)
    .order("actualizado_en", { ascending: false })
    .limit(1);

  if (rerr) throw rerr;

  const rep = (rdata && rdata.length > 0) ? rdata[0] : null;

  return {
    file: {
      id: fdata.id,
      filename: fdata.filename,
      url: fdata.url,
      file_type: fdata.file_type,
      tags: fdata.tags ?? [],
      uploaded_at: fdata.uploaded_at,
      uploaded_by: fdata.uploaded_by ?? null,
    },
    inference: inf
      ? {
          id: inf.id,
          creado_en: inf.creado_en,
          modelo_nombre: inf.modelo_nombre,
          modelo_version: inf.modelo_version,
          umbral: inf.umbral,
          clase_top1: inf.clase_top1,
          prob_top1: inf.prob_top1,
          presentes: inf.presentes ?? [],
          probabilidades: (inf.probabilidades ?? null) as any,
          topk: normalizeTopk(inf.topk),
          url_mapa_calor: inf.url_mapa_calor,
          tiempo_ms_prediccion: inf.tiempo_ms_prediccion,
          tiempo_ms_gradcam: inf.tiempo_ms_gradcam,
        }
      : null,
    report: rep
      ? {
          id: rep.id,
          estado: rep.estado as IaReportState,
          autor_id: rep.autor_id ?? null,
          creado_en: rep.creado_en ?? null,
          actualizado_en: rep.actualizado_en ?? null,
        }
      : null,
  };
}

// ===========================
// KPIs / Estadísticas
// ===========================

export async function getIaResultsStats(args: {
  patientId: string;
  from?: string;
  to?: string;
}): Promise<IaResultsStats> {
  const { patientId, from, to } = args;
  if (!isUuid(patientId)) throw new Error("patientId inválido");

  // 1) Files del paciente (rango opcional en uploaded_at solo como fallback)
  const files = await fetchPatientFileRecords({
    patientId,
    from,
    to,
  });

  const fileIds = files.map((f) => f.id);
  if (fileIds.length === 0) {
    return { total_estudios_ia: 0, top_clases: [], serie_diaria: [] };
  }

  // 2) Inferencias dentro del rango (por creado_en)
  let qi = supabase
    .from("ia_inferencias")
    .select("id, archivo_id, clase_top1, creado_en", { count: "exact" })
    .in("archivo_id", fileIds);

  const fromIso = normalizeFromISO(from);
  const toIso = normalizeToISO(to);
  if (fromIso) qi = qi.gte("creado_en", fromIso);
  if (toIso) qi = qi.lte("creado_en", toIso);

  const { data, error, count } = await qi;
  if (error) throw error;

  const total_estudios_ia = count ?? (data?.length ?? 0);

  // 3) Top clases (por frecuencia de top1)
  const clsMap = new Map<string, number>();
  for (const it of data ?? []) {
    const c = ((it as any).clase_top1 || "").toString();
    if (!c) continue;
    clsMap.set(c, (clsMap.get(c) ?? 0) + 1);
  }
  const top_clases = Array.from(clsMap.entries())
    .map(([clase, cnt]) => ({ clase, count: cnt }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 4) Serie diaria
  const dayMap = new Map<string, number>();
  for (const it of data ?? []) {
    const iso = (it as any).creado_en as string;
    if (!iso) continue;
    const d = new Date(iso);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate()
    ).padStart(2, "0")}`;
    dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }
  const serie_diaria = Array.from(dayMap.entries())
    .map(([date, cnt]) => ({ date, count: cnt }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { total_estudios_ia, top_clases, serie_diaria };
}

// ===========================
// Export CSV
// ===========================

export async function exportIaResultsCsv(args: ListIaResultsArgs): Promise<string> {
  // Reutilizamos la lista (mismos filtros/orden/paginación), pero para export usualmente se espera TODO el set filtrado.
  const { rows } = await listIaResultsByPatient({
    ...args,
    page: 1,
    pageSize: 10_000, // tope razonable
  });

  const headers = [
    "file_id",
    "filename",
    "file_type",
    "uploaded_at",
    "tags",
    "inference_id",
    "creado_en",
    "modelo_nombre",
    "modelo_version",
    "umbral",
    "clase_top1",
    "prob_top1",
    "presentes",
    "has_heatmap",
    "tiempo_ms_prediccion",
    "report_state",
    "report_updated_at",
  ];

  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return `"${v.join("|").replace(/"/g, '""')}"`;
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.file_id,
        r.filename,
        r.file_type ?? "",
        r.uploaded_at ?? "",
        (r.tags ?? []).join("|"),
        r.inference_id,
        r.creado_en,
        r.modelo_nombre,
        r.modelo_version,
        r.umbral,
        r.clase_top1 ?? "",
        r.prob_top1 ?? "",
        (r.presentes ?? []).join("|"),
        r.has_heatmap ? "1" : "0",
        r.tiempo_ms_prediccion ?? "",
        r.report_state ?? "",
        r.report_updated_at ?? "",
      ]
        .map(escape)
        .join(",")
    ),
  ];

  return lines.join("\n");
}
