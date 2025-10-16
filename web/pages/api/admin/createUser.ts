// pages/api/admin/createUser.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Body = {
  email?: string;
  full_name?: string;
  role_id?: number | string;
  status?: "active" | "inactive";
  ci?: string | null;
  fecha_nacimiento?: string | null;
  sexo?: "masculino" | "femenino" | "otro" | "prefiere_no_decir" | null;
  telefono_contacto?: string | null;
  mode?: "invite" | "password";
  temp_password?: string;
  password?: string; // compat anterior
};

const isDev = process.env.NODE_ENV !== "production";

function respond(res: NextApiResponse, code: number, msg: string, extra?: any) {
  const payload = isDev ? { error: msg, ...extra } : { error: msg };
  return res.status(code).json(payload);
}

function isDuplicateMsg(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("already") || m.includes("exists") || m.includes("registered")
      || m.includes("ya existe") || m.includes("ya registrado") || m.includes("existente");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respond(res, 405, "Method Not Allowed");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return respond(res, 500, "Faltan envs: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const raw = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const body: Body = raw;
    const {
      email, full_name, role_id: rawRole,
      status = "active", ci = null, fecha_nacimiento = null, sexo = null, telefono_contacto = null,
      mode, temp_password, password, // compat
    } = body;

    const role_id = typeof rawRole === "string" ? Number(rawRole) : rawRole;

    const effectiveMode: "invite" | "password" =
      (mode as any) || (typeof password === "string" ? "password" : "invite");
    const effectivePassword = temp_password || password || undefined;

    // Validaciones
    if (!email || !role_id)
      return respond(res, 400, "email y role_id son obligatorios", { debug: { email, role_id, rawRole } });

    if (!["invite", "password"].includes(effectiveMode))
      return respond(res, 400, "mode inválido", { debug: { mode, effectiveMode } });

    if (!["active", "inactive"].includes(status))
      return respond(res, 400, "status inválido", { debug: { status } });

    if (effectiveMode === "password") {
      if (!effectivePassword)
        return respond(res, 400, "password/temp_password es obligatorio en mode='password'");
      if (effectivePassword.length < 6)
        return respond(res, 422, "La contraseña debe tener al menos 6 caracteres");
    }

    // Duplicado en tu tabla (mensaje claro)
    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile?.id) {
      return respond(res, 409, "Ya existe un usuario con ese email.", { debug: { where: "profiles" } });
    }

    // 1) Crear en Auth
    let userId: string | undefined;
    if (effectiveMode === "invite") {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
      if (error) {
        const msg = error.message || "Error invitando usuario";
        const code = isDuplicateMsg(msg) ? 409 : 400;
        return respond(res, code, isDuplicateMsg(msg) ? "Ya existe un usuario con ese email (Auth)." : `inviteUserByEmail: ${msg}`, { debug: { where: "auth.invite", msg } });
      }
      userId = data?.user?.id;
      if (userId && full_name) {
        await admin.auth.admin.updateUserById(userId, { user_metadata: { full_name } });
      }
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: effectivePassword!,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (error) {
        const msg = error.message || "Error creando usuario";
        const code = isDuplicateMsg(msg) ? 409 : (msg.toLowerCase().includes("password") ? 422 : 400);
        return respond(res, code, isDuplicateMsg(msg) ? "Ya existe un usuario con ese email (Auth)." : `createUser: ${msg}`, { debug: { where: "auth.create", msg } });
      }
      userId = data.user?.id;
    }

    if (!userId) return respond(res, 500, "No se obtuvo userId desde Supabase Auth");

    // 2) Upsert perfil
    const { error: upsertErr } = await admin
      .from("user_profiles")
      .upsert(
        {
          id: userId,
          email,
          full_name: full_name ?? null,
          role_id: Number(role_id),
          status,
          ci,
          fecha_nacimiento,
          sexo,
          telefono_contacto,
        },
        { onConflict: "id" }
      );

    if (upsertErr) return respond(res, 500, `upsert user_profiles: ${upsertErr.message}`, { debug: { where: "db.upsert" } });

    return res.status(201).json({ userId });
  } catch (e: any) {
    console.error("create user api error:", e);
    return respond(res, 500, e?.message || "Server error", { debug: { where: "catch" } });
  }
}
