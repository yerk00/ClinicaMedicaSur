// web/pages/estudios-gabinete/index.tsx
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import {
  getRadiographStudies,
  updateStudyStatus,
  RadiographStudyRow,
} from "@/lib/studies";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  FileImage as FileImageIcon,
  FileText,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SortAsc,
  SortDesc,
  Search,
  Loader2,
  ClipboardList,
  ArrowLeft,
  ExternalLink,
  Eye,
  Filter,
} from "lucide-react";

type StudyStatus = "pendiente" | "completado";
type StatusFilter = StudyStatus | "todos";

const PAGE_SIZE = 20;

/* ================== Tipos para Drawer de archivos ================== */
type FileRow = {
  id: string;
  filename: string;
  url: string;
  file_type: string | null;
  uploaded_at: string | null;
  tags: string[] | null;
};
type FileTypeFilter = "all" | "images" | "docs";

function fileIsImage(ft?: string | null) {
  return !!ft && ft.startsWith("image/");
}

export default function EstudiosGabinetePage() {
  const router = useRouter();

  // ========== Sesión / doctor activo ==========
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setDoctorId(user.id);
      // intenta traer nombre del perfil
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();
      setDoctorName(prof?.full_name || prof?.email || "Radiólogo");
    })();
  }, [router]);

  // ========== Filtros/UI de estudios ==========
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("pendiente");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RadiographStudyRow[]>([]);
  const [count, setCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // ========== Fetch estudios ==========
  async function load() {
    setLoading(true);
    try {
      const { data, count } = await getRadiographStudies({
        page,
        pageSize: PAGE_SIZE,
        status,
        q,
        from,
        to,
        order,
      });
      setRows(data);
      setCount(count);
    } catch (e) {
      console.error(e);
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, order]);

  // debounce básico para búsqueda/fechas
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, from, to]);

  // Helpers UI
  function fmtDateTime(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  // Badge de estado RX
  function RxBadge({ estado }: { estado: StudyStatus | null | undefined }) {
    if (estado === "completado") {
      return (
        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white">
          <CheckCircle2 className="h-3.5 w-3.5" /> Completado
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white">
        <Clock className="h-3.5 w-3.5" /> Pendiente
      </Badge>
    );
  }

  // Cambiar estado estudio
  async function toggleEstado(row: RadiographStudyRow) {
    try {
      setRefreshing(true);
      const next: StudyStatus =
        row.estudios_estado === "completado" ? "pendiente" : "completado";
      await updateStudyStatus(row.consultation_id, next);
      setRows((prev) =>
        prev.map((r) =>
          r.consultation_id === row.consultation_id
            ? { ...r, estudios_estado: next }
            : r
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }

  // ========== ARCHIVOS (acción completa en /uploads actuando como Radiólogo) ==========
  function openFilesAsRadiologist(patientId: string, patientName?: string | null) {
    try {
      // Persistimos también en localStorage (compatibilidad)
      localStorage.setItem("targetProfileId", patientId);
      if (patientName) localStorage.setItem("targetProfileName", patientName);
      if (doctorId) localStorage.setItem("actingDoctorId", doctorId);
      if (doctorName) localStorage.setItem("actingDoctorName", doctorName);
      localStorage.setItem("actingRole", "Radiologo");
      localStorage.setItem("sourcePage", "estudios-gabinete");
    } catch {}

    // >>> CORRECCIÓN CLAVE: enviar el contexto por URL (a prueba de SSR)
    router.push({
      pathname: "/uploads",
      query: {
        id: patientId,
        patientName: patientName || "",
        actingRole: "Radiologo",
        actingDoctorId: doctorId || "",
        actingDoctorName: doctorName || "",
        from: "estudios-gabinete",
      },
    });
  }

  // ========== Drawer "Ver imágenes" dentro de esta página ==========
  const [filesOpen, setFilesOpen] = useState(false);
  const [filesPatientId, setFilesPatientId] = useState<string | null>(null);
  const [filesPatientName, setFilesPatientName] = useState<string>("");

  const [files, setFiles] = useState<FileRow[]>([]);
  const [filesCount, setFilesCount] = useState(0);
  const [filesLoading, setFilesLoading] = useState(false);

  const [filesPage, setFilesPage] = useState(1);
  const [filesPageSize, setFilesPageSize] = useState(24);
  const [filesQ, setFilesQ] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>("all");

  const filesTotalPages = Math.max(1, Math.ceil(filesCount / filesPageSize));
  const debouncedFilesQ = useDebounced(filesQ, 250);

  function openImagesDrawer(patientId: string, patientName?: string | null) {
    setFilesPatientId(patientId);
    setFilesPatientName(patientName || "");
    setFilesPage(1);
    setFilesQ("");
    setFileTypeFilter("all");
    setFilesOpen(true);
  }

  async function loadFilesDrawer() {
    if (!filesPatientId) return;
    setFilesLoading(true);
    try {
      let query = supabase
        .from("files")
        .select("id, filename, url, file_type, uploaded_at, tags", { count: "exact" })
        .eq("user_profile_id", filesPatientId);

      if (debouncedFilesQ.trim()) {
        const like = `%${debouncedFilesQ.trim()}%`;
        query = query.ilike("filename", like);
      }

      if (fileTypeFilter === "images") {
        query = query.ilike("file_type", "image/%");
      } else if (fileTypeFilter === "docs") {
        // incluye file_type NULL para documentos antiguos
        query = query.or("file_type.is.null,file_type.not.ilike.image/%");
      }

      const from = (filesPage - 1) * filesPageSize;
      const to = from + filesPageSize - 1;

      const { data, error, count } = await query
        .order("uploaded_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("[files] select error:", error);
        alert(`No fue posible cargar los archivos: ${error.message}`);
        setFiles([]);
        setFilesCount(0);
        return;
      }

      setFiles((data || []) as FileRow[]);
      setFilesCount(count || 0);
    } catch (e: any) {
      console.error(e);
      alert(`No fue posible cargar los archivos: ${e?.message || e}`);
      setFiles([]);
      setFilesCount(0);
    } finally {
      setFilesLoading(false);
    }
  }

  useEffect(() => {
    if (!filesOpen) return;
    loadFilesDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesOpen, filesPage, filesPageSize, debouncedFilesQ, fileTypeFilter]);

  // Navegar a historia
  function openHistoryDoc(patientId: string, consultationId: string) {
    try {
      localStorage.setItem("targetProfileId", patientId);
      localStorage.setItem("sourcePage", "estudios-gabinete");
    } catch {}
    router.push(`/historial-clinico/${patientId}/documento?cid=${consultationId}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50/60 via-background to-background">
      <div className="container mx-auto px-3 py-5">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-cyan-600/10 p-2">
              <ClipboardList className="h-5 w-5 text-cyan-700" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-semibold">
                Estudios de gabinete — Radiología
              </h1>
              <p className="text-xs text-muted-foreground">
                Consultas con radiografías solicitadas. Cambia su estado cuando el estudio esté cargado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
              className="cursor-pointer"
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Actualizando
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" /> Refrescar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_1fr_1fr_auto] gap-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar (paciente, motivo, servicio)…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-8"
                />
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">a</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>

              <Select
                value={status}
                onValueChange={(v) => {
                  setPage(1);
                  setStatus(v as StatusFilter);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setOrder((o) => (o === "desc" ? "asc" : "desc"))}
                className="justify-start"
              >
                {order === "desc" ? (
                  <>
                    <SortDesc className="h-4 w-4 mr-1" /> Más recientes
                  </>
                ) : (
                  <>
                    <SortAsc className="h-4 w-4 mr-1" /> Más antiguos
                  </>
                )}
              </Button>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQ("");
                    setFrom("");
                    setTo("");
                    setStatus("pendiente");
                    setOrder("desc");
                    setPage(1);
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resultados ({count})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando estudios…
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded border bg-muted/20 p-3 text-sm text-muted-foreground">
                No hay estudios para los filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Paciente</th>
                      <th className="px-3 py-2 text-left">Servicio</th>
                      <th className="px-3 py-2 text-left">Motivo</th>
                      <th className="px-3 py-2 text-left">Estado RX</th>
                      <th className="px-3 py-2 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.consultation_id} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {fmtDateTime(r.fecha_hora)}
                        </td>
                        <td className="px-3 py-2 min-w-[220px]">
                          <div className="flex items-center gap-2">
                            <Image
                              src={r.patient_avatar_url || "/images.jpg"}
                              alt={r.patient_name || "Paciente"}
                              width={28}
                              height={28}
                              className="rounded-full object-cover ring-1 ring-cyan-200"
                            />
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {r.patient_name || "—"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {r.patient_email || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">{r.servicio || "—"}</td>
                        <td className="px-3 py-2">{r.motivo_consulta || "—"}</td>
                        <td className="px-3 py-2">
                          <RxBadge estado={r.estudios_estado} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Ver imágenes (Drawer en esta página) */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openImagesDrawer(r.patient_id, r.patient_name)}
                              className="cursor-pointer"
                              title="Ver imágenes/documentos del paciente"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver imágenes
                            </Button>

                            {/* Archivos (ruta /uploads actuando como Radiólogo) */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openFilesAsRadiologist(r.patient_id, r.patient_name)}
                              className="cursor-pointer"
                              title="Abrir gestor de archivos actuando como Radiólogo"
                            >
                              <FileImageIcon className="h-4 w-4 mr-1" />
                              Archivos
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => toggleEstado(r)}
                              className="cursor-pointer"
                              title={
                                r.estudios_estado === "completado"
                                  ? "Marcar como pendiente"
                                  : "Marcar como completado"
                              }
                            >
                              {r.estudios_estado === "completado" ? (
                                <>
                                  <Clock className="h-4 w-4 mr-1" /> Pendiente
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Completado
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación estudios */}
            {rows.length > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Página {page} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="cursor-pointer"
                  >
                    Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drawer: Ver imágenes del paciente */}
      <Sheet open={filesOpen} onOpenChange={setFilesOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-3xl">
          <SheetHeader>
            <SheetTitle>
              Imágenes y documentos {filesPatientName ? `— ${filesPatientName}` : ""}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {/* Controles */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar por nombre…"
                  value={filesQ}
                  onChange={(e) => {
                    setFilesPage(1);
                    setFilesQ(e.target.value);
                  }}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    {fileTypeFilter === "all"
                      ? "Todos"
                      : fileTypeFilter === "images"
                      ? "Imágenes"
                      : "Documentos"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setFilesPage(1);
                      setFileTypeFilter("all");
                    }}
                  >
                    Todos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setFilesPage(1);
                      setFileTypeFilter("images");
                    }}
                  >
                    Imágenes
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setFilesPage(1);
                      setFileTypeFilter("docs");
                    }}
                  >
                    Documentos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Por página: {filesPageSize}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {[12, 24, 48].map((n) => (
                    <DropdownMenuItem
                      key={n}
                      onClick={() => {
                        setFilesPage(1);
                        setFilesPageSize(n);
                      }}
                    >
                      {n}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Grid archivos */}
            {filesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando archivos…
              </div>
            ) : files.length === 0 ? (
              <div className="rounded border bg-muted/20 p-3 text-sm text-muted-foreground">
                Este paciente no tiene archivos que coincidan.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {files.map((f) => {
                  const isImg = fileIsImage(f.file_type);
                  return (
                    <div key={f.id} className="rounded-md border overflow-hidden bg-card">
                      <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center">
                        {isImg ? (
                          <img
                            src={f.url}
                            alt={f.filename}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <FileText className="h-7 w-7 mb-1" />
                            <div className="text-[11px]">Documento</div>
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="truncate text-xs font-medium" title={f.filename}>
                          {f.filename}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {f.uploaded_at ? new Date(f.uploaded_at).toLocaleString() : "—"}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">
                            {f.file_type || "—"}
                          </Badge>
                          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                            <a href={f.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              Abrir
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginación archivos */}
            {files.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Página {filesPage} de {filesTotalPages} • {filesCount} archivo(s)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilesPage((p) => Math.max(1, p - 1))}
                    disabled={filesPage <= 1 || filesLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilesPage((p) => Math.min(filesTotalPages, p + 1))}
                    disabled={filesPage >= filesTotalPages || filesLoading}
                  >
                    Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ============ Hook de debounce pequeño ============ */
function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
