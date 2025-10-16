'use client';

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Calendar,
  User,
  Menu,
  LogIn,
  LogOut,
  File,
  List,
  X,
  History,
  FileImageIcon,
} from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { signOut } from "@/lib/auth";
import { ModeToggle } from "@/components/ModeToggle";
import { getAllowedPagesForCurrentUser } from "@/lib/permissions";

const LOGO_URL = "/images/clinic-logo.png";

type NavItemProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  isExpanded: boolean;
  onClick?: () => void;
};

function NavItem({ href, icon, label, isExpanded, onClick }: NavItemProps) {
  const router = useRouter();
  const active = router.asPath === href;
  const commonClasses =
    "w-full flex items-center transition-all duration-300 cursor-pointer rounded-xl";
  const expandedClasses = isExpanded
    ? `items-center gap-4 px-5 py-3 ${active ? "bg-white text-cyan-700 shadow-md" : "hover:bg-white/10"}`
    : `justify-center p-4 ${active ? "bg-white text-cyan-700 shadow-md" : "hover:bg-white/10"}`;
  return (
    <Link href={href} legacyBehavior>
      <a
        onClick={onClick}
        className={`${commonClasses} ${expandedClasses} hover:scale-105`}
      >
        <div className="flex-shrink-0 flex justify-center items-center w-6 h-6">
          {icon}
        </div>
        {isExpanded && (
          <span className="whitespace-nowrap transition-opacity duration-200 block text-[15px] font-semibold tracking-wide">
            {label}
          </span>
        )}
      </a>
    </Link>
  );
}

type NavBarProps = {
  staticNav?: boolean;
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
};

// Mapea href → pages.name (roles_pages.name)
// - '/profile' -> 'profile'
// - '/historial-clinico' -> 'historial-clinico'
// - '/admin/dashboard' -> 'admin_dashboard'
// - '/admin/users' -> 'admin_users'
function pageKeyForHref(href: string): string {
  const path = href.startsWith("/") ? href.slice(1) : href;
  if (path.startsWith("admin/")) {
    const rest = path.slice("admin/".length); // 'dashboard' | 'users' | ...
    return `admin_${rest.replace(/\//g, "_")}`;
  }
  return path;
}

export default function NavBar({
  staticNav = false,
  isExpanded,
  setIsExpanded,
}: NavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [allowedPages, setAllowedPages] = useState<string[]>([]);
  const router = useRouter();
  const navRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(!!session?.user);
      }
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchPages = async () => {
      const pages = await getAllowedPagesForCurrentUser();
      setAllowedPages(pages || []);
    };
    fetchPages();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (window.innerWidth >= 768) return;
      if (
        mobileOpen &&
        navRef.current &&
        mobileButtonRef.current &&
        !navRef.current.contains(event.target as Node) &&
        !mobileButtonRef.current.contains(event.target as Node)
      ) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [mobileOpen]);

  const expandedWidth = "w-64";
  const collapsedWidth = "w-20";
  const desktopWidth = isExpanded ? expandedWidth : collapsedWidth;
  const mobileTranslate = mobileOpen ? "translate-x-0" : "-translate-x-full";

  const containerClasses = staticNav
    ? `${desktopWidth} bg-gradient-to-b from-cyan-800 via-cyan-700 to-cyan-600 text-white backdrop-blur-lg bg-opacity-80 flex flex-col justify-between transition-all duration-300 h-screen shadow-2xl border-r border-white/10`
    : `fixed top-0 left-0 h-screen ${desktopWidth} bg-gradient-to-b from-cyan-800 via-cyan-700 to-cyan-600 text-white backdrop-blur-lg bg-opacity-80 flex flex-col justify-between transition-all duration-300 z-40 transform ${mobileTranslate} md:translate-x-0 shadow-2xl border-r border-white/10`;

  const navItemsContainerClasses = isExpanded
    ? "mt-6 space-y-2 flex flex-col items-start"
    : "mt-6 space-y-2 flex flex-col items-center";

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navItems = [
        { href: "/dashboard_ia", label: "Dashboard", icon: <List className="w-5 h-5" /> },
    { href: "/profile", label: "Pacientes", icon: <User className="w-5 h-5" /> },
    { href: "/historial-clinico", label: "Historias clínicas", icon: <History className="w-5 h-5" /> },
    { href: "/calendar", label: "Calendario", icon: <Calendar className="w-5 h-5" /> },
    { href: "/citas", label: "Citas", icon: <Calendar className="w-5 h-5" /> },
    { href: "/estudios-gabinete", label: "Estudios", icon: <FileImageIcon className="w-5 h-5" /> },
    { href: "/reminder", label: "Medicamentos", icon: <List className="w-5 h-5" /> },
  ];

  const adminItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: <Home className="w-5 h-5" /> },
    { href: "/admin/users", label: "Usuarios", icon: <User className="w-5 h-5" /> },
  ];

  const canSeeAdmin =
    allowedPages.includes("admin_dashboard") || allowedPages.includes("admin_users");

  return (
    <>
      {!staticNav && (
        <button
          ref={mobileButtonRef}
          className="fixed top-2 right-2 z-50 md:hidden p-2 bg-cyan-700 text-white rounded-full shadow hover:bg-white/10 hover:text-cyan-200 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setMobileOpen((prev) => !prev);
          }}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}

      <nav ref={navRef} className={containerClasses}>
        <div>
          <div className="flex items-center justify-center p-4 border-b border-white/10">
            {isExpanded ? (
              <div className="flex items-center gap-2">
                <Image
                  src={LOGO_URL}
                  alt="Clínica Médica Sur"
                  width={40}
                  height={40}
                  className="rounded-full shadow"
                  priority
                />
                <span className="text-lg font-bold tracking-wide cursor-pointer">
                  <Link href="/home">Clínica Médica Sur</Link>
                </span>
              </div>
            ) : (
              <Image
                src={LOGO_URL}
                alt="Logo"
                width={40}
                height={40}
                className="rounded-full shadow"
                priority
              />
            )}
          </div>

          <div className={navItemsContainerClasses}>
            {/* Ítems regulares por permisos */}
            {navItems.map((item) => {
              const key = pageKeyForHref(item.href);
              return (
                allowedPages.includes(key) && (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    isExpanded={isExpanded}
                  />
                )
              );
            })}

            {/* Sección Administración (solo Admin) */}
            {canSeeAdmin && (
              <>
                {isExpanded ? (
                  <div className="px-5 pt-4 text-xs uppercase tracking-wider opacity-80">
                    Administración
                  </div>
                ) : (
                  <div className="pt-2" />
                )}
                {adminItems.map((item) => {
                  const key = pageKeyForHref(item.href);
                  return (
                    allowedPages.includes(key) && (
                      <NavItem
                        key={item.href}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        isExpanded={isExpanded}
                      />
                    )
                  );
                })}
              </>
            )}

            {/* Auth + Modo */}
            {isLoggedIn ? (
              <button
                onClick={handleLogout}
                className={
                  isExpanded
                    ? "w-full flex items-center gap-3 px-5 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 text-green-400"
                    : "w-full flex justify-center items-center p-4 rounded-xl hover:bg-white/10 transition-all duration-300 text-red-400"
                }
              >
                <LogOut className="w-5 h-5" />
                {isExpanded && <span className="font-medium">Salir</span>}
              </button>
            ) : (
              <NavItem
                href="/auth/login"
                icon={<LogIn className="w-5 h-5" />}
                label="Ingresar"
                isExpanded={isExpanded}
              />
            )}

            <ModeToggle isExpanded={isExpanded as any} />
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className="w-full flex items-center justify-center p-3 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
