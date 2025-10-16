"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw, TrendingUp, Calendar, Layers, ListFilter } from "lucide-react";
import { toast } from "sonner";

import {
  listIaResultsByPatient,
  exportIaResultsCsv,
  getIaResultsStats,
  IaResultRow,
  IaResultsOrderBy,
} from "@/lib/iaResults";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import { ResultsFilters, FiltersState, defaultFiltersState } from "./results/Filters";
import { ResultsTable } from "./results/Table";
import { ResultDrawer } from "./results/Drawer";

type Props = { patientId: string };

const quickRanges = [
  { key: "7d", label: "Últimos 7 días", days: 7 },
  { key: "30d", label: "Últimos 30 días", days: 30 },
  { key: "90d", label: "Últimos 90 días", days: 90 },
  { key: "all", label: "Todo", days: null as number | null },
];

function isoDateNDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ResultsIaView({ patientId }: Props) {
  const [filters, setFilters] = useState<FiltersState>(defaultFiltersState);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [orderBy, setOrderBy] = useState<IaResultsOrderBy>("date_desc");
  const [dense, setDense] = useState<boolean>(false);

  const [openFileId, setOpenFileId] = useState<string | null>(null);

  const listKey = useMemo(
    () => ["iaResults", patientId, filters, page, pageSize, orderBy],
    [patientId, filters, page, pageSize, orderBy]
  );

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      listIaResultsByPatient({
        patientId,
        from: filters.from || undefined,
        to: filters.to || undefined,
        classes: filters.hallazgos.length ? filters.hallazgos : undefined,
        minThreshold:
          filters.minConfidence != null ? filters.minConfidence / 100 : undefined,
        reportState: filters.reportState ?? undefined,
        hasHeatmap: filters.hasHeatmap ?? undefined,
        search: filters.search || undefined,
        page,
        pageSize,
        orderBy,
      }),
    keepPreviousData: true,
  });

  const rows: IaResultRow[] = data?.rows ?? [];
  const total: number = data?.count ?? 0;

  const statsKey = useMemo(
    () => ["iaResultsStats", patientId, filters.from, filters.to],
    [patientId, filters.from, filters.to]
  );
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: statsKey,
    queryFn: () =>
      getIaResultsStats({
        patientId,
        from: filters.from || undefined,
        to: filters.to || undefined,
      }),
  });

  const applyQuickRange = (key: string) => {
    const q = quickRanges.find((r) => r.key === key);
    if (!q) return;
    if (q.days == null) {
      setFilters({ ...filters, from: null, to: null });
    } else {
      const from = isoDateNDaysAgo(q.days);
      const to = new Date().toISOString().slice(0, 10);
      setFilters({ ...filters, from, to });
    }
    setPage(1);
  };

  const onExport = async () => {
    try {
      const csv = await exportIaResultsCsv({
        patientId,
        from: filters.from || undefined,
        to: filters.to || undefined,
        classes: filters.hallazgos.length ? filters.hallazgos : undefined,
        minThreshold:
          filters.minConfidence != null ? filters.minConfidence / 100 : undefined,
        reportState: filters.reportState ?? undefined,
        hasHeatmap: filters.hasHeatmap ?? undefined,
        search: filters.search || undefined,
        orderBy,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `resultados-ia_${date}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Exportado CSV");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo exportar CSV");
    }
  };

  // === Helpers de resumen corto para badges (RESPONSIVE) ===
  const mapHeat = filters.hasHeatmap === null ? "Todos" : filters.hasHeatmap ? "Con" : "Sin";
  const mapHeatActive = filters.hasHeatmap !== null;

  const mapReport =
    filters.reportState === null
      ? "Todos"
      : filters.reportState === "sin_informe"
      ? "Sin inf."
      : filters.reportState === "borrador"
      ? "Borrador"
      : "Final";
  const mapReportActive = filters.reportState !== null;

  const mapHall = filters.hallazgos.length ? `${filters.hallazgos.length}` : "Todos";
  const mapHallActive = filters.hallazgos.length > 0;

  const mapConf =
    filters.minConfidence != null ? `Conf ≥ ${filters.minConfidence}%` : "Conf: —";
  const mapConfActive = filters.minConfidence != null;

  return (
    <div className="space-y-4">
      {/* KPIs Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4" /> Estudios analizados con IA
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">
              {loadingStats ? "…" : stats?.total_estudios_ia ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">
              total en el rango seleccionado
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Hallazgo más frecuente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">
              {loadingStats ? "…" : stats?.top_clases?.[0]?.clase ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {loadingStats
                ? ""
                : stats?.top_clases?.[0]
                ? `${stats.top_clases[0].count} apariciones`
                : "sin datos"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Último análisis
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">
              {rows[0]?.creado_en
                ? new Date(rows[0].creado_en).toLocaleDateString()
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {rows[0]?.clase_top1 ?? ""}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick ranges + actions */}
      <div className="flex flex-wrap items-center gap-2">
        {quickRanges.map((r) => {
          const active =
            (r.days == null && !filters.from && !filters.to) ||
            (r.days != null &&
              filters.from === isoDateNDaysAgo(r.days) &&
              filters.to === new Date().toISOString().slice(0, 10));
          return (
            <Button
              key={r.key}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => applyQuickRange(r.key)}
            >
              {r.label}
            </Button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
          <Button size="sm" onClick={onExport} disabled={isFetching || total === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        {/* Header con resumen RESPONSIVE (wrap + textos cortos) */}
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ListFilter className="h-4 w-4" /> Filtros
            </CardTitle>
            <div className="flex flex-wrap gap-1.5 sm:ml-auto">
              <Badge variant={mapHeatActive ? "default" : "outline"} className="text-[11px]">
                Mapa: {mapHeat.toLowerCase()}
              </Badge>
              <Badge variant={mapReportActive ? "default" : "outline"} className="text-[11px]">
                Inf: {mapReport.toLowerCase()}
              </Badge>
              <Badge variant={mapHallActive ? "default" : "outline"} className="text-[11px]">
                Hall: {mapHall}
              </Badge>
              <Badge variant={mapConfActive ? "default" : "outline"} className="text-[11px]">
                {mapConf}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <ResultsFilters
            value={filters}
            onChange={(f) => {
              setPage(1);
              setFilters(f);
            }}
            dense={dense}
            onToggleDense={() => setDense((d) => !d)}
            // Puedes pasar iaMeta?.classes si las tienes aquí
            // classOptions={iaMeta?.classes ?? []}
          />

          <Separator />

          <ResultsTable
            loading={isLoading || isFetching}
            dense={dense}
            rows={rows}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(ps) => {
              setPage(1);
              setPageSize(ps);
            }}
            orderBy={orderBy}
            onOrderByChange={setOrderBy}
            onOpenRow={(fileId) => setOpenFileId(fileId)}
          />
        </CardContent>
      </Card>

      <ResultDrawer
        fileId={openFileId}
        onOpenChange={(open) => !open && setOpenFileId(null)}
      />
    </div>
  );
}
