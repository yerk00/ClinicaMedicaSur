// web/pages/historial-clinico/[id]/documento.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
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
  Search as SearchIcon,
} from "lucide-react";

const PAGE_SIZE = 200;

export default function ClinicalDocumentView() {
  const router = useRouter();
  const { id, cid } = router.query as { id?: string; cid?: string };

  // ===== Guard de sesión =====
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) router.replace("/auth/login");
    })();
  }, [router]);

  // ===== Estado principal (sin cambios de lógica) =====
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

  // ===== Avatar (mover arriba para respetar el orden de hooks) =====
  const [avatarSrc, setAvatarSrc] = useState<string>(
    (profile?.avatar_url && profile.avatar_url.trim() !== ""
      ? profile.avatar_url
      : "/avatar-default.png") as string
  );
  useEffect(() => {
    setAvatarSrc(
      profile?.avatar_url && profile.avatar_url.trim() !== ""
        ? profile.avatar_url
        : "/avatar-default.png"
    );
  }, [profile]);

  // ===== Inicial (carga de datos) =====
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

  // ===== Filtro + orden =====
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
    if (fromDate) {
      const from = new Date(`${fromDate}T00:00:00`);
      arr = arr.filter((c) => new Date(c.fecha_hora) >= from);
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59`);
      arr = arr.filter((c) => new Date(c.fecha_hora) <= to);
    }
    arr.sort((a, b) =>
      sortOrder === "desc"
        ? +new Date(b.fecha_hora) - +new Date(a.fecha_hora)
        : +new Date(a.fecha_hora) - +new Date(b.fecha_hora)
    );
    return arr;
  }, [consults, search, sortOrder, fromDate, toDate]);

  // ===== Mantener selección válida =====
  useEffect(() => {
    if (!filteredConsults.length) return;
    if (!selectedId || !filteredConsults.some((c) => c.id === selectedId)) {
      setSelectedId(filteredConsults[0].id);
    }
  }, [filteredConsults, selectedId]);

  // ===== Cargar RX del día =====
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

  // ===== Acciones =====
  const handlePDF = useCallback(async () => {
    if (!profile || !selected) return;
    await generateConsultationReportPDF({
      patient: profile,
      record,
      consult: selected,
      radiographs,
      logoUrl: "/images/clinica.png",
      institutionName: "Clínica Medica Sur",
    });
  }, [profile, selected, record, radiographs]);

  const yesNo = (v?: boolean | null) => (v == null ? "—" : v ? "Sí" : "No");

  // ===== UI states tempranos =====
  if (loading) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-xl border bg-card/50 p-5 text-muted-foreground backdrop-blur-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando vista de historia…
        </div>
      </Shell>
    );
  }

  if (!profile) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-xl border bg-card/50 p-5 text-muted-foreground backdrop-blur-sm">
          No se encontró el paciente.
        </div>
      </Shell>
    );
  }

  // ===== Derivados de UI =====
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
        {/* ===== Top bar ===== */}
        <header className="mb-5 flex flex-col gap-3 rounded-xl border bg-white/70 dark:bg-card/60 backdrop-blur p-3 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/home?id=${id}`)}
                className="cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Volver al paciente
              </Button>

              <div className="flex items-center gap-3 pl-1">
                <div className="relative">
                  <Image
                    src={avatarSrc}
                    alt={profile.full_name || "Paciente"}
                    width={44}
                    height={44}
                    onError={() => setAvatarSrc("/avatar-default.png")}
                    className="rounded-full object-cover ring-2 ring-cyan-200 bg-white"
                  />
                  {/* Indicador opcional de estado */}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold leading-tight truncate">
                    {profile.full_name || "Paciente sin nombre"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {profile.email || "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePDF}>
                <Download className="h-4 w-4 mr-1" />
                Descargar PDF
              </Button>
            </div>
          </div>

          {/* Identificación compacta */}
          <dl className="grid grid-cols-2 md:grid-cols-6 gap-2 text-[11.5px] text-muted-foreground">
            <Item label="CI" value={(profile as any).ci ?? "—"} />
            <Item label="Sexo" value={(profile as any).sexo_genero ?? "—"} />
            <Item
              className="col-span-2 md:col-span-2"
              label="Nacimiento"
              value={
                (profile as any).fecha_nacimiento
                  ? new Date(
                      (profile as any).fecha_nacimiento
                    ).toLocaleDateString()
                  : "—"
              }
              extra={
                typeof (profile as any).edad === "number"
                  ? `(${(profile as any).edad} años)`
                  : edadCalculada !== null
                  ? `(${edadCalculada} años)`
                  : ""
              }
            />
            <Item
              className="col-span-2 md:col-span-1"
              label="Tel."
              value={(profile as any).telefono ?? "—"}
            />
            <Item
              className="col-span-2 md:col-span-2"
              label="Dirección"
              value={(profile as any).direccion ?? "—"}
            />
          </dl>
        </header>

        {/* ===== Layout principal ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          {/* ==== Sidebar ==== */}
          <Card className="h-full border-cyan-100 shadow-sm lg:sticky lg:top-4 lg:self-start">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Consultas ({countC})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Search + sort */}
              <div className="flex items-center gap-2">
                <div className="relative w-full">
                  <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    aria-label="Buscar consultas"
                    placeholder="Buscar (motivo, dx, servicio)…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSortOrder((s) => (s === "desc" ? "asc" : "desc"))
                  }
                  className="cursor-pointer"
                  title="Cambiar orden"
                  aria-label="Cambiar orden de listado"
                >
                  {sortOrder === "desc" ? (
                    <SortDesc className="h-4 w-4" />
                  ) : (
                    <SortAsc className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  aria-label="Desde"
                />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  aria-label="Hasta"
                />
              </div>

              <Separator className="my-1" />

              {/* Lista de consultas */}
              <nav
                className="max-h-[66vh] overflow-auto pr-1 space-y-2"
                aria-label="Listado de consultas"
              >
                {filteredConsults.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <ConsultListItem
                      key={c.id}
                      c={c}
                      active={active}
                      onClick={() => setSelectedId(c.id)}
                    />
                  );
                })}
                {!filteredConsults.length && (
                  <div className="text-xs text-muted-foreground">
                    No hay consultas con los filtros aplicados.
                  </div>
                )}
              </nav>
            </CardContent>
          </Card>

          {/* ==== Documento principal ==== */}
          <Card className="border-cyan-100 shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">
                Historia clínica – Reporte de consulta
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {!selected ? (
                <EmptyState />
              ) : (
                <>
                  {/* Encabezado de consulta */}
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

                  {/* Secciones clínicas */}
                  <Section title="I. FILIACIÓN">
                    <Field label="Nombre:" value={profile.full_name || "—"} />
                    <Field label="Email:" value={profile.email || "—"} />
                  </Section>

                  <Section title="II. ANTECEDENTES PERSONALES Y MÉDICOS">
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
                  </Section>

                  <Section title="III. MOTIVO DE CONSULTA">
                    <Paragraph text={selected.motivo_consulta || "—"} />
                  </Section>

                  <Section title="IV. ENFERMEDAD ACTUAL">
                    <Paragraph text={selected.historia_enfermedad_actual || "—"} />
                  </Section>

                  <Section title="V. EXAMEN FÍSICO">
                    <Paragraph text={selected.examen_fisico || "—"} />
                  </Section>

                  <Section title="VI. ESTUDIOS SOLICITADOS">
                    <Paragraph
                      text={
                        (selected as any).estudios_solicitados?.length
                          ? (selected as any).estudios_solicitados.join(", ")
                          : "—"
                      }
                    />
                  </Section>

                  <Section title="VII. DIAGNÓSTICO">
                    <Field
                      label="Inicial:"
                      value={selected.diagnostico_inicial || "—"}
                    />
                    <Field label="Final:" value={selected.diagnostico_final || "—"} />
                  </Section>

                  <Section title="VIII. CONDUCTA / TRATAMIENTO">
                    <Paragraph text={selected.conducta_tratamiento || "—"} />
                  </Section>

                  <Section title="IX. MÉDICO RESPONSABLE">
                    <Paragraph text={selected.medico_responsable || "—"} />
                  </Section>

                  {/* RX del día */}
                  <Section title="X. RADIOGRAFÍAS DEL DÍA" tight>
                    {rxLoading ? (
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando
                        imágenes…
                      </div>
                    ) : radiographs.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        — No se registran imágenes en esta fecha —
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {radiographs.map((rx) => (
                          <RadiographCard
                            key={rx.id}
                            rx={rx}
                            patientId={profile.id} // redirección a /analisis-ia/[patientId]
                            onPreview={() => setPreviewRx(rx)}
                          />
                        ))}
                      </div>
                    )}
                  </Section>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== Preview RX full-screen ===== */}
      {previewRx && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de radiografía"
          onClick={() => setPreviewRx(null)}
        >
          <div
            className="relative max-w-6xl max-h-[92vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-3 -right-3 rounded-full bg-white text-black shadow px-2 py-1 text-xs"
              onClick={() => setPreviewRx(null)}
              aria-label="Cerrar"
            >
              Cerrar
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewRx.url}
              alt={previewRx.filename}
              className="w-full h-auto max-h-[92vh] object-contain rounded shadow-2xl bg-black"
            />
            <div className="mt-2 text-xs text-white/80 truncate">
              {previewRx.filename}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= helpers UI ======================= */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50/60 via-background to-background">
      <div className="container mx-auto px-4 py-12">{children}</div>
    </div>
  );
}

