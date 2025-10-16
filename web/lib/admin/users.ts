  // /lib/admin/users.ts
  // Gestión de usuarios (Administrador)
  // -------------------------------------------------------------
  // Requiere: "@/lib/supabaseClient"
  // Seguridad: RLS debe permitir a Admin leer/actualizar user_profiles.
  // La creación de usuarios usa un endpoint server-side con service_role.
  // -------------------------------------------------------------

  import { supabase } from "@/lib/supabaseClient";

  export type UserStatus = "active" | "inactive";

  export interface Role {
    id: number;
    name: string;
  }

  export interface AdminUserRow {
    id: string;               // uuid (auth.users.id / user_profiles.id)
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    role_id: number;
    role_name?: string;       // opcional (join con roles)
    status: UserStatus;
    created_at: string | null;
  }

  export type SortBy = "created_at" | "full_name";
  export type SortDir = "asc" | "desc";

  export interface ListUsersParams {
    page?: number;            // 1-based
    pageSize?: number;        // default 20
    q?: string;               // búsqueda en email / full_name (ILIKE)
    roleId?: number;          // filtro por rol
    status?: UserStatus;      // filtro por estado
    sortBy?: SortBy;          // "created_at" | "full_name"
    sortDir?: SortDir;        // "asc" | "desc"
  }

  export interface ListUsersResult {
    rows: AdminUserRow[];
    total: number;
    page: number;
    pageSize: number;
  }

  /** Sanitiza texto para ILIKE */
  function ilikePattern(s: string) {
    const escaped = s.replace(/[%_]/g, (m) => `\\${m}`);
    return `%${escaped}%`;
  }

  /** Whitelist de ordenamiento para evitar inyecciones por sort dinámico */
  const SORT_WHITELIST: Record<SortBy, string> = {
    created_at: "created_at",
    full_name: "full_name",
  };

  /**
   * Lista/pagina usuarios con búsqueda, filtros y ordenamiento.
   * Nota: el join a roles(name) requiere relación en Supabase:
   *   roles!user_profiles_role_id_fkey(name)
   */
  export async function listUsers(params: ListUsersParams = {}): Promise<ListUsersResult> {
    const {
      page = 1,
      pageSize = 20,
      q,
      roleId,
      status,
      sortBy = "created_at",
      sortDir = "desc",
    } = params;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("user_profiles")
      .select(
        "id, email, full_name, avatar_url, role_id, status, created_at, roles(name)",
        { count: "exact" }
      );

    // Filtros
    if (roleId != null) query = query.eq("role_id", roleId);
    if (status) query = query.eq("status", status);

    if (q && q.trim().length > 0) {
      const pattern = ilikePattern(q.trim());
      query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
    }

    // Orden (whitelist)
    const sortCol = SORT_WHITELIST[sortBy] ?? "created_at";
    query = query.order(sortCol, { ascending: sortDir === "asc" });

    // Paginación
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(`listUsers: ${error.message}`);

    const rows: AdminUserRow[] =
      (data ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        avatar_url: u.avatar_url,
        role_id: u.role_id,
        role_name: u.roles?.name ?? undefined,
        status: u.status,
        created_at: u.created_at,
      })) ?? [];

    return {
      rows,
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  /** Catálogo de roles (para dropdowns) */
  export async function listRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from("roles")
      .select("id, name")
      .order("name", { ascending: true });
    if (error) throw new Error(`listRoles: ${error.message}`);
    return (data ?? []) as Role[];
  }

  export interface CreateUserPayload {
    email: string;
    full_name?: string;
    role_id: number;
    status?: UserStatus;                       // default "active"
    // Datos opcionales del perfil:
    ci?: string | null;
    fecha_nacimiento?: string | null;         // "YYYY-MM-DD"
    sexo?: "masculino" | "femenino" | "otro" | "prefiere_no_decir" | null;
    telefono_contacto?: string | null;
    // Modalidad de alta:
    mode: "invite" | "password";              // invite: email invite; password: temp password
    temp_password?: string;                   // requerido si mode = "password"
  }

  /**
   * Crea usuario vía API server (service_role).
   * Requiere /api/admin/users/create implementado.
   */
  export async function createUser(payload: any): Promise<{ userId: string }> {
    const resp = await fetch("/api/admin/createUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    if (!resp.ok) {
      let detail = `${resp.status} ${resp.statusText}`;
      try {
        const ct = resp.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const j = await resp.json();
          if (j?.error) detail = j.error;
        }
      } catch {}
      throw new Error(`createUser: ${detail}`);
    }
    const json = await resp.json();
    return { userId: json.userId as string };
  }



  /** Cambia el rol de un usuario (update directo en user_profiles). */
  export async function updateUserRole(userId: string, roleId: number): Promise<void> {
    const { error } = await supabase
      .from("user_profiles")
      .update({ role_id: roleId })
      .eq("id", userId);
    if (error) throw new Error(`updateUserRole: ${error.message}`);
  }

  /** Cambia el estado de un usuario (active/inactive). */
  export async function updateUserStatus(userId: string, status: UserStatus): Promise<void> {
    const { error } = await supabase
      .from("user_profiles")
      .update({ status })
      .eq("id", userId);
    if (error) throw new Error(`updateUserStatus: ${error.message}`);
  }

  /** Acciones masivas: cambio de estado */
  export async function bulkUpdateStatus(userIds: string[], status: UserStatus): Promise<void> {
    if (!userIds.length) return;
    const { error } = await supabase
      .from("user_profiles")
      .update({ status })
      .in("id", userIds);
    if (error) throw new Error(`bulkUpdateStatus: ${error.message}`);
  }

  /** Acciones masivas: cambio de rol */
  export async function bulkUpdateRole(userIds: string[], roleId: number): Promise<void> {
    if (!userIds.length) return;
    const { error } = await supabase
      .from("user_profiles")
      .update({ role_id: roleId })
      .in("id", userIds);
    if (error) throw new Error(`bulkUpdateRole: ${error.message}`);
  }

  /** Alias opcionales por compatibilidad (si tu página los importa con otros nombres) */
  export async function bulkSetUserStatus(userIds: string[], status: UserStatus): Promise<void> {
    return bulkUpdateStatus(userIds, status);
  }
  export async function bulkSetUserRole(userIds: string[], roleId: number): Promise<void> {
    return bulkUpdateRole(userIds, roleId);
  }

  /** Obtiene un usuario por id (útil para sidepanels/modals) */
  export async function getUserById(userId: string): Promise<AdminUserRow | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, email, full_name, avatar_url, role_id, status, created_at, roles(name)")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(`getUserById: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      avatar_url: data.avatar_url,
      role_id: data.role_id,
      role_name: data.roles?.name ?? undefined,
      status: data.status,
      created_at: data.created_at,
    };
  }


  // --- añadir cerca de tus tipos ---
  export interface AdminUserDetails extends AdminUserRow {
    ci: string | null;
    fecha_nacimiento: string | null; // YYYY-MM-DD
    sexo: "masculino" | "femenino" | "otro" | "prefiere_no_decir" | null;
    telefono_contacto: string | null;
    direccion_calle: string | null;
    direccion_zona_ciudad: string | null;
    direccion_departamento: string | null;
  }

  /** Trae el perfil completo para la card de edición */
  export async function getUserDetails(userId: string): Promise<AdminUserDetails | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select(`
        id, email, full_name, avatar_url, role_id, status, created_at,
        ci, fecha_nacimiento, sexo, telefono_contacto,
        direccion_calle, direccion_zona_ciudad, direccion_departamento,
        roles(name)
      `)
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(`getUserDetails: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      avatar_url: data.avatar_url,
      role_id: data.role_id,
      role_name: data.roles?.name ?? undefined,
      status: data.status,
      created_at: data.created_at,
      ci: data.ci ?? null,
      fecha_nacimiento: data.fecha_nacimiento ?? null,
      sexo: data.sexo ?? null,
      telefono_contacto: data.telefono_contacto ?? null,
      direccion_calle: data.direccion_calle ?? null,
      direccion_zona_ciudad: data.direccion_zona_ciudad ?? null,
      direccion_departamento: data.direccion_departamento ?? null,
    };
  }

  /** Actualiza campos del perfil (solo user_profiles) */
  export type UserProfileUpdate = Partial<{
    email: string;
    full_name: string;
    avatar_url: string | null;
    ci: string | null;
    fecha_nacimiento: string | null;  // "YYYY-MM-DD"
    sexo: "masculino" | "femenino" | "otro" | "prefiere_no_decir" | null;
    telefono_contacto: string | null;
    direccion_calle: string | null;
    direccion_zona_ciudad: string | null;
    direccion_departamento: string | null;
    status: UserStatus;
    role_id: number;
  }>;

  export async function updateUserProfile(userId: string, patch: UserProfileUpdate): Promise<void> {
    if (!userId) throw new Error("updateUserProfile: userId requerido");
    const { error } = await supabase.from("user_profiles").update(patch).eq("id", userId);
    if (error) throw new Error(`updateUserProfile: ${error.message}`);
  }


  /** Export default opcional para evitar problemas de resolución en el bundler */
  const adminUsersApi = {
    listUsers,
    listRoles,
    createUser,
    updateUserRole,
    updateUserStatus,
    bulkUpdateStatus,
    bulkUpdateRole,
    bulkSetUserStatus,
    bulkSetUserRole,
    getUserById,
  };
  export default adminUsersApi;
