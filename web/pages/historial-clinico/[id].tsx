// web/pages/historial-clinico/[id].tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import {
  getPatientProfile,
  getMedicalRecordByUserIdLite,
  getConsultationsPage,
  ConsultationLite,
  PatientProfile,
  MedicalRecordLite,
  getRadiographsOfDay, // RX del mismo día para el PDF
} from "@/lib/historyDetails";
import { generateConsultationReportPDF } from "@/lib/clinicalReport";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Stethoscope, Calendar as CalendarIcon, Loader2 } from "lucide-react";

type TLItem = { type: "consulta"; date: string; data: ConsultationLite };

const PAGE = { consults: 1 };
const SIZE = { consults: 8 };

export default function PatientHistoryDoc() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  // Guard sesión
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) router.replace("/auth/login");
    })();
  }, [router]);

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [record, setRecord] = useState<MedicalRecordLite | null>(null);

  const [consults, setConsults] = useState<ConsultationLite[]>([]);
  const [pageC, setPageC] = useState(PAGE.consults);
  const [countC, setCountC] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filtros (dejamos solo Consultas para coherencia)
  const [showConsults, setShowConsults] = useState(true);
  const [search, setSearch] = useState("");

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
          getConsultationsPage(id, 1, SIZE.consults),
        ]);
        setProfile(pf);
        setRecord(mr);
        setConsults(cPage.data);
        setCountC(cPage.count);
        setPageC(1);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Cargar más (fix: no activar loading si no hay más páginas)
  async function loadMore() {
    if (!id) return;

    const nextC = pageC + 1;
    const hasMoreC = nextC <= Math.ceil(countC / SIZE.consults);
    if (!hasMoreC) return;

    try {
      setLoadingMore(true);
      const cPage = await getConsultationsPage(id, nextC, SIZE.consults);
      if (cPage.data.length) {
        setConsults((prev) => [...prev, ...cPage.data]);
        setPageC(nextC);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }

  // Timeline (solo consultas)
  const timeline: TLItem[] = useMemo(() => {
    const arr: TLItem[] = [];
    if (showConsults) {
      for (const c of consults)
        arr.push({ type: "consulta", date: c.fecha_hora, data: c });
    }
    const q = search.trim().toLowerCase();
    const filtered = q
      ? arr.filter((it) => {
          const c = it.data as ConsultationLite;
          return (
            (c.motivo_consulta || "").toLowerCase().includes(q) ||
            (c.diagnostico_inicial || "").toLowerCase().includes(q) ||
            (c.diagnostico_final || "").toLowerCase().includes(q) ||
            (c.servicio || "").toLowerCase().includes(q)
          );
        })
      : arr;
    return filtered.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [consults, showConsults, search]);

  // Agrupar por día (YYYY-MM-DD)
  const groups = useMemo(() => {
    const m = new Map<string, TLItem[]>();
    for (const it of timeline) {
      const d = new Date(it.date);
      const key = isNaN(d.getTime()) ? "Sin fecha" : d.toISOString().slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(it);
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [timeline]);

  // Generar PDF de historia clínica (consulta + RX del mismo día)
  async function handleReport(consult: ConsultationLite) {
    if (!profile) return;
    try {
      const rx = await getRadiographsOfDay(profile.id, consult.fecha_hora);
      await generateConsultationReportPDF({
        patient: profile,
        record,
        consult,
        radiographs: rx,
        logoUrl: "/images/clinica.png", // tu logo en /public
        institutionName: "Clínica Medica Sur",
      });
    } catch (e) {
      console.error(e);
    }
  }

  const yesNo = (b?: boolean | null) => (b === true ? "Sí" : b === false ? "No" : "—");

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando historia clínica…
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">No se encontró el paciente.</p>
      </div>
    );
  }

  // (Opcional) calcular edad en cliente si no viene de la API
  const edadCalculada =
    profile.fecha_nacimiento
      ? Math.floor(
          (Date.now() - new Date(profile.fecha_nacimiento).getTime()) / 31557600000
        )
      : null;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Encabezado tipo documento */}
      <Card className="mb-6">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image
              src={profile.avatar_url || "/avatar-default.png"}
              alt={profile.full_name || "Paciente"}
              width={56}
              height={56}
              className="rounded-full object-cover"
            />
            <div>
              <CardTitle className="text-lg md:text-xl">
                {profile.full_name || "Paciente sin nombre"}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                {profile.email || "—"}
              </div>

              {/* Datos de identificación y contacto (nuevos campos) */}
              <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">CI:</span>{" "}
                  {profile.ci ?? "—"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Sexo:</span>{" "}
                  {profile.sexo_genero ?? "—"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Nacimiento:</span>{" "}
                  {profile.fecha_nacimiento
                    ? new Date(profile.fecha_nacimiento).toLocaleDateString()
                    : "—"}
                  {typeof (profile as any).edad === "number"
                    ? `  (${(profile as any).edad} años)`
                    : edadCalculada !== null
                    ? `  (${edadCalculada} años)`
                    : ""}
                </div>
                <div>
                  <span className="font-medium text-foreground">Tel.:</span>{" "}
                  {profile.telefono ?? "—"}
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-foreground">Dirección:</span>{" "}
                  {profile.direccion ?? "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Resumen de antecedentes (nuevo esquema) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Grupo sanguíneo</div>
              <div className="font-semibold">{record?.grupo_sanguineo || "—"}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Alergias</div>
              <div className="font-semibold truncate" title={record?.alergias || ""}>
                {record?.alergias || "—"}
              </div>
            </div>
            <div className="rounded border p-2 col-span-2 md:col-span-1">
              <div className="text-muted-foreground">Enf. crónicas</div>
              <div
                className="font-semibold truncate"
                title={record?.enfermedades_cronicas || ""}
              >
                {record?.enfermedades_cronicas || "—"}
              </div>
            </div>
            <div className="rounded border p-2 col-span-2 md:col-span-1">
              <div className="text-muted-foreground">Medicación actual</div>
              <div
                className="font-semibold truncate"
                title={record?.medicacion_actual || ""}
              >
                {record?.medicacion_actual || "—"}
              </div>
            </div>
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Cirugías previas</div>
              <div
                className="font-semibold truncate"
                title={record?.cirugias_previas || ""}
              >
                {record?.cirugias_previas || "—"}
              </div>
            </div>
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Transfusiones previas</div>
              <div className="font-semibold">{yesNo(record?.transfusiones_previas)}</div>
            </div>
            <div className="rounded border p-2 col-span-2 md:col-span-2">
              <div className="text-muted-foreground">Detalle transfusiones</div>
              <div
                className="font-semibold truncate"
                title={record?.transfusiones_detalle || ""}
              >
                {record?.transfusiones_detalle || "—"}
              </div>
            </div>
            <div className="rounded border p-2 col-span-2 md:col-span-2">
              <div className="text-muted-foreground">Ant. familiares</div>
              <div
                className="font-semibold truncate"
                title={record?.antecedentes_familiares || ""}
              >
                {record?.antecedentes_familiares || "—"}
              </div>
            </div>
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Consumo sustancias</div>
              <div
                className="font-semibold truncate"
                title={record?.consumo_sustancias || ""}
              >
                {record?.consumo_sustancias || "—"}
              </div>
            </div>
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Actividad física</div>
              <div
                className="font-semibold truncate"
                title={record?.actividad_fisica || ""}
              >
                {record?.actividad_fisica || "—"}
              </div>
            </div>
            <div className="rounded border p-2 col-span-2 md:col-span-4">
              <div className="text-muted-foreground">Vacunas</div>
              <div className="font-semibold truncate" title={record?.vacunas || ""}>
                {record?.vacunas || "—"}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={showConsults ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setShowConsults((v) => !v)}
            >
              <Stethoscope className="h-3 w-3 mr-1" /> Consultas
            </Badge>
          </div>

          <div className="relative">
            <Input
              placeholder="Buscar en consultas (motivo, dx, servicio)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[280px] pl-3"
            />
          </div>
        </CardContent>
      </Card>

      {/* Timeline por fecha (solo consultas) */}
      {groups.map(([dateKey, items]) => (
        <div key={dateKey} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              {dateKey === "Sin fecha"
                ? "Sin fecha"
                : new Date(dateKey).toLocaleDateString()}
            </h3>
            <Separator className="flex-1" />
          </div>

          <div className="space-y-3">
            {items.map((it) => {
              const c = it.data as ConsultationLite;
              return (
                <Card key={`c-${c.id}`} className="border-l-4 border-l-cyan-600">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-cyan-600" />
                      Consulta — {new Date(c.fecha_hora).toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Servicio:</span>{" "}
                      {c.servicio || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Motivo:</span>{" "}
                      {c.motivo_consulta || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Dx inicial:</span>{" "}
                      {c.diagnostico_inicial || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Dx final:</span>{" "}
                      {c.diagnostico_final || "—"}
                    </div>
                    <div>
                      <span className="font-medium">Médico responsable:</span>{" "}
                      {c.medico_responsable || "—"}
                    </div>

                    {/* Botón de reporte PDF */}
                    <div className="flex items-center justify-end mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReport(c)}
                        className="cursor-pointer"
                        title="Generar PDF de historia clínica (día)"
                      >
                        Reporte historial (PDF)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Paginación */}
      <div className="mt-6 flex items-center justify-center">
        <Button
          variant="outline"
          onClick={loadMore}
          disabled={loadingMore || consults.length >= countC}
          title={consults.length >= countC ? "No hay más consultas" : "Cargar más"}
          className="cursor-pointer"
        >
          {loadingMore ? "Cargando..." : "Cargar más"}
        </Button>
      </div>
    </div>
  );
}
