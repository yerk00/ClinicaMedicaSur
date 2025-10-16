import { supabase } from "./supabaseClient";
import { z } from "zod";

/**
 * This file contains functions to manage user profiles in a Supabase database.
 * It includes functions to get the current user's profile, update the profile,
 * upload and remove the user's avatar, and search for profiles based on a search term.
 */
// Reemplaza ProfileSchema por:
export const ProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  created_at: z.string().nullable().optional(),
  role: z.object({ name: z.string() }).optional(),

  // Nuevos campos (opcionales)
  ci: z.string().nullable().optional(),
  fecha_nacimiento: z.string().nullable().optional(), // ISO (YYYY-MM-DD)
  sexo: z.string().nullable().optional(),             // 'masculino' | 'femenino' | 'otro' | 'prefiere_no_decir'
  direccion_calle: z.string().nullable().optional(),
  direccion_zona_ciudad: z.string().nullable().optional(),
  direccion_departamento: z.string().nullable().optional(),
  telefono_contacto: z.string().nullable().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;


export async function getCurrentProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*, role:roles(name)")
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  return ProfileSchema.parse(data);
}


/**
 * Updates the current user's profile in the Supabase database.
 * @param full_name The new full name of the user.
 * @param avatar_url The new avatar URL of the user (optional).
 * @param condition_tags The new condition tags of the user (optional).
 * @returns The updated user's profile data.
 * @throws An error if there is an issue updating the profile data.
 */
export async function updateProfile({
  full_name,
  avatar_url,
  profileId,
  // nuevos opcionales:
  ci,
  fecha_nacimiento,
  sexo,
  direccion_calle,
  direccion_zona_ciudad,
  direccion_departamento,
  telefono_contacto,
}: {
  full_name: string;
  avatar_url?: string | null;
  profileId?: string;

  ci?: string | null;
  fecha_nacimiento?: string | null; // 'YYYY-MM-DD'
  sexo?: 'masculino' | 'femenino' | 'otro' | 'prefiere_no_decir' | null;
  direccion_calle?: string | null;
  direccion_zona_ciudad?: string | null;
  direccion_departamento?: string | null;
  telefono_contacto?: string | null;
}): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No user found");

  const idToUpdate = profileId ?? user.id;

  const updatePayload: Record<string, unknown> = { full_name };
  if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url;

  // setear solo si vienen definidos (para no sobreescribir con undefined)
  if (ci !== undefined) updatePayload.ci = ci;
  if (fecha_nacimiento !== undefined) updatePayload.fecha_nacimiento = fecha_nacimiento;
  if (sexo !== undefined) updatePayload.sexo = sexo;
  if (direccion_calle !== undefined) updatePayload.direccion_calle = direccion_calle;
  if (direccion_zona_ciudad !== undefined) updatePayload.direccion_zona_ciudad = direccion_zona_ciudad;
  if (direccion_departamento !== undefined) updatePayload.direccion_departamento = direccion_departamento;
  if (telefono_contacto !== undefined) updatePayload.telefono_contacto = telefono_contacto;

  const { data, error } = await supabase
    .from("user_profiles")
    .update(updatePayload)
    .eq("id", idToUpdate)
    .select("*, role:roles(name)")
    .single();

  if (error) throw error;
  return ProfileSchema.parse(data);
}


/**
 * Uploads an avatar image for the current user to Supabase storage.
 * @param file The image file to upload.
 * @returns The public URL of the uploaded avatar image.
 * @throws An error if there is an issue uploading the avatar image.
 */
export async function uploadAvatar(file: File, profileId?: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No user found");
  }

  const targetId = profileId ?? user.id;
  const fileExt = file.name.split(".").pop();
  const fileName = `${targetId}.${fileExt}`;
  const filePath = fileName;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}


/**
 * Removes the current user's avatar image from Supabase storage.
 * @throws An error if there is an issue removing the avatar image.
 */
export async function removeAvatar(profileId?: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No user found");
  }

  const targetId = profileId ?? user.id;
  const possibleExtensions = ["png", "jpg", "jpeg", "webp"];
  let removed = false;

  for (const ext of possibleExtensions) {
    const filePath = `${targetId}.${ext}`;
    const { error } = await supabase.storage.from("avatars").remove([filePath]);
    if (!error) {
      removed = true;
      break;
    }
  }

  if (!removed) {
    throw new Error("Failed to remove avatar file.");
  }

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({ avatar_url: null })
    .eq("id", targetId);

  if (updateError) {
    throw updateError;
  }
}


/**
 * Searches for user profiles in the Supabase database based on a search term.
 * @param searchTerm The term to search for in the user's full name or email.
 * @returns An array of matching user profiles.
 * @throws An error if there is an issue searching for profiles.
 */
export async function searchProfiles(searchTerm: string): Promise<Profile[]> {
  const PACIENTE_ROLE_ID = 4; // ← usa el ID numérico real de tu base de datos

  const baseQuery = supabase
    .from("user_profiles")
    .select("*")
    .eq("role_id", PACIENTE_ROLE_ID);

  if (searchTerm.trim()) {
    baseQuery.or(
      `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
    );
  }

  const { data, error } = await baseQuery;

  if (error) {
    console.error("Error en búsqueda:", error);
    throw error;
  }

  return ProfileSchema.array().parse(data) || [];
}




/**
 * Returns the current user's role name (e.g., "Doctor", "Radiólogo", etc.)
 * @returns The name of the role, or null if not found.
 */
export async function getCurrentUserRole(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("role:roles(name)")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching user role:", error);
    return null;
  }

  return data?.role?.name ?? null;
}

