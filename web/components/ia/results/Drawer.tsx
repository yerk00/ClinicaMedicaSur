// web/components/ia/results/Drawer.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { getIaResultDetail } from "@/lib/iaResults";

/* =============== helpers =============== */
function sortProbs(prob: Record<string, number> | null | undefined) {
  if (!prob) return [] as Array<{ label: string; p: number }>;
  return Object.entries(prob)
    .map(([label, p]) => ({ label, p: Number(p) || 0 }))
    .sort((a, b) => b.p - a.p);
}
const pct = (v: number | null | undefined) => `${Math.round((Number(v || 0)) * 100)}%`;
const safeDT = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

type Props = { fileId: string | null; onOpenChange: (open: boolean) => void };

export function ResultDrawer({ fileId, onOpenChange }: Props) {
  const open = !!fileId;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["iaResultDetail", fileId],
    queryFn: () => getIaResultDetail({ fileId: fileId! }),
    enabled: !!fileId,
  });

  useEffect(() => {
    if (fileId) refetch();
  }, [fileId, refetch]);

  // Top-K (tolera {class,prob} o {label,prob})
  const topk = useMemo(() => {
    const arr = (data?.inference?.topk as any) as Array<{ class?: string; label?: string; prob?: number }> | null;
    if (!arr || !Array.isArray(arr)) return [];
    return arr
      .map((k) => ({ label: (k.class ?? k.label ?? "").toString(), prob: typeof k.prob === "number" ? k.prob : 0 }))
      .filter((k) => k.label.length > 0)
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 5);
  }, [data]);

  // Probabilidades
  const probsSorted = useMemo(() => sortProbs(data?.inference?.probabilidades), [data]);

  // Clínico
  const threshold = typeof data?.inference?.umbral === "number" ? data!.inference!.umbral : 0.5;
  const probAbove = useMemo(() => probsSorted.filter((x) => x.p >= threshold), [probsSorted, threshold]);
  const top1 = probsSorted[0] || null;
  const coactivation = probAbove.length >= 2 ? "Múltiple" : probAbove.length === 1 ? "Única" : "—";

  // Descargas
  const downloadJson = () => {
    if (!data?.inference) return;
    const payload = { file: data.file, inference: data.inference, report: data.report };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = (data.file.filename || "inferencia").replace(/\.[^.]+$/, "");
    a.download = `${name}_ia.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const downloadHeatmapPng = () => {
    const hm = data?.inference?.url_mapa_calor;
    if (!hm) return;
    const a = document.createElement("a");
    a.href = hm; // dataURL o URL remota
    const name = (data?.file?.filename || "mapa_calor").replace(/\.[^.]+$/, "");
    a.download = `${name}_heatmap.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Dimensiones de imagen
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    setDims({ w: el.naturalWidth || el.width, h: el.naturalHeight || el.height });
  }, []);

  // Imagen a mostrar: heatmap si existe; de lo contrario original
  const imgSrc = data?.inference?.url_mapa_calor || data?.file?.url || "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Drawer más ancho y con contenido scrolleable interno */}
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl xl:max-w-[1200px] p-0">
        {/* Header fijo */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-5 py-4">
          <SheetHeader className="min-w-0">
            <SheetTitle className="truncate">Detalle del estudio IA</SheetTitle>
            <SheetDescription className="truncate">{data?.file?.filename ?? ""}</SheetDescription>
          </SheetHeader>
        </div>

        {/* Body con scroll; padding responsivo para que no se corte nada */}
        <div className="px-4 sm:px-5 py-4 space-y-4 max-h-[calc(100vh-96px)] overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{(error as any)?.message ?? "Error al cargar detalle."}</p>
          ) : data ? (
            <>
              {/* Acciones (responsive, no se rompen) */}
              <div className="flex flex-wrap gap-2">
                {data.file?.url ? (
                  <Button variant="outline" className="gap-2" asChild>
                    <a href={data.file.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Abrir original
                    </a>
                  </Button>
                ) : null}
                {data.inference?.url_mapa_calor ? (
                  <>
                    <Button variant="outline" className="gap-2" asChild>
                      <a href={data.inference.url_mapa_calor} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" /> Abrir mapa térmico
                      </a>
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={downloadHeatmapPng}>
                      <Download className="h-4 w-4" /> Descargar heatmap
                    </Button>
                  </>
                ) : null}
                <Button className="gap-2" onClick={downloadJson}>
                  <Download className="h-4 w-4" /> Descargar JSON
                </Button>
              </div>

              {/* Grid responsive: izquierda ancha para imagen, derecha datos clínicos */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-4 min-w-0">
                {/* Columna izquierda ================================================= */}
                <div className="space-y-4 min-w-0">
                  {/* Vista */}
                  <Card className="min-w-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Vista</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      {imgSrc ? (
                        <div className="rounded-md border overflow-hidden bg-black/5">
                          <img
                            src={imgSrc}
                            alt="Mapa térmico / imagen"
                            onLoad={onImgLoad}
                            className="block w-full h-auto max-h-[48vh] sm:max-h-[52vh] lg:max-h-[56vh] object-contain"
                          />
                        </div>
                      ) : (
                        <div className="rounded-md border p-6 text-sm text-muted-foreground">
                          Sin imagen disponible.
                        </div>
                      )}

                      {/* Metadatos bajo la imagen (wrapping y truncado) */}
                      <div className="mt-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="shrink-0">Tipo: <b>{data.file.file_type ?? "—"}</b></span>
                        <span className="hidden sm:inline">·</span>
                        <span className="min-w-0">
                          Subido: <b className="break-words">{safeDT(data.file.uploaded_at)}</b>
                        </span>
                        {dims ? (
                          <>
                            <span className="hidden sm:inline">·</span>
                            <span className="shrink-0">Resolución: <b>{dims.w}×{dims.h}px</b></span>
                          </>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top-K compacto */}
                  <Card className="min-w-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Top-K</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      {topk.length > 0 ? (
                        <ul className="text-sm divide-y">
                          {topk.map((k) => (
                            <li key={`${k.label}_${k.prob}`} className="py-2 flex items-center gap-3 min-w-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <span className="truncate capitalize" title={k.label}>{k.label}</span>
                                  <span className="tabular-nums text-xs">{k.prob.toFixed(3)}</span>
                                </div>
                                <div className="mt-1 w-full h-1.5 bg-muted/60 rounded overflow-hidden">
                                  <div
                                    className="h-1.5 bg-primary/80"
                                    style={{ width: `${Math.max(0, Math.min(100, k.prob * 100))}%` }}
                                  />
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-muted-foreground">No disponible.</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Columna derecha ================================================== */}
                <div className="space-y-4 min-w-0">
                  {/* Resumen clínico (no se corta; todo trunca/ajusta) */}
                  <Card className="border-cyan-200 min-w-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Resumen clínico</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-3 min-w-0">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-md border p-3 min-w-0">
                          <div className="text-[11px] text-muted-foreground">Hallazgos ≥ umbral</div>
                          <div className="text-xl font-semibold">
                            {probAbove.length} <span className="text-sm text-muted-foreground">/ {probsSorted.length}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">Umbral: {pct(threshold)}</div>
                        </div>

                        <div className="rounded-md border p-3 min-w-0">
                          <div className="text-[11px] text-muted-foreground">Principal (top-1)</div>
                          <div className="text-xl font-semibold truncate capitalize" title={top1?.label || ""}>
                            {top1 ? top1.label : "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{top1 ? pct(top1.p) : ""}</div>
                        </div>

                        <div className="rounded-md border p-3 min-w-0">
                          <div className="text-[11px] text-muted-foreground">Co-activación</div>
                          <div className="text-xl font-semibold">{coactivation}</div>
                          <div className="text-[11px] text-muted-foreground">N.º clases sobre umbral</div>
                        </div>

                        <div className="rounded-md border p-3 min-w-0">
                          <div className="text-[11px] text-muted-foreground">Último análisis</div>
                          <div className="text-sm font-medium truncate" title={safeDT(data.inference?.creado_en)}>
                            {safeDT(data.inference?.creado_en)}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate" title={`v${data.inference?.modelo_version ?? "—"}`}>
                            Modelo v{data.inference?.modelo_version ?? "—"}
                          </div>
                        </div>
                      </div>

                      {/* Chips de ≥ umbral con límite +N para no desbordar */}
                      {probAbove.length ? (
                        <div className="text-sm min-w-0">
                          <span className="text-muted-foreground">≥ umbral:&nbsp;</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {probAbove.slice(0, 6).map((e) => (
                              <Badge key={e.label} variant="secondary" className="capitalize">
                                {e.label} · {pct(e.p)}
                              </Badge>
                            ))}
                            {probAbove.length > 6 ? (
                              <Badge variant="outline">+{probAbove.length - 6}</Badge>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Ninguna clase supera el umbral actual.</div>
                      )}

                      <div className="text-[11px] text-muted-foreground">
                        Nota: soporte a la decisión. Correlacione con clínica e imágenes previas.
                      </div>
                    </CardContent>
                  </Card>

                  {/* Inferencia */}
                  <Card className="min-w-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Inferencia</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-2 min-w-0">
                      {data.inference ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="capitalize">{data.inference.clase_top1 ?? "-"}</Badge>
                            <span className="text-sm">
                              {typeof data.inference.prob_top1 === "number" ? `Prob: ${data.inference.prob_top1.toFixed(3)}` : "Prob: -"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground min-w-0">
                            <span className="truncate">
                              Modelo: {data.inference.modelo_nombre} (v{data.inference.modelo_version})
                            </span>
                            {" • "}
                            <span>Umbral: {typeof data.inference.umbral === "number" ? data.inference.umbral.toFixed(2) : "-"}</span>
                          </div>

                          {(data.inference.tiempo_ms_prediccion != null || data.inference.tiempo_ms_gradcam != null) && (
                            <div className="text-xs text-muted-foreground">
                              {data.inference.tiempo_ms_prediccion != null ? `Predict: ${data.inference.tiempo_ms_prediccion} ms` : "Predict: —"}
                              {" · "}
                              {data.inference.tiempo_ms_gradcam != null ? `Grad-CAM: ${data.inference.tiempo_ms_gradcam} ms` : "Grad-CAM: —"}
                            </div>
                          )}

                          <Separator className="my-2" />
                          <div className="text-sm">
                            Hallazgos ≥ umbral:&nbsp;
                            {(data.inference.presentes ?? []).length > 0 ? (data.inference.presentes ?? []).join(", ") : "—"}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm">Sin inferencia registrada para este archivo.</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Archivo */}
                  <Card className="min-w-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Archivo</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-2 min-w-0">
                      <div className="font-medium truncate" title={data.file.filename}>{data.file.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {data.file.file_type ?? "-"} • {safeDT(data.file.uploaded_at)}
                        {dims ? <> • {dims.w}×{dims.h}px</> : null}
                      </div>
                      {(data.file as any)?.tags?.length ? (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(data.file as any).tags.slice(0, 8).map((t: string) => (
                            <Badge key={t} variant="secondary" className="capitalize">{t}</Badge>
                          ))}
                          {(data.file as any).tags.length > 8 ? (
                            <Badge variant="outline">+{(data.file as any).tags.length - 8}</Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* Informe */}
                  <Card className="min-w-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Informe</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-2 min-w-0">
                      {data.report ? (
                        <>
                          <Badge variant={data.report.estado === "final" ? "default" : "secondary"} className="capitalize">
                            {data.report.estado}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            Última actualización: {safeDT(data.report.actualizado_en)}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm">Sin informe generado.</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Probabilidades por clase (ordenadas, truncadas, sin desbordes) */}
                  <Card className="min-w-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Probabilidades por clase</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      {probsSorted.length ? (
                        <ul className="text-sm divide-y">
                          {probsSorted.map((e) => (
                            <li key={e.label} className="py-2 flex items-center gap-3 min-w-0">
                              <div className="w-[36%] sm:w-[30%] lg:w-[28%] xl:w-[24%] truncate capitalize" title={e.label}>
                                {e.label}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="w-full h-1.5 bg-muted/60 rounded overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded ${e.p >= threshold ? "bg-cyan-600" : "bg-slate-400"}`}
                                    style={{ width: `${Math.max(0, Math.min(100, e.p * 100))}%` }}
                                  />
                                </div>
                              </div>
                              <div className="w-14 text-right tabular-nums text-xs shrink-0">{e.p.toFixed(3)}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-muted-foreground">No disponible.</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
