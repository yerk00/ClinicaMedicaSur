import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserRole } from "@/lib/profile";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Search, Home, Pencil, ChevronsUpDown, Info } from "lucide-react";

/* ============ Tipos ============ */
type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string | null;
  ci: string | null;
  sexo: string | null;

  last_event_at: string | null; // última atención (consulta/cita)
  last_area: string | null;     // área (servicio/área o ubicación)
  last_source: string | null;   // "consulta" | "cita"
};

type DoctorProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

/* ============ Utils ============ */
function areaBadgeClass(area?: string | null) {
  const a = (area || "").toLowerCase();
  if (a.includes("emerg")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
  if (a.includes("general")) return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200";
  if (a.includes("pedi")) return "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200";
  if (a.includes("trauma")) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200";
  if (a.includes("gine")) return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200";
  return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100";
}

/* ============ Página ============ */
export default function PatientsPage() {
  const router = useRouter();

  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [roleName, setRoleName] = useState<string>("");

  const [editDoctorOpen, setEditDoctorOpen] = useState(false);
  const [docFullName, setDocFullName] = useState("");
  const [docAvatarUrl, setDocAvatarUrl] = useState("");

  // Datos
  const [patients, setPatients] = useState<ProfileRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // UI / filtros
  const [searchQuery, setSearchQuery] = useState("");
  type Density = "cozy" | "compact";
  const [density, setDensity] = useState<Density>("cozy");

  // Paginación
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Debounce búsqueda
  const [qDebounced, setQDebounced] = useState(searchQuery);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* Perfil médico */
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) return;

        const { data, error } = await supabase
          .from("user_profiles")
          .select("id, full_name, email, avatar_url, created_at")
          .eq("id", userId)
          .single();
        if (error) throw error;

        const doc: DoctorProfile = {
          id: data.id,
          full_name: data.full_name,
          email: data.email,
          avatar_url: data.avatar_url,
          created_at: data.created_at,
        };
        setDoctor(doc);
        setDocFullName(doc.full_name || doc.email || "");
        setDocAvatarUrl(doc.avatar_url || "");

        const role = await getCurrentUserRole();
        setRoleName(typeof role === "string" ? role : (role?.name ?? ""));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  /* Listado paginado + RPC última atención */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Role Paciente
        const { data: roleRow, error: roleErr } = await supabase
          .from("roles")
          .select("id")
          .eq("name", "Paciente")
          .single();
        if (roleErr) throw roleErr;

        // Búsqueda server-side: CI / nombre / email
        const q = qDebounced.trim();
        let query = supabase
          .from("user_profiles")
          .select("id, full_name, email, avatar_url, created_at, ci, sexo", { count: "exact" })
          .eq("role_id", roleRow.id);

        if (q) {
          const like = `%${q}%`;
          query = query.or(`ci.ilike.${like},full_name.ilike.${like},email.ilike.${like}`);
        }

        // Paginación real
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data: rows, error, count } = await query
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const base: ProfileRow[] = (rows ?? []).map((p: any) => ({
          id: p.id,
          full_name: p.full_name ?? null,
          email: p.email ?? null,
          avatar_url: p.avatar_url ?? null,
          created_at: p.created_at ?? null,
          ci: p.ci ?? null,
          sexo: p.sexo ?? null,
          last_event_at: null,
          last_area: null,
          last_source: null,
        }));

        setTotal(count ?? base.length);

        // RPC con IDs de la página
        if (base.length > 0) {
          const ids = base.map((r) => r.id);
          const { data: latest, error: rpcErr } = await supabase.rpc(
            "latest_encounters_for",
            { p_ids: ids, include_appointments: true }
          );
          if (!rpcErr && Array.isArray(latest)) {
            const map = new Map<
              string,
              { last_event_at: string | null; area: string | null; source: string | null }
            >();
            latest.forEach((r: any) => {
              map.set(r.patient_id, {
                last_event_at: r.last_event_at ?? null,
                area: r.area ?? null,
                source: r.source ?? null,
              });
            });
            for (const row of base) {
              const m = map.get(row.id);
              if (m) {
                row.last_event_at = m.last_event_at;
                row.last_area = m.area;
                row.last_source = m.source;
              }
            }
          }
        }

        // === ORDEN FINAL: "citas" más recientes primero ===
        // 1) Prioriza registros cuya última atención provenga de "cita"
        // 2) Dentro de cada grupo, ordena por last_event_at DESC (más reciente)
        // 3) Como último recurso, usa created_at DESC (para quienes no tienen atención)
        const ordered = [...base].sort((a, b) => {
          const aw = a.last_source === "cita" ? 1 : 0;
          const bw = b.last_source === "cita" ? 1 : 0;
          if (bw !== aw) return bw - aw;

          const ad = a.last_event_at ? new Date(a.last_event_at).getTime() : -Infinity;
          const bd = b.last_event_at ? new Date(b.last_event_at).getTime() : -Infinity;
          if (bd !== ad) return bd - ad;

          const ac = a.created_at ? new Date(a.created_at).getTime() : -Infinity;
          const bc = b.created_at ? new Date(b.created_at).getTime() : -Infinity;
          return bc - ac;
        });

        setPatients(ordered);
      } catch (e) {
        console.error("load patients fast:", e);
        setPatients([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [qDebounced, page, pageSize]);

  /* Handlers */
  const handleOpenEditDoctor = () => {
    if (!doctor) return;
    setDocFullName(doctor.full_name || doctor.email || "");
    setDocAvatarUrl(doctor.avatar_url || "");
    setEditDoctorOpen(true);
  };
  const handleSaveDoctor = async () => {
    if (!doctor) return;
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          full_name: docFullName || null,
          avatar_url: docAvatarUrl || null,
        })
        .eq("id", doctor.id);
      if (error) throw error;
      setDoctor((prev) => (prev ? { ...prev, full_name: docFullName, avatar_url: docAvatarUrl } : prev));
      setEditDoctorOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  /* UI */
  const pageCount = Math.max(1, Math.ceil((total || 0) / pageSize));
  const padY = density === "cozy" ? "py-2.5" : "py-1.5";

  return (
    <>
      <Head><title>Pacientes</title></Head>

      <TooltipProvider>
        <div className="px-4 pb-8 lg:px-6 xl:px-8">
          {/* Header */}
          <MedicalHeader
            name={doctor?.full_name || doctor?.email || "Usuario"}
            role={roleName || "—"}
            avatarUrl={doctor?.avatar_url || ""}
            onEditProfile={handleOpenEditDoctor}
          />

          {/* Controles */}
          <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Buscar pacientes"
                className="pl-8"
                placeholder="Buscar por CI, nombre o email…"
                value={searchQuery}
                onChange={(e) => { setPage(1); setSearchQuery(e.target.value); }}
              />
            </div>

            <div className="flex items-center gap-2 md:justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Densidad: {density === "cozy" ? "Cómodo" : "Compacto"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDensity("cozy")}>Cómodo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDensity("compact")}>Compacto</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                onClick={() => {
                  try { localStorage.removeItem("targetProfileId"); localStorage.removeItem("targetProfileName"); } catch {}
                  router.push("/home");
                }}
              >
                <Home className="mr-2 h-4 w-4" />
                Volver a mi panel
              </Button>
            </div>
          </div>

          {/* Nota */}
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4" />
            Ordenado por <b className="mx-1">última cita programada</b> (y luego última atención / creación).
          </div>

          {/* Tabla */}
          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Pacientes <span className="text-muted-foreground">({loading ? "…" : total})</span>
                </CardTitle>
                <div className="text-xs text-muted-foreground">{loading ? "Cargando…" : "Actualizado"}</div>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-3" />

              {loading ? (
                <SkeletonTable />
              ) : patients.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="min-w-[780px] w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-background">
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className={`px-3 ${padY}`}>CI</th>
                          <th className={`px-3 ${padY}`}>Nombre</th>
                          <th className={`px-3 ${padY}`}>Área</th>
                          <th className={`px-3 ${padY}`}>Última consulta/cita</th>
                          <th className={`px-3 ${padY} text-right`}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patients.map((p) => (
                          <tr key={p.id} className="border-b last:border-0 odd:bg-muted/5 hover:bg-muted/20 transition-colors">
                            <td className={`px-3 ${padY}`}>
                              <span className="font-mono tabular-nums">{p.ci ?? "—"}</span>
                            </td>
                            <td className={`px-3 ${padY}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-8 w-8">
                                  {p.avatar_url
                                    ? <AvatarImage src={p.avatar_url} alt={p.full_name ?? p.email ?? p.ci ?? p.id} />
                                    : <AvatarFallback>{(p.full_name || p.email || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                                  }
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{p.full_name ?? "—"}</div>
                                  <div className="truncate text-[11px] text-muted-foreground">{p.email ?? "—"}</div>
                                </div>
                              </div>
                            </td>
                            <td className={`px-3 ${padY}`}>
                              {p.last_area ? (
                                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${areaBadgeClass(p.last_area)}`}>
                                  {p.last_area}
                                </span>
                              ) : (
                                <Badge variant="outline" className="text-xs">—</Badge>
                              )}
                            </td>
                            <td className={`px-3 ${padY}`}>
                              {p.last_event_at ? (
                                <div className="flex flex-col leading-tight">
                                  <span className="tabular-nums">
                                    {new Date(p.last_event_at).toLocaleDateString()}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {new Date(p.last_event_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    {p.last_source ? ` • ${p.last_source}` : ""}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className={`px-3 ${padY} text-right`}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      try {
                                        localStorage.setItem("targetProfileId", p.id);
                                        localStorage.setItem("targetProfileName", p.full_name || p.email || "");
                                      } catch {}
                                      router.push(`/home?id=${p.id}`);
                                    }}
                                    aria-label="Abrir ficha clínica"
                                  >
                                    <Home className="mr-2 h-4 w-4" />
                                    Ver
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ficha clínica / timeline del paciente</TooltipContent>
                              </Tooltip>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      Página {page} de {pageCount} • {total} resultado(s)
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline">Filas: {pageSize}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {[10, 25, 50, 100].map((n) => (
                            <DropdownMenuItem key={n} onClick={() => { setPage(1); setPageSize(n); }}>
                              {n}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => setPage(1)} disabled={page <= 1}>{"«"}</Button>
                        <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>{"‹"}</Button>
                        <span className="text-sm text-muted-foreground px-2">{page} / {pageCount}</span>
                        <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>{"›"}</Button>
                        <Button size="sm" variant="outline" onClick={() => setPage(pageCount)} disabled={page >= pageCount}>{"»"}</Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Modal: Editar perfil del Doctor */}
      <Dialog open={editDoctorOpen} onOpenChange={setEditDoctorOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar mi perfil</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {docAvatarUrl ? <AvatarImage src={docAvatarUrl} alt={docFullName} /> : <AvatarFallback>{(docFullName || "U").slice(0, 2).toUpperCase()}</AvatarFallback>}
              </Avatar>
              <div className="text-xs text-muted-foreground">Identificación del profesional de salud.</div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nombre completo</label>
              <Input value={docFullName} onChange={(e) => setDocFullName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Avatar (URL)</label>
              <Input placeholder="https://…" value={docAvatarUrl} onChange={(e) => setDocAvatarUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDoctorOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDoctor}><Pencil className="mr-2 h-4 w-4" />Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ============ Sub-componentes ============ */
function MedicalHeader({
  name,
  role,
  avatarUrl,
  onEditProfile,
}: {
  name: string;
  role: string;
  avatarUrl?: string;
  onEditProfile: () => void;
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border shadow-sm bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20">
      <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 ring-2 ring-white dark:ring-transparent">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : <AvatarFallback>{(name || "U").slice(0, 2).toUpperCase()}</AvatarFallback>}
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold leading-none tracking-tight">{name}</h1>
              <Badge variant="outline" className="gap-1">{role || "—"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Lista de pacientes • Orden por <b>última cita programada</b> (después última atención/creación).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onEditProfile}><Pencil className="mr-2 h-4 w-4" />Editar mi perfil</Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border p-8 text-center">
      <svg viewBox="0 0 24 24" className="mb-2 h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
      <p className="text-sm text-muted-foreground">No se encontraron pacientes con el filtro actual.</p>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
