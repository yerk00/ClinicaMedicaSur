import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserRole } from "@/lib/profile";
import { getMedicationRemindersByUser } from "@/lib/medications";
import { getHealthLogsByUser } from "@/lib/healthLogs";
import { getMedicalRecordByUserId, type MedicalRecordDB } from "@/lib/medicalRecords";

const cleanUuid = (s?: string | null) => (s ?? "").trim().replace(/^['"]+|['"]+$/g, "");
const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const normalizeRole = (r?: string | null) =>
  (r || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export interface MedicationReminder {
  id: string;
  user_profile_id: string;
  medication_name: string;
  dosage: string | null;
  reminder_time: string; // ISO
  recurrence: string | null;
  created_at: string;
}
export interface HealthLog {
  id: string;
  user_profile_id: string;
  symptom_type: string | null;
  severity: number | null;
  mood: string | null;
  temperature_c: number | null;
  heart_rate_bpm: number | null;
  respiratory_rate_bpm: number | null;
  bp_systolic_mmhg: number | null;
  bp_diastolic_mmhg: number | null;
  spo2_percent: number | null;
  weight_kg: number | null;
  height_m: number | null;
  pain_score: number | null;
}

export function useHomeData() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [userName, setUserName] = useState("User");
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");

  const [medicalRecord, setMedicalRecord] = useState<MedicalRecordDB | null>(null);

  const [allMedications, setAllMedications] = useState<MedicationReminder[]>([]);
  const [allLogs, setAllLogs] = useState<HealthLog[]>([]);
  const [totalMeds, setTotalMeds] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);

  const [isLoading, setIsLoading] = useState(true);

  // Canal de “broadcast” por usuario (opcional)
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const sendBroadcast = (eventName: string, message: string) => {
    if (!broadcastChannelRef.current) return;
    broadcastChannelRef.current.send({
      type: "broadcast",
      event: eventName,
      payload: { message },
    });
  };

  async function fetchAllRecords(uid: string) {
    const [meds, logs] = await Promise.all([
      getMedicationRemindersByUser(uid),
      getHealthLogsByUser(uid),
    ]);
    setAllMedications(meds);
    setAllLogs(logs);
    setTotalMeds(meds.length);
    setTotalLogs(logs.length);
  }

  const refreshMedicalRecord = async (pid: string) => {
    const rec = await getMedicalRecordByUserId(pid);
    setMedicalRecord(rec);
  };

  async function bootstrap() {
    setIsLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.push("/auth/login");
        return;
      }
      const role = await getCurrentUserRole();
      setCurrentUserRole(role);

      const currentUserId = user.id;
      const urlId = cleanUuid((router.query?.id as string) || "");
      const storedRaw = typeof window !== "undefined" ? localStorage.getItem("targetProfileId") || "" : "";
      const storedTargetId = cleanUuid(storedRaw);

      const allowedRoles = ["doctor", "radiologo", "enfermero"];
      const canImpersonate = allowedRoles.includes(normalizeRole(role));

      const candidate =
        canImpersonate && storedTargetId && storedTargetId !== currentUserId && isUuid(storedTargetId)
          ? storedTargetId
          : (isUuid(urlId) ? urlId : currentUserId);

      setUserId(currentUserId);
      setTargetUserId(candidate);

      // nombre (paciente)
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", candidate)
        .single();

      if (profileData?.full_name) {
        setUserName(profileData.full_name);
        setSelectedPatientName(profileData.full_name);
      }

      await fetchAllRecords(candidate);
      await refreshMedicalRecord(candidate);

      // Broadcast (user specific)
      if (!broadcastChannelRef.current) {
        const ch = supabase.channel(`user-channel-${currentUserId}`, { config: { broadcast: { self: false } } });
        ch.subscribe();
        broadcastChannelRef.current = ch;
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query?.id]);

  const goToHistoriaClinica = () => {
    if (!targetUserId) return;
    try { localStorage.setItem("targetProfileId", targetUserId); } catch {}
    router.push(`/historial-clinico/${targetUserId}/documento`);
  };

  return {
    // ids/roles
    userId, targetUserId, currentUserRole,

    // nombres
    userName, selectedPatientName,

    // datasets
    medicalRecord,
    allMedications, allLogs,
    totalMeds, totalLogs,

    // estado
    isLoading,

    // acciones
    refreshMedicalRecord,
    goToHistoriaClinica,
    sendBroadcast,
  };
}
