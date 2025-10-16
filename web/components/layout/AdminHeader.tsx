// components/layout/AdminHeader.tsx
"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

export default function AdminHeader() {
  const [adminName, setAdminName] = useState("Admin");

  useEffect(() => {
    // Simulación: reemplaza por lógica real (ej. Supabase)
    setAdminName("Jhnonnael");
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
      {/* Campo de búsqueda */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Buscar..."
          className="w-full pl-10 pr-4 py-2 rounded-md bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </div>

      {/* Usuario actual */}
      <div className="text-sm text-gray-700 font-medium">
        {adminName}
      </div>
    </header>
  );
}
