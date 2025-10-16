import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useState, useRef, useLayoutEffect } from "react";
import NavBar from "@/components/NavBar";
import { Toaster, toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Analytics } from "@vercel/analytics/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";

const queryClient = new QueryClient();

const shownNotifications = new Set<string>();
const handleToast = (r: { title: string; body: string }) => {
  const key = `${r.title}:${r.body}`;
  if (shownNotifications.has(key)) return;
  shownNotifications.add(key);
  toast.info(r.title, { description: r.body });
};

supabase.auth.onAuthStateChange((_, session) => {
  const userId = session?.user?.id;
  if (!userId) return;

  supabase.removeAllChannels();

  const fetchMissed = async () => {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data, error } = await supabase
      .from("user_notifications")
      .select("title, body")
      .eq("user_profile_id", userId)
      .gte("created_at", since);

    if (error) {
      console.error("Missed fetch error:", error);
      return;
    }
    (data ?? []).forEach(handleToast);
  };

  const channel = supabase.channel(`reminders-${userId}`).on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "user_notifications",
      filter: `user_profile_id=eq.${userId}`,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ new: row }) => handleToast(row as any),
  );

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log("✅ reminders channel LIVE");
      fetchMissed();
    }
  });
});

/* ============================================================
   ✅ Paciente activo (sincronización global, 100% compatible)
   - Unifica cómo resolvemos y persistimos el paciente seleccionado.
   - Prioriza ?id en la URL; si no hay, lee varias claves comunes.
   - Espeja SIEMPRE en todas las claves para máxima compatibilidad.
============================================================ */
const PATIENT_KEYS = [
  "targetProfileId",     // ya usada por varios módulos
  "selectedPatientId",   // otras pantallas
  "currentPatientId",
  "patientProfileId",
];

function safeParseId(raw: string | null): string | null {
  if (!raw) return null;
  try {
    // soporta valores guardados como JSON.stringify("...") o texto plano
    return raw.startsWith('"') ? JSON.parse(raw) : raw;
  } catch {
    return raw;
  }
}

function readAnyPatientKey(): string | null {
  if (typeof window === "undefined") return null;
  for (const k of PATIENT_KEYS) {
    const v = safeParseId(localStorage.getItem(k));
    if (v) return String(v);
  }
  return null;
}