function Item({
  label,
  value,
  extra,
  className = "",
}: {
  label: string;
  value: string;
  extra?: string;
  className?: string;
}) {
  return (
    <div className={`truncate ${className}`}>
      <span className="font-medium text-foreground">{label}:</span>{" "}
      <span className="text-foreground/90">{value}</span>{" "}
      {extra ? <span className="text-muted-foreground">{extra}</span> : null}
    </div>
  );
}

function Section({
  title,
  children,
  tight = false,
}: {
  title: string;
  children: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <section className={tight ? "" : "mb-3"}>
      <SectionTitle title={title} />
      <div className="space-y-1.5">{children}</div>
      {!tight && <Separator className="my-3" />}
    </section>
  );
}

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
    <div className="text-sm leading-relaxed">
      <span className="font-medium text-foreground/90">{label}</span>{" "}
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  return (
    <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
      {text}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-sm text-muted-foreground">
      Selecciona una consulta en la lista.
    </div>
  );
}

function ConsultListItem({
  c,
  active,
  onClick,
}: {
  c: ConsultationLite;
  active: boolean;
  onClick: () => void;
}) {
  const dateStr = useMemo(
    () => new Date(c.fecha_hora).toLocaleString(),
    [c.fecha_hora]
  );

  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left p-2 rounded-md border transition group",
        "hover:bg-accent/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-600/40",
        active
          ? "border-cyan-600 ring-1 ring-cyan-600 bg-cyan-50/60 dark:bg-cyan-950/20"
          : "border-border",
      ].join(" ")}
      title={dateStr}
      aria-current={active ? "true" : undefined}
    >
      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
        <CalendarIcon className="h-3 w-3" />
        <span className="truncate">{dateStr}</span>
      </div>
      <div className="text-sm font-medium truncate text-foreground">
        {c.servicio || "—"}
      </div>
      <div className="text-xs truncate text-foreground/90">
        {c.motivo_consulta || "—"}
      </div>
      <div className="text-[11px] text-muted-foreground truncate">
        Dx: {c.diagnostico_final || c.diagnostico_inicial || "—"}
      </div>
    </button>
  );
}

