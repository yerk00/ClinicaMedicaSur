import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import {
  listAppointments,
  createAppointment,
  updateAppointmentStatusNotes,
  rescheduleAppointment,
  cancelAppointment,
  deleteAppointment,
  getDoctorDayAppointments, // ⬅️ para horarios disponibles
  AppointmentRow,
  AppointmentStatus,
  statusToES, // ⬅️ etiquetas ES
} from "@/lib/appointments";
import { getCurrentUserRole } from "@/lib/permissions";
import { createUser } from "@/lib/admin/users";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CalendarRange,
  CalendarClock,
  Calendar as CalendarIcon,
  Plus,
  Stethoscope,
  Search,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ExternalLink,
  UserPlus,
} from "lucide-react";

type Role =
  | "Doctor"
  | "Operador"
  | "Administrador"
  | "Paciente"
  | "Radiólogo"
  | "Enfermero"
  | null;

type ProfileMini = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

// ============ Utils ============

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function combineDateTime(dateStr: string, timeStr: string) {
  if (!dateStr) return null;
  const t = timeStr || "00:00";
  const d = new Date(`${dateStr}T${t}`);
  return isNaN(+d) ? null : d.toISOString();
}

function StatusBadge({ s }: { s: AppointmentStatus }) {
  const map: Record<AppointmentStatus, string> = {
    scheduled:
      "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200",
    confirmed:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200",
    checked_in:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200",
    in_progress:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    completed:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
    canceled:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
    no_show:
      "bg-gray-200 text-gray-800 dark:bg-gray-800/40 dark:text-gray-200",
  };
  return <Badge className={map[s] ?? ""}>{statusToES(s)}</Badge>;
}

function isValidEmail(v: string) {
  const email = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Contraseña por defecto para pacientes (si no van a ingresar al sistema)
function genTempPassword() {
  // Suficiente fuerte y repetible en despliegue; puedes cambiarla por env var si prefieres.
  const base = "PacienteTmp#";
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900 + 100); // 3 dígitos
  return `${base}${year}${rand}`;
}

// === Búsqueda de perfiles por rol (con filtro de recientes y orden por creación desc) ===
async function searchProfilesByRole(
  q: string,
  roleId?: number,
  limit = 8,
  onlyRecent = false,
  recentDays = 30
): Promise<ProfileMini[]> {
  if (!q.trim()) return [];
  let query = supabase
    .from("user_profiles")
    .select("id, full_name, email, avatar_url, role_id, created_at")
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
    .order("created_at", { ascending: false }) // más nuevos primero
    .limit(limit);

  if (typeof roleId === "number") query = query.eq("role_id", roleId);

  if (onlyRecent) {
    const since = new Date();
    since.setDate(since.getDate() - recentDays);
    query = query.gte("created_at", since.toISOString());
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map((p: any) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    avatar_url: p.avatar_url,
  }));
}

async function fetchProfilesByIds(
  ids: string[]
): Promise<Record<string, ProfileMini>> {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", ids);
  if (error) return {};
  const map: Record<string, ProfileMini> = {};
  (data ?? []).forEach((p: any) => (map[p.id] = p));
  return map;
}

// Helper: buscar perfil por email exacto
async function fetchProfileByEmailExact(
  email: string,
  roleId?: number
): Promise[ProfileMini | null] {
  const q = supabase
    .from("user_profiles")
    .select("id, full_name, email, avatar_url, role_id")
    .eq("email", email.trim())
    .limit(1);
  const { data, error } =
    typeof roleId === "number" ? await q.eq("role_id", roleId) : await q;
  if (error || !data || !data[0]) return null;
  const p = data[0];
  return {
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    avatar_url: p.avatar_url,
  };
}

