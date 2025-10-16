// web/pages/historial-clinico/index.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Search, Eye } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getClinicalHistoryPage, ClinicalHistoryRow } from "@/lib/clinicalHistory";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ClinicalHistoryPage() {
  const router = useRouter();

  // Tabla
  const [rows, setRows] = useState<ClinicalHistoryRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  async function fetchPage() {
    try {
      setLoading(true);
      const { data, count, error } = await getClinicalHistoryPage({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        onlyWithHistory: true,
      });
      if (error) {
        console.error(error);
        setRows([]);
        setCount(0);
        return;
      }
      setRows(data);
      setCount(count);
    } catch (e) {
      console.error(e);
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  // Guard de sesión + carga de datos
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      await fetchPage();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count]);

  function gotoPatientHome(patientId: string) {
    try { localStorage.setItem("targetProfileId", patientId); } catch {}
    router.push(`/historial-clinico/${patientId}`); // ⟵ antes iba a /home?id=
    }


  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-base md:text-lg">Historial clínico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Buscar por nombre o email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {loading ? "Cargando…" : `${count} pacientes con historial`}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Paciente</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Consultas</th>
                  <th className="px-3 py-2 text-left">Últ. consulta</th>
                  <th className="px-3 py-2 text-left">Antecedentes</th>
                  <th className="px-3 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                      Cargando datos…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                      No se encontraron pacientes con historial.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.patient_id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          {r.avatar_url ? (
                            <img
                              src={r.avatar_url}
                              alt={r.full_name ?? "Avatar"}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-[10px] uppercase">
                              {(r.full_name || r.email || "?")
                                .split(" ")
                                .map((s) => s[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                          )}
                          <div className="font-medium">{r.full_name || "—"}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2">{r.email || "—"}</td>
                      <td className="px-3 py-2">{r.consultations_count ?? 0}</td>
                      <td className="px-3 py-2">
                        {r.last_consultation_at
                          ? new Date(r.last_consultation_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.has_medical_record ? (
                          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs">
                            Sí
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          onClick={() => gotoPatientHome(r.patient_id)}
                          className="cursor-pointer"
                          title="Ver historial"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver historial
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="cursor-pointer"
            >
              Anterior
            </Button>
            <div className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
              disabled={page >= totalPages || loading}
              className="cursor-pointer"
            >
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
