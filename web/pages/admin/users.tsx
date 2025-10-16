'use client';

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listUsers, listRoles,
  updateUserRole, updateUserStatus,
  bulkUpdateRole, bulkUpdateStatus,
  createUser,
  getUserDetails, updateUserProfile,
  type ListUsersParams, type UserStatus, type Role,
  type AdminUserDetails,
} from "@/lib/admin/users";
import { motion } from "framer-motion";
import { toast } from "sonner";

// shadcn/ui
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

const PAGE_SIZE = 20;

// Tokens para evitar value=""
const ROLE_ALL = "__all_roles__";
const STATUS_ALL = "__all_status__";
const NONE = "__none__";

export default function AdminUsersPage() {
  const qc = useQueryClient();

  // ---- filtros & estados UI ----
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [roleId, setRoleId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<UserStatus | undefined>(undefined);
  const [sortBy, setSortBy] = useState<ListUsersParams["sortBy"]>("created_at");
  const [sortDir, setSortDir] = useState<ListUsersParams["sortDir"]>("desc");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = useMemo(() => selected.length > 0, [selected]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  // roles (catálogo)
  const rolesQ = useQuery({ queryKey: ["admin-roles"], queryFn: listRoles, staleTime: 5 * 60 * 1000 });

  // listado
  const usersQ = useQuery({
    queryKey: ["admin-users", { q: debouncedQ, roleId, status, sortBy, sortDir, page }],
    queryFn: () =>
      listUsers({
        q: debouncedQ || undefined,
        roleId,
        status,
        sortBy,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      }),
    keepPreviousData: true,
  });

  // --- mutaciones unitarias ---
  const mRole = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: number }) => updateUserRole(userId, roleId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Rol actualizado"); },
    onError: (e: any) => toast.error(e.message || "No se pudo cambiar el rol"),
  });
  const mStatus = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) => updateUserStatus(userId, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Estado actualizado"); },
    onError: (e: any) => toast.error(e.message || "No se pudo cambiar el estado"),
  });

  // --- mutaciones masivas ---
  const mBulkStatus = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: UserStatus }) => bulkUpdateStatus(ids, status),
    onSuccess: () => { setSelected([]); qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Estados actualizados"); },
    onError: (e: any) => toast.error(e.message || "Acción masiva falló"),
  });
  const mBulkRole = useMutation({
    mutationFn: ({ ids, roleId }: { ids: string[]; roleId: number }) => bulkUpdateRole(ids, roleId),
    onSuccess: () => { setSelected([]); qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Roles actualizados"); },
    onError: (e: any) => toast.error(e.message || "Acción masiva falló"),
  });

  // --- crear usuario ---
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<{
    email: string; full_name?: string; role_id?: number; status?: UserStatus;
    ci?: string | null; fecha_nacimiento?: string | null;
    sexo?: "masculino" | "femenino" | "otro" | "prefiere_no_decir" | null;
    telefono_contacto?: string | null; mode: "invite" | "password"; temp_password?: string;
  }>({ email: "", full_name: "", role_id: undefined, status: "active", ci: null, fecha_nacimiento: null, sexo: null, telefono_contacto: null, mode: "invite", temp_password: "" });

  const mCreate = useMutation({
    mutationFn: createUser,
    onSuccess: () => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Usuario creado"); },
    onError: async (e: any) => { toast.error(e?.message || "No se pudo crear el usuario"); },
  });

  // --- modal ver/editar perfil ---
  const [openProfile, setOpenProfile] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const profileQ = useQuery({
    queryKey: ["admin-user-details", profileId],
    queryFn: () => getUserDetails(profileId as string),
    enabled: !!profileId,
  });

  const mUpdateProfile = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => updateUserProfile(id, patch),
    onSuccess: () => {
      toast.success("Perfil actualizado");
      qc.invalidateQueries({ queryKey: ["admin-user-details", profileId] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message || "No se pudo actualizar el perfil"),
  });

  const result = usersQ.data;
  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function selectAllPage() {
    const pageIds = rows.map((r) => r.id);
    const allIn = pageIds.every((id) => selected.includes(id));
    setSelected((prev) => (allIn ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])] ));
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground">Busca, filtra y edita sin salir de esta vista.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Crear usuario</Button>
      </header>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-12 items-center">
            <div className="md:col-span-4">
              <Input placeholder="Buscar por nombre o email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
            <div className="md:col-span-3">
              {/* Rol (con token ROLE_ALL) */}
              <Select
                value={roleId != null ? String(roleId) : ROLE_ALL}
                onValueChange={(v) => { setRoleId(v === ROLE_ALL ? undefined : Number(v)); setPage(1); }}
              >
                <SelectTrigger><SelectValue placeholder="Todos los roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROLE_ALL}>Todos los roles</SelectItem>
                  {(rolesQ.data ?? []).map((r: Role) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              {/* Estado (con token STATUS_ALL) */}
              <Select
                value={status ?? STATUS_ALL}
                onValueChange={(v) => { setStatus(v === STATUS_ALL ? undefined : (v as UserStatus)); setPage(1); }}
              >
                <SelectTrigger><SelectValue placeholder="Todos los estados" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Fecha</SelectItem>
                    <SelectItem value="full_name">Nombre</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortDir} onValueChange={(v: any) => setSortDir(v)}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Desc</SelectItem>
                    <SelectItem value="asc">Asc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Acciones masivas */}
          <div className="flex flex-wrap gap-2 items-center mt-4">
            <Badge variant="outline">Seleccionados: {selected.length}</Badge>
            <Button variant="secondary" disabled={!allSelected} onClick={() => mBulkStatus.mutate({ ids: selected, status: "active" })}>Activar</Button>
            <Button variant="secondary" disabled={!allSelected} onClick={() => mBulkStatus.mutate({ ids: selected, status: "inactive" })}>Inactivar</Button>

            <Select onValueChange={(v) => { if (!v) return; mBulkRole.mutate({ ids: selected, roleId: Number(v) }); }}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Cambiar rol (masivo)" /></SelectTrigger>
              <SelectContent>
                {(rolesQ.data ?? []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">
                    <input type="checkbox" className="accent-cyan-600" onChange={selectAllPage}
                      checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))}/>
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQ.isLoading && (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={`sk-${i}`} className="animate-pulse">
                      <TableCell colSpan={7}><div className="h-6 rounded bg-muted" /></TableCell>
                    </TableRow>
                  ))
                )}
                {rows.map((u) => (
                  <motion.tr key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }} className="hover:bg-muted/40">
                    <TableCell>
                      <input type="checkbox" className="accent-cyan-600" checked={selected.includes(u.id)} onChange={() => toggleSelect(u.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select value={String(u.role_id)} onValueChange={(v) => mRole.mutate({ userId: u.id, roleId: Number(v) })}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(rolesQ.data ?? []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant={u.status === "active" ? "default" : "secondary"}
                        onClick={() => mStatus.mutate({ userId: u.id, status: u.status === "active" ? "inactive" : "active" })}>
                        {u.status === "active" ? "Activo" : "Inactivo"}
                      </Button>
                    </TableCell>
                    <TableCell>{u.created_at ? new Date(u.created_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => { setProfileId(u.id); setOpenProfile(true); }}>
                        Ver perfil
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
                {!usersQ.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      Sin resultados. Ajusta filtros o búsqueda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Paginación */}
          <div className="flex items-center justify-between p-4">
            <span className="text-sm text-muted-foreground">
              Página {page} de {Math.max(1, totalPages)} — {total} usuarios
            </span>
            <div className="space-x-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Crear usuario */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
            <DialogDescription>Invita por correo o asigna una contraseña temporal.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} /></div>
              <div><Label>Nombre completo</Label><Input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} /></div>
              <div>
                <Label>Rol</Label>
                {/* value puede ser ROLE_ALL (placeholder) si no eligió aún */}
                <Select
                  value={createForm.role_id != null ? String(createForm.role_id) : ROLE_ALL}
                  onValueChange={(v) => setCreateForm({ ...createForm, role_id: v === ROLE_ALL ? undefined : Number(v) })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona rol" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROLE_ALL}>—</SelectItem>
                    {(rolesQ.data ?? []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={createForm.status ?? "active"} onValueChange={(v: any) => setCreateForm({ ...createForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>CI</Label><Input value={createForm.ci ?? ""} onChange={(e) => setCreateForm({ ...createForm, ci: e.target.value || null })} /></div>
              <div><Label>Teléfono</Label><Input value={createForm.telefono_contacto ?? ""} onChange={(e) => setCreateForm({ ...createForm, telefono_contacto: e.target.value || null })} /></div>
              <div><Label>Fecha nacimiento</Label><Input type="date" value={createForm.fecha_nacimiento ?? ""} onChange={(e) => setCreateForm({ ...createForm, fecha_nacimiento: e.target.value || null })} /></div>
              <div>
                <Label>Sexo</Label>
                <Select
                  value={createForm.sexo ?? NONE}
                  onValueChange={(v: any) => setCreateForm({ ...createForm, sexo: v === NONE ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="femenino">Femenino</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                    <SelectItem value="prefiere_no_decir">Prefiere no decir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-2" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Modo</Label>
                <Select value={createForm.mode} onValueChange={(v: any) => setCreateForm({ ...createForm, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invite">Invitar por correo</SelectItem>
                    <SelectItem value="password">Contraseña temporal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contraseña temporal</Label>
                <Input disabled={createForm.mode !== "password"} value={createForm.temp_password ?? ""} onChange={(e) => setCreateForm({ ...createForm, temp_password: e.target.value })}/>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!createForm.email || !createForm.role_id) { toast.error("Email y rol son obligatorios"); return; }
                mCreate.mutate({
                  email: createForm.email,
                  full_name: createForm.full_name || undefined,
                  role_id: createForm.role_id!,
                  status: (createForm.status ?? "active") as UserStatus,
                  ci: createForm.ci ?? null,
                  fecha_nacimiento: createForm.fecha_nacimiento ?? null,
                  sexo: createForm.sexo ?? null,
                  telefono_contacto: createForm.telefono_contacto ?? null,
                  mode: createForm.mode,
                  temp_password: createForm.mode === "password" ? createForm.temp_password : undefined,
                });
              }}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Ver/editar perfil */}
      <Dialog open={openProfile} onOpenChange={setOpenProfile}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Perfil del usuario</DialogTitle>
            <DialogDescription>Consulta y edita datos del perfil.</DialogDescription>
          </DialogHeader>

          {profileQ.isLoading ? (
            <div className="h-40 animate-pulse rounded bg-muted" />
          ) : profileQ.data ? (
            <ProfileForm
              data={profileQ.data}
              roles={rolesQ.data ?? []}
              onSave={(patch) => mUpdateProfile.mutate({ id: profileQ.data!.id, patch })}
            />
          ) : (
            <div className="text-sm text-muted-foreground">No se encontró el usuario.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileForm({
  data, roles, onSave,
}: {
  data: AdminUserDetails;
  roles: Role[];
  onSave: (patch: Partial<AdminUserDetails>) => void;
}) {
  const [form, setForm] = useState<Partial<AdminUserDetails>>({
    full_name: data.full_name ?? "", email: data.email,
    ci: data.ci ?? "", telefono_contacto: data.telefono_contacto ?? "",
    fecha_nacimiento: data.fecha_nacimiento ?? "",
    sexo: data.sexo ?? null,
    direccion_calle: data.direccion_calle ?? "",
    direccion_zona_ciudad: data.direccion_zona_ciudad ?? "",
    direccion_departamento: data.direccion_departamento ?? "",
    role_id: data.role_id,
    status: data.status,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>Nombre</Label><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>

        <div>
          <Label>Rol</Label>
          <Select value={String(form.role_id ?? data.role_id)} onValueChange={(v) => setForm({ ...form, role_id: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Estado</Label>
          <Select value={form.status ?? data.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="inactive">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div><Label>CI</Label><Input value={form.ci ?? ""} onChange={(e) => setForm({ ...form, ci: e.target.value })} /></div>
        <div><Label>Teléfono</Label><Input value={form.telefono_contacto ?? ""} onChange={(e) => setForm({ ...form, telefono_contacto: e.target.value })} /></div>
        <div><Label>Fecha nacimiento</Label><Input type="date" value={form.fecha_nacimiento ?? ""} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} /></div>
        <div>
          <Label>Sexo</Label>
          <Select
            value={form.sexo ?? NONE}
            onValueChange={(v: any) => setForm({ ...form, sexo: v === NONE ? null : v })}
          >
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="femenino">Femenino</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
              <SelectItem value="prefiere_no_decir">Prefiere no decir</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2"><Label>Dirección — calle</Label><Input value={form.direccion_calle ?? ""} onChange={(e) => setForm({ ...form, direccion_calle: e.target.value })} /></div>
        <div><Label>Zona/Ciudad</Label><Input value={form.direccion_zona_ciudad ?? ""} onChange={(e) => setForm({ ...form, direccion_zona_ciudad: e.target.value })} /></div>
        <div><Label>Departamento</Label><Input value={form.direccion_departamento ?? ""} onChange={(e) => setForm({ ...form, direccion_departamento: e.target.value })} /></div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => {
          setForm({
            full_name: data.full_name ?? "", email: data.email,
            ci: data.ci ?? "", telefono_contacto: data.telefono_contacto ?? "",
            fecha_nacimiento: data.fecha_nacimiento ?? "",
            sexo: data.sexo ?? null,
            direccion_calle: data.direccion_calle ?? "",
            direccion_zona_ciudad: data.direccion_zona_ciudad ?? "",
            direccion_departamento: data.direccion_departamento ?? "",
            role_id: data.role_id, status: data.status,
          });
        }}>Restaurar</Button>
        <Button onClick={() => onSave(form)}>Guardar cambios</Button>
      </div>
    </div>
  );
}
