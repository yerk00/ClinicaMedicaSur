// web/components/ia/results/Table.tsx
"use client";

import { IaResultRow, IaResultsOrderBy } from "@/lib/iaResults";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

type Props = {
  loading: boolean;
  dense?: boolean;
  rows: IaResultRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  orderBy: IaResultsOrderBy;
  onOrderByChange: (o: IaResultsOrderBy) => void;
  onOpenRow: (fileId: string) => void;
};

export function ResultsTable({
  loading,
  dense = false,
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  orderBy,
  onOrderByChange,
  onOpenRow,
}: Props) {
  const pageCount = Math.max(1, Math.ceil((total || 0) / Math.max(1, pageSize)));

  return (
    <div className="space-y-3">
      {/* Header de controles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {loading ? "Cargando..." : `${total} resultado(s)`} • Orden:&nbsp;
          <Select
            value={orderBy}
            onValueChange={(v) => onOrderByChange(v as IaResultsOrderBy)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Más recientes</SelectItem>
              <SelectItem value="date_asc">Más antiguos</SelectItem>
              <SelectItem value="prob_desc">Prob. top1 (desc)</SelectItem>
              <SelectItem value="prob_asc">Prob. top1 (asc)</SelectItem>
              <SelectItem value="filename_asc">Archivo (A–Z)</SelectItem>
              <SelectItem value="filename_desc">Archivo (Z–A)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filas por página:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
              aria-label="Primera página"
            >
              «
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
            >
              ‹
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {page} / {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pageCount}
              aria-label="Página siguiente"
            >
              ›
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(pageCount)}
              disabled={page >= pageCount}
              aria-label="Última página"
            >
              »
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className={dense ? "h-10" : ""}>
              <TableHead>Fecha</TableHead>
              <TableHead>Archivo</TableHead>
              <TableHead>Top-1</TableHead>
              <TableHead className="text-right">Prob.</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Heatmap</TableHead>
              <TableHead>Informe</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-10"
                >
                  No hay resultados para los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : null}

            {rows.map((r) => {
              const fecha = r.creado_en ? new Date(r.creado_en) : null;
              const prob = typeof r.prob_top1 === "number" ? r.prob_top1 : null;
              const probPct =
                prob != null ? Math.max(0, Math.min(100, prob * 100)) : null;

              return (
                <TableRow
                  key={r.inference_id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 transition-colors",
                    dense ? "h-10" : "h-[56px]"
                  )}
                  onClick={() => onOpenRow(r.file_id)}
                >
                  {/* Fecha */}
                  <TableCell className="whitespace-nowrap">
                    {fecha ? fecha.toLocaleString() : "—"}
                  </TableCell>

                  {/* Archivo + tags */}
                  <TableCell className="max-w-[320px]">
                    <div
                      className="truncate font-medium"
                      title={r.filename || undefined}
                    >
                      {r.filename || "—"}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(r.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="capitalize">
                          {t}
                        </Badge>
                      ))}
                      {(r.tags ?? []).length > 3 ? (
                        <Badge variant="outline">
                          +{(r.tags ?? []).length - 3}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>

                  {/* Top-1 */}
                  <TableCell className="capitalize">
                    {r.clase_top1 ?? "—"}
                  </TableCell>

                  {/* Probabilidad */}
                  <TableCell className="text-right">
                    {prob != null ? (
                      <div className="inline-flex flex-col items-end gap-1">
                        <div
                          className={cn(
                            "text-sm tabular-nums",
                            prob >= 0.5 ? "font-semibold" : "text-muted-foreground"
                          )}
                          title={`${(prob * 100).toFixed(1)}%`}
                        >
                          {prob.toFixed(3)}
                        </div>
                        <div className="w-24 h-1.5 bg-muted/60 rounded overflow-hidden">
                          <div
                            className="h-1.5 bg-primary/80"
                            style={{ width: `${probPct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>

                  {/* Modelo */}
                  <TableCell>
                    <div className="text-sm">{r.modelo_nombre || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.modelo_version ? `v${r.modelo_version}` : ""}
                    </div>
                  </TableCell>

                  {/* Heatmap */}
                  <TableCell>
                    {r.has_heatmap ? (
                      <Badge>sí</Badge>
                    ) : (
                      <Badge variant="outline">no</Badge>
                    )}
                  </TableCell>

                  {/* Informe */}
                  <TableCell>
                    {r.report_state ? (
                      <Badge
                        variant={
                          r.report_state === "final" ? "default" : "secondary"
                        }
                        className="capitalize"
                      >
                        {r.report_state}
                      </Badge>
                    ) : (
                      <Badge variant="outline">sin informe</Badge>
                    )}
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRow(r.file_id);
                      }}
                      aria-label="Ver detalle"
                    >
                      <Eye className="h-4 w-4 mr-1" /> Ver
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {loading && rows.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
