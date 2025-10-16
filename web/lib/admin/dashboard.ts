// /lib/admin/dashboard.ts
import { supabase } from "@/lib/supabaseClient";

export interface AdminKpis {
  total_users: number;
  active_users: number;
  inactive_users: number;
  new_users_last_7d: number;
  new_users_last_30d: number;
}

export interface UsersByRole {
  role_id: number;
  role_name: string;
  count: number;
}

export interface UsersByDay {
  day: string;   // YYYY-MM-DD
  count: number;
}

/** KPIs principales */
export async function getSummary(): Promise<AdminKpis> {
  const totalQ = supabase.from("user_profiles").select("id", { count: "exact", head: true });
  const activeQ = supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("status", "active");
  const inactiveQ = supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("status", "inactive");

  const [totalR, activeR, inactiveR] = await Promise.all([totalQ, activeQ, inactiveQ]);
  if (totalR.error) throw new Error(`getSummary.total: ${totalR.error.message}`);
  if (activeR.error) throw new Error(`getSummary.active: ${activeR.error.message}`);
  if (inactiveR.error) throw new Error(`getSummary.inactive: ${inactiveR.error.message}`);

  const now = new Date();
  const d7 = new Date(now); d7.setDate(now.getDate() - 7);
  const d30 = new Date(now); d30.setDate(now.getDate() - 30);

  const last7Q = supabase.from("user_profiles").select("id", { count: "exact", head: true }).gte("created_at", d7.toISOString());
  const last30Q = supabase.from("user_profiles").select("id", { count: "exact", head: true }).gte("created_at", d30.toISOString());

  const [last7R, last30R] = await Promise.all([last7Q, last30Q]);
  if (last7R.error) throw new Error(`getSummary.last7: ${last7R.error.message}`);
  if (last30R.error) throw new Error(`getSummary.last30: ${last30R.error.message}`);

  return {
    total_users: totalR.count ?? 0,
    active_users: activeR.count ?? 0,
    inactive_users: inactiveR.count ?? 0,
    new_users_last_7d: last7R.count ?? 0,
    new_users_last_30d: last30R.count ?? 0,
  };
}

/** Distribución por rol (loop simple; pocos roles ⇒ OK) */
export async function getByRole(): Promise<UsersByRole[]> {
  const rolesRes = await supabase.from("roles").select("id, name").order("name", { ascending: true });
  if (rolesRes.error) throw new Error(`getByRole.roles: ${rolesRes.error.message}`);

  const roles = rolesRes.data ?? [];
  const out: UsersByRole[] = [];
  for (const r of roles) {
    const { count, error } = await supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("role_id", r.id);
    if (error) throw new Error(`getByRole.count[${r.name}]: ${error.message}`);
    out.push({ role_id: r.id, role_name: r.name, count: count ?? 0 });
  }
  return out;
}

/** Serie de altas por día (últimos N días) */
export async function getByDay(days: number = 30): Promise<UsersByDay[]> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - Math.max(1, days));

  const { data, error } = await supabase
    .from("user_profiles")
    .select("created_at")
    .gte("created_at", start.toISOString())
    .lte("created_at", now.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getByDay: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.created_at) continue;
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const series: UsersByDay[] = [];
  const cursor = new Date(start);
  while (cursor <= now) {
    const day = cursor.toISOString().slice(0, 10);
    series.push({ day, count: counts.get(day) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

/* Export default opcional por si el bundler lo requiere */
const adminDashboardApi = { getSummary, getByRole, getByDay };
export default adminDashboardApi;
