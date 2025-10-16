"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  runPredictFromUrl,
  runGradcamFromUrl,
  saveDiagnosisToFile,
  type PredictResponse,
  type IaMeta,
} from "@/lib/assistance";
import { FileLite } from "@/lib/historyDetails";

/* ================= helpers persistentes ================= */
export function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

/* ============== util: medir y normalizar heatmap ============== */
async function medirImagen(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () =>
      resolve({
        w: (im as any).naturalWidth || im.width,
        h: (im as any).naturalHeight || im.height,
      });
    im.onerror = reject;
    try {
      if (!url.startsWith("data:")) (im as any).crossOrigin = "anonymous";
    } catch {}
    im.src = url;
  });
}

/** Redimensiona el heatmap (dataURL) al tamaño nativo de la imagen original. */
export async function normalizarHeatmap(
  heatmapDataUrl: string,
  originalUrl: string
): Promise<string> {
  const { w, h } = await medirImagen(originalUrl);
  // Evita canvas gigantes que pueden congelar la pestaña (ajusta si quieres)
  const maxPixels = 4_000_000; // ~4MP
  if (w * h > maxPixels) {
    // escalado proporcional para no superar maxPixels
    const scale = Math.sqrt(maxPixels / (w * h));
    const W = Math.max(1, Math.round(w * scale));
    const H = Math.max(1, Math.round(h * scale));
    const hm = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = heatmapDataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return heatmapDataUrl;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(hm, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }

  const hm = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = heatmapDataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return heatmapDataUrl;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(hm, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/* ============== Hook: motor de IA (predict + gradcam + save) ============== */
export function useIaEngine({
  file,
  threshold,
  iaMeta,
  onHeatmap,
}: {
  file: FileLite | null;
  threshold: number;
  iaMeta?: IaMeta | null;
  onHeatmap?: (raw: string | null, normalized: string | null) => void;
}) {
  const [predict, setPredict] = useState<PredictResponse | null>(null);
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);
  const [timeMsPredict, setTimeMsPredict] = useState<number | null>(null);
  const [timeMsGradcam, setTimeMsGradcam] = useState<number | null>(null);

  // reset al cambiar de archivo
  useEffect(() => {
    setPredict(null);
    setTimeMsPredict(null);
    setTimeMsGradcam(null);
    onHeatmap?.(null, null);
  }, [file?.id]); // eslint-disable-line

  async function analyze(force?: boolean) {
    if (!file) return;
    if (predict && !force) return;
    try {
      setLoadingDiagnosis(true);
      const { data, error, timeMs } = await runPredictFromUrl(
        file.url,
        file.filename,
        threshold
      );
      if (error || !data) throw new Error(error || "Error en inferencia");
      setPredict(data);
      setTimeMsPredict(timeMs ?? null);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo generar la asistencia IA");
    } finally {
      setLoadingDiagnosis(false);
    }
  }

  async function changeClass(cls: string | null) {
    if (!file) {
      setTimeMsGradcam(null);
      onHeatmap?.(null, null);
      return;
    }

    // Si no hay clase elegida, usa top-1 del predict
    const fallbackTop1 = predict?.top_k?.[0]?.class || null;
    const target = cls || fallbackTop1;

    if (!target) {
      onHeatmap?.(null, null);
      toast.message("Primero ejecuta la predicción para obtener una clase top-1.");
      return;
    }

    if (iaMeta?.classes?.length && !iaMeta.classes.includes(target)) {
      toast.error("La clase seleccionada no existe en el modelo cargado.");
      return;
    }

    const r = await runGradcamFromUrl(file.url, file.filename, {
      targetClass: target,                      // <- el backend usa ?labels=target
      targetLayer: iaMeta?.last_conv || undefined, // ignorado por backend actual (compat)
      // El backend ya colorea con alpha; dejamos estos params por compatibilidad a futuro
      probFloor: 0.45,
      cap: 0.65,
      curve: 1.0,
      gamma: 2.0,
    });

    if (r.error || !r.data || !r.data.heatmap_data_url) {
      setTimeMsGradcam(null);
      onHeatmap?.(null, null);
      toast.error(r.error || "No se pudo recalcular Grad-CAM");
      return;
    }

    const raw = r.data.heatmap_data_url; // data:image/png;base64,...
    let normalized = raw;
    try {
      normalized = await normalizarHeatmap(raw, file.url);
    } catch (e) {
      // si falla la normalización, igual mostramos el raw
      console.warn("No se pudo normalizar el heatmap:", e);
    }
    onHeatmap?.(raw, normalized);
    setTimeMsGradcam(r.timeMs ?? null);
  }

  async function saveDiagnosis(text?: string) {
    if (!file) return false;
    try {
      let contenido = (text || "").trim();
      if (!contenido && predict?.top_k?.[0]) {
        const t = predict.top_k[0];
        contenido = `${t.class} (${Math.round(t.prob * 100)}%)`;
      }
      if (!contenido) contenido = "Sin hallazgos por encima del umbral";
      const { error } = await saveDiagnosisToFile(file.id, contenido);
      if (error) throw new Error(error);
      return true;
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el diagnóstico");
      return false;
    }
  }

  return {
    predict,
    loadingDiagnosis,
    timeMsPredict,
    timeMsGradcam,
    analyze,
    changeClass,
    saveDiagnosis,
  };
}
