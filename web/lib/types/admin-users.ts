// Tipos compartidos para la gestión de usuarios (Admin)

export type UserStatus = 'active' | 'suspended' | 'invited' | 'archived';

export type UserAdminRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;

  // campos de perfil extendidos
  ci: string | null;
  sexo: 'masculino' | 'femenino' | 'otro' | 'prefiere_no_decir' | null;
  fecha_nacimiento: string | null;

  // rol (opcional si fallback)
  role_id?: number | null;
  role_name?: string | null;

  // actividad (depende de RPC/vista)
  last_sign_in_at?: string | null;

  // estado opcional (si en tu esquema agregas status en el futuro)
  status?: UserStatus | null;
};

export type DirectoryFilters = {
  q?: string;                               // nombre, email o CI
  role?: string;                            // 'Paciente', 'Doctor', etc.
  sexo?: 'masculino'|'femenino'|'otro'|'prefiere_no_decir';
  status?: UserStatus;                      // opcional (si existiera)
  recentBucket?: 'today'|'24h'|'7d';        // filtro cliente por actividad
  orderBy?:
    | 'created_at_asc' | 'created_at_desc'
    | 'name_asc'       | 'name_desc'
    | 'sexo_asc'       | 'sexo_desc'
    | 'last_login_asc' | 'last_login_desc';

  limit?: number;
  offset?: number;
};

export type RoleRow = { id: number; name: string };
