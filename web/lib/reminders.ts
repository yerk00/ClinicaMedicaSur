import {
  getMedicationRemindersByUser,
  MedicationReminder,
} from "./medications";
import { z } from "zod";

const ReminderSchema = z.object({
  id: z.string(),
  type: z.enum(["medication"]),
  title: z.string(),
  dueTime: z.date(),
});
export type Reminder = z.infer<typeof ReminderSchema>;

/**
 * Fetches and merges appointment and medication reminders for a user.
 * Converts the reminder due times (assumed to be stored as UTC ISO strings) into Date objects.
 *
 * @param userId - The current user ID.
 * @returns An array of Reminder objects.
 */
export async function fetchUserReminders(userId: string): Promise<Reminder[]> {
  const [medications] = await Promise.all([
    getMedicationRemindersByUser(userId),
  ]);

  const medicationReminders: Reminder[] = medications.map(
    (med: MedicationReminder) => ({
      id: `med-${med.id}`,
      type: "medication",
      title: med.medication_name,
      dueTime: new Date(med.reminder_time),
    }),
  );

  return ReminderSchema.array().parse([
    ...medicationReminders,
  ]);
}
