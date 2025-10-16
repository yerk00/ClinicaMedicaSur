// lib/usersByRole.ts
import { supabase } from "./supabaseClient";
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  role: z.object({
    name: z.string(),
  }),
});

export type UserProfile = z.infer<typeof UserSchema>;

export async function getUsersByRole(roleName: string): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, avatar_url, role:roles(name)")
    .eq("role.name", roleName);

  if (error) {
    console.error("Error fetching users:", error);
    throw error;
  }

  return UserSchema.array().parse(data);
}

export async function getPatients() {
  return getUsersByRole("Paciente");
}

export async function getDoctors() {
  return getUsersByRole("Doctor");
}

export async function getRadiologists() {
  return getUsersByRole("Radiologo");
}

export async function getNurses() {
  return getUsersByRole("Enfermero");
}

export async function getAdmins() {
  return getUsersByRole("Administrador");
}
