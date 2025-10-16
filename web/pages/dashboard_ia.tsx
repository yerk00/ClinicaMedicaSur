// web/pages/dashboard_ia.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import {
  Loader2,
  RefreshCw,
  Download,
  Activity,
  Users,
  Clock,
  Gauge,
  FolderOpen,
} from "lucide-react";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from "recharts";

/* ========================= Tipos ========================= */
type TopK = { class: string; prob: number };
type InferenceRow = {
  id: string;
  archivo_id: string;
  creado_en?: string | null;    // puede existir
  created_at?: string | null;   // fallback
  probabilidades?: Record<string, number> | null;
  presentes?: string[] | null;
  tiempo_ms_prediccion?: number | null;
  tiempo_ms_gradcam?: number | null;
  topk?: TopK[] | null;
};
type InformeRow = {
  id: string;
  creado_en?: string | null;    // puede existir
  created_at?: string | null;   // fallback
  archivo_id: string;
  inferencia_id: string | null;
  narrativa?: string | null;
  hallazgos_seleccionados?: string[] | null;
};
type FileRow = {
  id: string;
  filename: string;
  url: string;
  user_profile_id: string;
};
type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  ci: string | null;
};

/* ========================= Helpers ========================= */
const fmtPct = (v: number) => `${(v * 100).toFixed(0)}%`;
const fmtMs = (v?: number | null) => (v || v === 0 ? `${Math.round(v)} ms` : "—");
const COLORS = ["#0891b2", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#a855f7"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function iso(d: Date) {
  return d.toISOString();
}

