import Head from "next/head";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import { useHomeData } from "@/features/home/useHomeData";

// Secciones existentes
import HeaderAndRecord from "@/components/home/HeaderAndRecord";
import StatsAndCharts from "@/components/home/StatsAndCharts";
import ConsultationsAndDialogs from "@/components/home/ConsultationsAndDialogs";

// Nuevas secciones separadas
import MedsSection from "@/components/home/MedsSection";
import HealthLogsSection from "@/components/home/HealthLogsSection";

// Navbar
import { HeaderNavbar } from "@/components/HeaderNavbar";

type TabKey = "registros" | "sintomas" | "medicaciones" | "consultas";

export default function HomePage() {
  const {
    userId, targetUserId,
    userName, selectedPatientName,
    medicalRecord,
    allLogs, allMedications, totalMeds, totalLogs,
    isLoading,
    refreshMedicalRecord,
    goToHistoriaClinica,
    sendBroadcast,
  } = useHomeData();

  const [active, setActive] = useState<TabKey>("registros");

  const openCreateConsult = () => {
    setActive("consultas");
    setTimeout(() => document.getElementById("open-add-consult")?.click(), 0);
  };

  return (
    <>
      <Head>
        <title>ClinicaMedicaSur | Home</title>
        <meta name="description" content="Your personal health dashboard." />
      </Head>

      {/* NAVBAR superior */}
      <HeaderNavbar
        active={active}
        onNavigate={setActive}
        onOpenHistoria={() => goToHistoriaClinica()}
        currentPatientId={targetUserId ?? undefined}  
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative p-6 md:p-8 flex-1 overflow-y-auto space-y-8"
      >
        <style jsx global>{`
          html { scroll-behavior: smooth; }
          html, body { overscroll-behavior: none; }
        `}</style>

        {isLoading && (
          <>
            <div className="absolute inset-0 z-50 bg-background/50" />
            <div className="absolute left-1/2 z-50" style={{ top: "50vh", transform: "translateX(-50%)" }}>
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
            </div>
          </>
        )}

        {/* === PESTAÑA: Registros Médicos (Inicio) === */}
        <section className={active === "registros" ? "space-y-8" : "hidden"}>
          <HeaderAndRecord
            userName={userName}
            selectedPatientName={selectedPatientName}
            medicalRecord={medicalRecord}
            patientId={targetUserId ?? undefined}
            doctorId={userId ?? undefined}
            onRecordSaved={() => targetUserId && refreshMedicalRecord(targetUserId)}
            onCreateConsultClick={openCreateConsult}
            onAddLogClick={() => document.getElementById("open-add-log")?.click()}
            onAddMedClick={() => document.getElementById("open-add-med")?.click()}
            onGoHistoriaClinica={goToHistoriaClinica}
          />

          <StatsAndCharts
            totalMeds={totalMeds}
            totalLogs={totalLogs}
            allLogs={allLogs}
            allMedications={allMedications}
          />
        </section>

        {/* === PESTAÑA: Síntomas === */}
        <section className={active === "sintomas" ? "" : "hidden"}>
          <HealthLogsSection
            patientId={targetUserId}
            onDataChanged={() => targetUserId && refreshMedicalRecord(targetUserId)}
            sendBroadcast={sendBroadcast}
          />
        </section>

        {/* === PESTAÑA: Medicaciones === */}
        <section className={active === "medicaciones" ? "" : "hidden"}>
          <MedsSection
            patientId={targetUserId}
            onDataChanged={() => targetUserId && refreshMedicalRecord(targetUserId)}
            sendBroadcast={sendBroadcast}
          />
        </section>

        {/* === PESTAÑA: Consultas === */}
        <section className={active === "consultas" ? "" : "hidden"}>
          <ConsultationsAndDialogs
            patientId={targetUserId}
            doctorId={userId}
          />
        </section>
      </motion.div>
    </>
  );
}
