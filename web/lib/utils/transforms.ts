import { DirectoryFilters, UserAdminRow } from '../types/admin-users';

type RpcDirectoryParams = {
  p_q?: string | null;
  p_role?: string | null;
  p_sexo?: string | null;
  p_order_by?: string | null;
  p_limit?: number | null;
  p_offset?: number | null;
  // Si agregas status en la RPC futura:
  // p_status?: string | null;
};

export function toDirectoryParams(filters: DirectoryFilters): RpcDirectoryParams {
  const {
    q, role, sexo, orderBy, limit, offset,
  } = filters;

  let p_order_by: string | null = null;
  switch (orderBy) {
    case 'created_at_asc':  p_order_by = 'created_at_asc'; break;
    case 'created_at_desc': p_order_by = 'created_at_desc'; break;
    case 'name_asc':        p_order_by = 'name_asc'; break;
    case 'name_desc':       p_order_by = 'name_desc'; break;
    case 'sexo_asc':        p_order_by = 'sexo_asc'; break;
    case 'sexo_desc':       p_order_by = 'sexo_desc'; break;
    case 'last_login_asc':  p_order_by = 'last_login_asc'; break;
    case 'last_login_desc': p_order_by = 'last_login_desc'; break;
    default:                p_order_by = null;
  }

  return {
    p_q: q?.trim() || null,
    p_role: role || null,
    p_sexo: sexo || null,
    p_order_by,
    p_limit: limit ?? null,
    p_offset: offset ?? null,
    // p_status: filters.status ?? null,
  };
}

export function mapDirectoryRow(row: any): UserAdminRow {
  return {
    id: row.id,
    email: row.email ?? null,
    full_name: row.full_name ?? null,
    avatar_url: row.avatar_url ?? null,
    created_at: row.created_at ?? null,

    ci: row.ci ?? null,
    sexo: row.sexo ?? null,
    fecha_nacimiento: row.fecha_nacimiento ?? null,

    role_id: row.role_id ?? null,
    role_name: row.role_name ?? null,

    last_sign_in_at: row.last_sign_in_at ?? null,
    status: row.status ?? null,
  };
}