// === Slots disponibles (08:00-18:00 c/30min) ===
function generateSlots(): string[] {
  const res: string[] = [];
  for (let h = 8; h <= 17; h++) {
    res.push(`${String(h).padStart(2, "0")}:00`);
    res.push(`${String(h).padStart(2, "0")}:30`);
  }
  res.push("18:00");
  return res;
}
function isoToHHMM(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function isPastSlot(dateStr: string, hhmm: string) {
  try {
    const now = new Date();
    const slot = new Date(`${dateStr}T${hhmm}:00`);
    return slot.getTime() < now.getTime();
  } catch {
    return false;
  }
}

export default function CitasPage() {
  const router = useRouter();

  // --- Auth guard & rol ---
  const [role, setRole] = useState<Role>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // role_id para filtros: { paciente, doctor }
  const [roleIds, setRoleIds] = useState<{ patient?: number; doctor?: number }>(
    {}
  );

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setUserId(user.id);
      const r = await getCurrentUserRole();
      setRole((r as Role) ?? null);

      // Descubrir role_id de Paciente y Doctor
      const { data: roles } = await supabase
        .from("roles")
        .select("id, name")
        .in("name", ["Paciente", "Doctor"]);
      const map: { patient?: number; doctor?: number } = {};
      (roles ?? []).forEach((row: any) => {
        const name = String(row.name || "").toLowerCase();
        if (name.includes("paciente")) map.patient = row.id;
        if (name.includes("doctor")) map.doctor = row.id;
      });
      setRoleIds(map);
    })();
  }, [router]);

  // --- Filtros/listado ---
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AppointmentRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filtros comunes
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<AppointmentStatus | "all">("all");

  // Para mostrar nombres (patient/doctor)
  const [profileMap, setProfileMap] = useState<Record<string, ProfileMini>>(
    {}
  );

  // --- Dialogs/estado de acciones ---
  const [openCreate, setOpenCreate] = useState(false);
  const [openResched, setOpenResched] = useState<AppointmentRow | null>(null);
  const [openStatus, setOpenStatus] = useState<AppointmentRow | null>(null);
  const [openCancel, setOpenCancel] = useState<AppointmentRow | null>(null);
  const [openDelete, setOpenDelete] = useState<AppointmentRow | null>(null);

  // === Nuevo: dialog para crear Paciente (sin contraseña manual) ===
  const [openCreatePatient, setOpenCreatePatient] = useState(false);
  const initialPatientForm = {
    email: "",
    full_name: "",
    ci: "",
    telefono_contacto: "",
    fecha_nacimiento: "",
    sexo: null as
      | "masculino"
      | "femenino"
      | "otro"
      | "prefiere_no_decir"
      | null,
  };
  const [patientForm, setPatientForm] = useState({ ...initialPatientForm });
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [recentOnly, setRecentOnly] = useState(true); // ⬅️ filtro “recién creados” ON por defecto

  // Form crear cita
  const [searchPatient, setSearchPatient] = useState("");
  const [searchDoctor, setSearchDoctor] = useState("");
  const [patientResults, setPatientResults] = useState<ProfileMini[]>([]);
  const [doctorResults, setDoctorResults] = useState<ProfileMini[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<ProfileMini | null>(
    null
  );
  const [selectedDoctor, setSelectedDoctor] = useState<ProfileMini | null>(
    null
  );
  const [cDate, setCDate] = useState("");
  const [cTime, setCTime] = useState("");
  const [cService, setCService] = useState("");
  const [cReason, setCReason] = useState("");
  const [cLocation, setCLocation] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reprogramar form
  const [rDate, setRDate] = useState("");
  const [rTime, setRTime] = useState("");
  const [rLoc, setRLoc] = useState("");

  // Status/notes form (Doctor)
  const [dStatus, setDStatus] = useState<AppointmentStatus>("confirmed");
  const [dNotes, setDNotes] = useState("");

  // Cargar citas según rol
  async function load() {
    try {
      setLoading(true);

      const params: any = {
        page,
        pageSize,
        order: "desc" as const, // ⬅️ más recientes primero
        q: q || undefined,
      };

      if (from) params.from = `${from}T00:00:00`;
      if (to) params.to = `${to}T23:59:59`;
      if (statusFilter !== "all") params.status = [statusFilter];
      if (role === "Doctor" && userId) params.doctorId = userId;

      const { data, count, error } = await listAppointments(params);
      if (error) {
        toast.error(error);
        setItems([]);
        setCount(0);
        return;
      }

      // Garantizamos orden descendente por si el backend no lo aplica
      const ordered = [...data].sort(
        (a, b) =>
          new Date(b.appointment_time).getTime() -
          new Date(a.appointment_time).getTime()
      );

      setItems(ordered);
      setCount(count);

      // Prefetch perfiles
      const ids = new Set<string>();
      ordered.forEach((a) => {
        ids.add(a.patient_id);
        ids.add(a.doctor_id);
      });
      const map = await fetchProfilesByIds(Array.from(ids));
      setProfileMap(map);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!role) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, page]);

  // Buscar perfiles (autocomplete) con debounce simple y filtro por rol + recientes
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!searchPatient.trim()) {
        setPatientResults([]);
        return;
      }
      const res = await searchProfilesByRole(
        searchPatient.trim(),
        roleIds.patient,
        8,
        recentOnly,
        30
      );
      setPatientResults(res);
    }, 300);
    return () => clearTimeout(t);
  }, [searchPatient, roleIds.patient, recentOnly]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!searchDoctor.trim()) {
        setDoctorResults([]);
        return;
      }
      const res = await searchProfilesByRole(
        searchDoctor.trim(),
        roleIds.doctor,
        8,
        false
      );
      setDoctorResults(res);
    }, 300);
    return () => clearTimeout(t);
  }, [searchDoctor, roleIds.doctor]);

  // Handlers crear cita
  async function handleCreate() {
    if (!selectedPatient || !selectedDoctor) {
      toast.error("Selecciona paciente y doctor.");
      return;
    }
    const iso = combineDateTime(cDate, cTime);
    if (!iso) {
      toast.error("Completa fecha y hora válidas.");
      return;
    }
    setSaving(true);
    const { error } = await createAppointment({
      patient_id: selectedPatient.id,
      doctor_id: selectedDoctor.id,
      appointment_time: iso,
      service: cService || null,
      reason: cReason || null,
      location: cLocation || null,
      notes: cNotes || null,
      status: "scheduled", // Programado por defecto
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Cita creada");
    setOpenCreate(false);
    // reset form
    setSearchPatient("");
    setSelectedPatient(null);
    setSearchDoctor("");
    setSelectedDoctor(null);
    setCDate("");
    setCTime("");
    setCService("");
    setCReason("");
    setCLocation("");
    setCNotes("");
    await load();
  }

  // Handlers reprogramar
  async function handleReschedule() {
    if (!openResched) return;
    const iso = combineDateTime(rDate, rTime);
    if (!iso) {
      toast.error("Completa fecha y hora válidas.");
      return;
    }
    const { error } = await rescheduleAppointment({
      id: openResched.id,
      appointment_time: iso,
      location: rLoc || null,
    });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Cita reprogramada");
    setOpenResched(null);
    await load();
  }

  // Handlers estado/notas (doctor)
  async function handleUpdateStatusNotes() {
    if (!openStatus) return;
    const { error } = await updateAppointmentStatusNotes(openStatus.id, {
      status: dStatus,
      notes: dNotes || null,
    });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Estado/Notas actualizados");
    if (dStatus === "in_progress") {
      // Redirige al home del paciente cuando doctor pone "Atendiendo"
      router.push(`/home?id=${openStatus.patient_id}`);
      return;
    }
    setOpenStatus(null);
    await load();
  }

  // Cancelar (operador/admin y doctor)
  const [cancelReason, setCancelReason] = useState("");
  async function handleCancel() {
    if (!openCancel) return;
    const { error } = await cancelAppointment({
      id: openCancel.id,
      reason: cancelReason || null,
    });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Cita cancelada");
    setOpenCancel(null);
    setCancelReason("");
    await load();
  }

  // Eliminar (operador/admin)
  async function handleDelete() {
    if (!openDelete) return;
    const { error } = await deleteAppointment(openDelete.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Cita eliminada");
    setOpenDelete(null);
    await load();
  }

  async function applyFilters() {
    setPage(1);
    await load();
  }

  const canOperate = role === "Operador" || role === "Administrador";
  const isDoctor = role === "Doctor";

  // === Crear Paciente ===
  function openCreatePatientWithPrefill() {
    const guessEmail = searchPatient.includes("@") ? searchPatient.trim() : "";
    setPatientForm({
      ...initialPatientForm,
      email: guessEmail,
      full_name: "",
    });
    setOpenCreatePatient(true);
  }

  async function handleCreatePatient() {
    if (!roleIds.patient) {
      toast.error("No se encontró el rol Paciente en el sistema.");
      return;
    }
    const email = patientForm.email.trim();
    if (!isValidEmail(email)) {
      toast.error("Email inválido.");
      return;
    }

    setCreatingPatient(true);
    try {
      await createUser({
        email,
        full_name: patientForm.full_name?.trim() || undefined,
        role_id: roleIds.patient,          // ← SIEMPRE Paciente
        status: "active",
        ci: (patientForm.ci || "").trim() || null,
        fecha_nacimiento: patientForm.fecha_nacimiento || null,
        sexo: patientForm.sexo ?? null,
        telefono_contacto: (patientForm.telefono_contacto || "").trim() || null,
        // sin intervención del operador → siempre password por defecto
        mode: "password",
        temp_password: genTempPassword(),
      });

      toast.success("Paciente creado");

      // Autoseleccionar el paciente por email exacto
      const created = await fetchProfileByEmailExact(email, roleIds.patient);
      if (created) {
        setSelectedPatient(created);
        setSearchPatient(created.full_name || created.email || "");
      } else {
        // Fallback: refrescar resultados de búsqueda
        const res = await searchProfilesByRole(email, roleIds.patient, 8, true);
        setPatientResults(res);
      }

      setOpenCreatePatient(false);
      setPatientForm({ ...initialPatientForm });
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear el paciente");
    } finally {
      setCreatingPatient(false);
    }
  }

  // ============ UI ============

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50/60 via-background to-background">
      <div className="container mx-auto px-3 py-5">
        {/* Top bar */}
        <div className="mb-5 flex items-center justify-between rounded-xl border bg-white/60 dark:bg-card/60 backdrop-blur p-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/home")}
              className="cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
            <div className="text-base font-semibold">Gestión de Citas</div>
            {role && <Badge variant="outline" className="ml-2">{role}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {canOperate && (
              <>
                <Button
                  size="sm"
                  onClick={() => setOpenCreate(true)}
                  className="cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nueva cita
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={openCreatePatientWithPrefill}
                  className="cursor-pointer"
                  title="Crear nuevo paciente"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Nuevo paciente
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px_180px_120px] gap-2 items-end">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar (servicio, motivo, lugar, notas)…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="scheduled">Programado</SelectItem>
                    <SelectItem value="confirmed">Reprogramado</SelectItem>
                    <SelectItem value="in_progress">Atendiendo</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="canceled">Cancelada</SelectItem>
                    <SelectItem value="no_show">No asistió</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={applyFilters}
                  className="w-full cursor-pointer"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />
              {isDoctor ? "Mi agenda" : "Todas las citas"}
            </CardTitle>
          </CardHeader>
        <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </div>
            ) : items.length === 0 ? (
              <div className="rounded border bg-muted/20 p-3 text-sm text-muted-foreground">
                No hay citas con los filtros actuales.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Fecha/Hora</th>
                      <th className="px-3 py-2 text-left">Paciente</th>
                      <th className="px-3 py-2 text-left">Doctor</th>
                      <th className="px-3 py-2 text-left">Servicio</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-left">Lugar</th>
                      <th className="px-3 py-2 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) => {
                      const p = profileMap[a.patient_id];
                      const d = profileMap[a.doctor_id];
                      return (
                        <tr key={a.id} className="border-t">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 text-foreground">
                              <CalendarIcon className="h-3.5 w-3.5" />
                              {fmt(a.appointment_time)}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold">
                                {(p?.full_name || p?.email || "P")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate">
                                  {p?.full_name || "Paciente"}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {p?.email || "—"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-4 w-4 text-muted-foreground" />
                              <div className="min-w-0">
                                <div className="truncate">
                                  {d?.full_name || "Doctor"}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {d?.email || "—"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">{a.service ?? "—"}</td>
                          <td className="px-3 py-2">
                            <StatusBadge s={a.status} />
                          </td>
                          <td className="px-3 py-2">{a.location ?? "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {isDoctor && userId === a.doctor_id && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setOpenStatus(a);
                                    setDStatus(a.status);
                                    setDNotes(a.notes || "");
                                  }}
                                  className="cursor-pointer"
                                  title="Estado / Notas"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Estado
                                </Button>
                              )}

                              {(role === "Operador" ||
                                role === "Administrador") && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setOpenResched(a);
                                      const d = new Date(a.appointment_time);
                                      setRDate(d.toISOString().slice(0, 10));
                                      setRTime(d.toTimeString().slice(0, 5));
                                      setRLoc(a.location || "");
                                    }}
                                    className="cursor-pointer"
                                    title="Reprogramar"
                                  >
                                    <CalendarClock className="h-4 w-4 mr-1" />
                                    Reprog.
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setOpenCancel(a)}
                                    className="cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setOpenDelete(a)}
                                    className="cursor-pointer"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Eliminar
                                  </Button>
                                </>
                              )}

                              {isDoctor &&
                                userId === a.doctor_id &&
                                !(role === "Operador" || role === "Administrador") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setOpenCancel(a)}
                                    className="cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Cancelar
                                  </Button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación */}
            <div className="mt-3 flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                {count} resultado{count === 1 ? "" : "s"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <div>Página {page}</div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * pageSize >= count}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* === Dialog: Crear cita (Operador/Admin) === */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Nueva cita</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Paciente (solo rol Paciente) */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Paciente</Label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={recentOnly}
                    onChange={(e) => setRecentOnly(e.target.checked)}
                  />
                  Solo recién creados (30 días)
                </label>
              </div>
              <Input
                placeholder="Buscar nombre o email…"
                value={searchPatient}
                onChange={(e) => {
                  setSearchPatient(e.target.value);
                  setSelectedPatient(null);
                }}
              />
              {selectedPatient ? (
                <div className="mt-1 text-xs text-foreground">
                  Seleccionado:{" "}
                  <b>
                    {selectedPatient.full_name || selectedPatient.email}
                  </b>
                </div>
              ) : (
                <div className="mt-1 max-h-40 overflow-auto rounded border">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-2 py-1 hover:bg-accent/50"
                      onClick={() => setSelectedPatient(p)}
                    >
                      {(p.full_name || p.email) ?? p.id}
                    </button>
                  ))}
                  {patientResults.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground flex items-center justify-between">
                      <span>Sin resultados (Pacientes)…</span>
                      {canOperate && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7"
                          onClick={openCreatePatientWithPrefill}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          Crear paciente
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Doctor (solo rol Doctor) */}
            <div>
              <Label>Doctor</Label>
              <Input
                placeholder="Buscar nombre o email…"
                value={searchDoctor}
                onChange={(e) => {
                  setSearchDoctor(e.target.value);
                  setSelectedDoctor(null);
                }}
              />
              {selectedDoctor ? (
                <div className="mt-1 text-xs text-foreground">
                  Seleccionado:{" "}
                  <b>{selectedDoctor.full_name || selectedDoctor.email}</b>
                </div>
              ) : (
                <div className="mt-1 max-h-40 overflow-auto rounded border">
                  {doctorResults.map((d) => (
                    <button
                      key={d.id}
                      className="w-full text-left px-2 py-1 hover:bg-accent/50"
                      onClick={() => setSelectedDoctor(d)}
                    >
                      {(d.full_name || d.email) ?? d.id}
                    </button>
                  ))}
                  {doctorResults.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      Sin resultados (Doctores)…
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fecha / Hora */}
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={cDate}
                onChange={(e) => setCDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Hora</Label>
              <Input
                type="time"
                value={cTime}
                onChange={(e) => setCTime(e.target.value)}
              />
            </div>

            <div>
              <Label>Servicio</Label>
              <Input
                value={cService}
                onChange={(e) => setCService(e.target.value)}
                placeholder="Ej. Atención general"
              />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input
                value={cReason}
                onChange={(e) => setCReason(e.target.value)}
                placeholder="Ej. Dolor torácico"
              />
            </div>

            <div>
              <Label>Lugar</Label>
              <Input
                value={cLocation}
                onChange={(e) => setCLocation(e.target.value)}
                placeholder="Ej. Consultorio 2"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Notas</Label>
              <Textarea
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Horarios disponibles */}
          <AvailableSlots
            doctorId={selectedDoctor?.id || null}
            dateStr={cDate}
            selected={cTime}
            onPick={(hhmm) => setCTime(hhmm)}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando…
                </>
              ) : (
                "Crear cita"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog: Crear Paciente (sin contraseña manual) === */}
      <Dialog open={openCreatePatient} onOpenChange={setOpenCreatePatient}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Nuevo paciente</DialogTitle>
            <DialogDescription>
              Crea un usuario con rol <b>Paciente</b> para asignarlo a citas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input
                value={patientForm.email}
                onChange={(e) =>
                  setPatientForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="correo@dominio.com"
              />
            </div>
            <div>
              <Label>Nombre completo</Label>
              <Input
                value={patientForm.full_name}
                onChange={(e) =>
                  setPatientForm((f) => ({
                    ...f,
                    full_name: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>CI</Label>
              <Input
                value={patientForm.ci}
                onChange={(e) =>
                  setPatientForm((f) => ({ ...f, ci: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={patientForm.telefono_contacto}
                onChange={(e) =>
                  setPatientForm((f) => ({
                    ...f,
                    telefono_contacto: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Fecha nacimiento</Label>
              <Input
                type="date"
                value={patientForm.fecha_nacimiento}
                onChange={(e) =>
                  setPatientForm((f) => ({
                    ...f,
                    fecha_nacimiento: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Sexo</Label>
              <Select
                value={patientForm.sexo ?? "NONE"}
                onValueChange={(v: any) =>
                  setPatientForm((f) => ({
                    ...f,
                    sexo: v === "NONE" ? null : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">—</SelectItem>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="femenino">Femenino</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                  <SelectItem value="prefiere_no_decir">
                    Prefiere no decir
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpenCreatePatient(false);
                setPatientForm({ ...initialPatientForm });
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreatePatient}
              disabled={creatingPatient}
              className="cursor-pointer"
            >
              {creatingPatient ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Creando…
                </>
              ) : (
                "Crear paciente"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog: Reprogramar (Operador/Admin) === */}
      <Dialog
        open={!!openResched}
        onOpenChange={(v) => !v && setOpenResched(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Reprogramar cita</DialogTitle>
          </DialogHeader>
          {openResched && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={rDate}
                  onChange={(e) => setRDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={rTime}
                  onChange={(e) => setRTime(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Lugar</Label>
                <Input
                  value={rLoc}
                  onChange={(e) => setRLoc(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenResched(null)}>
              Cerrar
            </Button>
            <Button onClick={handleReschedule} className="cursor-pointer">
              <CalendarClock className="h-4 w-4 mr-1" />
              Reprogramar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog: Estado / Notas (Doctor) === */}
      <Dialog
        open={!!openStatus}
        onOpenChange={(v) => !v && setOpenStatus(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Actualizar estado / notas</DialogTitle>
          </DialogHeader>
          {openStatus && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Estado</Label>
                <Select
                  value={dStatus}
                  onValueChange={(v) => setDStatus(v as AppointmentStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Programado</SelectItem>
                    <SelectItem value="confirmed">Reprogramado</SelectItem>
                    <SelectItem value="in_progress">Atendiendo</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="canceled">Cancelada</SelectItem>
                    <SelectItem value="no_show">No asistió</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notas</Label>
                <Textarea
                  rows={4}
                  value={dNotes}
                  onChange={(e) => setDNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenStatus(null)}>
              Cerrar
            </Button>
            <Button onClick={handleUpdateStatusNotes} className="cursor-pointer">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog: Cancelar === */}
      <Dialog
        open={!!openCancel}
        onOpenChange={(v) => !v && setOpenCancel(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Cancelar cita</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Motivo</Label>
            <Textarea
              rows={4}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCancel(null)}>
              Cerrar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              className="cursor-pointer"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancelar cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog: Eliminar === */}
      <Dialog
        open={!!openDelete}
        onOpenChange={(v) => !v && setOpenDelete(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Eliminar cita</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Esta acción es permanente. ¿Deseas eliminar la cita?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDelete(null)}>
              Cerrar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="cursor-pointer"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========= Componente: Horarios disponibles ========= */
function AvailableSlots({
  doctorId,
  dateStr,
  selected,
  onPick,
}: {
  doctorId: string | null;
  dateStr: string;
  selected: string;
  onPick: (hhmm: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [occupied, setOccupied] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      if (!doctorId || !dateStr) {
        setOccupied(new Set());
        return;
      }
      setLoading(true);
      const { data, error } = await getDoctorDayAppointments({
        doctorId,
        date: dateStr,
      });
      setLoading(false);
      if (error) {
        setOccupied(new Set());
        return;
      }

      // Ocupan el slot todas excepto 'canceled'
      const occ = new Set<string>();
      (data || []).forEach((a) => {
        if (a.status !== "canceled") {
          occ.add(isoToHHMM(a.appointment_time));
        }
      });
      setOccupied(occ);
    })();
  }, [doctorId, dateStr]);

  if (!doctorId || !dateStr) return null;

  const slots = generateSlots();

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Horarios disponibles</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando horarios…
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {slots.map((hhmm) => {
              const isOcc = occupied.has(hhmm);
              const isPast = isPastSlot(dateStr, hhmm);
              const active = selected === hhmm;
              const disabled = isOcc || isPast;
              return (
                <button
                  key={hhmm}
                  type="button"
                  onClick={() => !disabled && onPick(hhmm)}
                  className={[
                    "px-2 py-1 rounded border text-xs transition",
                    disabled
                      ? "bg-muted/30 text-muted-foreground cursor-not-allowed"
                      : active
                      ? "bg-cyan-600 text-white border-cyan-700"
                      : "bg-white hover:bg-cyan-50 border-cyan-200 text-foreground cursor-pointer",
                  ].join(" ")}
                  title={
                    disabled ? (isOcc ? "Ocupado" : "Pasado") : "Seleccionar"
                  }
                >
                  {hhmm}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-2 text-[11px] text-muted-foreground">
          * Ocupados = citas existentes (excepto canceladas). Se muestran
          intervalos de 30min entre 08:00 y 18:00.
        </div>
      </CardContent>
    </Card>
  );
}
