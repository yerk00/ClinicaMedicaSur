// components/layout/AdminSidebar.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  UserCircle,
  LogOut,
} from "lucide-react";

const navItems = [
  { name: "Panel de Control", href: "/admin", icon: LayoutDashboard },
  { name: "Usuarios", href: "/admin/users", icon: Users },
  { name: "Radiografías", href: "/admin/radiografias", icon: FolderKanban },
  { name: "Mi Perfil", href: "/admin/profile", icon: UserCircle },
];

export default function AdminSidebar() {
  const router = useRouter();

  const isActive = (path: string) => router.pathname === path;

  const handleLogout = () => {
    // Aquí puedes agregar lógica de cierre de sesión
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-white shadow-md h-screen border-r border-gray-200 flex flex-col">
      <div className="px-6 py-6 flex items-center gap-2 border-b">
        <span className="text-2xl font-bold text-purple-700">Jobs Now 🚀</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-purple-100 text-purple-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon size={18} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