/* ========================= Página ========================= */
export default function DashboardIA() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "365d" | "all">("30d");
  const [threshold, setThreshold] = useState<number>(0.5);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [inferences, setInferences] = useState<InferenceRow[]>([]);
  const [recentInformes, setRecentInformes] = useState<InformeRow[]>([]);
  const [filesMap, setFilesMap] = useState<Record<string, FileRow>>({});
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileRow>>({});

  const periodDates = useMemo(() => {
    if (period === "all") return { from: null as Date | null, to: new Date() };
    const now = new Date();
    const lookup: Record<typeof period, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365, all: 0 };
    const days = lookup[period];
    const from = startOfDay(addDays(now, -days + 1));
    return { from, to: now };
  }, [period]);

  /* ========================= Fetch con fallback de columnas ========================= */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // --- ia_inferencias: intentar con creado_en; si falla, usar created_at ---
        let inferData: InferenceRow[] | null = null;
        {
          const selectA = "id, archivo_id, creado_en, probabilidades, presentes, tiempo_ms_prediccion, tiempo_ms_gradcam, topk";
          let q = supabase.from("ia_inferencias").select(selectA).order("creado_en", { ascending: false }).limit(1000);
          let { data, error }: any = await q;
          if (error && error.code === "42703") {
            // fallback a created_at
            const selectB = "id, archivo_id, created_at, probabilidades, presentes, tiempo_ms_prediccion, tiempo_ms_gradcam, topk";
            const qb = supabase.from("ia_inferencias").select(selectB).order("created_at", { ascending: false }).limit(1000);
            const resB: any = await qb;
            if (resB.error) throw resB.error;
            inferData = resB.data || [];
          } else if (error) {
            throw error;
          } else {
            inferData = data || [];
          }
        }

        // Filtrado por período en cliente
        const filtered = (inferData || []).filter((r) => {
          const d = new Date(r.creado_en || r.created_at || Date.now());
          if (!periodDates.from) return true;
          return d >= periodDates.from && d <= (periodDates.to || new Date());
        });
        setInferences(filtered);

        // --- ia_informes: intentar con creado_en; si falla, created_at ---
        let informes: InformeRow[] = [];
        {
          const selectA = "id, creado_en, archivo_id, inferencia_id, narrativa, hallazgos_seleccionados";
          let q = supabase.from("ia_informes").select(selectA).order("creado_en", { ascending: false }).limit(10);
          let { data, error }: any = await q;
          if (error && error.code === "42703") {
            const selectB = "id, created_at, archivo_id, inferencia_id, narrativa, hallazgos_seleccionados";
            const qb = supabase.from("ia_informes").select(selectB).order("created_at", { ascending: false }).limit(10);
            const resB: any = await qb;
            if (resB.error) throw resB.error;
            informes = resB.data || [];
          } else if (error) {
            throw error;
          } else {
            informes = data || [];
          }
        }
        setRecentInformes(informes || []);

        // --- Mapear archivos de ambos conjuntos ---
        const archivoIds = Array.from(new Set([
          ...filtered.map((x) => x.archivo_id),
          ...(informes || []).map((x) => x.archivo_id),
        ]));

        let files: FileRow[] = [];
        if (archivoIds.length) {
          const { data: filesData, error: fErr } = await supabase
            .from("files")
            .select("id, filename, url, user_profile_id")
            .in("id", archivoIds);
          if (fErr) throw fErr;
          files = filesData || [];
        }
        const fMap: Record<string, FileRow> = {};
        files.forEach((f) => (fMap[f.id] = f));
        setFilesMap(fMap);

        // --- Perfiles ---
        const profileIds = Array.from(new Set(files.map((f) => f.user_profile_id)));
        let profiles: ProfileRow[] = [];
        if (profileIds.length) {
          const { data: profilesData, error: pErr } = await supabase
            .from("user_profiles")
            .select("id, full_name, email, ci")
            .in("id", profileIds);
          if (pErr) throw pErr;
          profiles = profilesData || [];
        }
        const pMap: Record<string, ProfileRow> = {};
        profiles.forEach((p) => (pMap[p.id] = p));
        setProfilesMap(pMap);
      } catch (e: any) {
        console.error(e);
        toast.error(`No se pudo cargar el dashboard${e?.message ? `: ${e.message}` : ""}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [period, periodDates.from, periodDates.to]);

  /* ========================= Cálculos agregados ========================= */
  const enriched = useMemo(() => {
    // Normaliza datos y calcula "presentes" según threshold si no existieran
    return inferences.map((inf) => {
      const probs = inf.probabilidades || {};
      const presentes =
        inf.presentes && inf.presentes.length
          ? inf.presentes
          : Object.entries(probs)
              .filter(([, v]) => (v || 0) >= threshold)
              .map(([k]) => k);
      const date = new Date(inf.creado_en || inf.created_at || Date.now());
      return { ...inf, presentes, date, probs };
    });
  }, [inferences, threshold]);

  // Totales
  const totalEstudios = enriched.length;
  const totalPositivos = enriched.filter((x) => (x.presentes?.length || 0) > 0).length;
  const tasaPositivos = totalEstudios ? totalPositivos / totalEstudios : 0;

  // Distintos pacientes
  const distinctPatientCount = useMemo(() => {
    const setIds = new Set<string>();
    enriched.forEach((inf) => {
      const file = filesMap[inf.archivo_id];
      if (file) setIds.add(file.user_profile_id);
    });
    return setIds.size;
  }, [enriched, filesMap]);

  // Tiempos medios
  const avgPredict = useMemo(() => {
    const arr = enriched.map((x) => x.tiempo_ms_prediccion || 0).filter((x) => x > 0);
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  }, [enriched]);
  const avgGradcam = useMemo(() => {
    const arr = enriched.map((x) => x.tiempo_ms_gradcam || 0).filter((x) => x > 0);
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  }, [enriched]);

  // Ranking por patología (conteo de presentes + avg prob)
  const pathologyAgg = useMemo(() => {
    const counts: Record<string, { count: number; sumProb: number; hits: number }> = {};
    enriched.forEach((inf) => {
      const probs = inf.probs as Record<string, number>;
      (inf.presentes || []).forEach((label) => {
        if (!counts[label]) counts[label] = { count: 0, sumProb: 0, hits: 0 };
        counts[label].count += 1;
        const p = probs?.[label] ?? 0;
        counts[label].sumProb += p;
        counts[label].hits += 1;
      });
    });
    const rows = Object.entries(counts).map(([label, v]) => ({
      label,
      count: v.count,
      avgProb: v.hits ? v.sumProb / v.hits : 0,
    }));
    rows.sort((a, b) => b.count - a.count || b.avgProb - a.avgProb);
    return rows;
  }, [enriched]);

  // Serie de estudios por día
  const seriesByDay = useMemo(() => {
    if (!enriched.length) return [];
    const dates: Record<string, number> = {};
    let from = periodDates.from ? startOfDay(periodDates.from) : startOfDay(addDays(new Date(), -29));
    const to = startOfDay(periodDates.to || new Date());
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      dates[d.toISOString().slice(0, 10)] = 0;
    }
    enriched.forEach((inf) => {
      const key = startOfDay(inf.date).toISOString().slice(0, 10);
      dates[key] = (dates[key] || 0) + 1;
    });
    return Object.entries(dates).map(([date, count]) => ({ date, count }));
  }, [enriched, periodDates.from, periodDates.to]);

  // Tiempos para gráfico
  const timesBar = useMemo(() => {
    return [
      { name: "Predict", ms: avgPredict || 0 },
      { name: "Grad-CAM", ms: avgGradcam || 0 },
    ];
  }, [avgPredict, avgGradcam]);

  // Pie Positivos/Negativos
  const posNegPie = useMemo(
    () => [
      { name: "Positivos (≥ umbral)", value: totalPositivos },
      { name: "Negativos", value: Math.max(0, totalEstudios - totalPositivos) },
    ],
    [totalEstudios, totalPositivos]
  );

  // Tabla/Gráfico patologías (filtra con search)
  const filteredPathologies = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = pathologyAgg;
    return q ? base.filter((r) => r.label.toLowerCase().includes(q)) : base;
  }, [pathologyAgg, search]);

  /* ========================= Export CSV ========================= */
  function exportCSV() {
    try {
      const header = ["date", "archivo_id", "presentes", "tiempo_ms_prediccion", "tiempo_ms_gradcam"].join(",");
      const rows = enriched.map((x) =>
        [
          (x.date.toISOString() || "").slice(0, 19),
          x.archivo_id,
          (x.presentes || []).join("|"),
          x.tiempo_ms_prediccion ?? "",
          x.tiempo_ms_gradcam ?? "",
        ].join(",")
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard_ia_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo exportar el CSV");
    }
  }

  /* ========================= UI ========================= */
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header / Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-2xl font-semibold">Dashboard IA</div>
          <div className="text-sm text-muted-foreground">Resumen general por patología, distribuciones y actividad reciente</div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as any)}>
            <ToggleGroupItem value="7d">7d</ToggleGroupItem>
            <ToggleGroupItem value="30d">30d</ToggleGroupItem>
            <ToggleGroupItem value="90d">90d</ToggleGroupItem>
            <ToggleGroupItem value="365d">1 año</ToggleGroupItem>
            <ToggleGroupItem value="all">Todo</ToggleGroupItem>
          </ToggleGroup>
          <Separator orientation="vertical" className="h-8 hidden md:block" />
          <div className="hidden md:block text-xs text-muted-foreground mr-1">Umbral</div>
          <div className="w-36">
            <Slider value={[threshold]} min={0} max={1} step={0.05} onValueChange={(v) => setThreshold(v[0])} />
          </div>
          <div className="w-10 text-right text-xs font-mono">{Math.round(threshold * 100)}%</div>
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => p)}>
            <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
          </Button>
          <Button size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Métricas grandes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Estudios</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-2xl font-semibold">{loading ? "…" : totalEstudios}</div>
            <div className="text-xs text-muted-foreground">Inferencias en el período</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Pacientes únicos</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-2xl font-semibold">{loading ? "…" : distinctPatientCount}</div>
            <div className="text-xs text-muted-foreground">Contados por propietario del archivo</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4" /> Tasa positivos</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: "pos", value: Math.max(1, Math.round(tasaPositivos * 100)) }]} startAngle={180} endAngle={0}>
                    <RadialBar minAngle={15} background dataKey="value" />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <div className="text-2xl font-semibold">{loading ? "…" : fmtPct(tasaPositivos)}</div>
                <div className="text-xs text-muted-foreground">≥ {Math.round(threshold * 100)}% en alguna clase</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Tiempos medios</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border p-2">
                <div className="text-[11px] text-muted-foreground">Predict</div>
                <div className="text-lg font-semibold">{loading ? "…" : fmtMs(avgPredict)}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-[11px] text-muted-foreground">Grad-CAM</div>
                <div className="text-lg font-semibold">{loading ? "…" : fmtMs(avgGradcam)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Serie temporal + tiempos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Estudios por día</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="w-full h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={seriesByDay}>
                  <defs>
                    <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis width={36} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Area type="monotone" dataKey="count" stroke="#0891b2" fill="url(#colorA)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tiempos medios</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="w-full h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timesBar} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" />
                  <RTooltip formatter={(v: any) => [`${Math.round(Number(v))} ms`, "Tiempo"]} />
                  <Bar dataKey="ms" radius={[4, 4, 4, 4]} fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking de patologías */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm">Patologías (conteo ≥ umbral y probabilidad media)</CardTitle>
            <div className="flex-1" />
            <Input
              placeholder="Buscar patología…"
              className="w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {filteredPathologies.length ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="xl:col-span-2">
                <div className="w-full h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={filteredPathologies.slice(0, 12).map((r) => ({ name: r.label, count: r.count, avg: +(r.avgProb * 100).toFixed(1) }))}
                      margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} height={40} />
                      <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <RTooltip />
                      <Bar yAxisId="left" dataKey="count" name="Conteo" fill="#0891b2" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="avg" name="Prob. media (%)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className="w-full h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <RTooltip />
                      <Pie
                        data={filteredPathologies.slice(0, 6).map((r, i) => ({ name: r.label, value: r.count, fill: COLORS[i % COLORS.length] }))}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={100}
                        innerRadius={50}
                        paddingAngle={2}
                      >
                        {filteredPathologies.slice(0, 6).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Top 6 por frecuencia (≥ {Math.round(threshold * 100)}%)</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No hay datos en este período o con el umbral seleccionado.</div>
          )}
        </CardContent>
      </Card>

      {/* Positivos vs Negativos + desglose */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribución (positivos vs negativos)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RTooltip />
                  <Pie data={posNegPie} dataKey="value" nameKey="name" outerRadius={110} innerRadius={60}>
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Desglose de positivos por patología (Top 10)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-sm">
                <thead>
                  <tr className="text-left text-[12px] text-muted-foreground">
                    <th className="py-2 pr-3">Patología</th>
                    <th className="py-2 pr-3">Conteo</th>
                    <th className="py-2 pr-3">Prob. media</th>
                    <th className="py-2 pr-3">Badge</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPathologies.slice(0, 10).map((r, idx) => (
                    <tr key={r.label} className="border-b last:border-0">
                      <td className="py-2 pr-3">{r.label}</td>
                      <td className="py-2 pr-3">{r.count}</td>
                      <td className="py-2 pr-3">{(r.avgProb * 100).toFixed(1)}%</td>
                      <td className="py-2">
                        <Badge className="capitalize" style={{ background: COLORS[idx % COLORS.length], color: "white" }}>
                          {r.label}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {!filteredPathologies.length && (
                    <tr><td colSpan={4} className="py-4 text-sm text-muted-foreground">Sin datos para mostrar.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pacientes recientes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pacientes / informes recientes</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {recentInformes.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {recentInformes.map((inf) => {
                const file = filesMap[inf.archivo_id];
                const prof = file ? profilesMap[file.user_profile_id] : undefined;
                const label = (inf.hallazgos_seleccionados || [])[0];
                const fecha = new Date(inf.creado_en || inf.created_at || Date.now()).toLocaleString();
                return (
                  <div key={inf.id} className="rounded border p-3 bg-white/60 dark:bg-card/60">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{prof?.full_name || "Paciente"}</div>
                      <div className="text-[11px] text-muted-foreground">{fecha}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{file?.filename}</div>
                    <div className="mt-2 flex items-center gap-2">
                      {label ? <Badge className="capitalize">{label}</Badge> : <Badge variant="outline">Sin hallazgos ≥ umbral</Badge>}
                      {prof?.ci ? <Badge variant="outline">CI: {prof.ci}</Badge> : null}
                    </div>
                    {inf.narrativa ? (
                      <div className="mt-2 text-xs line-clamp-3 text-muted-foreground whitespace-pre-line">{inf.narrativa}</div>
                    ) : null}
                    <div className="mt-2">
                      <a href={file?.url} target="_blank" className="text-xs underline text-blue-600">Abrir imagen</a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Aún no hay informes.</div>
          )}
        </CardContent>
      </Card>

      {/* Estado de carga */}
      {loading && (
        <div className="fixed inset-x-0 bottom-4 mx-auto w-fit px-3 py-1.5 rounded-full border bg-background shadow-sm text-xs flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando datos…
        </div>
      )}
    </div>
  );
}
