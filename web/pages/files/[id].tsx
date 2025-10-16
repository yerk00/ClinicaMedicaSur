"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Tag,
  ChevronLeft,
  Image as ImageIcon,
  Flame,
  Layers,
  RefreshCw,
  ExternalLink,
  Save,
  Gauge,
  Download,
  AlertTriangle,
  Search,
  LineChart,
  GitBranch,
  Home,
} from "lucide-react";
import { toast } from "sonner";

/* =========================================================
   TIPOS BÁSICOS
========================================================= */
type PatientProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type FileLite = {
  id: string;
  filename: string;
  file_type: string | null;
  url: string;
  uploaded_at: string | null;
  tags: string[] | null;
};

type TopK = { class: string; prob: number };
type PredictResponse = {
  threshold: number;
  probabilities: Record<string, number>;
  present: string[];
  top_k: TopK[];
  model_version?: string;
};
type GradcamResponse = {
  class: string;
  prob: number;
  heatmap_data_url: string; // data:image/png;base64,...
};

/* =========================================================
   STATE PERSISTENTE SIMPLE
========================================================= */
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

/* =========================================================
   UTILS (IMAGEN y FORMATO)
========================================================= */
async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
}
const formatPct = (x: number) => `${(x * 100).toFixed(1)}%`;
const fmtDT = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

/* =========================================================
   MINI-COMPONENTES VISUALES
========================================================= */
function LegendBar() {
  return (
    <div className="mt-3">
      <div className="text-xs text-muted-foreground mb-1">Intensidad (heatmap)</div>
      <div
        className="h-2 w-full rounded"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,255,0.6) 15%, rgba(0,255,255,0.7) 35%, rgba(255,255,0,0.8) 65%, rgba(255,0,0,1) 100%)",
        }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>Bajo</span>
        <span>Alto</span>
      </div>
    </div>
  );
}

function TopKChips({
  topk,
  onPick,
  active,
}: {
  topk: TopK[];
  onPick: (cls: string) => void;
  active: string | null;
}) {
  if (!topk?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {topk.slice(0, 6).map((t) => (
        <Badge
          key={t.class}
          onClick={() => onPick(t.class)}
          className={`cursor-pointer transition ${
            active === t.class
              ? "bg-cyan-600 text-white"
              : "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200"
          }`}
        >
          {t.class} · {(t.prob * 100).toFixed(0)}%
        </Badge>
      ))}
    </div>
  );
}

function FindingsSelector({
  present,
  topk,
  selected,
  onToggle,
  onInsert,
}: {
  present: string[];
  topk: TopK[];
  selected: Set<string>;
  onToggle: (cls: string) => void;
  onInsert: () => void;
}) {
  const names = useMemo(() => {
    const s = new Set<string>(present);
    topk.forEach((t) => s.add(t.class));
    return Array.from(s);
  }, [present, topk]);

  if (!names.length) return null;
  return (
    <div className="mt-2 rounded-md border bg-white/60 dark:bg-card/60 p-2">
      <div className="text-xs text-muted-foreground mb-1">Hallazgos sugeridos</div>
      <div className="flex flex-wrap gap-2">
        {names.map((name) => (
          <label
            key={name}
            className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.has(name)}
              onChange={() => onToggle(name)}
            />
            <span className="truncate max-w-[180px]" title={name}>
              {name}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-2">
        <Button size="sm" variant="outline" onClick={onInsert} className="cursor-pointer">
          Insertar selección en informe
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
   CHARTS (SVG inline, sin librerías)
========================================================= */
type SessionPoint = { t: number; label: string; prob: number; fileId: string };

function TrendChart({ data }: { data: SessionPoint[] }) {
  const minT = Math.min(...data.map((d) => d.t));
  const maxT = Math.max(...data.map((d) => d.t));
  const spanT = Math.max(1, maxT - minT);
  const w = 420,
    h = 120,
    pad = 16;

  const pts = data.map((d) => {
    const x = pad + ((d.t - minT) / spanT) * (w - pad * 2);
    const y = pad + (1 - d.prob) * (h - pad * 2);
    return { x, y, label: d.label, prob: d.prob };
  });

  const path = pts.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg width={w} height={h} className="rounded border bg-white/60 dark:bg-card/60">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" opacity={0.2} />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" opacity={0.2} />
        <path d={path} fill="none" stroke="rgb(8,145,178)" strokeWidth="2" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill="rgb(8,145,178)" />
          </g>
        ))}
        {pts.length ? (
          <>
            <text x={pts[0].x} y={pts[0].y - 6} fontSize="10" className="fill-foreground">
              {`${(pts[0].prob * 100).toFixed(0)}%`}
            </text>
            <text
              x={pts[pts.length - 1].x}
              y={pts[pts.length - 1].y - 6}
              fontSize="10"
              className="fill-foreground"
              textAnchor="end"
            >
              {`${(pts[pts.length - 1].prob * 100).toFixed(0)}%`}
            </text>
          </>
        ) : null}
      </svg>
    </div>
  );
}

