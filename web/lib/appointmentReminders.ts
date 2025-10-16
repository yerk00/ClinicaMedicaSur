// Reemplaza TODO el archivo por esta versión mínima segura
import { z } from "zod";

export const AppointmentReminderSchema = z.object({
  id: z.string(),
  user_profile_id: z.string(),
  appointment_name: z.string(),
  date: z.string(),
});
export type AppointmentReminder = z.infer<typeof AppointmentReminderSchema>;

// Funciones “no-op” para no romper consumo actual
export async function getPaginatedAppointmentRemindersByUser(): Promise<{ data: AppointmentReminder[]; count: number }> {
  return { data: [], count: 0 };
}
export async function createAppointmentReminder(): Promise<never> {
  throw new Error("La tabla 'appointment_reminders' fue eliminada del esquema.");
}
export async function updateAppointmentReminder(): Promise<never> {
  throw new Error("La tabla 'appointment_reminders' fue eliminada del esquema.");
}
export async function deleteAppointmentReminder(): Promise<never> {
  throw new Error("La tabla 'appointment_reminders' fue eliminada del esquema.");
}
