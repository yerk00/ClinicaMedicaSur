import React from "react";

interface MedicalRecord {
  enfermedades_cronicas?: string | null;
  alergias?: string | null;
  medicacion_actual?: string | null;
  cirugias_previas?: string | null;
  grupo_sanguineo?: string | null;
  transfusiones_previas?: boolean | null;
  transfusiones_detalle?: string | null;
  antecedentes_familiares?: string | null;
  consumo_sustancias?: string | null;
  actividad_fisica?: string | null;
  vacunas?: string | null;
  created_at?: string | null;
}

interface Props {
  record: MedicalRecord;
}

export default function MedicalRecordCard({ record }: Props) {
  const yesNo = (v?: boolean | null) => (v == null ? "—" : v ? "Sí" : "No");

  const formatDate = (d?: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  };

  return (
    <article className="w-full max-w-full rounded-2xl border border-border bg-card p-3 shadow-sm">
      {/* Header: compact with small avatar + title + actions */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border px-2 py-[3px] text-[11px] text-muted-foreground md:inline">Resumen</span>
          {/* small chevron that does nothing (purely visual) */}
        </div>
      </header>

      {/* Top summary row (condensed chips) */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="truncate rounded-md border px-2 py-2 text-xs">
          <div className="text-[10px] text-muted-foreground">Grupo sanguíneo</div>
          <div className="font-medium">{record.grupo_sanguineo || "—"}</div>
        </div>

        <div className="truncate rounded-md border px-2 py-2 text-xs">
          <div className="text-[10px] text-muted-foreground">Transfusiones</div>
          <div className="font-medium">{yesNo(record.transfusiones_previas)}</div>
        </div>

        <div className="col-span-2 truncate rounded-md border px-2 py-2 text-xs">
          <div className="text-[10px] text-muted-foreground">Detalle transfusiones</div>
          <div className="font-medium truncate">{record.transfusiones_detalle || "—"}</div>
        </div>
      </div>

      <hr className="my-3 border-t border-border/60" />

      {/* Collapsible sections using native <details> to keep behavior simple and accessible */}
      <div className="space-y-2 text-sm">
        <details className="group rounded-lg border p-2">
          <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M2 5a2 2 0 012-2h2a2 2 0 012 2v1H4a2 2 0 00-2 2v2h2V8h4v4H6v2h2a2 2 0 012 2v1a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
                <path d="M12 6h6v8h-6z" />
              </svg>
              <span className="text-xs font-semibold text-foreground">Condiciones & Alergias</span>
              <span className="ml-1 rounded-md bg-muted-foreground/5 px-2 py-[2px] text-[11px] text-muted-foreground">Compacto</span>
            </div>
            <div className="text-xs text-muted-foreground">{record.enfermedades_cronicas ? "Expandir" : "Sin datos"}</div>
          </summary>

          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div className="rounded-md border p-2 text-xs">
              <div className="text-[10px] text-muted-foreground">Enfermedades crónicas</div>
              <div className="mt-1 font-medium break-words text-sm">{record.enfermedades_cronicas || "—"}</div>
            </div>

            <div className="rounded-md border p-2 text-xs">
              <div className="text-[10px] text-muted-foreground">Alergias</div>
              <div className="mt-1 font-medium break-words text-sm">{record.alergias || "—"}</div>
            </div>

            <div className="md:col-span-2 rounded-md border p-2 text-xs">
              <div className="text-[10px] text-muted-foreground">Medicación actual</div>
              <div className="mt-1 font-medium break-words text-sm">{record.medicacion_actual || "—"}</div>
            </div>
          </div>
        </details>

        <details className="group rounded-lg border p-2">
          <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M10 2a2 2 0 00-2 2v2H4v8h12V6h-4V4a2 2 0 00-2-2z" />
              </svg>
              <span className="text-xs font-semibold text-foreground">Antecedentes & Estilo</span>
            </div>
            <div className="text-xs text-muted-foreground">{record.cirugias_previas ? "Expandir" : "Sin datos"}</div>
          </summary>

          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div className="rounded-md border p-2 text-xs">
              <div className="text-[10px] text-muted-foreground">Cirugías previas</div>
              <div className="mt-1 font-medium break-words text-sm">{record.cirugias_previas || "—"}</div>
            </div>

            <div className="rounded-md border p-2 text-xs">
              <div className="text-[10px] text-muted-foreground">Antecedentes familiares</div>
              <div className="mt-1 font-medium break-words text-sm">{record.antecedentes_familiares || "—"}</div>
            </div>

            <div className="rounded-md border p-2 text-xs">
              <div className="text-[10px] text-muted-foreground">Consumo sustancias</div>
              <div className="mt-1 font-medium break-words text-sm">{record.consumo_sustancias || "—"}</div>
            </div>

            <div className="rounded-md border p-2 text-xs">
              <div className="text-[10px] text-muted-foreground">Actividad física</div>
              <div className="mt-1 font-medium break-words text-sm">{record.actividad_fisica || "—"}</div>
            </div>

            <div className="md:col-span-2 rounded-md border p-2 text-xs">
              <div className="text-[10px] text-muted-foreground">Vacunas</div>
              <div className="mt-1 font-medium break-words text-sm">{record.vacunas || "—"}</div>
            </div>
          </div>
        </details>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div>Registrado el {formatDate(record.created_at)}</div>
        <div className="hidden items-center gap-2 sm:flex">
        </div>
      </div>
    </article>
  );
}
