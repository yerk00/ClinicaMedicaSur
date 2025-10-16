// web/pages/Historial.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserRole } from "@/lib/permissions";

import {
  getPatientProfile,
  getMedicalRecordByUserIdLite,
  getConsultationsPage,
  getRadiographsOfDay,
  type ConsultationLite,
  type PatientProfile,
  type MedicalRecordLite,
  type FileLite,
} from "@/lib/historyDetails";
import { generateConsultationReportPDF } from "@/lib/clinicalReport";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import {
  Calendar as CalendarIcon,
  Loader2,
  SortAsc,
  SortDesc,
  Download,
  ChevronRight,
  UserSearch,
  Stethoscope,
  Undo2,
  Users,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";

/* =========================
   Config y tipos
========================= */
const PATIENTS_PAGE_SIZE = 30;
const CONSULTS_PAGE_SIZE = 200;

type Role =
  | "Doctor"
  | "Radiologo"
  | "Administrador"
  | "Operador"
  | "Paciente"
  | "Enfermero"
  | null;

type ProfileMini = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
};

/* =========================
   Utils UI
========================= */
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

const yesNo = (v?: boolean | null) => (v == null ? "—" : v ? "Sí" : "No");

/* =========================
   Data helpers
========================= */
let cachedPacienteRoleId: number | null = null;

async function getPacienteRoleId(): Promise<number | null> {
  if (cachedPacienteRoleId) return cachedPacienteRoleId;
  const { data, error } = await supabase.from("roles").select("id,name").eq("name", "Paciente").limit(1);
  if (error || !data?.length) return null;
  cachedPacienteRoleId = data[0].id as number;
  return cachedPacienteRoleId;
}

async function getPatientsPage(params: {
  q: string;
  page: number;
  pageSize: number;
}): Promise<{ data: ProfileMini[]; count: number }> {
  const roleId = await getPacienteRoleId();
  if (!roleId) return { data: [], count: 0 };

  const { q, page, pageSize } = params;
  const fromIdx = Math.max(0, (page - 1) * pageSize);
  const toIdx = fromIdx + pageSize - 1;

  let query = supabase
    .from("user_profiles")
    .select("id, full_name, email, avatar_url", { count: "exact" })
    .eq("role_id", roleId);

  if (q.trim()) {
    const like = `%${q.trim()}%`;
    query = query.or(`full_name.ilike.${like},email.ilike.${like}`);
  }

  query = query.order("full_name", { ascending: true, nullsFirst: false });

  const { data, count } = await query.range(fromIdx, toIdx);
  return { data: (data ?? []) as ProfileMini[], count: count ?? 0 };
}

