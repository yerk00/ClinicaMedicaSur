"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGreetingParts } from "@/lib/greetings";
import { getPatientProfile } from "@/lib/historyDetails";

import {
  NotebookText,
  ActivitySquare,
  Pill,
  CalendarClock,
  FileText,
  Image as ImageIcon,
  Cpu,
  Stethoscope,
} from "lucide-react";

type TabKey = "registros" | "sintomas" | "medicaciones" | "consultas";

type Props = {
  active: TabKey;
  onNavigate: (key: TabKey) => void;
  onOpenHistoria: () => void;
  currentPatientId?: string;
  /** Opcional: si ya tienes al paciente cargado puedes pasarlo y evita el fetch */
  selectedPatientName?: string;
  selectedPatientAvatarUrl?: string | null;
};

export function HeaderNavbar({
  active,
  onNavigate,
  onOpenHistoria,
  currentPatientId,
  selectedPatientName,
  selectedPatientAvatarUrl,
}: Props) {
  const router = useRouter();
  const { greeting, emoji } = getGreetingParts();

  // ---------- Tabs ----------
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "registros", label: "Registros Médicos", icon: <NotebookText className="h-4 w-4" /> },
    { key: "sintomas", label: "Sígnos Vitales", icon: <ActivitySquare className="h-4 w-4" /> },
    { key: "medicaciones", label: "Medicaciones", icon: <Pill className="h-4 w-4" /> },
    { key: "consultas", label: "Consultas", icon: <CalendarClock className="h-4 w-4" /> },
  ];

  const handleKeyNav: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const idx = tabs.findIndex((t) => t.key === active);
    if (idx < 0) return;
    if (e.key === "ArrowRight") onNavigate(tabs[(idx + 1) % tabs.length].key);
    else if (e.key === "ArrowLeft") onNavigate(tabs[(idx - 1 + tabs.length) % tabs.length].key);
  };

  // ---------- Paciente: hidratar si no vino por props ----------
  const [hydratedName, setHydratedName] = React.useState<string | undefined>(undefined);
  const [hydratedAvatar, setHydratedAvatar] = React.useState<string | null | undefined>(undefined);

  // Paciente efectivo: props > fetch por currentPatientId > fetch por LS
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (selectedPatientName) {
        setHydratedName(selectedPatientName);
        setHydratedAvatar(selectedPatientAvatarUrl ?? null);
        return;
      }

      const effectiveId =
        currentPatientId ||
        (() => {
          try {
            const raw = localStorage.getItem("targetProfileId");
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        })();

      if (!effectiveId) {
        setHydratedName(undefined);
        setHydratedAvatar(undefined);
        return;
      }

      const profile = await getPatientProfile(effectiveId).catch(() => null);
      if (cancelled) return;

      if (profile) {
        setHydratedName(profile.full_name || profile.email || "Paciente");
        setHydratedAvatar(profile.avatar_url ?? null);
      } else {
        setHydratedName("Paciente");
        setHydratedAvatar(null);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentPatientId, selectedPatientName, selectedPatientAvatarUrl]);

  const displayName = (selectedPatientName || hydratedName || "Paciente").trim();
  const avatarUrl = selectedPatientAvatarUrl ?? hydratedAvatar ?? null;

  const initials = React.useMemo(() => {
    return displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || "")
      .join("") || "PA";
  }, [displayName]);

  // ---------- Navegación preservando paciente ----------
  const pushWithPatient = (path: string) => {
    const pid =
      currentPatientId ||
      (() => {
        try {
          const raw = localStorage.getItem("targetProfileId");
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

    if (pid) {
      try {
        localStorage.setItem("targetProfileId", JSON.stringify(pid));
      } catch {}
      router.push(`${path}?id=${encodeURIComponent(pid)}`);
    } else {
      router.push(path);
    }
  };

  const goUploads = () => pushWithPatient("/uploads");
  const goIA = () => pushWithPatient("/analisis-ia");

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
      {/* Ancho mayor y mejor respiro lateral */}
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        {/* Altura mayor y separación limpia */}
        <div className="flex h-16 items-center gap-4 md:gap-6">

          {/* === Bloque paciente (izquierda) con buen padding === */}
          <div className="flex items-center gap-3 pr-2 mr-2 min-w-0">
            {/* Avatar / iniciales */}
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={40}
                height={40}
                className="rounded-full object-cover ring-2 ring-cyan-200 dark:ring-cyan-800"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100 flex items-center justify-center text-[12px] font-semibold ring-1 ring-cyan-200 dark:ring-cyan-800">
                {initials}
              </div>
            )}

            {/* Título dinámico */}
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1 text-[15px] text-muted-foreground">
                <Stethoscope className="h-3.5 w-3.5" />
                <span className="truncate">{greeting}</span>
                <span aria-hidden>{emoji}</span>
              </div>
              <div className="truncate text-[15px] font-semibold tracking-tight">
                {displayName}
              </div>
            </div>
          </div>

          {/* === Tabs (centro) === */}
          <nav
            className="hidden md:flex flex-1 items-center justify-center"
            role="tablist"
            aria-label="Secciones de inicio"
            onKeyDown={handleKeyNav}
          >
            <div className="inline-flex rounded-xl border border-muted/60 bg-muted/30 backdrop-blur-sm p-1 shadow-sm">
              {tabs.map((t) => {
                const selected = active === t.key;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={selected}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1",
                      selected
                        ? "bg-white text-cyan-800 ring-1 ring-cyan-200 shadow-sm dark:bg-cyan-900/30 dark:text-cyan-50 dark:ring-cyan-700/40"
                        : "text-muted-foreground hover:bg-white hover:text-foreground hover:shadow-sm dark:hover:bg-white/5"
                    )}
                    onClick={() => onNavigate(t.key)}
                  >
                    <span className={cn(selected && "text-cyan-600 dark:text-cyan-300")}>
                      {t.icon}
                    </span>
                    <span className="whitespace-nowrap">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* === Acciones (derecha) === */}
          <div className="ml-auto hidden md:flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2 border-cyan-200 bg-white hover:bg-cyan-50 hover:border-cyan-300 dark:border-cyan-800 dark:hover:bg-cyan-950/30"
              onClick={onOpenHistoria}
              title="Historia Clínica"
            >
              <FileText className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
              <span className="text-cyan-800 dark:text-cyan-200">Historia Clínica</span>
            </Button>

            <Button
              variant="outline"
              className="gap-2 border-emerald-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
              onClick={goUploads}
              title="Radiografías"
            >
              <ImageIcon className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              <span className="text-emerald-800 dark:text-emerald-200">Radiografías</span>
            </Button>

            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={goIA}
              title="Análisis IA"
            >
              <Cpu className="h-4 w-4" />
              <span className="font-medium">Análisis IA</span>
            </Button>
          </div>
        </div>

        {/* === Mobile: tabs y acciones === */}
        <div className="md:hidden pb-3">
          <div
            className="flex gap-2 overflow-x-auto py-1 scrollbar-hide"
            role="tablist"
            aria-label="Secciones de inicio"
            onKeyDown={handleKeyNav}
          >
            {tabs.map((t) => {
              const selected = active === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={selected}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 inline-flex items-center gap-2 whitespace-nowrap border shadow-sm",
                    selected
                      ? "bg-white text-cyan-800 border-cyan-200 shadow-md dark:bg-cyan-900/30 dark:text-cyan-50 dark:border-cyan-800"
                      : "text-muted-foreground bg-muted/40 border-transparent hover:bg-white hover:text-foreground dark:hover:bg-white/5"
                  )}
                  onClick={() => onNavigate(t.key)}
                >
                  <span className={cn(selected && "text-cyan-600 dark:text-cyan-300")}>
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="border-cyan-200 bg-white hover:bg-cyan-50 hover:border-cyan-300 dark:border-cyan-800 dark:hover:bg-cyan-950/30 text-cyan-800 dark:text-cyan-200"
              onClick={onOpenHistoria}
            >
              <FileText className="h-4 w-4 mr-1" />
              Historia
            </Button>

            <Button
              variant="outline"
              className="border-emerald-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
              onClick={goUploads}
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              Rx
            </Button>

            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={goIA}
            >
              <Cpu className="h-4 w-4 mr-1" />
              IA
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
