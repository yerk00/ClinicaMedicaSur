"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search, Stethoscope, Biohazard, FileText, Undo2, ListFilter } from "lucide-react";

export type FiltersState = {
  from: string | null;
  to: string | null;
  search: string;               // Nombre del estudio/archivo
  hallazgos: string[];          // Clases del modelo
  minConfidence: number | null; // 0–100 %
  reportState: "borrador" | "final" | "sin_informe" | null;
  hasHeatmap: boolean | null;   // null=todos, true=con, false=sin
};

export const defaultFiltersState: FiltersState = {
  from: null,
  to: null,
  search: "",
  hallazgos: [],
  minConfidence: 50,
  reportState: null,
  hasHeatmap: null,
};

type Props = {
  value: FiltersState;
  onChange: (next: FiltersState) => void;
  dense?: boolean;
  onToggleDense?: () => void;
  classOptions?: string[] | null;
  maxQuickChips?: number;
};

export function ResultsFilters({
  value,
  onChange,
  dense,
  onToggleDense,
  classOptions,
  maxQuickChips = 12,
}: Props) {
  const set = (patch: Partial<FiltersState>) => onChange({ ...value, ...patch });

  const hallazgosText = useMemo(() => value.hallazgos.join(", "), [value.hallazgos]);

  const toggleHallazgo = (h: string) => {
    const key = h.toLowerCase();
    const exists = value.hallazgos.some((x) => x.toLowerCase() === key);
    set({
      hallazgos: exists
        ? value.hallazgos.filter((x) => x.toLowerCase() !== key)
        : [...value.hallazgos, h],
    });
  };

  const quickChips = useMemo(() => {
    const opts = Array.isArray(classOptions) ? classOptions : [];
    return opts.slice().sort((a, b) => a.localeCompare(b)).slice(0, maxQuickChips);
  }, [classOptions, maxQuickChips]);

  const confidenceEnabled = value.minConfidence != null;

  // Atajos:
  const applyPresetAll = () => {
    onChange({ ...defaultFiltersState });
  };
  const applyPresetCritical = () => {
    set({ minConfidence: 80, hasHeatmap: true, reportState: null });
  };
  const applyPresetPending = () => {
    set({ reportState: "sin_informe", hasHeatmap: null });
  };
  const applyPresetFinal = () => {
    set({ reportState: "final", hasHeatmap: null });
  };

  return (
    <div className="space-y-4">
      {/* Búsqueda + fechas (responsivo) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">
        <div className="space-y-1 min-w-0">
          <Label htmlFor="f-search">Buscar estudio</Label>
          <div className="relative min-w-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="f-search"
              className="pl-8"
              placeholder="Nombre del archivo o estudio…"
              value={value.search}
              onChange={(e) => set({ search: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-from">Desde</Label>
          <Input
            id="f-from"
            type="date"
            value={value.from ?? ""}
            onChange={(e) => set({ from: e.target.value || null })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-to">Hasta</Label>
          <Input
            id="f-to"
            type="date"
            value={value.to ?? ""}
            onChange={(e) => set({ to: e.target.value || null })}
          />
        </div>
      </div>

      {/* Hallazgos */}
      <div className="space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <Label>Hallazgos (clases del modelo)</Label>
          {value.hallazgos.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              Seleccionados: <b>{value.hallazgos.length}</b>
            </span>
          ) : null}
        </div>

        {quickChips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {quickChips.map((h) => {
              const active = value.hallazgos.some((x) => x.toLowerCase() === h.toLowerCase());
              return (
                <Button
                  key={h}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => toggleHallazgo(h)}
                  className="capitalize"
                  aria-pressed={active}
                >
                  {h}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            No hay lista de clases disponible para “chips rápidos”.
          </div>
        )}

        <div className="mt-2 min-w-0">
          <Input
            placeholder="Otros hallazgos (separados por coma)"
            aria-label="Agregar hallazgos manualmente"
            value={hallazgosText}
            onChange={(e) =>
              set({
                hallazgos: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          {value.hallazgos.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {value.hallazgos.map((h) => (
                <Badge key={h} variant="secondary" className="capitalize">
                  {h}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Controles clínicos y de presentación */}
      <Card className="border-muted/70">
        <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Confianza mínima con switch */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="f-conf">Confianza mínima (%)</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={confidenceEnabled}
                  onCheckedChange={(on) =>
                    set({ minConfidence: on ? (value.minConfidence ?? 50) : null })
                  }
                />
                <span className="text-xs text-muted-foreground">Aplicar</span>
              </div>
            </div>
            <Slider
              id="f-conf"
              value={[value.minConfidence ?? 50]}
              min={0}
              max={100}
              step={1}
              onValueChange={(vals) =>
                set({ minConfidence: confidenceEnabled ? vals?.[0] ?? 50 : null })
              }
              disabled={!confidenceEnabled}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {confidenceEnabled ? `${value.minConfidence ?? 50}%` : "— (sin filtro)"}
            </div>
          </div>

          {/* Estado del informe */}
          <div className="space-y-1">
            <Label>Estado del informe</Label>
            <Select
              value={value.reportState ?? "any"}
              onValueChange={(v) => set({ reportState: v === "any" ? null : (v as any) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Todos</SelectItem>
                <SelectItem value="final">Final</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="sin_informe">Sin informe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mapa térmico tri-estado */}
          <div className="space-y-1">
            <Label>Mapa térmico</Label>
            <ToggleGroup
              type="single"
              value={value.hasHeatmap === null ? "all" : value.hasHeatmap ? "with" : "without"}
              onValueChange={(v) => {
                if (!v) return;
                if (v === "all") set({ hasHeatmap: null });
                else if (v === "with") set({ hasHeatmap: true });
                else set({ hasHeatmap: false });
              }}
              className="mt-1"
            >
              <ToggleGroupItem value="all">Todos</ToggleGroupItem>
              <ToggleGroupItem value="with">Con</ToggleGroupItem>
              <ToggleGroupItem value="without">Sin</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Densidad + reset */}
          <div className="flex items-center justify-between gap-3 border rounded-md px-3 py-2">
            <span className="text-sm">Densidad de filas</span>
            <div className="flex items-center gap-2">
              <Button
                variant={dense ? "default" : "outline"}
                size="sm"
                onClick={onToggleDense}
                aria-pressed={dense}
              >
                {dense ? "Compacta" : "Normal"}
              </Button>
              <Button variant="ghost" size="sm" onClick={applyPresetAll} title="Todos">
                <ListFilter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onChange({ ...defaultFiltersState })} title="Resetear">
                <Undo2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Atajos claros (incluye “Todos”) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Atajos rápidos:</span>
        <Button size="sm" variant="outline" onClick={applyPresetAll} className="gap-1" title="Mostrar todos (limpiar filtros)">
          <ListFilter className="h-4 w-4" /> Todos
        </Button>
        <Button size="sm" variant="outline" onClick={applyPresetCritical} className="gap-1" title="≥80% y con mapa térmico">
          <Biohazard className="h-4 w-4" /> Crítico
        </Button>
        <Button size="sm" variant="outline" onClick={applyPresetPending} className="gap-1" title="Estudios sin informe">
          <Stethoscope className="h-4 w-4" /> Pendientes
        </Button>
        <Button size="sm" variant="outline" onClick={applyPresetFinal} className="gap-1" title="Solo informes finales">
          <FileText className="h-4 w-4" /> Finales
        </Button>
      </div>
    </div>
  );
}