/**
 * Tarjeta de radiografía
 * - Mantiene relación 4:3 (object-contain) para no cortar imagen.
 * - "Diagnóstico (IA)" ⇒ /analisis-ia/[patientId]
 */
function RadiographCard({
  rx,
  onPreview,
  patientId,
}: {
  rx: FileLite;
  onPreview: () => void;
  patientId: string;
}) {
  const uploaded = rx.uploaded_at
    ? new Date(rx.uploaded_at).toLocaleString()
    : "—";

  return (
    <div className="rounded-xl border bg-white/70 dark:bg-card/60 hover:shadow-sm transition overflow-hidden">
      {/* Media 4:3 */}
      <div className="relative w-full aspect-[4/3] bg-neutral-50 dark:bg-neutral-900">
        <Image
          src={rx.url}
          alt={rx.filename}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-contain p-2"
          onClick={onPreview}
        />
        <button
          onClick={onPreview}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white hover:bg-black/70"
          title="Ampliar"
          aria-label={`Ampliar ${rx.filename}`}
        >
          Ampliar <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate text-foreground">
            {rx.filename}
          </div>
          <div className="text-[11px] text-muted-foreground">{uploaded}</div>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {rx.file_type ? (
            <span className="text-[10px] rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200 px-2 py-0.5">
              {rx.file_type}
            </span>
          ) : null}
          {rx.tags?.slice(0, 4).map((t) => (
            <span
              key={t}
              className="text-[10px] rounded-full bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 px-2 py-0.5"
            >
              {t}
            </span>
          ))}
          {rx.tags && rx.tags.length > 4 ? (
            <span className="text-[10px] text-muted-foreground">
              +{rx.tags.length - 4}
            </span>
          ) : null}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onPreview}>
            Vista previa
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={rx.url} target="_blank" rel="noreferrer">
              Abrir imagen
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/analisis-ia/${patientId}`} title="Abrir análisis con IA">
              Diagnóstico (IA)
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="ml-auto"
            asChild
            title="Descargar"
          >
            <a href={rx.url} download>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
