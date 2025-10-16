"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Stethoscope,
  Activity,
  AlertTriangle,
  Pill,
  Syringe,
  HeartPulse,
  User,
} from "lucide-react";
import MedicalRecordForm from "@/components/medical/MedicalRecordForm";

// shadcn/ui Dialog
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader as DialogH,
  DialogTitle as DialogT,
  DialogDescription as DialogD,
  DialogFooter as DialogF,
} from "@/components/ui/dialog";

/* ---------- helpers ---------- */
type Props = {
  userName: string;
  selectedPatientName?: string;
  medicalRecord: any | null;
  patientId?: string | null;
  doctorId?: string | null;
  onRecordSaved?: () => void;
};

function toItems(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string")
    return v
      .split(/[\n,;]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

function Tag({
  children,
  tone = "slate",
  size = "md",
}: {
  children: React.ReactNode;
  tone?: "slate" | "amber" | "green" | "violet";
  size?: "xs" | "md";
}) {
  const toneMap = {
    slate: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    green: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
    violet: "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200",
  } as const;
  const sizeMap = {
    xs: "px-1.5 py-0 text-xs",
    md: "px-2 py-0.5 text-sm",
  } as const;
  return (
    <span className={`inline-flex rounded-md ${toneMap[tone]} ${sizeMap[size]}`}>{children}</span>
  );
}

function Section({
  title,
  icon,
  children,
  variant = "normal",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  variant?: "normal" | "mini";
}) {
  const isMini = variant === "mini";
  return (
    <Card className={`border-slate-200/70 dark:border-slate-700/60 shadow-sm ${isMini ? "min-h-0" : ""}`}>
      <CardHeader className={isMini ? "py-1.5" : "py-2"}>
        <div className="flex items-center gap-2">
          <span className="text-cyan-700 dark:text-cyan-300">{icon}</span>
          <CardTitle className={isMini ? "text-sm font-semibold" : "text-base font-semibold"}>
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent
        className={`${isMini ? "pt-0 pb-1.5" : "pt-0 pb-2"} text-base leading-relaxed text-slate-800 dark:text-slate-100`}
      >
        {children}
      </CardContent>
    </Card>
  );
}

/* ---------- component ---------- */
export default function HeaderAndRecord({
  selectedPatientName,
  medicalRecord,
  patientId,
  doctorId,
  onRecordSaved,
}: Props) {
  const [open, setOpen] = React.useState(false); // controla el Dialog

  // normaliza campos a chips
  const enfermedades = toItems(medicalRecord?.enfermedades_cronicas);
  const alergias = toItems(medicalRecord?.alergias);
  const medicacion = toItems(medicalRecord?.medicacion_actual);
  const cirugias = toItems(medicalRecord?.cirugias_previas);
  const antecedentesFam = toItems(medicalRecord?.antecedentes_familiares);
  const actividad = (medicalRecord?.actividad_fisica as string) || "";
  const consumo = (medicalRecord?.consumo_sustancias as string) || "";
  const vacunas = toItems(medicalRecord?.vacunas);
  const grupoSang = (medicalRecord?.grupo_sanguineo as string) || "";
  const transfPrev = medicalRecord?.transfusiones_previas as boolean | null | undefined;
  const transfDet = (medicalRecord?.transfusiones_detalle as string) || "";

  const titleBtn = medicalRecord ? "Editar registro" : "Crear registro";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Card cabecera */}
        <Card className="overflow-hidden border-0 bg-white/95 shadow-md dark:bg-slate-800/95">
          <div className="h-1 w-full bg-gradient-to-r from-cyan-700 via-cyan-600 to-emerald-600" />
          <CardHeader className="py-3">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-3">
                <FileText className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  Registro médico
                </CardTitle>

                {/* Chip paciente */}
                {selectedPatientName && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/60 bg-white px-3 py-1 text-[13px] shadow-sm dark:border-cyan-800/50 dark:bg-slate-800">
                    <div className="flex items-center justify-center rounded-full border border-cyan-200 text-cyan-700 dark:border-cyan-700/40 dark:text-cyan-300 h-6 w-6">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-slate-600 dark:text-slate-300">Paciente:</span>
                    <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                      {selectedPatientName}
                    </span>
                  </div>
                )}
              </div>

              {/* Trigger del modal */}
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 cursor-pointer"
                    size="sm"
                  >
                    {titleBtn}
                  </Button>
                </DialogTrigger>

                {/* Ventana mediana */}
                <DialogContent className="max-w-2xl sm:max-w-3xl">
                  <DialogH>
                    <DialogT>{titleBtn}</DialogT>
                    <DialogD>
                      {medicalRecord ? "Actualiza los datos del registro médico del paciente." : "Completa los campos para crear un registro médico."}
                    </DialogD>
                  </DialogH>

                  {/* Contenido: el formulario (prefill si hay registro) */}
                  <div className="max-h-[70vh] overflow-auto rounded-md border bg-background p-2">
                    <MedicalRecordForm
                      patientId={patientId as string}
                      doctorId={doctorId as string}
                      existingRecord={medicalRecord ?? undefined}
                      onRecordCreated={() => {
                        onRecordSaved?.();
                        setOpen(false);
                      }}
                    />
                  </div>

                  <DialogF>
                    <Button variant="outline" onClick={() => setOpen(false)} className="ml-auto">
                      Cerrar
                    </Button>
                  </DialogF>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          {/* (Quitamos el inline form para que ahora SIEMPRE sea modal) */}
        </Card>

        {/* GRID 2:1 (solo cuando NO está abierto el modal, para evitar scroll doble raro) */}
        {medicalRecord && !open && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {/* IZQUIERDA */}
            <div className="space-y-3">
              <Section title="Antecedentes médicos" icon={<Stethoscope className="h-5 w-5" />}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Enfermedades crónicas */}
                  <div>
                    <h4 className="mb-1 text-sm font-semibold text-slate-700">Enfermedades crónicas</h4>
                    {enfermedades.length ? (
                      <div className="flex flex-wrap gap-2">
                        {enfermedades.map((e, i) => (
                          <Tag key={i}>{e}</Tag>
                        ))}
                      </div>
                    ) : (
                      <p className="italic text-slate-500">Sin registro</p>
                    )}
                  </div>

                  {/* Cirugías previas */}
                  <div>
                    <h4 className="mb-1 text-sm font-semibold text-slate-700">Cirugías previas</h4>
                    {cirugias.length ? (
                      <div className="flex flex-wrap gap-2">
                        {cirugias.map((c, i) => (
                          <Tag key={i}>{c}</Tag>
                        ))}
                      </div>
                    ) : (
                      <p className="italic text-slate-500">Sin registro</p>
                    )}
                  </div>

                  {/* Antecedentes familiares */}
                  <div className="md:col-span-2">
                    <h4 className="mb-1 text-sm font-semibold text-slate-700">Antecedentes familiares</h4>
                    {antecedentesFam.length ? (
                      <div className="flex flex-wrap gap-2">
                        {antecedentesFam.map((a, i) => (
                          <Tag key={i}>{a}</Tag>
                        ))}
                      </div>
                    ) : (
                      <p className="italic text-slate-500">Sin registro</p>
                    )}
                  </div>

                  {/* Transfusiones */}
                  <div className="md:col-span-2">
                    <h4 className="mb-1 text-sm font-semibold text-slate-700">Transfusiones</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag tone={transfPrev ? "green" : "slate"}>
                        Estado: {transfPrev === true ? "Sí" : transfPrev === false ? "No" : "No especificado"}
                      </Tag>
                      {transfDet ? <Tag tone="violet">{transfDet}</Tag> : null}
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Hábitos y estilo de vida" icon={<Activity className="h-5 w-5" />}>
                <div className="flex flex-wrap gap-2">
                  <Tag>{`Actividad física: ${actividad || "—"}`}</Tag>
                  <Tag>{`Consumo de sustancias: ${consumo || "—"}`}</Tag>
                </div>
              </Section>
            </div>

            {/* DERECHA */}
            <div className="space-y-3">
              {/* MINI: Grupo sanguíneo */}
              <Section title="Grupo sanguíneo" icon={<HeartPulse className="h-5 w-5" />} variant="mini">
                <Tag tone="violet" size="xs">{grupoSang || "—"}</Tag>
              </Section>

              <Section title="Alergias y reacciones" icon={<AlertTriangle className="h-5 w-5" />}>
                {alergias.length ? (
                  <div className="flex flex-wrap gap-2">
                    {alergias.map((a, i) => (
                      <Tag key={i} tone="amber">
                        {a}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <p className="italic text-slate-500">Sin alergias registradas</p>
                )}
              </Section>

              <Section title="Medicaciones actuales" icon={<Pill className="h-5 w-5" />}>
                {medicacion.length ? (
                  <div className="flex flex-wrap gap-2">
                    {medicacion.map((m, i) => (
                      <Tag key={i} tone="green">
                        {m}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <p className="italic text-slate-500">Sin medicación activa</p>
                )}
              </Section>

              <Section title="Vacunas" icon={<Syringe className="h-5 w-5" />}>
                {vacunas.length ? (
                  <div className="flex flex-wrap gap-2">
                    {vacunas.map((v, i) => (
                      <Tag key={i}>{v}</Tag>
                    ))}
                  </div>
                ) : (
                  <p className="italic text-slate-500">Sin registro de vacunas</p>
                )}
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
