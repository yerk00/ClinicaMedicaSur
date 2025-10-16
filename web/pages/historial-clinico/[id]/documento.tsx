// web/pages/historial-clinico/[id]/documento.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import {
  getPatientProfile,
  getMedicalRecordByUserIdLite,
  getConsultationsPage,
  getRadiographsOfDay,
  ConsultationLite,
  PatientProfile,
  MedicalRecordLite,
  FileLite,
} from "@/lib/historyDetails";
import { generateConsultationReportPDF } from "@/lib/clinicalReport";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Calendar as CalendarIcon,
  Loader2,
  SortAsc,
  SortDesc,
  ChevronLeft,
  Download,
  ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 200;

export default function ClinicalDocumentView() {
  const router = useRouter();
  const { id, cid } = router.query as { id?: string; cid?: string };

  // Guard de sesión
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.replace("/auth/login");
    })();
  }, [router]);

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [record, setRecord] = useState<MedicalRecordLite | null>(null);
  const [consults, setConsults] = useState<ConsultationLite[]>([]);
  const [countC, setCountC] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => consults.find((c) => c.id === selectedId) || null,
    [consults, selectedId]
  );

  const [rxLoading, setRxLoading] = useState(false);
  const [radiographs, setRadiographs] = useState<FileLite[]>([]);
  const [previewRx, setPreviewRx] = useState<FileLite | null>(null);

  // Inicial
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        try {
          localStorage.setItem("targetProfileId", id);
        } catch {}

        const [pf, mr, cPage] = await Promise.all([
          getPatientProfile(id),
          getMedicalRecordByUserIdLite(id),
          getConsultationsPage(id, 1, PAGE_SIZE),
        ]);
        setProfile(pf);
        setRecord(mr);
        setConsults(cPage.data);
        setCountC(cPage.count);

        const initial =
          (cid && cPage.data.find((x) => x.id === cid)?.id) ||
          (cPage.data[0]?.id ?? null);
        setSelectedId(initial || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, cid]);

  const filteredConsults = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = consults.filter((c) => {
      if (!q) return true;
      return (
        (c.motivo_consulta || "").toLowerCase().includes(q) ||
        (c.diagnostico_inicial || "").toLowerCase().includes(q) ||
        (c.diagnostico_final || "").toLowerCase().includes(q) ||
        (c.servicio || "").toLowerCase().includes(q)
      );
    });
    if (fromDate)
      arr = arr.filter(
        (c) => new Date(c.fecha_hora) >= new Date(`${fromDate}T00:00:00`)
      );
    if (toDate)
      arr = arr.filter(
        (c) => new Date(c.fecha_hora) <= new Date(`${toDate}T23:59:59`)
      );
    arr.sort((a, b) =>
      sortOrder === "desc"
        ? +new Date(b.fecha_hora) - +new Date(a.fecha_hora)
        : +new Date(a.fecha_hora) - +new Date(b.fecha_hora)
    );
    return arr;
  }, [consults, search, sortOrder, fromDate, toDate]);

  // Mantener selección válida
  useEffect(() => {
    if (!filteredConsults.length) return;
    if (!selectedId || !filteredConsults.some((c) => c.id === selectedId)) {
      setSelectedId(filteredConsults[0].id);
    }
  }, [filteredConsults, selectedId]);

  // Cargar RX del día al cambiar de consulta
  useEffect(() => {
    (async () => {
      if (!profile || !selected) return;
      setRxLoading(true);
      try {
        const rx = await getRadiographsOfDay(profile.id, selected.fecha_hora);
        setRadiographs(rx);
      } finally {
        setRxLoading(false);
      }
    })();
  }, [profile, selected]);

  async function handlePDF() {
    if (!profile || !selected) return;
    await generateConsultationReportPDF({
      patient: profile,
      record,
      consult: selected,
      radiographs,
      logoUrl: "/images/clinica.png",
      institutionName: "Clínica Medica Sur",
    });
  }

  const yesNo = (v?: boolean | null) => (v == null ? "—" : v ? "Sí" : "No");

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-md rounded-xl border bg-card/50 p-5 text-muted-foreground backdrop-blur-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando vista de historia…
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-md rounded-xl border bg-card/50 p-5 text-muted-foreground backdrop-blur-sm">
          No se encontró el paciente.
        </div>
      </div>
    );
  }

  // Fallback de edad calculada en cliente si el API no la trae
  const edadCalculada =
    (profile as any)?.fecha_nacimiento
      ? Math.floor(
          (Date.now() - new Date((profile as any).fecha_nacimiento).getTime()) /
            31557600000
        )
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50/60 via-background to-background">
      <div className="container mx-auto px-3 py-5">
        {/* Top bar */}
        <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-white/60 dark:bg-card/60 backdrop-blur p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/home?id=${id}`)} // Volver al HOME del paciente
                className="cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Volver al paciente
              </Button>
              <div className="flex items-center gap-3 pl-1">
                <Image
                  src={profile.avatar_url || "/avatar-default.png"}
                  alt={profile.full_name || "Paciente"}
                  width={44}
                  height={44}
                  className="rounded-full object-cover ring-2 ring-cyan-200"
                />
                <div>
                  <div className="font-semibold leading-tight">
                    {profile.full_name || "Paciente sin nombre"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {profile.email || "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePDF}
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-1" />
                Descargar PDF
              </Button>
            </div>
          </div>

          {/* Datos de identificación y contacto (nuevos campos) */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-[11.5px] text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">CI:</span>{" "}
              {(profile as any).ci ?? "—"}
            </div>
            <div>
              <span className="font-medium text-foreground">Sexo:</span>{" "}
              {(profile as any).sexo_genero ?? "—"}
            </div>
            <div className="col-span-2 md:col-span-2">
              <span className="font-medium text-foreground">Nacimiento:</span>{" "}
              {(profile as any).fecha_nacimiento
                ? new Date((profile as any).fecha_nacimiento).toLocaleDateString()
                : "—"}
              {typeof (profile as any).edad === "number"
                ? `  (${(profile as any).edad} años)`
                : edadCalculada !== null
                ? `  (${edadCalculada} años)`
                : ""}
            </div>
            <div className="col-span-2 md:col-span-1">
              <span className="font-medium text-foreground">Tel.:</span>{" "}
              {(profile as any).telefono ?? "—"}
            </div>
            <div className="col-span-2 md:col-span-2">
              <span className="font-medium text-foreground">Dirección:</span>{" "}
              {(profile as any).direccion ?? "—"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-5">
          {/* Sidebar */}
          <Card className="h-full border-cyan-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Consultas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Buscar (motivo, dx, servicio)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSortOrder((s) => (s === "desc" ? "asc" : "desc"))
                  }
                  className="cursor-pointer"
                  title="Cambiar orden"
                >
                  {sortOrder === "desc" ? (
                    <SortDesc className="h-4 w-4" />
                  ) : (
                    <SortAsc className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              <Separator className="my-1" />

              <div className="max-h-[66vh] overflow-auto pr-1 space-y-2">
                {filteredConsults.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left p-2 rounded-md border transition hover:bg-accent/50
                        ${
                          active
                            ? "border-cyan-600 ring-1 ring-cyan-600 bg-cyan-50/40 dark:bg-cyan-950/20"
                            : ""
                        }`}
                      title={new Date(c.fecha_hora).toLocaleString()}
                    >
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {new Date(c.fecha_hora).toLocaleString()}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {c.servicio || "—"}
                      </div>
                      <div className="text-xs truncate">{c.motivo_consulta || "—"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        Dx: {c.diagnostico_final || c.diagnostico_inicial || "—"}
                      </div>
                    </button>
                  );
                })}
                {!filteredConsults.length && (
                  <div className="text-xs text-muted-foreground">
                    No hay consultas con los filtros aplicados.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main documento */}
          <Card className="border-cyan-100 shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">
                Historia clínica – Reporte de consulta
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {!selected ? (
                <div className="text-sm text-muted-foreground">
                  Selecciona una consulta en la lista.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground">
                    <div>
                      Fecha/Hora:{" "}
                      <span className="text-foreground">
                        {new Date(selected.fecha_hora).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      Servicio:{" "}
                      <span className="text-foreground">
                        {selected.servicio || "—"}
                      </span>
                    </div>
                  </div>
                  <Separator className="my-3" />

                  {/* I. FILIACIÓN */}
                  <SectionTitle title="I. FILIACIÓN" />
                  <Field label="Nombre:" value={profile.full_name || "—"} />
                  <Field label="Email:" value={profile.email || "—"} />
                  <Separator className="my-3" />

                  {/* II. ANTECEDENTES PERSONALES Y MÉDICOS */}
                  <SectionTitle title="II. ANTECEDENTES PERSONALES Y MÉDICOS" />
                  <Field
                    label="Grupo sanguíneo:"
                    value={(record as any)?.grupo_sanguineo || "—"}
                  />
                  <Field
                    label="Transfusiones previas:"
                    value={yesNo((record as any)?.transfusiones_previas)}
                  />
                  <Field
                    label="Detalle de transfusiones:"
                    value={(record as any)?.transfusiones_detalle || "—"}
                  />
                  <Field
                    label="Enfermedades crónicas:"
                    value={(record as any)?.enfermedades_cronicas || "—"}
                  />
                  <Field label="Alergias:" value={(record as any)?.alergias || "—"} />
                  <Field
                    label="Medicación actual:"
                    value={(record as any)?.medicacion_actual || "—"}
                  />
                  <Field
                    label="Cirugías previas:"
                    value={(record as any)?.cirugias_previas || "—"}
                  />
                  <Field
                    label="Antecedentes familiares:"
                    value={(record as any)?.antecedentes_familiares || "—"}
                  />
                  <Field
                    label="Consumo de sustancias:"
                    value={(record as any)?.consumo_sustancias || "—"}
                  />
                  <Field
                    label="Actividad física:"
                    value={(record as any)?.actividad_fisica || "—"}
                  />
                  <Field label="Vacunas:" value={(record as any)?.vacunas || "—"} />
                  <Separator className="my-3" />

                  {/* III. MOTIVO DE CONSULTA */}
                  <SectionTitle title="III. MOTIVO DE CONSULTA" />
                  <Paragraph text={selected.motivo_consulta || "—"} />
                  <Separator className="my-3" />

                  {/* IV. ENFERMEDAD ACTUAL */}
                  <SectionTitle title="IV. ENFERMEDAD ACTUAL" />
                  <Paragraph text={selected.historia_enfermedad_actual || "—"} />
                  <Separator className="my-3" />

                  {/* V. EXAMEN FÍSICO */}
                  <SectionTitle title="V. EXAMEN FÍSICO" />
                  <Paragraph text={selected.examen_fisico || "—"} />
                  <Separator className="my-3" />

                  {/* VI. ESTUDIOS SOLICITADOS */}
                  <SectionTitle title="VI. ESTUDIOS SOLICITADOS" />
                  <Paragraph
                    text={
                      (selected as any).estudios_solicitados?.length
                        ? (selected as any).estudios_solicitados.join(", ")
                        : "—"
                    }
                  />
                  <Separator className="my-3" />

                  {/* VII. DIAGNÓSTICO */}
                  <SectionTitle title="VII. DIAGNÓSTICO" />
                  <Field
                    label="Inicial:"
                    value={selected.diagnostico_inicial || "—"}
                  />
                  <Field label="Final:" value={selected.diagnostico_final || "—"} />
                  <Separator className="my-3" />

                  {/* VIII. CONDUCTA / TRATAMIENTO */}
                  <SectionTitle title="VIII. CONDUCTA / TRATAMIENTO" />
                  <Paragraph text={selected.conducta_tratamiento || "—"} />
                  <Separator className="my-3" />

                  {/* IX. MÉDICO RESPONSABLE */}
                  <SectionTitle title="IX. MÉDICO RESPONSABLE" />
                  <Paragraph text={selected.medico_responsable || "—"} />
                  <Separator className="my-3" />

                  {/* X. RADIOGRAFÍAS DEL DÍA */}
                  <SectionTitle title="X. RADIOGRAFÍAS DEL DÍA" />
                  {rxLoading ? (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando imágenes…
                    </div>
                  ) : radiographs.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      — No se registran imágenes en esta fecha —
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {radiographs.map((rx) => (
                        <div
                          key={rx.id}
                          className="border rounded-lg p-3 flex items-start gap-3 bg-white/60 dark:bg-card/60"
                        >
                          <button
                            onClick={() => setPreviewRx(rx)}
                            className="shrink-0 cursor-zoom-in group relative"
                            title="Ampliar"
                          >
                            <Image
                              src={rx.url}
                              alt={rx.filename}
                              width={220}
                              height={165}
                              className="rounded-md object-cover border shadow-sm group-hover:shadow-md transition"
                            />
                            <span className="absolute bottom-1 right-1 hidden group-hover:flex text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                              Ampliar
                            </span>
                          </button>

                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {rx.filename}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {rx.uploaded_at
                                ? new Date(rx.uploaded_at).toLocaleString()
                                : "—"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {rx.file_type || "—"}
                              {rx.tags?.length ? ` · ${rx.tags.join(", ")}` : ""}
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <a
                                href={rx.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[12px] text-cyan-700 hover:underline inline-flex items-center gap-1"
                              >
                                Abrir imagen <ChevronRight className="h-3 w-3" />
                              </a>
                              {/* Diagnóstico (IA) → detalle del archivo */}
                              <a
                                href={`/files/${rx.id}`}
                                className="text-[12px] text-emerald-700 hover:underline inline-flex items-center gap-1"
                                title="Abrir la radiografía con IA"
                              >
                                Diagnóstico (IA) <ChevronRight className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview full-screen */}
      {previewRx && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewRx(null)}
        >
          <div className="max-w-6xl max-h-[92vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewRx.url}
              alt={previewRx.filename}
              className="max-w-full max-h-[92vh] rounded shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= helpers UI ======================= */

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-1.5 h-4 bg-cyan-600 rounded" />
      <div className="text-sm font-semibold tracking-wide">{title}</div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <span className="font-medium text-foreground/90">{label}</span>{" "}
      <span className="text-foreground">{value}</span>
    </div>
  );
}
function Paragraph({ text }: { text: string }) {
  return <div className="text-sm whitespace-pre-wrap leading-relaxed">{text}</div>;
}