function MindMap({ center, related }: { center: string; related: string[] }) {
  const size = 320;
  const cx = size / 2,
    cy = size / 2,
    r = 110;
  const nodes = related.slice(0, 8).map((name, i, arr) => {
    const ang = (i / arr.length) * Math.PI * 2;
    return { name, x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg width={size} height={size} className="rounded border bg-white/60 dark:bg-card/60">
        {nodes.map((n, i) => (
          <line key={`l-${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="rgb(8,145,178)" strokeWidth="1.5" opacity={0.35} />
        ))}
        <circle cx={cx} cy={cy} r={22} fill="rgb(8,145,178)" opacity={0.9} />
        <text x={cx} y={cy + 4} fontSize="10" textAnchor="middle" className="fill-white">
          {center || "Patrón"}
        </text>
        {nodes.map((n, i) => (
          <g key={`n-${i}`} className="transition">
            <circle cx={n.x} cy={n.y} r={16} fill="rgb(8,145,178)" opacity={0.15} />
            <text x={n.x} y={n.y + 3} fontSize="9" textAnchor="middle" className="fill-foreground">
              {n.name.length > 12 ? n.name.slice(0, 11) + "…" : n.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* =========================================================
   PÁGINA PRINCIPAL: ASISTENCIA IA
========================================================= */
type BlendModeCanvas = "multiply" | "screen" | "overlay" | "soft-light" | "color-burn";

export default function AsistenciaPage() {
  const router = useRouter();
  const { id: qId, patientId: qPid } = router.query as { id?: string; patientId?: string };
  const broadcastChannelRef = useRef<any>(null);

  /* ---------- Contexto paciente ---------- */
  const [patientId, setPatientId] = usePersistedState<string | null>("targetProfileId", null);
  const [patient, setPatient] = useState<PatientProfile | null>(null);

  /* ---------- Archivos del paciente ---------- */
  const [files, setFiles] = useState<FileLite[]>([]);
  const [count, setCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState<FileLite | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  /* ---------- Buscador de paciente (si no hay contexto) ---------- */
  const [qPatient, setQPatient] = useState("");
  const [patientResults, setPatientResults] = useState<PatientProfile[]>([]);

  /* ---------- Visor / IA ---------- */
  const [viewTab, setViewTab] = useState<"original" | "heatmap" | "blend">("blend");
  const [blendAlpha, setBlendAlpha] = usePersistedState<number>("ia.alpha", 0.6);
  const [blendMode, setBlendMode] = usePersistedState<BlendModeCanvas>("ia.blend", "overlay");
  const [zoom, setZoom] = usePersistedState<number>("ia.zoom", 1.0);
  const [threshold, setThreshold] = usePersistedState<number>("ia.threshold", 0.5);

  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);
  const [predict, setPredict] = useState<PredictResponse | null>(null);
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = usePersistedState<string | null>("ia.selClass", null);
  const [hallazgosTexto, setHallazgosTexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [timeMsPredict, setTimeMsPredict] = useState<number | null>(null);
  const [timeMsGradcam, setTimeMsGradcam] = useState<number | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgMeta, setImgMeta] = useState<{ w: number; h: number; orient: "portrait" | "landscape" | "square" } | null>(null);

  const [selFindings, setSelFindings] = useState<Set<string>>(new Set());
  const [sessionTrend, setSessionTrend] = useState<SessionPoint[]>([]);

  /* ---------- Backend IA ---------- */
  const predictURL = "http://127.0.0.1:8000/predict";
  const gradcamURL = "http://127.0.0.1:8000/gradcam";

  /* =========================================================
     SECCIÓN: GUARD DE SESIÓN & CONTEXTO PACIENTE
  ========================================================= */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) router.replace("/auth/login");
    })();
  }, [router]);

  useEffect(() => {
    const picked = (typeof qId === "string" && qId) || (typeof qPid === "string" && qPid) || null;
    if (picked) setPatientId(picked);
    // si no llega, persistimos el que ya existe en localStorage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qId, qPid]);

  /* =========================================================
     SECCIÓN: DATA FETCH (perfil + archivos)
  ========================================================= */
  async function fetchPatientProfile(pid: string): Promise<PatientProfile | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, avatar_url")
      .eq("id", pid)
      .maybeSingle();
    if (error) return null;
    return (data as any) ?? null;
  }

  async function fetchPatientFiles(pid: string, limit = 60): Promise<{ data: FileLite[]; count: number }> {
    const { data, error, count } = await supabase
      .from("files")
      .select("id, filename, file_type, url, uploaded_at, tags", { count: "exact" })
      .or(`user_id.eq.${pid},owner_id.eq.${pid}`)
      .order("uploaded_at", { ascending: false })
      .limit(limit);

    if (error) return { data: [], count: 0 };
    return { data: (data || []) as FileLite[], count: count || 0 };
  }

  async function loadPatientAndFiles(pid: string) {
    try {
      setLoadingFiles(true);
      const [pf, page] = await Promise.all([fetchPatientProfile(pid), fetchPatientFiles(pid, 60)]);
      setPatient(pf);
      setFiles(page.data);
      setCount(page.count);

      setSelectedFile((prev) => {
        if (!page.data?.length) return null;
        if (prev && page.data.some((d) => d.id === prev.id)) return prev;
        return page.data[0]; // más reciente
      });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar el paciente/archivos");
      setPatient(null);
      setFiles([]);
      setCount(0);
      setSelectedFile(null);
    } finally {
      setLoadingFiles(false);
    }
  }

  useEffect(() => {
    if (!patientId) return;
    loadPatientAndFiles(patientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // Búsqueda de pacientes si no hay contexto
  useEffect(() => {
    const t = setTimeout(async () => {
      if (patientId) return;
      const q = qPatient.trim();
      if (!q) {
        setPatientResults([]);
        return;
      }
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, avatar_url")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);
      if (error) return setPatientResults([]);
      setPatientResults((data || []) as PatientProfile[]);
    }, 300);
    return () => clearTimeout(t);
  }, [qPatient, patientId]);

  /* =========================================================
     SECCIÓN: BROADCAST (opcional)
  ========================================================= */
  useEffect(() => {
    async function subscribeToUserChannel() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const userChannelName = `user-channel-${user.id}`;
      const ch = supabase.channel(userChannelName, { config: { broadcast: { self: false } } });
      broadcastChannelRef.current = ch;
      ch.on("broadcast", { event: "*" }, (payload: any) => {
        toast.success(`${payload.payload.message.replace(/\./g, "")}`);
      }).subscribe();
      return () => {
        supabase.removeChannel(ch);
        broadcastChannelRef.current = null;
      };
    }
    subscribeToUserChannel();
  }, []);

  /* =========================================================
     SECCIÓN: IA (Predict + GradCAM)
  ========================================================= */
  async function runGradcamFor(targetClass: string) {
    if (!selectedFile) return;
    try {
      const t0 = performance.now();
      const imgRes = await fetch(selectedFile.url);
      const blob = await imgRes.blob();
      const fd = new FormData();
      fd.append("file", blob, selectedFile.filename);
      const r = await fetch(`${gradcamURL}?target_class=${encodeURIComponent(targetClass)}`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) throw new Error("GradCAM error");
      const g: GradcamResponse = await r.json();
      setHeatmapUrl(g.heatmap_data_url);
      setTimeMsGradcam(Math.round(performance.now() - t0));
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el mapa de calor");
    }
  }

  async function handleDiagnose({ force }: { force?: boolean } = {}) {
    if (!selectedFile) return;
    if (predict && !force) return;
    try {
      setLoadingDiagnosis(true);
      setTimeMsPredict(null);

      const response = await fetch(selectedFile.url);
      const blob = await response.blob();

      const t0 = performance.now();
      const form1 = new FormData();
      form1.append("file", blob, selectedFile.filename);
      const res1 = await fetch(`${predictURL}?threshold=${threshold}`, { method: "POST", body: form1 });
      if (!res1.ok) throw new Error("Predict error");
      const pred: PredictResponse = await res1.json();
      setPredict(pred);
      setTimeMsPredict(Math.round(performance.now() - t0));

      // Selección de hallazgos por defecto
      const s = new Set<string>(pred.present || []);
      pred.top_k?.slice(0, 3).forEach((t) => s.add(t.class));
      setSelFindings(s);

      // Grad-CAM del top1
      const top1 = pred.top_k?.[0]?.class ?? null;
      if (top1) {
        setSelectedClass(top1);
        await runGradcamFor(top1);
      } else {
        setSelectedClass(null);
        setHeatmapUrl(null);
        setTimeMsGradcam(null);
      }

      // Tendencia de sesión
      if (top1) {
        const p = pred.top_k[0].prob;
        setSessionTrend((prev) => [...prev, { t: Date.now(), label: top1, prob: p, fileId: selectedFile.id }]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al generar la asistencia diagnóstica");
    } finally {
      setLoadingDiagnosis(false);
    }
  }

  // Auto-IA al cambiar de archivo si es imagen
  useEffect(() => {
    if (!selectedFile) return;
    if (selectedFile.file_type?.startsWith("image")) {
      handleDiagnose({ force: true });
    } else {
      setPredict(null);
      setHeatmapUrl(null);
      setSelectedClass(null);
      setSelFindings(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.id]);

  async function handleChangeGradcam(targetClass: string | null) {
    setSelectedClass(targetClass);
    if (targetClass) await runGradcamFor(targetClass);
    else setHeatmapUrl(null);
  }

  async function handleGuardarDiagnostico() {
    if (!selectedFile) return;
    setGuardando(true);

    let contenido = hallazgosTexto.trim();
    if (!contenido && predict?.top_k?.[0]) {
      const t = predict.top_k[0];
      contenido = `${t.class} (${Math.round(t.prob * 100)}%)`;
    }
    if (!contenido) contenido = "Sin hallazgos por encima del umbral";

    const { error: updateError } = await supabase
      .from("files")
      .update({ diagnosis_ia: contenido })
      .eq("id", selectedFile.id);

    if (updateError) {
      console.error("Error al guardar el diagnóstico:", updateError);
      toast.error("Error al guardar el diagnóstico");
    } else {
      toast.success("Diagnóstico guardado exitosamente");
    }
    setGuardando(false);
  }

  async function exportOverlayPng() {
    if (!selectedFile?.file_type?.startsWith("image")) {
      toast.info("Exportación disponible solo para imágenes.");
      return;
    }
    try {
      const baseBlob = await (await fetch(selectedFile.url)).blob();
      const baseImg = await loadImageFromBlob(baseBlob);

      const canvas = document.createElement("canvas");
      canvas.width = baseImg.naturalWidth || baseImg.width;
      canvas.height = baseImg.naturalHeight || baseImg.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas no soportado");

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

      if (heatmapUrl) {
        let heatImg: HTMLImageElement | null = null;
        if (heatmapUrl.startsWith("data:image")) {
          heatImg = await new Promise((resolve) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.src = heatmapUrl;
          });
        } else {
          const heatBlob = await (await fetch(heatmapUrl)).blob();
          heatImg = await loadImageFromBlob(heatBlob);
        }
        if (heatImg) {
          ctx.globalAlpha = Math.max(0, Math.min(1, blendAlpha));
          // @ts-ignore
          ctx.globalCompositeOperation = blendMode;
          ctx.drawImage(heatImg, 0, 0, canvas.width, canvas.height);
        }
      }

      const a = document.createElement("a");
      a.download = `${(selectedFile.filename || "overlay").replace(/\.[^.]+$/, "")}_overlay.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo exportar el snapshot");
    }
  }

  /* =========================================================
     SECCIÓN: UI HELPERS
  ========================================================= */
  const probsSorted = useMemo(() => {
    if (!predict) return [];
    return Object.entries(predict.probabilities).sort((a, b) => b[1] - a[1]);
  }, [predict]);

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    const orient = w === h ? "square" : w > h ? "landscape" : "portrait";
    setImgMeta({ w, h, orient });
  }

  function qualityLabel() {
    if (!imgMeta) return "—";
    if (imgMeta.w >= 2000 || imgMeta.h >= 2000) return "Alta";
    if (imgMeta.w >= 1200 || imgMeta.h >= 1200) return "Media";
    return "Baja";
  }

  // Atajos
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.key.toLowerCase() === "o") setViewTab("original");
      if (e.key.toLowerCase() === "h") setViewTab("heatmap");
      if (e.key.toLowerCase() === "b") setViewTab("blend");
      if (e.key === "+") setBlendAlpha((a) => Math.min(1, a + 0.05));
      if (e.key === "-") setBlendAlpha((a) => Math.max(0, a - 0.05));
      if (e.key.toLowerCase() === "g") handleDiagnose({ force: true });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setBlendAlpha]);

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <>
      <Head>
        <title>Asistencia IA | Cabina</title>
        <meta name="description" content="Asistencia diagnóstica por IA" />
      </Head>

      <div className="flex flex-col min-h-screen bg-gradient-to-b from-cyan-50/60 via-background to-background">
        <style jsx global>{`
          html { scroll-behavior: smooth; }
          html, body { overscroll-behavior: none; }
        `}</style>

        {/* ================== TOP BAR ================== */}
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1320px]">
            <div className="mb-4 flex items-center justify-between rounded-xl border bg-white/60 dark:bg-card/60 backdrop-blur p-3">
              <div className="flex items-center gap-2">
                <Button onClick={() => router.back()} variant="outline" size="sm" className="cursor-pointer">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Volver
                </Button>

                {!patient ? (
                  <div className="relative w-[280px] ml-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar paciente (nombre/email)…"
                      value={qPatient}
                      onChange={(e) => setQPatient(e.target.value)}
                      className="pl-8"
                    />
                    {!!patientResults.length && (
                      <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow">
                        {patientResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setPatientId(p.id);
                              setQPatient("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-accent"
                          >
                            {(p.full_name || p.email) ?? p.id}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pl-1">
                    <Image
                      src={patient.avatar_url || "/images.jpg"}
                      alt={patient.full_name || "Paciente"}
                      width={40}
                      height={40}
                      className="rounded-full object-cover ring-2 ring-cyan-200"
                    />
                    <div>
                      <div className="font-semibold leading-tight">
                        {patient.full_name || "Paciente sin nombre"}
                      </div>
                      <div className="text-xs text-muted-foreground">{patient.email || "—"}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => patientId && router.push(`/home?id=${patientId}`)}
                      className="cursor-pointer"
                    >
                      <Home className="h-4 w-4 mr-1" />
                      Ir al Home
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPatientId(null);
                        setPatient(null);
                        setFiles([]);
                        setCount(0);
                        setSelectedFile(null);
                      }}
                      className="cursor-pointer"
                    >
                      Cambiar paciente
                    </Button>
                  </div>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-2">
                {selectedFile?.tags?.length ? (
                  <div className="hidden md:flex flex-wrap gap-1">
                    {selectedFile.tags.map((tag, i) => (
                      <Badge key={`${tag}-${i}`} variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" /> {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* ================== LAYOUT PRINCIPAL ================== */}
            {!patientId ? (
              <div className="rounded-xl border bg-card/50 p-6 text-muted-foreground text-sm">
                Selecciona un paciente para iniciar la asistencia IA.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1.05fr)_minmax(0,0.95fr)] gap-5">
                {/* ---------- SECCIÓN A: ARCHIVOS DEL PACIENTE (Sidebar) ---------- */}
                <Card className="h-fit border-cyan-100 shadow-sm sticky top-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-cyan-700" />
                      Archivos del paciente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {loadingFiles ? (
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                      </div>
                    ) : files.length === 0 ? (
                      <div className="rounded border bg-muted/20 p-3 text-sm text-muted-foreground">
                        No hay archivos.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                        {files.map((f) => {
                          const active = f.id === selectedFile?.id;
                          const isImg = f.file_type?.startsWith("image");
                          return (
                            <button
                              key={f.id}
                              onClick={() => setSelectedFile(f)}
                              className={`w-full text-left p-2 rounded-md border transition hover:bg-accent/50 ${
                                active ? "border-cyan-600 ring-1 ring-cyan-600 bg-cyan-50/40 dark:bg-cyan-950/20" : ""
                              }`}
                              title={fmtDT(f.uploaded_at)}
                            >
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                {isImg ? <ImageIcon className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
                                {fmtDT(f.uploaded_at)}
                              </div>
                              <div className="text-sm font-medium truncate">{f.filename}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{f.file_type || "—"}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-muted-foreground">{count} archivo(s)</div>
                  </CardContent>
                </Card>

                {/* ---------- SECCIÓN B: VISOR + CONTROLES ---------- */}
                <Card className="overflow-hidden border-cyan-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Visor</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {/* Controles del visor */}
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={viewTab === "original" ? "default" : "outline"}
                        onClick={() => setViewTab("original")}
                        className="cursor-pointer"
                        title="O"
                      >
                        <ImageIcon className="h-4 w-4 mr-1" /> Original
                      </Button>
                      <Button
                        size="sm"
                        variant={viewTab === "heatmap" ? "default" : "outline"}
                        onClick={() => setViewTab("heatmap")}
                        disabled={!heatmapUrl}
                        className="cursor-pointer"
                        title="H"
                      >
                        <Flame className="h-4 w-4 mr-1" /> Heatmap
                      </Button>
                      <Button
                        size="sm"
                        variant={viewTab === "blend" ? "default" : "outline"}
                        onClick={() => setViewTab("blend")}
                        disabled={!heatmapUrl}
                        className="cursor-pointer"
                        title="B"
                      >
                        <Layers className="h-4 w-4 mr-1" /> Superposición
                      </Button>

                      <div className="ml-auto flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-xs">
                          <span>Umbral</span>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={threshold}
                            onChange={(e) => setThreshold(parseFloat(e.target.value))}
                          />
                          <span className="font-mono">{Math.round(threshold * 100)}%</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDiagnose({ force: true })}
                            className="cursor-pointer"
                            disabled={loadingDiagnosis || !selectedFile}
                            title="G"
                          >
                            {loadingDiagnosis ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Aplicando…
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Aplicar umbral
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span>Blend</span>
                          <select
                            value={blendMode}
                            onChange={(e) => setBlendMode(e.target.value as BlendModeCanvas)}
                            className="border rounded px-2 py-1"
                          >
                            <option value="overlay">overlay</option>
                            <option value="multiply">multiply</option>
                            <option value="screen">screen</option>
                            <option value="soft-light">soft-light</option>
                            <option value="color-burn">color-burn</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span>Zoom</span>
                          <input
                            type="range"
                            min={0.5}
                            max={2}
                            step={0.05}
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                          />
                          <span className="font-mono">{(zoom * 100).toFixed(0)}%</span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportOverlayPng}
                          className="cursor-pointer"
                          title="Exportar snapshot"
                          disabled={!selectedFile}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Exportar
                        </Button>
                      </div>
                    </div>

                    {/* Lienzo del visor */}
                    <div
                      className="relative mx-auto w-full max-w-3xl aspect-[4/3] rounded-md border bg-black/5 dark:bg-zinc-900 overflow-hidden"
                      style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                    >
                      {!selectedFile ? (
                        <div className="absolute inset-0 grid place-content-center text-sm text-muted-foreground">
                          Selecciona un archivo en la lista.
                        </div>
                      ) : selectedFile.file_type?.startsWith("image") ? (
                        <>
                          <img
                            ref={imgRef}
                            src={selectedFile.url}
                            alt={selectedFile.filename}
                            loading="lazy"
                            className={`absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity ${
                              viewTab === "heatmap" ? "opacity-0" : "opacity-100"
                            }`}
                            onLoad={onImgLoad}
                          />
                          {heatmapUrl && (
                            <>
                              <img
                                src={heatmapUrl}
                                alt={`Grad-CAM ${selectedClass ?? ""}`}
                                className={`absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity ${
                                  viewTab === "heatmap" ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <img
                                src={heatmapUrl}
                                alt={`Grad-CAM ${selectedClass ?? ""}`}
                                className={`absolute inset-0 m-auto max-h-full max-w-full object-contain pointer-events-none transition-opacity ${
                                  viewTab === "blend" ? "opacity-100" : "opacity-0"
                                }`}
                                style={{ opacity: blendAlpha, mixBlendMode: blendMode as any }}
                              />
                            </>
                          )}
                        </>
                      ) : selectedFile.file_type === "application/pdf" ? (
                        <iframe
                          src={selectedFile.url}
                          title={selectedFile.filename}
                          className="absolute inset-0 w-full h-full"
                          style={{ border: "none" }}
                        />
                      ) : (
                        <div className="absolute inset-0 p-6 text-center">
                          <p className="mb-4 text-muted-foreground">Vista previa no disponible.</p>
                          <a href={selectedFile.url} target="_blank" rel="noreferrer" className="text-cyan-700 underline">
                            Abrir archivo
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Pie del visor */}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="text-xs text-muted-foreground">
                        {selectedFile ? (
                          <>
                            {imgMeta ? (
                              <>
                                Resolución: <b>{imgMeta.w}×{imgMeta.h}</b> · Orientación:{" "}
                                <b>{imgMeta.orient}</b> · Calidad estimada:{" "}
                                <b>{qualityLabel()}</b>{" "}
                                {qualityLabel() === "Baja" && (
                                  <Badge variant="destructive" className="ml-2 gap-1 text-[10px]">
                                    <AlertTriangle className="h-3 w-3" />
                                    Sugerir repetir proyección (PA)
                                  </Badge>
                                )}
                              </>
                            ) : (
                              "Cargando metadatos de imagen…"
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                      {heatmapUrl && (
                        <div className="ml-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(heatmapUrl!, "_blank")}
                            className="cursor-pointer"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Abrir heatmap
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* ---------- SECCIÓN C: IA, KPIs y REPORTES ---------- */}
                <div className="space-y-4">
                  {/* KPIs + Acciones IA */}
                  <Card className="border-cyan-100 shadow-sm sticky top-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-cyan-700" />
                        Resumen IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={() => handleDiagnose({ force: !predict })}
                          disabled={loadingDiagnosis || !selectedFile}
                          className="cursor-pointer"
                          title="G"
                        >
                          {loadingDiagnosis ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Analizando…
                            </>
                          ) : predict ? (
                            "Actualizar IA"
                          ) : (
                            "🧠 Generar asistencia"
                          )}
                        </Button>

                        <div className="text-xs text-muted-foreground">
                          {predict ? `Umbral: ${Math.round(predict.threshold * 100)}%` : "Sin resultados todavía"}
                        </div>

                        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>Modelo: {predict?.model_version ?? "—"}</span>
                          <span>Infer.: {timeMsPredict ? `${timeMsPredict} ms` : "—"}</span>
                          <span>Grad-CAM: {timeMsGradcam ? `${timeMsGradcam} ms` : "—"}</span>
                        </div>
                      </div>

                      {predict && (
                        <>
                          {/* KPI circular simple (top-1) */}
                          <div className="mt-3 grid grid-cols-3 gap-3">
                            <KpiDonut title="Top-1" value={predict.top_k?.[0]?.prob ?? 0} label={predict.top_k?.[0]?.class ?? "—"} />
                            <KpiDonut
                              title="Hallazgos > umbral"
                              value={(predict.present.length || 0) / Math.max(1, Object.keys(predict.probabilities).length)}
                              label={`${predict.present.length}/${Object.keys(predict.probabilities).length}`}
                            />
                            <KpiDonut
                              title="Cobertura barras"
                              value={Math.min(1, (Object.keys(predict.probabilities).slice(0, 10).reduce((a, k) => a + (predict.probabilities[k] || 0), 0)))} 
                              label="Top-10 suma"
                            />
                          </div>

                          {/* Bloque Top-1 y chips */}
                          <div className="mt-3 rounded-md border bg-white/60 dark:bg-card/60 p-3">
                            <div className="text-xs text-muted-foreground mb-1">Predicción principal</div>
                            <div className="flex items-end justify-between">
                              <div className="text-lg font-semibold">{predict.top_k?.[0]?.class || "—"}</div>
                              <div className="text-lg font-mono">
                                {predict.top_k?.[0] ? formatPct(predict.top_k[0].prob) : "—"}
                              </div>
                            </div>
                            <TopKChips
                              topk={predict.top_k || []}
                              active={selectedClass}
                              onPick={(cls) => handleChangeGradcam(cls)}
                            />
                          </div>

                          {/* Chips por encima del umbral */}
                          <div className="mt-3 text-xs text-muted-foreground">Por encima del umbral</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {predict.present.length > 0 ? (
                              predict.present.map((c) => (
                                <Badge key={c} className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200">
                                  {c}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin hallazgos por encima del umbral.</span>
                            )}
                          </div>

                          {/* Leyenda + Barras animadas */}
                          <LegendBar />
                          <Separator className="my-3" />
                          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                            <LineChart className="h-4 w-4" />
                            Probabilidades por patrón
                          </div>
                          <div className="space-y-2">
                            {probsSorted.slice(0, 10).map(([cls, p]) => (
                              <div key={cls}>
                                <div className="flex items-center justify-between text-xs">
                                  <div className={`truncate max-w-[65%] ${selectedClass === cls ? "font-semibold text-foreground" : ""}`}>{cls}</div>
                                  <div className="font-mono">{formatPct(p)}</div>
                                </div>
                                <div className="mt-1 h-2 w-full rounded bg-muted overflow-hidden">
                                  <div
                                    className={`h-2 rounded ${selectedClass === cls ? "bg-cyan-700" : "bg-cyan-600"} transition-[width] duration-700`}
                                    style={{ width: `${Math.min(100, Math.max(0, p * 100))}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tendencia de sesión */}
                  <Card className="border-cyan-100 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <LineChart className="h-4 w-4 text-cyan-700" />
                        Tendencia (sesión)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      {sessionTrend.length < 2 ? (
                        <div className="text-xs text-muted-foreground">Ejecuta la IA en varios archivos para ver la tendencia.</div>
                      ) : (
                        <TrendChart data={sessionTrend} />
                      )}
                      <div className="mt-2 text-[11px] text-muted-foreground">Top-1 y su probabilidad a lo largo de esta sesión local.</div>
                    </CardContent>
                  </Card>

                  {/* Mapa mental */}
                  <Card className="border-cyan-100 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-cyan-700" />
                        Mapa de patrones
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      {predict ? (
                        <MindMap
                          center={predict.top_k?.[0]?.class ?? "Patrón"}
                          related={Array.from(
                            new Set([...(predict.present || []), ...(predict.top_k || []).map((t) => t.class)])
                          ).slice(0, 8)}
                        />
                      ) : (
                        <div className="text-xs text-muted-foreground">Genera primero la asistencia IA.</div>
                      )}
                      <div className="mt-2 text-[11px] text-muted-foreground">Diagrama conceptual para orientar correlaciones visuales.</div>
                    </CardContent>
                  </Card>

                  {/* Informe rápido */}
                  <Card className="border-cyan-100 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Informe rápido</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      {predict && (
                        <FindingsSelector
                          present={predict.present || []}
                          topk={predict.top_k || []}
                          selected={selFindings}
                          onToggle={(cls) => {
                            setSelFindings((prev) => {
                              const n = new Set(prev);
                              if (n.has(cls)) n.delete(cls);
                              else n.add(cls);
                              return n;
                            });
                          }}
                          onInsert={() => {
                            if (!predict) return;
                            const selected = Array.from(selFindings);
                            const text = selected.length
                              ? `Patrones probables: ${selected
                                  .map((n) => {
                                    const p = predict.probabilities[n] ?? null;
                                    return p != null ? `${n} (${Math.round(p * 100)}%)` : n;
                                  })
                                  .join(", ")}.`
                              : "Sin hallazgos por encima del umbral.";
                            setHallazgosTexto((t) => (t?.trim() ? `${t}\n${text}` : text));
                            toast.success("Se insertó la selección en el informe.");
                          }}
                        />
                      )}

                      <textarea
                        placeholder="Escribe tus hallazgos clínicos (se guardará en files.diagnosis_ia)."
                        value={hallazgosTexto}
                        onChange={(e) => setHallazgosTexto(e.target.value)}
                        className="w-full p-2 border rounded text-sm mt-2"
                        rows={5}
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <Button onClick={handleGuardarDiagnostico} disabled={guardando || !selectedFile} className="cursor-pointer">
                          {guardando ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Guardando…
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-1" />
                              Guardar diagnóstico
                            </>
                          )}
                        </Button>
                        {predict && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const top = predict.top_k?.[0];
                              const texto = top ? `${top.class} (${Math.round(top.prob * 100)}%)` : "Sin hallazgos por encima del umbral";
                              setHallazgosTexto((t) => (t?.trim() ? `${t}\n${texto}` : texto));
                              toast.success("Insertado el resumen IA en el texto.");
                            }}
                            className="cursor-pointer"
                          >
                            Insertar resumen IA
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

/* =========================================================
   KPI DONUT (SVG)
========================================================= */
function KpiDonut({ title, value, label }: { title: string; value: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, value || 0));
  const size = 92;
  const r = 38;
  const c = 2 * Math.PI * r;
  const dash = c * clamped;

  return (
    <div className="rounded-md border p-3 bg-white/60 dark:bg-card/60">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-2 flex items-center gap-3">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" opacity={0.15} strokeWidth="8" fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgb(8,145,178)"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeLinecap="round"
          />
          <text
            x={size / 2}
            y={size / 2 + 4}
            textAnchor="middle"
            fontSize="12"
            className="fill-foreground rotate-90"
          >
            {(clamped * 100).toFixed(0)}%
          </text>
        </svg>
        <div className="text-sm leading-tight">
          <div className="font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground">probabilidad</div>
        </div>
      </div>
    </div>
  );
}
