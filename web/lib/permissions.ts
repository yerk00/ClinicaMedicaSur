// web/lib/permissions.ts
import { supabase } from "@/lib/supabaseClient";

/**
 * Devuelve la lista de paths permitidos para el usuario actual
 * según tu tabla roles_pages → pages(name).
 */
export async function getAllowedPagesForCurrentUser(): Promise<string[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) return [];

    const { data: pages, error: pagesError } = await supabase
      .from("roles_pages")
      .select("pages(name)")
      .eq("role_id", profile.role_id);

    if (pagesError) return [];

    return (pages ?? []).map((rp: any) => rp.pages?.name).filter(Boolean);
  } catch (error) {
    console.error("getAllowedPagesForCurrentUser error:", error);
    return [];
  }
}

/**
 * Devuelve el nombre del rol del usuario actual, p.ej.:
 * "Doctor" | "Operador" | "Administrador" | "Paciente" | "Radiólogo" | "Enfermero"
 *
 * Intenta leerlo desde la tabla `roles (id, name)`.
 * Si no existe esa tabla, usa un mapeo de respaldo por role_id.
 */
export async function getCurrentUserRole(): Promise<
  "Doctor" | "Operador" | "Administrador" | "Paciente" | "Radiologo" | "Enfermero" | null
> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) return null;

    // 1) Intentar leer de tabla `roles`
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("name")
      .eq("id", profile.role_id)
      .maybeSingle();

    if (!roleError && role?.name) {
      return role.name as any;
    }

    // 2) Respaldo si no tienes `roles` (ajusta a tus IDs reales)
    const FALLBACK: Record<number, any> = {
      1: "Administrador",
      2: "Doctor",
      3: "Operador",
      4: "Paciente",
      5: "Radiologo",
      6: "Enfermero",
    };
    return FALLBACK[profile.role_id] ?? null;
  } catch (error) {
    console.error("getCurrentUserRole error:", error);
    return null;
  }
}
