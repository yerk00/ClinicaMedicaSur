// web/components/ia/StudiesPanel.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarIcon } from "lucide-react";
import type { FileLite } from "@/lib/historyDetails";

export default function StudiesPanel({
  files,
  count,
  loading,
  page,
  pageSize,
  from,
  to,
  q,
  onChangeFrom,
  onChangeTo,
  onChangeQ,
  onApply,
  onPrev,
  onNext,
  onSelectFile,
  activeFileId,
}: {
  files: FileLite[];
  count: number;
  loading: boolean;
  page: number;
  pageSize: number;
  from: string;
  to: string;
  q: string;
  onChangeFrom: (s: string) => void;
  onChangeTo: (s: string) => void;
  onChangeQ: (s: string) => void;
  onApply: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSelectFile: (f: FileLite) => void;
  activeFileId: string | null;
}) {
  return (
    <Card className="border-cyan-100 shadow-sm min-w-0 self-start" role="complementary" aria-label="Imágenes del paciente">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Imágenes del paciente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 min-w-0">
        <div
          className="grid grid-cols-2 gap-2"
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply();
          }}
        >
          <Input
            type="date"
            value={from}
            onChange={(e) => onChangeFrom(e.target.value)}
            aria-label="Desde"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => onChangeTo(e.target.value)}
            aria-label="Hasta"
          />
          <div className="col-span-2 flex gap-2">
            <Input
              placeholder="Buscar por nombre/tag…"
              value={q}
              onChange={(e) => onChangeQ(e.target.value)}
              aria-label="Buscar archivos"
            />
            <Button variant="outline" size="sm" onClick={onApply} className="cursor-pointer">
              Aplicar
            </Button>
          </div>
        </div>

        <Separator className="my-1" />

        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando imágenes…</div>
        ) : !files.length ? (
          <div className="text-xs text-muted-foreground">No hay archivos con los filtros actuales.</div>
        ) : (
          <div className="max-h-[66vh] overflow-auto pr-1 space-y-2 min-w-0" role="list">
            {files.map((f) => {
              const active = f.id === activeFileId;
              return (
                <button
                  key={f.id}
                  onClick={() => onSelectFile(f)}
                  role="listitem"
                  className={`w-full text-left p-2 rounded-md border transition hover:bg-accent/50 ${
                    active ? "border-cyan-600 ring-1 ring-cyan-600 bg-cyan-50/40 dark:bg-cyan-950/20" : ""
                  }`}
                  title={f.filename}
                >
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {f.uploaded_at ? new Date(f.uploaded_at).toLocaleString() : "—"}
                  </div>
                  <div className="text-sm font-medium truncate">{f.filename}</div>
                  <div className="text-[11px] text-muted-foreground">{f.file_type || "—"}</div>
                  {!!f.diagnosis_ia && (
                    <div className="mt-1 text-[11px] line-clamp-2">{f.diagnosis_ia}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="pt-2 flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            {count} resultado{count === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
              Prev
            </Button>
            <div>Pág. {page}</div>
            <Button
              variant="outline"
              size="sm"
              disabled={page * pageSize >= count}
              onClick={onNext}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