/* =========================
   Página
========================= */
export default function Historial() {
  const router = useRouter();

  /* ---- Gate de sesión/rol ---- */
  const [role, setRole] = useState<Role>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const r = await getCurrentUserRole();
      setRole((r as Role) ?? null);
      if (!(r === "Doctor" || r === "Radiologo")) {
        router.replace("/home");
        return;
      }
      setAuthLoading(false);
    })();
  }, [router]);

  /* ---- Lista de pacientes (maestro) ---- */
  const [qPatients, setQPatients] = useState("");
  const [patientsPage, setPatientsPage] = useState(1);
  const [patients, setPatients] = useState<ProfileMini[]>([]);
  const [patientsCount, setPatientsCount] = useState(0);
  const [loadingPatients, setLoadingPatients] = useState(false);

  async function loadPatients() {
    setLoadingPatients(true);
    try {
      const { data, count } = await getPatientsPage({
        q: qPatients,
        page: patientsPage,
        pageSize: PATIENTS_PAGE_SIZE,
      });
      setPatients(data);
      setPatientsCount(count);
    } finally {
      setLoadingPatients(false);
    }
  }

  useEffect(() => {
    loadPatients(); // initial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadPatients(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qPatients, patientsPage]);

  /* ---- Selección de paciente ---- */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const qid = (router.query?.id as string) || null;
    if (qid) {
      setSelectedId(qid);
      try { localStorage.setItem("targetProfileId", qid); } catch {}
      return;
    }
    try {
      const cached = localStorage.getItem("targetProfileId");
      if (cached) setSelectedId(cached);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Documento del paciente (detalle) ---- */
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [record, setRecord] = useState<MedicalRecordLite | null>(null);
  const [consults, setConsults] = useState<ConsultationLite[]>([]);
  const [selectedConsultId, setSelectedConsultId] = useState<string | null>(null);
  const [radiographs, setRadiographs] = useState<FileLite[]>([]);
  const [rxLoading, setRxLoading] = useState(false);

  // filtros consultorio
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!selectedId) {
      setProfile(null);
      setRecord(null);
      setConsults([]);
      setSelectedConsultId(null);
      setRadiographs([]);
      return;
    }
    (async () => {
      setLoadingDoc(true);
      try {
        try { localStorage.setItem("targetProfileId", selectedId); } catch {}
        const [pf, mr, cPage] = await Promise.all([
          getPatientProfile(selectedId),
          getMedicalRecordByUserIdLite(selectedId),
          getConsultationsPage(selectedId, 1, CONSULTS_PAGE_SIZE),
        ]);
        setProfile(pf);
        setRecord(mr);
        setConsults(cPage.data);
        setSelectedConsultId(cPage.data[0]?.id ?? null);
      } finally {
        setLoadingDoc(false);
      }
    })();
  }, [selectedId]);

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
    if (fromDate) arr = arr.filter((c) => new Date(c.fecha_hora) >= new Date(`${fromDate}T00:00:00`));
    if (toDate) arr = arr.filter((c) => new Date(c.fecha_hora) <= new Date(`${toDate}T23:59:59`));
    arr.sort((a, b) =>
      sortOrder === "desc"
        ? +new Date(b.fecha_hora) - +new Date(a.fecha_hora)
        : +new Date(a.fecha_hora) - +new Date(b.fecha_hora),
    );
    return arr;
  }, [consults, search, sortOrder, fromDate, toDate]);

  useEffect(() => {
    if (!filteredConsults.length) return;
    if (!selectedConsultId || !filteredConsults.some((c) => c.id === selectedConsultId)) {
      setSelectedConsultId(filteredConsults[0].id);
    }
  }, [filteredConsults, selectedConsultId]);

  useEffect(() => {
    (async () => {
      if (!profile || !selectedConsultId) return;
      const current = consults.find((c) => c.id === selectedConsultId) || null;
      if (!current) return;
      setRxLoading(true);
      try {
        const rx = await getRadiographsOfDay(profile.id, current.fecha_hora);
        setRadiographs(rx);
      } finally {
        setRxLoading(false);
      }
    })();
  }, [profile, selectedConsultId, consults]);

  async function handlePDF() {
    if (!profile || !selectedConsultId) return;
    const current = consults.find((c) => c.id === selectedConsultId) || null;
    if (!current) return;
    await generateConsultationReportPDF({
      patient: profile,
      record,
      consult: current,
      radiographs,
      logoUrl: "/images/clinica.png",
      institutionName: "Clínica Medica Sur",
    });
  }

  /* =========================
     Render
  ========================= */
  if (authLoading) {
    return (
      <div className="container mx-auto px-3 py-10">
        <div className="mx-auto max-w-md rounded-xl border bg-card/50 p-5 text-muted-foreground backdrop-blur-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      </div>
    );
  }

  // Edad fallback
  const edadCalculada =
    (profile as any)?.fecha_nacimiento
      ? Math.floor((Date.now() - new Date((profile as any).fecha_nacimiento).getTime()) / 31557600000)
      : null;

  const totalPages = Math.max(1, Math.ceil(patientsCount / PATIENTS_PAGE_SIZE));

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50/60 via-background to-background">
      <div className="container mx-auto px-3 py-5">
        {/* Barra superior */}
        <div className="mb-5 flex items-center justify-between rounded-xl border bg-white/60 dark:bg-card/60 backdrop-blur p-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-700" />
            <div className="text-base font-semibold">Historias clínicas</div>
            {role && (
              <Badge variant="outline" className="ml-2">
                {role}
              </Badge>
            )}
          </div>
        </div>

        {/* Layout maestro-detalle */}
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
          {/* Maestro: lista de pacientes */}
          <Card className="h-full border-cyan-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserSearch className="h-4 w-4" />
                Pacientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="sticky top-[68px] z-10 bg-white/80 dark:bg-card/80 backdrop-blur rounded-md border p-2">
                <Input
                  placeholder="Buscar (nombre o email)…"
                  value={qPatients}
                  onChange={(e) => {
                    setPatientsPage(1);
                    setQPatients(e.target.value);
                  }}
                />
                <div className="mt-2 flex items-center justify-between text-[11.5px] text-muted-foreground">
                  <span>{patientsCount} resultados</span>
                  <div className="inline-flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={patientsPage <= 1 || loadingPatients}
                      onClick={() => setPatientsPage((p) => Math.max(1, p - 1))}
                      title="Anterior"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span>
                      {patientsPage}/{totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={patientsPage >= totalPages || loadingPatients}
                      onClick={() => setPatientsPage((p) => Math.min(totalPages, p + 1))}
                      title="Siguiente"
                    >
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-auto pr-1">
                {loadingPatients ? (
                  <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando pacientes…
                  </div>
                ) : patients.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Sin resultados.</div>
                ) : (
                  <ul className="space-y-2">
                    {patients.map((p) => {
                      const active = p.id === selectedId;
                      return (
                        <li key={p.id}>
                          <button
                            className={`w-full text-left p-2 rounded-md border transition flex items-center gap-3 hover:bg-accent/50 ${
                              active ? "border-cyan-600 ring-1 ring-cyan-600 bg-cyan-50/40 dark:bg-cyan-950/20" : ""
                            }`}
                            onClick={() => setSelectedId(p.id)}
                          >
                            <Image
                              src={p.avatar_url || "/avatar-default.png"}
                              alt={p.full_name || "Paciente"}
                              width={36}
                              height={36}
                              className="rounded-full object-cover ring-1 ring-cyan-200"
                            />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{p.full_name || "Paciente"}</div>
                              <div className="text-[11.5px] text-muted-foreground truncate">{p.email || "—"}</div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detalle: historia del paciente */}
          <Card className="border-cyan-100 shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Historia clínica</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedId(null);
                      setConsults([]);
                      setProfile(null);
                      setRecord(null);
                      setRadiographs([]);
                    }}
                    className="cursor-pointer"
                    title="Cambiar paciente"
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Cambiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePDF} disabled={!selectedId || !selectedConsultId}>
                    <Download className="h-4 w-4 mr-1" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-3">
              {!selectedId ? (
                <div className="text-sm text-muted-foreground">Seleccione un paciente de la lista.</div>
              ) : loadingDoc ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando historia…
                </div>
              ) : !profile ? (
                <div className="text-sm text-muted-foreground">No se encontró el paciente seleccionado.</div>
              ) : (
                <>
                  {/* Encabezado paciente */}
                  <div className="mb-3 flex items-center gap-3">
                    <Image
                      src={profile.avatar_url || "/avatar-default.png"}
                      alt={profile.full_name || "Paciente"}
                      width={44}
                      height={44}
                      className="rounded-full object-cover ring-2 ring-cyan-200"
                    />
                    <div>
                      <div className="font-semibold leading-tight">{profile.full_name || "Paciente sin nombre"}</div>
                      <div className="text-xs text-muted-foreground">{profile.email || "—"}</div>
                    </div>
                  </div>

                  {/* Identificación */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-[11.5px] text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">CID:</span>{" "}
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

                  <Separator className="my-4" />

                  {/* Layout interno: Sidebar consultas + reporte */}
                  <div className="grid grid-cols-1 xl:grid-cols-[330px_1fr] gap-5">
                    {/* Sidebar consultas */}
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
                            onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
                            className="cursor-pointer"
                            title="Cambiar orden"
                          >
                            {sortOrder === "desc" ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>

                        <Separator className="my-1" />

                        <div className="max-h-[60vh] overflow-auto pr-1 space-y-2">
                          {filteredConsults.map((c) => {
                            const active = c.id === selectedConsultId;
                            return (
                              <button
                                key={c.id}
                                onClick={() => setSelectedConsultId(c.id)}
                                className={`w-full text-left p-2 rounded-md border transition hover:bg-accent/50 ${
                                  active ? "border-cyan-600 ring-1 ring-cyan-600 bg-cyan-50/40 dark:bg-cyan-950/20" : ""
                                }`}
                                title={new Date(c.fecha_hora).toLocaleString()}
                              >
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
                                  {new Date(c.fecha_hora).toLocaleString()}
                                </div>
                                <div className="text-sm font-medium truncate">{c.servicio || "—"}</div>
                                <div className="text-xs truncate">{c.motivo_consulta || "—"}</div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  Dx: {c.diagnostico_final || c.diagnostico_inicial || "—"}
                                </div>
                              </button>
                            );
                          })}
                          {!filteredConsults.length && (
                            <div className="text-xs text-muted-foreground">No hay consultas con los filtros.</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Reporte consulta */}
                    <Card className="border-cyan-100 shadow-sm">
                      <CardHeader className="pb-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Stethoscope className="h-4 w-4" />
                          Reporte de consulta
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        {!selectedConsultId ? (
                          <div className="text-sm text-muted-foreground">Selecciona una consulta en la lista.</div>
                        ) : (
                          (() => {
                            const c = consults.find((x) => x.id === selectedConsultId)!;
                            return (
                              <>
                                <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground">
                                  <div>
                                    Fecha/Hora:{" "}
                                    <span className="text-foreground">
                                      {new Date(c.fecha_hora).toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    Servicio: <span className="text-foreground">{c.servicio || "—"}</span>
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
                                <Field label="Grupo sanguíneo:" value={(record as any)?.grupo_sanguineo || "—"} />
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
                                <Field label="Cirugías previas:" value={(record as any)?.cirugias_previas || "—"} />
                                <Field
                                  label="Antecedentes familiares:"
                                  value={(record as any)?.antecedentes_familiares || "—"}
                                />
                                <Field
                                  label="Consumo de sustancias:"
                                  value={(record as any)?.consumo_sustancias || "—"}
                                />
                                <Field label="Actividad física:" value={(record as any)?.actividad_fisica || "—"} />
                                <Field label="Vacunas:" value={(record as any)?.vacunas || "—"} />
                                <Separator className="my-3" />

                                {/* III. MOTIVO DE CONSULTA */}
                                <SectionTitle title="III. MOTIVO DE CONSULTA" />
                                <Paragraph text={c.motivo_consulta || "—"} />
                                <Separator className="my-3" />

                                {/* IV. ENFERMEDAD ACTUAL */}
                                <SectionTitle title="IV. ENFERMEDAD ACTUAL" />
                                <Paragraph text={c.historia_enfermedad_actual || "—"} />
                                <Separator className="my-3" />

                                {/* V. EXAMEN FÍSICO */}
                                <SectionTitle title="V. EXAMEN FÍSICO" />
                                <Paragraph text={c.examen_fisico || "—"} />
                                <Separator className="my-3" />

                                {/* VI. ESTUDIOS SOLICITADOS */}
                                <SectionTitle title="VI. ESTUDIOS SOLICITADOS" />
                                <Paragraph
                                  text={
                                    (c as any).estudios_solicitados?.length
                                      ? (c as any).estudios_solicitados.join(", ")
                                      : "—"
                                  }
                                />
                                <Separator className="my-3" />

                                {/* VII. DIAGNÓSTICO */}
                                <SectionTitle title="VII. DIAGNÓSTICO" />
                                <Field label="Inicial:" value={c.diagnostico_inicial || "—"} />
                                <Field label="Final:" value={c.diagnostico_final || "—"} />
                                <Separator className="my-3" />

                                {/* VIII. CONDUCTA / TRATAMIENTO */}
                                <SectionTitle title="VIII. CONDUCTA / TRATAMIENTO" />
                                <Paragraph text={c.conducta_tratamiento || "—"} />
                                <Separator className="my-3" />

                                {/* IX. MÉDICO RESPONSABLE */}
                                <SectionTitle title="IX. MÉDICO RESPONSABLE" />
                                <Paragraph text={c.medico_responsable || "—"} />
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
                                        <a
                                          href={rx.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="shrink-0 group relative"
                                          title="Abrir a tamaño completo"
                                        >
                                          <Image
                                            src={rx.url}
                                            alt={rx.filename}
                                            width={220}
                                            height={165}
                                            className="rounded-md object-cover border shadow-sm group-hover:shadow-md transition"
                                          />
                                          <span className="absolute bottom-1 right-1 hidden group-hover:flex text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                                            Abrir
                                          </span>
                                        </a>

                                        <div className="min-w-0">
                                          <div className="text-sm font-medium truncate">{rx.filename}</div>
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
                            );
                          })()
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
