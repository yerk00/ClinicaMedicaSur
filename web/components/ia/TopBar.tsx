// components/ia/TopBar.tsx
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, PanelLeftOpen, PanelLeftClose, Users, Info } from "lucide-react";
import type { IaMeta } from "@/lib/assistance";

type PatientLite = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Props = {
  onBack: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  iaMeta?: IaMeta | null;
  patient?: PatientLite | null;
};

export default function TopBar({
  onBack,
  sidebarOpen,
  setSidebarOpen,
  iaMeta,
  patient,
}: Props) {
  return (
    <div
      className="
        sticky top-0 z-20
        mb-5 flex flex-wrap items-center justify-between gap-3
        rounded-xl border bg-white/60 dark:bg-card/60 backdrop-blur p-3
      "
      aria-label="Barra superior de Asistencia IA"
    >
      {/* Izquierda: navegación y estudios */}
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="cursor-pointer"
          aria-label="Volver"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="cursor-pointer"
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? "Ocultar estudios del paciente" : "Mostrar estudios del paciente"}
        >
          {sidebarOpen ? (
            <>
              <PanelLeftClose className="h-4 w-4 mr-1" />
              Ocultar estudios
            </>
          ) : (
            <>
              <PanelLeftOpen className="h-4 w-4 mr-1" />
              Estudios del paciente
            </>
          )}
        </Button>

        <div className="text-base font-semibold truncate">Asistencia IA</div>

        {iaMeta && (
          <Badge
            variant="outline"
            className="ml-2 hidden sm:inline-flex gap-1 items-center"
            title={iaMeta.last_conv ? `Capa Grad-CAM: ${iaMeta.last_conv}` : undefined}
          >
            <Info className="h-3.5 w-3.5" />
            <span>{iaMeta.num_classes} clases</span>
            <span>·</span>
            <span>
              {iaMeta.input_hw?.[0]}×{iaMeta.input_hw?.[1]}
            </span>
            {iaMeta.version ? (
              <>
                <span>·</span>
                <span>v{iaMeta.version}</span>
              </>
            ) : null}
          </Badge>
        )}

      </div>

      {/* Derecha: identidad del paciente */}
      {patient ? (
        <div
          className="
            group flex items-center gap-3 min-w-0
            rounded-lg border bg-white/70 dark:bg-card/70 px-3 py-2
          "
          aria-label="Paciente seleccionado"
        >
          <Image
            src={patient.avatar_url || "/images.jpg"}
            alt={patient.full_name || "Paciente"}
            width={40}
            height={40}
            className="rounded-full object-cover ring-2 ring-cyan-200 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold leading-tight truncate">
                {patient.full_name || "Paciente sin nombre"}
              </div>
              <Badge className="hidden sm:inline-flex" variant="default">
                Paciente seleccionado
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {patient.email || "—"}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-4 w-4" />
          Seleccione un paciente para comenzar
        </div>
      )}
    </div>
  );
}