function writeAllPatientKeys(id: string) {
  if (typeof window === "undefined") return;
  const v = JSON.stringify(id);
  for (const k of PATIENT_KEYS) {
    try { localStorage.setItem(k, v); } catch {}
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  // Wanna hide the nav bar on auth pages and landing page and 404
  const authPaths = [
    "/",
    "/auth/signUp",
    "/auth/login",
    "/404",
    "/auth/forgotPassword",
    "/auth/updatePassword",
  ];
  const hideNav = authPaths.includes(router.pathname);

  const [navExpanded, setNavExpanded] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkScreen = () => setIsMobile(window.innerWidth < 768);
      checkScreen();
      window.addEventListener("resize", checkScreen);
      return () => window.removeEventListener("resize", checkScreen);
    }
  }, []);

  useEffect(() => {
    const storedPref = localStorage.getItem("navExpanded");
    if (storedPref !== null) setNavExpanded(storedPref === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("navExpanded", String(navExpanded));
  }, [navExpanded]);

  // Push content to the right when nav is expanded. This is kinda a
  // hacky way to do it, but it works
  const marginLeft = isMobile ? "0" : navExpanded ? "16rem" : "5rem";
  const [userId, setUserId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broadcastChannelRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && isMounted) {
        setUserId(user.id);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!userId) return;

    const fetchMissed = async () => {
      const since = new Date(Date.now() - 60_000).toISOString();
      const { data, error } = await supabase
        .from("user_notifications")
        .select("title, body")
        .eq("user_profile_id", userId)
        .gte("created_at", since);

    if (error) {
        console.error("Missed fetch error:", error);
        return;
      }

      (data ?? []).forEach(handleToast);
    };

    const channel = supabase.channel(`reminders-${userId}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "user_notifications",
        filter: `user_profile_id=eq.${userId}`,
      },
      ({ new: row }) => handleToast(row as { title: string; body: string }),
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        fetchMissed();
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  /**
   * Supabase Realtime #3...
   */
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`reminders-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_profile_id=eq.${userId}`,
        },
        (payload) => {
          const { title, body } = payload.new as {
            title: string;
            body: string;
          };
          handleToast({ title, body });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  /**
   * Supabase Realtime #2...
   */
  useEffect(() => {
    broadcastChannelRef.current = supabase.channel("universal-channel", {
      config: { broadcast: { self: false } },
    });
    const channel = broadcastChannelRef.current;
    channel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("broadcast", { event: "*" }, (payload: any) => {
        if (payload?.payload?.message) {
          toast.success(`Notification: ${payload.payload.message}`);
        }
      })
      .subscribe((status: string) => {
        console.log("Universal channel status:", status);
      });
    return () => {
      supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Helper to fetch reminders due in the current minute window
    const fetchDueReminders = async () => {
      const now = new Date();
      const windowStart = new Date(now.setSeconds(0, 0));
      const windowEnd = new Date(windowStart.getTime() + 60_000);

      const { data: dueReminders, error } = await supabase
        .from("user_notifications")
        .select("title, body")
        .eq("user_profile_id", userId)
        .gte("created_at", windowStart.toISOString())
        .lt("created_at", windowEnd.toISOString());

      if (error) {
        console.error("Error fetching due reminders:", error);
        return;
      }
      dueReminders?.forEach(({ title, body }) => handleToast({ title, body }));
    };

    const now = new Date();
    const msToNextMinute =
      60_000 - (now.getSeconds() * 1_000 + now.getMilliseconds());

    const timeoutId = setTimeout(() => {
      fetchDueReminders();

      const intervalId = setInterval(fetchDueReminders, 60_000);

      return () => clearInterval(intervalId);
    }, msToNextMinute);

    fetchDueReminders();

    return () => clearTimeout(timeoutId);
  }, [userId]);

  /* ============================================================
     ✅ Sincronización del paciente activo (core del fix)
     - Prioriza router.query.id si existe.
     - Si no, lee cualquiera de las claves conocidas.
     - Espeja el valor en TODAS las claves.
     - Escucha cambios desde otras pestañas/módulos.
  ============================================================ */
  const [activePatientId, setActivePatientId] = useState<string | null>(null);

  // 1) Resolver en el arranque de cada ruta
  useEffect(() => {
    if (!router.isReady) return;
    const qIdRaw = router.query?.id;
    const qId = Array.isArray(qIdRaw) ? qIdRaw[0] : qIdRaw;

    const resolved =
      (qId && String(qId)) || // prioridad a ?id
      readAnyPatientKey();    // si no hay, lo que ya esté en localStorage

    if (resolved && resolved !== activePatientId) {
      setActivePatientId(resolved);
      writeAllPatientKeys(resolved); // espejo/normalización para todos los módulos
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query?.id]);

  // 2) Escuchar cambios entre pestañas o de otros módulos (cualquier clave)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !PATIENT_KEYS.includes(e.key)) return;
      const newId = safeParseId(e.newValue);
      if (newId && newId !== activePatientId) {
        setActivePatientId(newId);
        writeAllPatientKeys(newId); // volvemos a normalizar
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [activePatientId]);

  // 3) (Opcional) Dejarlo accesible para debug/inspección y estilos
  useEffect(() => {
    try {
      if (activePatientId) {
        (document.body as any).dataset.patientId = activePatientId;
      } else {
        delete (document.body as any).dataset.patientId;
      }
    } catch {}
  }, [activePatientId]);

  if (hideNav) {
    return (
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
        <Toaster position="bottom-right" richColors />
        <Analytics />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <div>
          <NavBar
            isExpanded={navExpanded}
            setIsExpanded={setNavExpanded}
            staticNav={false}
          />
          <main className="transition-all duration-300" style={{ marginLeft }}>
            {/* Nota: pasamos activePatientId por si en el futuro quieres leerlo como prop,
               pero no es obligatorio; los módulos pueden seguir usando localStorage. */}
            <Component {...pageProps} activePatientId={activePatientId} />
          </main>
          <Toaster position="bottom-right" richColors />
          <Analytics />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
