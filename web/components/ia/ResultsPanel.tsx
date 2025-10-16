"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Image as ImageIcon,
  Flame,
  Layers,
  Download,
  RefreshCw,
  Loader2,
  Gauge,
  Save,
  ExternalLink,
  Activity,
  AlertTriangle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  Sun,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crosshair,
  Maximize2,
  Minimize2,
  Circle,
  FileText,
} from "lucide-react";

import type { FileLite } from "@/lib/historyDetails";
import type { PredictResponse, TopK } from "@/lib/assistance";

import { supabase } from "@/lib/supabaseClient";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/* ====== % anim liviana ====== */
function AnimatedPercent({ value }: { value: number }) {
  const [display, setDisplay] = useState("0.0%");
  useEffect(() => {
    const target = Math.max(0, Math.min(1, value || 0)) * 100;
    let raf = 0;
    let start: number | null = null;
    const from = Number(display.replace("%", "")) || 0;
    const diff = target - from;
    const dur = 220;
    const step = (t: number) => {
      if (start == null) start = t;
      const p = Math.min(1, (t - start) / dur);
      setDisplay(`${(from + diff * p).toFixed(1)}%`);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className="font-mono">{display}</span>;
}

/* ====== Recharts: Prob chart (UI) ====== */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
  Cell,
} from "recharts";

function ProbChart({
  probs,
  selected,
  onSelect,
  threshold,
}: {
  probs: Record<string, number>;
  selected?: string | null;
  onSelect?: (cls: string) => void;
  threshold: number;
}) {
  const data = useMemo(
    () =>
      Object.entries(probs)
        .map(([name, p]) => ({
          name,
          prob: +(Number(p || 0) * 100).toFixed(1),
          above: (Number(p) || 0) >= threshold,
        }))
        .sort((a, b) => b.prob - a.prob),
    [probs, threshold]
  );

  return (
    <div className="w-full h-[240px] min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 24 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} height={36} />
          <YAxis width={36} tick={{ fontSize: 11 }} />
          <RTooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Probabilidad"]} labelClassName="text-xs" />
          <ReferenceLine
            y={threshold * 100}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: `Umbral ${Math.round(threshold * 100)}%`, position: "insideTopRight", fontSize: 10, fill: "#ef4444" }}
          />
          <Bar dataKey="prob" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="prob" position="top" formatter={(v: any) => (v >= 10 ? `${Number(v).toFixed(0)}%` : "")} className="text-[10px]" />
            {data.map((entry) => (
              <Cell
                key={entry.name}
                cursor="pointer"
                onClick={() => onSelect?.(entry.name)}
                fill={entry.above ? "#0891b2" : "#94a3b8"}
                stroke={selected === entry.name ? "#0ea5e9" : undefined}
                strokeWidth={selected === entry.name ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ====== Métricas (UI) ====== */
function MetricsPanel({ probs, threshold }: { probs: Record<string, number>; threshold: number }) {
  const entries = useMemo(
    () =>
      Object.entries(probs || {})
        .map(([label, p]) => ({ label, p: Number(p) || 0 }))
        .sort((a, b) => b.p - a.p),
    [probs]
  );
  const total = entries.length;
  const above = entries.filter((e) => e.p >= threshold);
  const countAbove = above.length;
  const top = entries[0] || null;
  const mean = total > 0 ? entries.reduce((acc, it) => acc + it.p, 0) / total : 0;

  return (
    <Card className="border-cyan-100 shadow-sm min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-700" />
          Métricas del modelo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2 space-y-4">
        {countAbove >= 2 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Varias clases superan el umbral. Revise Grad-CAM por clase.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border p-3">
            <div className="text-[11px] text-muted-foreground">Clases ≥ umbral</div>
            <div className="text-xl font-semibold">
              {countAbove} <span className="text-sm text-muted-foreground">/ {total}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">Umbral: {Math.round(threshold * 100)}%</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-[11px] text-muted-foreground">Principal</div>
            <div className="text-xl font-semibold">{top ? top.label : "—"}</div>
            <div className="text-[11px] text-muted-foreground">{top ? `${(top.p * 100).toFixed(0)}%` : ""}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-[11px] text-muted-foreground">Prob. media</div>
            <div className="text-xl font-semibold">{Math.round(mean * 100)}%</div>
            <div className="text-[11px] text-muted-foreground">Promedio</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-[11px] text-muted-foreground">Co-activación</div>
            <div className="text-xl font-semibold">
              {countAbove >= 2 ? "Múltiple" : countAbove === 1 ? "Única" : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground">Sobre el umbral</div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-xs text-muted-foreground mb-1">Clases ≥ umbral</div>
          {countAbove ? (
            <div className="flex flex-wrap gap-1.5">
              {above.map((e) => (
                <Badge key={e.label} variant="outline" className="text-xs">
                  {e.label} · {(e.p * 100).toFixed(0)}%
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Ninguna clase supera el umbral.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ========================= Helpers generales ========================= */
type ViewTab = "original" | "heatmap" | "blend";
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    try {
      if (!src.startsWith("data:")) im.crossOrigin = "anonymous";
    } catch {}
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

async function composeBlend(baseUrl: string, heatUrl: string, alpha: number): Promise<string> {
  const [base, heat] = await Promise.all([loadImage(baseUrl), loadImage(heatUrl)]);
  const w = base.naturalWidth || base.width;
  const h = base.naturalHeight || base.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return baseUrl;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(base, 0, 0, w, h);
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.drawImage(heat, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

/* ========================= Visor simple ========================= */
function DicomLikeViewer({
  baseUrl,
  heatmapUrl,
  viewTab,
  blendAlpha,
  zoom,
  setZoom,
  brightness,
  contrast,
  invert,
  rotateDeg,
  flipH,
  flipV,
  showCrosshair,
  showMagnifier,
}: {
  baseUrl: string;
  heatmapUrl: string | null;
  viewTab: ViewTab;
  blendAlpha: number;
  zoom: number;
  setZoom: (n: number) => void;
  brightness: number;
  contrast: number;
  invert: boolean;
  rotateDeg: number;
  flipH: boolean;
  flipV: boolean;
  showCrosshair: boolean;
  showMagnifier: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [fitRect, setFitRect] = useState<{ w: number; h: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [displaySrc, setDisplaySrc] = useState<string>(baseUrl);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (viewTab === "original" || !heatmapUrl) {
          if (!cancelled) setDisplaySrc(baseUrl);
          return;
        }
        if (viewTab === "heatmap") {
          if (!cancelled) setDisplaySrc(heatmapUrl);
          return;
        }
        // blend
        const out = await composeBlend(baseUrl, heatmapUrl, blendAlpha);
        if (!cancelled) setDisplaySrc(out);
      } catch {
        if (!cancelled) setDisplaySrc(baseUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [baseUrl, heatmapUrl, blendAlpha, viewTab]);

  const filterCss = `brightness(${brightness}) contrast(${contrast}) ${invert ? "invert(1)" : ""}`;

  const computeFit = useCallback(() => {
    if (!viewportRef.current || !imgNatural) return;
    const { clientWidth: vw, clientHeight: vh } = viewportRef.current;
    const { w: iw, h: ih } = imgNatural;
    const scale = Math.min(vw / iw, vh / ih);
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    setFitRect({ w, h });
  }, [imgNatural]);

  useEffect(() => {
    const onR = () => computeFit();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [computeFit]);

  const onLoadImg = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    setImgNatural({ w: el.naturalWidth || el.width, h: el.naturalHeight || el.height });
  };

  useEffect(() => { computeFit(); }, [imgNatural, computeFit]);

  const clampPan = useCallback(
    (nx: number, ny: number) => {
      if (!viewportRef.current || !fitRect) return { x: 0, y: 0 };
      const { clientWidth: vw, clientHeight: vh } = viewportRef.current;
      const cw = fitRect.w * zoom;
      const ch = fitRect.h * zoom;
      const maxX = cw > vw ? (cw - vw) / 2 : 0;
      const maxY = ch > vh ? (ch - vh) / 2 : 0;
      return { x: clamp(nx, -maxX, maxX), y: clamp(ny, -maxY, maxY) };
    },
    [zoom, fitRect]
  );

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dz = e.deltaY > 0 ? -0.1 : 0.1;
    const nz = clamp(+(zoom + dz).toFixed(2), 0.5, 3);
    setZoom(nz);
    setPan((p) => clampPan(p.x, p.y));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    setDragging(true);
    dragOrigin.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragOrigin.current) return;
    const nx = e.clientX - dragOrigin.current.x;
    const ny = e.clientY - dragOrigin.current.y;
    setPan(clampPan(nx, ny));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as any).releasePointerCapture?.(e.pointerId);
    setDragging(false);
    dragOrigin.current = null;
  };

  return (
    <div
      ref={viewportRef}
      className="relative mx-auto w-full max-w-4xl h-[58vh] rounded-md border bg-black/5 dark:bg-zinc-900 overflow-hidden min-w-0 overscroll-contain"
      onWheel={onWheel}
      onWheelCapture={onWheel}
      role="region"
      aria-label="Visor tipo DICOM"
    >
      <div
        className="absolute left-1/2 top-1/2 will-change-transform touch-none"
        style={{
          width: fitRect?.w || "1px",
          height: fitRect?.h || "1px",
          transform: `translate(${pan.x}px, ${pan.y}px) translate(-50%, -50%) scale(${zoom}) rotate(${rotateDeg}deg) ${
            (flipH || flipV) ? `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})` : ""
          }`,
          transformOrigin: "center center",
          cursor: dragging ? "grabbing" : "grab",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setDragging(false)}
      >
        <img
          src={displaySrc}
          alt="estudio"
          onLoad={onLoadImg}
          className="block w-full h-full object-contain select-none"
          draggable={false}
          style={{ filter: filterCss }}
        />
      </div>

      {showCrosshair && (
        <>
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/40 dark:bg-white/30" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/40 dark:bg-white/30" />
        </>
      )}
    </div>
  );
}

/* ========================= Tipos para Reporte ========================= */
type IaReportVM = {
  informeId: string;
  creado_en: string;
  narrativa: string;
  hallazgos: string[];
  umbral: number;
  tiempos: { predict: number | null; gradcam: number | null };
  probabilidades: Record<string, number>;
  topk: TopK[];
  claseSeleccionada: string | null;
  heatmapUrl: string | null;
  fileUrl: string;
  fileName: string;
  paciente: {
    id: string;
    nombre: string | null;
    email: string | null;
    ci: string | null;
    fecha_nacimiento: string | null;
    sexo: string | null;
  };
};

/* ========================= Cabina de asistencia ========================= */
export default function ResultsPanel({
  selectedFile,
  viewTab,
  setViewTab,
  threshold,
  setThreshold,
  blendAlpha,
  setBlendAlpha,
  zoom,
  setZoom,
  loadingDiagnosis,
  onApplyThreshold,
  onDiagnose,
  onExportOverlay,
  predict,
  selectedClass,
  onChangeGradcam,
  heatmapUrlNorm,
  timeMsPredict,
  timeMsGradcam,
  hallazgosTexto,
  setHallazgosTexto,
  onSaveDiagnosis,
  savingDiagnosis,
  onOpenOriginal,
}: {
  selectedFile: FileLite | null;
  viewTab: "original" | "heatmap" | "blend";
  setViewTab: (v: "original" | "heatmap" | "blend") => void;
  threshold: number;
  setThreshold: (n: number) => void;
  blendAlpha: number;
  setBlendAlpha: (n: number) => void;
  zoom: number;
  setZoom: (n: number) => void;
  loadingDiagnosis: boolean;
  onApplyThreshold: () => void;
  onDiagnose: () => void;
  onExportOverlay: () => void;
  predict: PredictResponse | null;
  selectedClass: string | null;
  onChangeGradcam: (cls: string | null) => void;
  heatmapUrlNorm: string | null;
  timeMsPredict: number | null;
  timeMsGradcam: number | null;
  hallazgosTexto: string;
  setHallazgosTexto: (t: string) => void;
  onSaveDiagnosis: () => void;
  savingDiagnosis: boolean;
  onOpenOriginal: () => void;
}) {
  // Controles de imagen
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [invert, setInvert] = useState(false);
  const [rotateDeg, setRotateDeg] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [showMagnifier, setShowMagnifier] = useState(false);

  // Estado del reporte IA
  const [creatingReport, setCreatingReport] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastReport, setLastReport] = useState<IaReportVM | null>(null);

  /* ========== Helpers PDF ========== */
  const pdfColors = {
    cyan: rgb(0.07, 0.45, 0.55),
    grayText: rgb(0.35, 0.35, 0.35),
    softBg: rgb(0.97, 0.99, 1.0),
    softStroke: rgb(0.82, 0.92, 0.96),
  };

  const dataUrlToBytes = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(",")[1] || "";
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const renderProbChartPNG = async (
    probs: Record<string, number>,
    thresholdVal: number,
    width = 520,
    height = 260
  ): Promise<Uint8Array> => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return new Uint8Array();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const entries = Object.entries(probs || {})
      .map(([name, p]) => ({ name, prob: Math.max(0, Math.min(1, Number(p) || 0)) }))
      .sort((a, b) => b.prob - a.prob);

    const m = { top: 16, right: 16, bottom: 44, left: 40 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;

    // axes
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(m.left, height - m.bottom);
    ctx.lineTo(width - m.right, height - m.bottom);
    ctx.moveTo(m.left, height - m.bottom);
    ctx.lineTo(m.left, m.top);
    ctx.stroke();

    // y ticks
    ctx.fillStyle = "#64748b";
    ctx.font = "10px Helvetica, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let yv = 0; yv <= 100; yv += 20) {
      const yy = height - m.bottom - (yv / 100) * h;
      ctx.fillText(`${yv}`, m.left - 6, yy);
      ctx.strokeStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.moveTo(m.left, yy);
      ctx.lineTo(width - m.right, yy);
      ctx.stroke();
    }

    // bars
    const n = Math.max(1, entries.length);
    const gap = 8;
    const barW = Math.max(8, (w - gap * (n - 1)) / n);

    entries.forEach((e, i) => {
      const x = m.left + i * (barW + gap);
      const barH = (e.prob * h) | 0;
      const y = height - m.bottom - barH;

      const above = e.prob >= thresholdVal;
      ctx.fillStyle = above ? "#0891b2" : "#94a3b8";
      ctx.fillRect(x, y, barW, barH);

      if (e.prob * 100 >= 10) {
        ctx.fillStyle = "#0f172a";
        ctx.font = "10px Helvetica, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${(e.prob * 100).toFixed(0)}%`, x + barW / 2, y - 2);
      }
    });

    // x labels
    ctx.save();
    ctx.fillStyle = "#334155";
    ctx.font = "10px Helvetica, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    entries.forEach((e, i) => {
      const x = m.left + i * (barW + gap) + barW / 2;
      const y = height - m.bottom + 14;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((-20 * Math.PI) / 180);
      ctx.fillText(e.name, 0, 0);
      ctx.restore();
    });
    ctx.restore();

    // threshold line
    const ty = height - m.bottom - thresholdVal * h;
    ctx.strokeStyle = "#ef4444";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(m.left, ty);
    ctx.lineTo(width - m.right, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ef4444";
    ctx.font = "10px Helvetica, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(`Umbral ${Math.round(thresholdVal * 100)}%`, width - m.right, ty - 2);

    const dataUrl = c.toDataURL("image/png");
    return dataUrlToBytes(dataUrl);
  };

  /* ========== Cargar último informe al cambiar archivo ========== */
  useEffect(() => {
    setBrightness(1);
    setContrast(1);
    setInvert(false);
    setRotateDeg(0);
    setFlipH(false);
    setFlipV(false);
    setShowCrosshair(true);
    setShowMagnifier(false);

    (async () => {
      if (!selectedFile?.id) { setLastReport(null); return; }
      try {
        const { data: f } = await supabase
          .from("files")
          .select("id, filename, url, user_profile_id")
          .eq("id", selectedFile.id)
          .single();
        if (!f) { setLastReport(null); return; }

        const { data: informes } = await supabase
          .from("ia_informes")
          .select("id, narrativa, hallazgos_seleccionados, creado_en, inferencia_id")
          .eq("archivo_id", selectedFile.id)
          .order("creado_en", { ascending: false })
          .limit(1);

        if (!informes?.length) { setLastReport(null); return; }

        const infRow = informes[0];
        let inferencia: any = null;
        if (infRow.inferencia_id) {
          const { data: inf } = await supabase
            .from("ia_inferencias")
            .select("umbral, probabilidades, topk, clase_seleccionada, url_mapa_calor, tiempo_ms_prediccion, tiempo_ms_gradcam")
            .eq("id", infRow.inferencia_id)
            .single();
          inferencia = inf || null;
        }

        const { data: p } = await supabase
          .from("user_profiles")
          .select("full_name, email, ci, fecha_nacimiento, sexo")
          .eq("id", f.user_profile_id)
          .single();

        setLastReport({
          informeId: infRow.id,
          creado_en: infRow.creado_en,
          narrativa: infRow.narrativa,
          hallazgos: (infRow.hallazgos_seleccionados || []) as string[],
          umbral: inferencia?.umbral ?? (predict?.threshold ?? 0),
          tiempos: {
            predict: inferencia?.tiempo_ms_prediccion ?? null,
            gradcam: inferencia?.tiempo_ms_gradcam ?? null
          },
          probabilidades: (inferencia?.probabilidades || {}) as Record<string, number>,
          topk: (inferencia?.topk || []) as TopK[],
          claseSeleccionada: inferencia?.clase_seleccionada ?? null,
          heatmapUrl: inferencia?.url_mapa_calor ?? null,
          fileUrl: f.url,
          fileName: f.filename,
          paciente: {
            id: f.user_profile_id,
            nombre: p?.full_name ?? null,
            email: p?.email ?? null,
            ci: p?.ci ?? null,
            fecha_nacimiento: p?.fecha_nacimiento ?? null,
            sexo: p?.sexo ?? null,
          },
        });
      } catch {
        setLastReport(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.id]);

  const selectedProb = useMemo(() => {
    if (!predict || !selectedClass) return null;
    const p = predict.probabilities?.[selectedClass];
    return typeof p === "number" ? p : null;
  }, [predict, selectedClass]);

  /* ========== Guardar reporte IA ========== */
  async function handleGenerateReportIA() {
    if (!selectedFile?.id) { toast.error("Selecciona una imagen"); return; }
    if (!predict) { toast.error("Primero ejecuta la asistencia IA"); return; }

    setCreatingReport(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth?.user;
      if (!me) { toast.error("Debes iniciar sesión"); setCreatingReport(false); return; }

      const { data: f, error: fErr } = await supabase
        .from("files")
        .select("id, filename, url, user_profile_id")
        .eq("id", selectedFile.id)
        .single();
      if (fErr || !f) throw fErr || new Error("Archivo no encontrado");

      const { data: p } = await supabase
        .from("user_profiles")
        .select("full_name, email, ci, fecha_nacimiento, sexo")
        .eq("id", f.user_profile_id)
        .single();

      const presentes = Object.entries(predict.probabilities || {})
        .filter(([, v]) => (v || 0) >= (predict.threshold ?? threshold))
        .map(([k]) => k);

      const infPayload: any = {
        archivo_id: f.id,
        modelo_nombre: (predict as any)?.model_name ?? "modelo",
        modelo_version: (predict as any)?.model_version ?? "n/a",
        modelo_tarea: (predict as any)?.task ?? "clasificacion",
        modelo_parametros: { thresholdUsed: predict.threshold ?? threshold },
        umbral: predict.threshold ?? threshold,
        clase_top1: predict.top_k?.[0]?.class ?? null,
        prob_top1: predict.top_k?.[0]?.prob ?? null,
        presentes,
        probabilidades: predict.probabilities || {},
        topk: predict.top_k || [],
        clase_seleccionada: selectedClass ?? null,
        url_mapa_calor: heatmapUrlNorm ?? null,
        tiempo_ms_prediccion: timeMsPredict ?? null,
        tiempo_ms_gradcam: timeMsGradcam ?? null,
        creado_por: me.id,
      };

      const { data: infIns, error: infErr } = await supabase
        .from("ia_inferencias")
        .insert(infPayload)
        .select("id")
        .single();
      if (infErr) throw infErr;

      const narrativa = [
        `Paciente: ${p?.full_name ?? "—"}${p?.ci ? ` · CI: ${p.ci}` : ""}${p?.sexo ? ` · Sexo: ${p.sexo}` : ""}${p?.fecha_nacimiento ? ` · Nac.: ${p.fecha_nacimiento}` : ""}`,
        `Archivo: ${f.filename}`,
        `Umbral: ${Math.round((predict.threshold ?? threshold) * 100)}%`,
        `Hallazgos clínicos: ${hallazgosTexto?.trim() || "No consignados"}`,
        `Predicción principal: ${predict.top_k?.[0]?.class ?? "—"} (${Math.round((predict.top_k?.[0]?.prob ?? 0) * 100)}%)`,
        `Tiempo predict: ${timeMsPredict ?? "—"} ms · Grad-CAM: ${timeMsGradcam ?? "—"} ms`,
      ].join("\n");

      const { data: infRep, error: repErr } = await supabase
        .from("ia_informes")
        .insert({
          archivo_id: f.id,
          inferencia_id: infIns.id,
          autor_id: me.id,
          hallazgos_seleccionados: presentes,
          narrativa,
          estado: "final",
        })
        .select("id, creado_en")
        .single();
      if (repErr) throw repErr;

      setLastReport({
        informeId: infRep.id,
        creado_en: infRep.creado_en,
        narrativa,
        hallazgos: presentes,
        umbral: predict.threshold ?? threshold,
        tiempos: { predict: timeMsPredict ?? null, gradcam: timeMsGradcam ?? null },
        probabilidades: predict.probabilities || {},
        topk: predict.top_k || [],
        claseSeleccionada: selectedClass ?? null,
        heatmapUrl: heatmapUrlNorm ?? null,
        fileUrl: f.url,
        fileName: f.filename,
        paciente: {
          id: f.user_profile_id,
          nombre: p?.full_name ?? null,
          email: p?.email ?? null,
          ci: p?.ci ?? null,
          fecha_nacimiento: p?.fecha_nacimiento ?? null,
          sexo: p?.sexo ?? null,
        },
      });

      toast.success("Reporte IA generado");
    } catch (e: any) {
      console.error(e);
      toast.error(`No se pudo generar el reporte IA${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setCreatingReport(false);
    }
  }

  /* ========== Exportar PDF ========== */
  async function handleExportReport() {
    if (!lastReport) return;
    setExporting(true);
    try {
      const pdf = await PDFDocument.create();

      // Page/Layout
      let page = pdf.addPage([595.28, 841.89]); // A4 portrait
      const margin = 44;
      const W = page.getSize().width;
      const H = page.getSize().height;
      let y = H - margin;

      const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const fontIt = await pdf.embedFont(StandardFonts.HelveticaOblique);

      const ensure = (need: number) => {
        if (y - need < margin) {
          page = pdf.addPage([595.28, 841.89]);
          y = H - margin;
        }
      };

      const pdfColorsLocal = {
        cyan: rgb(0.07, 0.45, 0.55),
        grayText: rgb(0.35, 0.35, 0.35),
        softBg: rgb(0.97, 0.99, 1.0),
        softStroke: rgb(0.82, 0.92, 0.96),
      };

      const drawH1 = (text: string) => {
        ensure(32);
        page.drawText(text, { x: margin, y, size: 18, font: fontBold, color: pdfColorsLocal.cyan });
        y -= 8;
        page.drawText(`Informe ${lastReport.informeId} · ${new Date(lastReport.creado_en).toLocaleString()}`,
          { x: margin, y, size: 10, font: fontIt, color: pdfColorsLocal.grayText });
        y -= 12;
        page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 2, color: pdfColorsLocal.cyan });
        y -= 16;
      };

      const drawSectionTitle = (text: string) => {
        ensure(18);
        page.drawText(text, { x: margin, y, size: 12, font: fontBold, color: pdfColorsLocal.cyan });
        y -= 14;
      };

      const drawLabelRow = (k: string, v: string) => {
        ensure(14);
        page.drawText(`${k}:`, { x: margin, y, size: 10, font: fontBold });
        page.drawText(v || "—", { x: margin + 105, y, size: 10, font: fontReg });
        y -= 12;
      };

      const drawWrappedText = (txt: string, size = 10) => {
        const maxW = W - margin * 2;
        const words = (txt || "").split(/\s+/);
        let line = "";
        words.forEach((w, idx) => {
          const test = line ? `${line} ${w}` : w;
          const tooWide = fontReg.widthOfTextAtSize(test, size) > maxW;
          if (tooWide) {
            ensure(14);
            page.drawText(line, { x: margin, y, size, font: fontReg });
            y -= 12;
            line = w;
          } else {
            line = test;
          }
          if (idx === words.length - 1 && line) {
            ensure(14);
            page.drawText(line, { x: margin, y, size, font: fontReg });
            y -= 12;
            line = "";
          }
        });
      };

      // Header
      drawH1("REPORTE IA – Radiografía");

      // Paciente
      drawSectionTitle("Paciente");
      const yStart = y;
      drawLabelRow("Nombre", lastReport.paciente.nombre || "");
      drawLabelRow("CI", lastReport.paciente.ci || "");
      drawLabelRow("Sexo", lastReport.paciente.sexo || "");
      drawLabelRow("Nacimiento", lastReport.paciente.fecha_nacimiento || "");
      // box
      page.drawRectangle({
        x: margin - 4, y: y - 6, width: W - margin * 2 + 8, height: yStart - (y - 6),
        borderColor: rgb(0.82, 0.92, 0.96), borderWidth: 1
      });
      y -= 20;

      // Narrativa
      drawSectionTitle("Narrativa");
      drawWrappedText(lastReport.narrativa, 10);
      y -= 8;

      // Métricas IA
      drawSectionTitle("Métricas IA");
      const metricsLines: string[] = [
        `Umbral: ${Math.round(lastReport.umbral * 100)}%`,
        `Tiempo predict: ${lastReport.tiempos.predict ?? "—"} ms`,
        `Tiempo Grad-CAM: ${lastReport.tiempos.gradcam ?? "—"} ms`,
      ];
      metricsLines.forEach((L) => {
        ensure(14);
        page.drawText(L, { x: margin, y, size: 10, font: fontReg });
        y -= 12;
      });

      if ((lastReport.topk || []).length) {
        ensure(14);
        page.drawText("Top-K:", { x: margin, y, size: 10, font: fontBold });
        y -= 12;
        (lastReport.topk || []).slice(0, 5).forEach((t) => {
          ensure(12);
          page.drawText(`• ${t.class}: ${(t.prob * 100).toFixed(1)}%`, { x: margin + 12, y, size: 10, font: fontReg });
          y -= 12;
        });
      }
      y -= 10;

      // ProbChart -> PNG y embed
      const chartBytes = await renderProbChartPNG(lastReport.probabilidades || {}, lastReport.umbral, 520, 260);
      if (chartBytes && chartBytes.length) {
        const chartImg = await pdf.embedPng(chartBytes);
        const maxW = W - margin * 2;
        const scale = Math.min(1, maxW / chartImg.width);
        const drawW = chartImg.width * scale;
        const drawH = chartImg.height * scale;
        ensure(drawH + 6);
        page.drawImage(chartImg, { x: margin, y: y - drawH, width: drawW, height: drawH });
        y -= drawH + 14;
      }

      // Imágenes
      const fetchBytes = async (src: string) => {
        const res = await fetch(src);
        const b = await res.arrayBuffer();
        return new Uint8Array(b);
      };
      const images: { bytes: Uint8Array; name: string }[] = [];
      try { images.push({ bytes: await fetchBytes(lastReport.fileUrl), name: "Radiografía" }); } catch {}
      if (lastReport.heatmapUrl) {
        try { images.push({ bytes: await fetchBytes(lastReport.heatmapUrl), name: "Heatmap" }); } catch {}
      }

      if (images.length) {
        const cols = images.length === 2 ? 2 : 1;
        const gap = 10;
        const cellW = cols === 2 ? (W - margin * 2 - gap) / 2 : (W - margin * 2);
        for (let i = 0; i < images.length; i++) {
          const imBytes = images[i].bytes;
          let embed;
          try { embed = await pdf.embedPng(imBytes); }
          catch { embed = await pdf.embedJpg(imBytes); }
          const scale = Math.min(1, cellW / embed.width);
          const h = embed.height * scale;
          const w = embed.width * scale;
          ensure(h + 28);
          const isLeft = i % 2 === 0 || cols === 1;
          const colX = margin + (cols === 2 && !isLeft ? cellW + gap : 0);
          page.drawImage(embed, { x: colX, y: y - h, width: w, height: h });
          page.drawText(images[i].name, { x: colX, y: y - h - 12, size: 10, font: fontIt, color: pdfColors.grayText });
          if (cols === 1 || (!isLeft && cols === 2)) {
            y -= h + 26;
          }
        }
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ReporteIA_${lastReport.fileName.replace(/\.[a-zA-Z0-9]+$/, "")}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo exportar el PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card className="border-cyan-100 shadow-sm min-w-0">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Cabina de asistencia</CardTitle>
      </CardHeader>
      <CardContent className="pt-3 space-y-4">
        {!selectedFile ? (
          <div className="text-sm text-muted-foreground">Selecciona una imagen en la lista.</div>
        ) : (
          <>
            {/* ───────── Bloque A: Visualización ───────── */}
            <div className="rounded-lg border bg-white/60 dark:bg-card/60 p-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[220px]">
                  <div className="text-[11px] text-muted-foreground mb-1">Modo de visualización</div>
                  <ToggleGroup type="single" value={viewTab} onValueChange={(v) => v && setViewTab(v as any)} aria-label="Modo de visualización">
                    <ToggleGroupItem value="original" aria-label="Original"><ImageIcon className="h-4 w-4" /> Original</ToggleGroupItem>
                    <ToggleGroupItem value="heatmap" disabled={!heatmapUrlNorm} aria-label="Heatmap"><Flame className="h-4 w-4" /> Heatmap</ToggleGroupItem>
                    <ToggleGroupItem value="blend" disabled={!heatmapUrlNorm} aria-label="Superposición"><Layers className="h-4 w-4" /> Superposición</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="flex-1 min-w-[220px]">
                  <div className="text-[11px] text-muted-foreground mb-1">Alpha (opacidad del mapa térmico)</div>
                  <div className="flex items-center gap-2">
                    <Slider value={[blendAlpha]} onValueChange={(v) => setBlendAlpha(v[0])} min={0} max={1} step={0.05} className="flex-1" />
                    <span className="w-12 text-right font-mono text-xs">{Math.round(blendAlpha * 100)}%</span>
                  </div>
                </div>

                <Separator orientation="vertical" className="h-10 hidden md:block" />

                <div className="flex items-center gap-2">
                  <div className="text-[11px] text-muted-foreground">Clase Grad-CAM</div>
                  <Badge variant="outline" title="Clase usada para Grad-CAM" className="capitalize">
                    {selectedClass ? (
                      <>
                        {selectedClass}{" "}
                        {selectedProb !== null ? `· ${Math.round((selectedProb ?? 0) * 100)}%` : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedClass}
                    onClick={() => selectedClass && onChangeGradcam(selectedClass)}
                    title="Recalcular: genera un nuevo Grad-CAM para la clase seleccionada"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Recalcular
                  </Button>
                </div>

                <div className="ml-auto">
                  <Button variant="outline" size="sm" onClick={onExportOverlay} title="Exportar PNG">
                    <Download className="h-4 w-4 mr-1" /> Exportar
                  </Button>
                </div>
              </div>
            </div>

            {/* ───────── Bloque B: Controles imagen ───────── */}
            <div className="rounded-lg border bg-white/60 dark:bg-card/60 p-2">
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-2">
                {/* Zoom/Pan */}
                <div className="rounded-md border px-3 py-2">
                  <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-2">
                    <Move className="h-4 w-4" /> Zoom y Pan
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(3, +(zoom + 0.1).toFixed(2)))} title="Acercar">
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(0.5, +(zoom - 0.1).toFixed(2)))} title="Alejar">
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <div className="flex-1" />
                    <span className="text-xs text-muted-foreground hidden sm:inline">Arrastrar = Pan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Slider value={[zoom]} onValueChange={(v) => setZoom(v[0])} min={0.5} max={3} step={0.05} className="flex-1" />
                    <span className="w-12 text-right font-mono text-xs">{(zoom * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {/* Ajustar al visor: calcula zoom = fit (equivale a 1 visual en este viewer) */}
                    <Button variant="outline" size="sm" onClick={() => setZoom(1)} title="Ajustar al visor">
                      <Minimize2 className="h-4 w-4 mr-1" /> Ajustar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setZoom(1)} title="Reset de zoom/pan">
                      <Maximize2 className="h-4 w-4 mr-1" /> 1:1
                    </Button>
                  </div>
                </div>

                {/* WL */}
                <div className="rounded-md border px-3 py-2">
                  <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-2">
                    <Sun className="h-4 w-4" /> Window / Level
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Brillo</span>
                    <Slider value={[brightness]} min={0.5} max={2} step={0.05} onValueChange={(v) => setBrightness(v[0])} className="flex-1" />
                    <span className="w-10 text-right text-xs font-mono">{brightness.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Contraste</span>
                    <Slider value={[contrast]} min={0.5} max={2} step={0.05} onValueChange={(v) => setContrast(v[0])} className="flex-1" />
                    <span className="w-10 text-right text-xs font-mono">{contrast.toFixed(2)}</span>
                  </div>
                  <div className="mt-2">
                    <Button variant={invert ? "default" : "outline"} size="sm" onClick={() => setInvert(!invert)} title="Invertir (negativo)">
                      ± Invertir
                    </Button>
                  </div>
                </div>

                {/* Geometría */}
                <div className="rounded-md border px-3 py-2">
                  <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-2">
                    <RotateCw className="h-4 w-4" /> Geometría
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setRotateDeg((r) => (r + 90) % 360)} title="Rotar 90°">
                      <RotateCw className="h-4 w-4" /> 90°
                    </Button>
                    <Button variant={flipH ? "default" : "ghost"} size="sm" onClick={() => setFlipH(!flipH)} title="Espejo horizontal">
                      <FlipHorizontal className="h-4 w-4" /> H
                    </Button>
                    <Button variant={flipV ? "default" : "ghost"} size="sm" onClick={() => setFlipV(!flipV)} title="Espejo vertical">
                      <FlipVertical className="h-4 w-4" /> V
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      title="Reset visual (WL/rotación/espejos)"
                      onClick={() => {
                        setBrightness(1);
                        setContrast(1);
                        setInvert(false);
                        setRotateDeg(0);
                        setFlipH(false);
                        setFlipV(false);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                {/* Guías */}
                <div className="rounded-md border px-3 py-2">
                  <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-2">
                    <Crosshair className="h-4 w-4" /> Guías
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant={showCrosshair ? "default" : "outline"} size="sm" onClick={() => setShowCrosshair(!showCrosshair)} title="Mostrar cruz central">
                      <Crosshair className="h-4 w-4 mr-1" />
                      {showCrosshair ? "On" : "Off"}
                    </Button>
                    <Button variant={showMagnifier ? "default" : "outline"} size="sm" onClick={() => setShowMagnifier(!showMagnifier)} title="Lupa central 1.8×">
                      <Circle className="h-4 w-4 mr-1" />
                      {showMagnifier ? "Lupa On" : "Lupa Off"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* VISOR */}
            <DicomLikeViewer
              baseUrl={selectedFile.url}
              heatmapUrl={heatmapUrlNorm}
              viewTab={viewTab}
              blendAlpha={blendAlpha}
              zoom={zoom}
              setZoom={setZoom}
              brightness={brightness}
              contrast={contrast}
              invert={invert}
              rotateDeg={rotateDeg}
              flipH={flipH}
              flipV={flipV}
              showCrosshair={showCrosshair}
              showMagnifier={showMagnifier}
            />

            {/* ───────── Bloque C: IA ───────── */}
            <div className="rounded-lg border bg-white/60 dark:bg-card/60 p-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs w-full md:w-[420px]">
                  <span className="whitespace-nowrap">Umbral</span>
                  <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={0} max={1} step={0.05} className="flex-1" aria-label="Umbral" />
                  <span className="w-12 text-right font-mono">{Math.round(threshold * 100)}%</span>
                  <Button variant="outline" size="sm" onClick={onApplyThreshold} disabled={loadingDiagnosis} className="shrink-0" aria-label="Aplicar umbral">
                    {loadingDiagnosis ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Aplicando…</>) : (<><RefreshCw className="h-4 w-4 mr-1" /> Aplicar</>)}
                  </Button>
                </div>

                <div className="ml-auto flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Predict: {timeMsPredict ? `${timeMsPredict} ms` : "—"}</span>
                  <span className="text-xs text-muted-foreground">Grad-CAM: {timeMsGradcam ? `${timeMsGradcam} ms` : "—"}</span>
                  <Button onClick={onDiagnose} disabled={loadingDiagnosis} className="shrink-0" aria-label="Ejecutar/actualizar inferencia">
                    {loadingDiagnosis ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analizando…</>) : (predict ? "Actualizar IA" : "🧠 Generar asistencia IA")}
                  </Button>
                </div>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                <b>Original</b> muestra la imagen importada; <b>Heatmap</b> muestra sólo el Grad-CAM; <b>Superposición</b> compone ambos en una sola imagen.{" "}
                <b>Alpha</b> controla la opacidad del mapa térmico en la superposición.
              </div>
            </div>

            {/* Resumen + Informe */}
            <div className="mt-2 grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">
              <Card className="border-cyan-100 shadow-sm min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-cyan-700" /> Resumen IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2 space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {predict ? (
                      <>
                        Umbral (actual): <b>{Math.round(threshold * 100)}%</b>
                        <span>·</span>
                        Usado en última predicción: <b>{Math.round((predict.threshold ?? threshold) * 100)}%</b>
                      </>
                    ) : ("Sin resultados todavía")}
                    <div className="ml-auto flex items-center gap-3">
                      <span>Predict: {timeMsPredict ? `${timeMsPredict} ms` : "—"}</span>
                      <span>Grad-CAM: {timeMsGradcam ? `${timeMsGradcam} ms` : "—"}</span>
                    </div>
                  </div>

                  {predict && (
                    <>
                      <div className="rounded-md border bg-white/60 dark:bg-card/60 p-3">
                        <div className="text-xs text-muted-foreground mb-1">Predicción principal</div>
                        <div className="flex items-end justify-between">
                          <div className="text-lg font-semibold">{predict.top_k?.[0]?.class || "—"}</div>
                          <div className="text-lg"><AnimatedPercent value={predict.top_k?.[0]?.prob ?? 0} /></div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(predict.top_k || []).slice(0, 5).map((t: TopK) => (
                            <Badge
                              key={t.class}
                              onClick={() => onChangeGradcam(t.class)}
                              className={`cursor-pointer transition ${selectedClass === t.class ? "bg-cyan-600 text-white" : "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200"}`}
                              title="Ver Grad-CAM de esta clase"
                            >
                              {t.class} · {(t.prob * 100).toFixed(0)}%
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Separator className="my-1" />
                      <div className="text-xs text-muted-foreground mb-1">Probabilidades por clase (línea roja = umbral)</div>
                      <ProbChart probs={predict.probabilities} selected={selectedClass} onSelect={(cls) => onChangeGradcam(cls)} threshold={threshold} />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-cyan-100 shadow-sm min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Informe rápido</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <textarea
                    placeholder="Escribe tus hallazgos (se guardará en files.diagnosis_ia)."
                    value={hallazgosTexto}
                    onChange={(e) => setHallazgosTexto(e.target.value)}
                    className="w-full p-2 border rounded text-sm"
                    rows={7}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button onClick={onSaveDiagnosis} disabled={savingDiagnosis} className="cursor-pointer">
                      <Save className="h-4 w-4 mr-1" /> {savingDiagnosis ? "Guardando…" : "Guardar diagnóstico"}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleGenerateReportIA}
                      disabled={creatingReport || !predict || !selectedFile}
                      className="cursor-pointer"
                      title="Guardar en ia_inferencias + ia_informes"
                    >
                      {creatingReport ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generando…</>) : (<><FileText className="h-4 w-4 mr-1" /> Generar reporte IA</>)}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => setReportOpen(true)}
                      disabled={!lastReport}
                      title="Ver el último reporte IA"
                    >
                      Resumen radiografías IA
                    </Button>

                    {predict && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const top = predict.top_k?.[0];
                          const texto = top ? `${top.class} (${Math.round(top.prob * 100)}%)` : "Sin hallazgos por encima del umbral";
                          const nuevo = hallazgosTexto?.trim() ? `${hallazgosTexto}\n${texto}` : texto;
                          setHallazgosTexto(nuevo);
                        }}
                      >
                        Insertar resumen IA
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={onOpenOriginal}>
                      <ExternalLink className="h-4 w-4 mr-1" /> Abrir archivo original
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {predict && (
                <div className="xl:col-span-2 min-w-0">
                  <MetricsPanel probs={predict.probabilities} threshold={threshold} />
                </div>
              )}
            </div>

            {/* Ventana (Dialog) Resumen IA */}
            <Dialog open={reportOpen} onOpenChange={setReportOpen}>
              <DialogContent className="max-w-5xl w-full">
                <DialogHeader>
                  <DialogTitle>Resumen radiografías IA</DialogTitle>
                  {lastReport && (
                    <DialogDescription>
                      Informe {lastReport.informeId} · {new Date(lastReport.creado_en).toLocaleString()}
                    </DialogDescription>
                  )}
                </DialogHeader>

                {!lastReport ? (
                  <div className="text-sm text-muted-foreground">No hay reporte guardado para este archivo.</div>
                ) : (
                  <div className="max-h-[70vh] overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {/* Paciente */}
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Paciente</CardTitle></CardHeader>
                        <CardContent className="pt-2 text-sm">
                          <div><b>Nombre:</b> {lastReport.paciente.nombre || "—"}</div>
                          <div><b>CI:</b> {lastReport.paciente.ci || "—"}</div>
                          <div><b>Sexo:</b> {lastReport.paciente.sexo || "—"}</div>
                          <div><b>Nacimiento:</b> {lastReport.paciente.fecha_nacimiento || "—"}</div>
                        </CardContent>
                      </Card>

                      {/* Parámetros */}
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Parámetros y tiempos</CardTitle></CardHeader>
                        <CardContent className="pt-2 text-sm">
                          <div><b>Umbral:</b> {Math.round(lastReport.umbral * 100)}%</div>
                          <div><b>Predict:</b> {lastReport.tiempos.predict ?? "—"} ms</div>
                          <div><b>Grad-CAM:</b> {lastReport.tiempos.gradcam ?? "—"} ms</div>
                          {!!lastReport.hallazgos?.length && (
                            <div className="mt-2">
                              <b>Clases ≥ umbral:</b>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {lastReport.hallazgos.map((h) => (
                                  <Badge key={h} variant="outline" className="text-xs">{h}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Narrativa */}
                      <Card className="lg:col-span-2">
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Narrativa</CardTitle></CardHeader>
                        <CardContent className="pt-2">
                          <pre className="whitespace-pre-wrap text-sm">{lastReport.narrativa}</pre>
                        </CardContent>
                      </Card>

                      {/* Top-K / Probabilidades */}
                      <Card className="lg:col-span-2">
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Top-K y Probabilidades</CardTitle></CardHeader>
                        <CardContent className="pt-2">
                          {lastReport.topk?.length ? (
                            <div className="mb-3 flex flex-wrap gap-1.5">
                              {lastReport.topk.slice(0, 5).map((t) => (
                                <Badge key={t.class} className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200">
                                  {t.class} · {(t.prob * 100).toFixed(0)}%
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          {Object.keys(lastReport.probabilidades || {}).length ? (
                            <ProbChart
                              probs={lastReport.probabilidades}
                              selected={null}
                              onSelect={() => {}}
                              threshold={lastReport.umbral}
                            />
                          ) : (
                            <div className="text-sm text-muted-foreground">No hay probabilidades almacenadas.</div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Radiografía y Heatmap */}
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Radiografía</CardTitle></CardHeader>
                        <CardContent className="pt-2">
                          <img src={lastReport.fileUrl} alt={lastReport.fileName} className="w-full rounded-md border object-contain" />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Heatmap</CardTitle></CardHeader>
                        <CardContent className="pt-2">
                          {lastReport.heatmapUrl ? (
                            <img src={lastReport.heatmapUrl} alt="Heatmap" className="w-full rounded-md border object-contain" />
                          ) : (
                            <div className="text-sm text-muted-foreground">Sin mapa térmico guardado.</div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setReportOpen(false)}>Cerrar</Button>
                  <Button onClick={handleExportReport} disabled={!lastReport || exporting}>
                    {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                    Exportar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
