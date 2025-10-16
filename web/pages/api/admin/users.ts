// pages/api/admin/users.ts
import { supabase } from "../../../lib/supabaseClient";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleData?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data: profiles } = await supabase.from("user_profiles").select("id, full_name");
  const { data: authUsers } = await supabase.from("auth.users").select("id, email");
  const { data: roles } = await supabase.from("user_roles").select("user_id, role");

  const merged = authUsers.map((user) => ({
    id: user.id,
    email: user.email,
    full_name: profiles.find((p) => p.id === user.id)?.full_name ?? null,
    role: roles.find((r) => r.user_id === user.id)?.role ?? "unknown",
  }));

  res.status(200).json(merged);
}
