"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserRole } from "@/lib/permissions";
import { getPatientProfile, type FileLite } from "@/lib/historyDetails";
import {
  listPatientFiles,
  runPredictFromUrl,
  runGradcamFromUrl,
  saveDiagnosisToFile,
  getIaMeta,
  saveInferenceRow,
  updateInferenceRow,
  getLastInferenceForFile,
  predictFromInference,
  type PredictResponse,
  type IaMeta,
  type TopK,
} from "@/lib/assistance";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import StudiesPanel from "./StudiesPanel";
import ResultsPanel from "./ResultsPanel";
import TopBar from "./TopBar";
import ResultsIaView from "./ResultsIaView";

/* ===================== helpers persistentes ===================== */
function usePersistedState<T>(key: string, initial: T) {
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

/* ===================== Util: normalizar heatmap (tamaño EXACTO del original) ===================== */
async function medirImagen(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    try {
      if (!url.startsWith("data:")) (im as any).crossOrigin = "anonymous";
    } catch {}
    im.onload = () =>
      resolve({ w: im.naturalWidth || im.width, h: im.naturalHeight || im.height });
    im.onerror = reject;
    im.src = url;
  });
}

async function normalizarHeatmap(heatmapDataUrl: string, originalUrl: string): Promise<string> {
  const { w, h } = await medirImagen(originalUrl);
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

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(hm, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

/* ===================== Componente principal ===================== */
export default function Studio() {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();

  // --- Auth & rol ---
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const r = await getCurrentUserRole();
      setRole(r || null);
    })();
  }, [router]);

  const permitido = role === "Doctor" || role === "Radiologo" || role === "Administrador";

  // --- Meta del modelo ---
  const [iaMeta, setIaMeta] = useState<IaMeta | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await getIaMeta();
      if (data) setIaMeta(data);
    })();
  }, []);

  // --- Selección de paciente ---
  const [patientId, setPatientId] = usePersistedState<string | null>("targetProfileId", null);

  // hidratar desde ?id=... o desde localStorage
  useEffect(() => {
    const qid = search.get("id");
    if (qid && qid !== patientId) {
      setPatientId(qid);
      try { localStorage.setItem("targetProfileId", JSON.stringify(qid)); } catch {}
    } else if (!qid && !patientId) {
      try {
        const raw = localStorage.getItem("targetProfileId");
        if (raw) setPatientId(JSON.parse(raw));
      } catch {}
    }
  }, [search, patientId, setPatientId]);

  // sync entre pestañas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "targetProfileId") return;
      try {
        const v = e.newValue ? JSON.parse(e.newValue) : null;
        if (v && v !== patientId) setPatientId(v);
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [patientId, setPatientId]);

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => (patientId ? await getPatientProfile(patientId) : null),
    enabled: !!patientId,
  });

  // --- Archivos (sidebar)
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const [files, setFiles] = useState<FileLite[]>([]);
  const [count, setCount] = useState(0);
  const [loadingFiles, setLoadingFiles] = useState(false);

  async function loadFiles() {
    if (!patientId) return;
    setLoadingFiles(true);
    const { data, count, error } = await listPatientFiles({
      patientId,
      page,
      pageSize,
      from: from ? `${from}T00:00:00` : null,
      to: to ? `${to}T23:59:59` : null,
      imagesOnly: true,
      q,
    });
    if (error) console.error(error);
    setFiles(data);
    setCount(count);
    setLoadingFiles(false);
  }
  useEffect(() => { if (patientId) loadFiles(); /* eslint-disable-next-line */ }, [patientId, page]);

  const [selectedFile, setSelectedFile] = useState<FileLite | null>(null);
  useEffect(() => {
    if (!files.length) return;
    setSelectedFile((prev) => (prev && files.some((f) => f.id === prev.id) ? prev : files[0]));
  }, [files]);

  // --- Estado IA (analizar)
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);
  const [predict, setPredict] = useState<PredictResponse | null>(null);
  const [heatmapUrlNorm, setHeatmapUrlNorm] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = usePersistedState<string | null>("asist.selClass", null);
  const [threshold, setThreshold] = usePersistedState<number>("asist.threshold", 0.5);

  const [viewTab, setViewTab] = useState<"original" | "heatmap" | "blend">("blend");
  const [blendAlpha, setBlendAlpha] = usePersistedState<number>("asist.alpha", 0.6);
  const [zoom, setZoom] = usePersistedState<number>("asist.zoom", 1.0);

  const [hallazgosTexto, setHallazgosTexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [timeMsPredict, setTimeMsPredict] = useState<number | null>(null);
  const [timeMsGradcam, setTimeMsGradcam] = useState<number | null>(null);
  const [lastInferenceId, setLastInferenceId] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = usePersistedState<boolean>("asist.sidebarOpen", true);

  // Reset IA al cambiar estudio
  useEffect(() => {
    setPredict(null);
    setHeatmapUrlNorm(null);
    setSelectedClass(null);
    setTimeMsPredict(null);
    setTimeMsGradcam(null);
    setLastInferenceId(null);
    setHallazgosTexto(selectedFile?.diagnosis_ia || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.id]);

  // HIDRATAR desde BD: reconstruye análisis al seleccionar/recargar
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!selectedFile?.id) return;
      const { data, error } = await getLastInferenceForFile(selectedFile.id);
      if (cancel || error || !data) return;

      if (typeof data.umbral === "number") setThreshold(data.umbral);
      setPredict(predictFromInference(data));
      setSelectedClass(data.clase_seleccionada ?? null);
      setHeatmapUrlNorm(data.url_mapa_calor ?? null);
      setTimeMsPredict(data.tiempo_ms_prediccion ?? null);
      setTimeMsGradcam(data.tiempo_ms_gradcam ?? null);
      setLastInferenceId(data.id);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.id]);

  // === Handlers IA ===
  async function handleDiagnose() {
    if (!selectedFile) return;
    try {
      setLoadingDiagnosis(true);

      const { data, error, timeMs } = await runPredictFromUrl(
        selectedFile.url, selectedFile.filename, threshold
      );
      if (error || !data) throw new Error(error || "Error IA");

      setPredict(data);
      setTimeMsPredict(timeMs ?? null);

      const presentes = Object.entries(data.probabilities || {})
        .filter(([, p]) => (p ?? 0) >= threshold)
        .map(([k]) => k);
      const top1 = data.top_k?.[0];

      const modelo_nombre = iaMeta?.name || process.env.NEXT_PUBLIC_IA_MODEL_NAME || "cxr-model";
      const modelo_version = data.model_version || iaMeta?.version || "";
      const { id: infId, error: saveErr } = await saveInferenceRow({
        archivo_id: selectedFile.id,
        modelo_nombre,
        modelo_version,
        modelo_tarea: iaMeta?.task ?? "classification",
        modelo_parametros: { threshold, input_hw: iaMeta?.input_hw },
        umbral: threshold,
        clase_top1: top1?.class ?? null,
        prob_top1: top1?.prob ?? null,
        presentes,
        probabilidades: data.probabilities,
        topk: data.top_k,
        clase_seleccionada: null,
        url_mapa_calor: null,
        tiempo_ms_prediccion: timeMs ?? null,
        tiempo_ms_gradcam: null,
      });
      if (saveErr) console.error(saveErr);
      setLastInferenceId(infId ?? null);

      const chosen =
        selectedClass ??
        top1?.class ??
        Object.keys(data.probabilities || {})[0] ??
        null;

      if (chosen) {
        setSelectedClass(chosen);
        const g = await runGradcamFromUrl(selectedFile.url, selectedFile.filename, {
          targetClass: chosen,
          targetLayer: iaMeta?.last_conv || undefined,
          // Opcionales – puedes omitirlos si quieres usar los defaults del backend:
          probFloor: 0.45,
          cap: 0.65,
          curve: 1.0,
          gamma: 2.0,
        });

        if (g.error || !g.data || !g.data.heatmap_data_url) {
          setHeatmapUrlNorm(null);
          setTimeMsGradcam(null);
          if (g.error) console.error(g.error);
        } else {
          try {
            const norm = await normalizarHeatmap(g.data.heatmap_data_url, selectedFile.url);
            setHeatmapUrlNorm(norm);
            if (infId) await updateInferenceRow(infId, {
              url_mapa_calor: norm, clase_seleccionada: chosen, tiempo_ms_gradcam: g.timeMs ?? null,
            });
          } catch {
            setHeatmapUrlNorm(g.data.heatmap_data_url);
            if (infId) await updateInferenceRow(infId, {
              url_mapa_calor: g.data.heatmap_data_url, clase_seleccionada: chosen, tiempo_ms_gradcam: g.timeMs ?? null,
            });
          }
          setTimeMsGradcam(g.timeMs ?? null);
        }
      } else {
        setHeatmapUrlNorm(null);
        setTimeMsGradcam(null);
      }

      if (!selectedFile.diagnosis_ia) {
        const resumen = top1
          ? `${top1.class} (${Math.round((top1.prob ?? 0) * 100)}%)`
          : "Sin hallazgos por encima del umbral";
        const { error: upErr } = await supabase
          .from("files")
          .update({ diagnosis_ia: resumen })
          .eq("id", selectedFile.id);
        if (!upErr) setHallazgosTexto(resumen);
      }

      toast.success("Análisis IA completado.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo generar la asistencia IA");
    } finally {
      setLoadingDiagnosis(false);
    }
  }

  async function handleChangeGradcam(cls: string | null) {
    setSelectedClass(cls);
    if (!selectedFile) {
      setHeatmapUrlNorm(null);
      setTimeMsGradcam(null);
      return;
    }

    // Si no pasas clase, usa top-1 existente
    const target =
      cls ??
      predict?.top_k?.[0]?.class ??
      null;

    if (!target) {
      setHeatmapUrlNorm(null);
      setTimeMsGradcam(null);
      toast.message("Primero ejecuta la predicción para obtener una clase top-1.");
      return;
    }

    const r = await runGradcamFromUrl(selectedFile.url, selectedFile.filename, {
      targetClass: target,
      targetLayer: iaMeta?.last_conv || undefined,
      probFloor: 0.45,
      cap: 0.65,
      curve: 1.0,
      gamma: 2.0,
    });

    if (r.error || !r.data || !r.data.heatmap_data_url) {
      setHeatmapUrlNorm(null);
      setTimeMsGradcam(null);
      toast.error(r.error || "No se pudo recalcular Grad-CAM");
    } else {
      try {
        const norm = await normalizarHeatmap(r.data.heatmap_data_url, selectedFile.url);
        setHeatmapUrlNorm(norm);
        if (lastInferenceId) await updateInferenceRow(lastInferenceId, {
          url_mapa_calor: norm, clase_seleccionada: target, tiempo_ms_gradcam: r.timeMs ?? null,
        });
      } catch {
        setHeatmapUrlNorm(r.data.heatmap_data_url);
        if (lastInferenceId) await updateInferenceRow(lastInferenceId, {
          url_mapa_calor: r.data.heatmap_data_url, clase_seleccionada: target, tiempo_ms_gradcam: r.timeMs ?? null,
        });
      }
      setTimeMsGradcam(r.timeMs ?? null);
    }
  }

  // Export PNG con overlay
  async function exportOverlayPng() {
    if (!selectedFile?.file_type?.startsWith("image")) return;
    try {
      const baseBlob = await (await fetch(selectedFile.url, { cache: "no-store" })).blob();
      const baseImg = await new Promise<HTMLImageElement>((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.src = URL.createObjectURL(baseBlob);
      });

      const canvas = document.createElement("canvas");
      canvas.width = baseImg.naturalWidth || baseImg.width;
      canvas.height = baseImg.naturalHeight || baseImg.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas no soportado");

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

      if (heatmapUrlNorm) {
        const heatImg = await new Promise<HTMLImageElement>((resolve) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.src = heatmapUrlNorm;
        });
        ctx.globalAlpha = Math.max(0, Math.min(1, blendAlpha));
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(heatImg, 0, 0, canvas.width, canvas.height);
      }

      const a = document.createElement("a");
      a.download = `${(selectedFile.filename || "overlay").replace(/\.[^.]+$/, "")}_overlay.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch {
      toast.error("No se pudo exportar el snapshot");
    }
  }

  // --- Tabs ("Analizar archivo" | "Resultados IA") ---
  const subtab = search.get("subtab");
  const [activeTab, setActiveTab] = useState<"analizar" | "resultados">(
    subtab === "resultados" ? "resultados" : "analizar"
  );

  useEffect(() => {
    setActiveTab(subtab === "resultados" ? "resultados" : "analizar");
  }, [subtab]);

  const patientIdSafe = useMemo(() => patientId ?? "", [patientId]);

  const updateSearchParam = (key: string, value?: string) => {
    const sp = new URLSearchParams(search.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const onTabChange = (v: string) => {
    const next = v as "analizar" | "resultados";
    setActiveTab(next);
    if (next === "resultados") updateSearchParam("subtab", "resultados");
    else updateSearchParam("subtab", undefined);
  };

  if (!permitido) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="rounded-xl border bg-card/50 p-5 text-muted-foreground">
          Solo pueden acceder <b>Doctor</b> o <b>Radiólogo</b>.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50/60 via-background to-background">
      <div className="container mx-auto px-3 py-5">
        {/* TopBar reutilizable (sin búsqueda) */}
        <TopBar
          onBack={() => window.history.back()}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          iaMeta={iaMeta ?? undefined}
          patient={patient ?? undefined}
        />

        <div className="mb-3 flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList>
              <TabsTrigger value="analizar">Analizar archivo</TabsTrigger>
              <TabsTrigger value="resultados">Resultados IA</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/analisis-ia-galeria${patientIdSafe ? `?id=${patientIdSafe}` : ""}`)
            }
          >
            Resumen radiografías IA
          </Button>
        </div>

        {/* Contenido por pestaña */}
        {!patientId ? (
          <Card className="mx-auto max-w-xl p-6 text-center">Seleccione un paciente.</Card>
        ) : (
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
            {/* Tab: Analizar archivo */}
            <TabsContent value="analizar" className="space-y-4">
              <div className={`grid gap-5 ${sidebarOpen ? "grid-cols-1 lg:grid-cols-[320px_1fr]" : "grid-cols-1"}`}>
                {sidebarOpen && (
                  <StudiesPanel
                    files={files}
                    count={count}
                    loading={loadingFiles}
                    page={page}
                    pageSize={pageSize}
                    from={from}
                    to={to}
                    q={q}
                    onChangeFrom={setFrom}
                    onChangeTo={setTo}
                    onChangeQ={setQ}
                    onApply={() => { setPage(1); loadFiles(); }}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => p + 1)}
                    onSelectFile={setSelectedFile}
                    activeFileId={selectedFile?.id || null}
                  />
                )}

                <ResultsPanel
                  selectedFile={selectedFile}
                  viewTab={viewTab}
                  setViewTab={setViewTab}
                  threshold={threshold}
                  setThreshold={setThreshold}
                  blendAlpha={blendAlpha}
                  setBlendAlpha={setBlendAlpha}
                  zoom={zoom}
                  setZoom={setZoom}
                  loadingDiagnosis={loadingDiagnosis}
                  onApplyThreshold={handleDiagnose}
                  onDiagnose={handleDiagnose}
                  onExportOverlay={exportOverlayPng}
                  predict={predict}
                  selectedClass={selectedClass}
                  onChangeGradcam={handleChangeGradcam}
                  heatmapUrlNorm={heatmapUrlNorm}
                  timeMsPredict={timeMsPredict}
                  timeMsGradcam={timeMsGradcam}
                  hallazgosTexto={hallazgosTexto}
                  setHallazgosTexto={setHallazgosTexto}
                  onSaveDiagnosis={async () => {
                    if (!selectedFile) return;
                    setGuardando(true);
                    let contenido = hallazgosTexto.trim();
                    if (!contenido && predict?.top_k?.[0]) {
                      const t: TopK = predict.top_k[0];
                      contenido = `${t.class} (${Math.round(t.prob * 100)}%)`;
                    }
                    if (!contenido) contenido = "Sin hallazgos por encima del umbral";
                    const { error } = await saveDiagnosisToFile(selectedFile.id, contenido);
                    if (error) toast.error(error);
                    else {
                      toast.success("Diagnóstico guardado");
                      setHallazgosTexto(contenido);
                    }
                    setGuardando(false);
                  }}
                  savingDiagnosis={guardando}
                  onOpenOriginal={() => selectedFile && window.open(selectedFile.url, "_blank")}
                />
              </div>
            </TabsContent>

            {/* Tab: Resultados IA */}
            <TabsContent value="resultados" className="space-y-4">
              <ResultsIaView patientId={patientIdSafe} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
