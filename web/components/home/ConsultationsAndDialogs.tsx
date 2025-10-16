import * as React from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { FileImage as FileImageIcon, CheckCircle2, Minus, Clock, Edit3, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createConsultation } from "@/lib/consultations";
import { detectRadiograph } from "@/lib/studies";
import { getLatestAppointmentForPatient, updateAppointmentStatusNotes, statusToES } from "@/lib/appointments";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function RxBadge({
  requiere_rx,
  estudios_estado,
}: {
  requiere_rx: boolean | null | undefined;
  estudios_estado: "pendiente" | "completado" | null | undefined;
}) {
  if (!requiere_rx) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" /> —
      </Badge>
    );
  }
  if (estudios_estado === "completado") {
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white">
        <CheckCircle2 className="h-3 w-3" /> Completado
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white">
      <Clock className="h-3 w-3" /> Pendiente
    </Badge>
  );
}

type ConsultationListRow = {
  requiere_rx: boolean | null;
  estudios_estado: "pendiente" | "completado" | null;
  id: string;
  fecha_hora: string;
  servicio: string | null;
  motivo_consulta: string | null;
  diagnostico_inicial: string | null;
  diagnostico_final: string | null;
  estado_salida: string | null;
  medico_responsable: string | null;
};

export default function ConsultationsAndDialogs({
  patientId,
  doctorId,
}: {
  patientId: string | null;
  doctorId: string | null;
}) {
  const [consultations, setConsultations] = useState<ConsultationListRow[]>([]);
  const [loadingConsults, setLoadingConsults] = useState(false);

  // crear
  const [addConsultOpen, setAddConsultOpen] = useState(false);
  const [savingConsult, setSavingConsult] = useState(false);
  const [cService, setCService] = useState("");
  const [cMotivo, setCMotivo] = useState("");
  const [cHEA, setCHEA] = useState("");
  const [cExamen, setCExamen] = useState("");
  const [cEstudios, setCEstudios] = useState("");
  const [cDxInicial, setCDxInicial] = useState("");
  const [cDxFinal, setCDxFinal] = useState("");

  // editar
  const [editConsultOpen, setEditConsultOpen] = useState(false);
  const [editingConsultId, setEditingConsultId] = useState<string | null>(null);
  const [loadingEditingConsult, setLoadingEditingConsult] = useState(false);
  const [eService, setEService] = useState("");
  const [eMotivo, setEMotivo] = useState("");
  const [eHEA, setEHEA] = useState("");
  const [eExamen, setEExamen] = useState("");
  const [eEstudios, setEEstudios] = useState("");
  const [eDxInicial, setEDxInicial] = useState("");
  const [eDxFinal, setEDxFinal] = useState("");
  const [eTx, setETx] = useState("");
  const [eEstado, setEEstado] = useState("Tratamiento");

  // eliminar
  const [showDeleteConsultDialog, setShowDeleteConsultDialog] = useState(false);
  const [deleteConsultId, setDeleteConsultId] = useState<string | null>(null);
  const [deletingConsult, setDeletingConsult] = useState(false);

  async function fetchConsultationsForPatient(pid: string) {
    if (!pid || !isUuid(pid)) {
      setConsultations([]);
      return;
    }
    try {
      setLoadingConsults(true);
      const { data, error } = await supabase
        .from("consultations")
        .select("id, fecha_hora, servicio, motivo_consulta, diagnostico_inicial, diagnostico_final, estado_salida, medico_responsable, estudios_estado, requiere_rx")
        .eq("patient_id", pid)
        .order("fecha_hora", { ascending: false });

      if (error) throw error;
      setConsultations((data ?? []) as ConsultationListRow[]);
    } catch (e) {
      console.error("Error fetching consultations:", e);
      setConsultations([]);
    } finally {
      setLoadingConsults(false);
    }
  }

  useEffect(() => {
    if (patientId) fetchConsultationsForPatient(patientId);
    else setConsultations([]);
  }, [patientId]);

  // === crear: check cita previa y abrir modal
  async function handleCreateConsultClick() {
    if (!patientId) return;
    const { data: appt, error } = await getLatestAppointmentForPatient(patientId);
    if (error) {
      toast.error("No se pudo verificar la cita del paciente");
      return;
    }
    if (!appt) {
      toast.warning("El paciente no tiene ninguna cita registrada.");
      setAddConsultOpen(true);
      return;
    }
    if (appt.status !== "in_progress" && appt.status !== "checked_in") {
      const label = statusToES(appt.status);
      toast.message(`La cita está en estado: ${label}`, {
        description: "¿Deseas marcarla como 'Atendiendo' antes de continuar?",
        action: {
          label: "Marcar Atendiendo",
          onClick: async () => {
            const { error: e2 } = await updateAppointmentStatusNotes(appt.id, { status: "in_progress" });
            if (e2) { toast.error("No se pudo actualizar el estado"); return; }
            toast.success("Cita marcada como 'Atendiendo'");
            setAddConsultOpen(true);
          },
        },
      });
      return;
    }
    setAddConsultOpen(true);
  }

  // === crear: guardar
  async function handleCreateConsultation() {
    try {
      if (!patientId || !doctorId) { toast.error("No se pudo identificar paciente o médico."); return; }
      if (!cService.trim() || !cMotivo.trim()) { toast.error("Servicio y Motivo de consulta son obligatorios."); return; }

      setSavingConsult(true);
      const estudiosArr = cEstudios.split(",").map((s) => s.trim()).filter(Boolean);
      const requiresRx = detectRadiograph(estudiosArr);

      const payload: any = {
        patient_id: patientId,
        doctor_id: doctorId,
        fecha_hora: new Date().toISOString(),
        servicio: cService.trim(),
        motivo_consulta: cMotivo.trim(),
        historia_enfermedad_actual: cHEA.trim() || null,
        examen_fisico: cExamen.trim() || null,
        estudios_solicitados: estudiosArr.length ? estudiosArr : null,
        diagnostico_inicial: cDxInicial.trim() || null,
        diagnostico_final: cDxFinal.trim() || null,
      };

      if (requiresRx) { payload.estudios_estado = "pendiente"; payload.requiere_rx = true; } else { payload.requiere_rx = false; }

      const { data, error } = await createConsultation(payload);
      if (error || !data) { console.error(error); toast.error("No se pudo crear la consulta."); return; }

      toast.success("Consulta creada correctamente.");
      setAddConsultOpen(false);
      setCService(""); setCMotivo(""); setCHEA(""); setCExamen(""); setCEstudios(""); setCDxInicial(""); setCDxFinal("");

      await fetchConsultationsForPatient(patientId);
    } catch (e) {
      console.error(e);
      toast.error("Error inesperado al crear la consulta.");
    } finally {
      setSavingConsult(false);
    }
  }

  // === editar: abrir
  async function openEditConsultation(id: string) {
    try {
      setLoadingEditingConsult(true);
      setEditingConsultId(id);

      const { data, error } = await supabase
        .from("consultations")
        .select("id, servicio, motivo_consulta, historia_enfermedad_actual, examen_fisico, estudios_solicitados, diagnostico_inicial, diagnostico_final, conducta_tratamiento, estado_salida")
        .eq("id", id)
        .single();

      if (error || !data) { toast.error("No se pudo cargar la consulta."); setLoadingEditingConsult(false); return; }

      setEService(data.servicio ?? "");
      setEMotivo(data.motivo_consulta ?? "");
      setEHEA(data.historia_enfermedad_actual ?? "");
      setEExamen(data.examen_fisico ?? "");
      setEEstudios(Array.isArray(data.estudios_solicitados) ? data.estudios_solicitados.join(", ") : "");
      setEDxInicial(data.diagnostico_inicial ?? "");
      setEDxFinal(data.diagnostico_final ?? "");
      setETx(data.conducta_tratamiento ?? "");
      setEEstado(data.estado_salida ?? "Tratamiento");

      setEditConsultOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Error cargando la consulta.");
    } finally {
      setLoadingEditingConsult(false);
    }
  }

  // === editar: guardar
  async function handleUpdateConsultation() {
    try {
      if (!editingConsultId) return;
      if (!eService.trim() || !eMotivo.trim()) { toast.error("Servicio y Motivo son obligatorios."); return; }
      const estudiosArr = eEstudios.split(",").map((s) => s.trim()).filter(Boolean);

      const { error } = await supabase
        .from("consultations")
        .update({
          servicio: eService.trim(),
          motivo_consulta: eMotivo.trim(),
          historia_enfermedad_actual: eHEA.trim() || null,
          examen_fisico: eExamen.trim() || null,
          estudios_solicitados: estudiosArr.length ? estudiosArr : null,
          diagnostico_inicial: eDxInicial.trim() || null,
          diagnostico_final: eDxFinal.trim() || null,
          conducta_tratamiento: eTx.trim() || null,
          estado_salida: eEstado.trim() || null,
        })
        .eq("id", editingConsultId);

      if (error) { console.error(error); toast.error("No se pudo actualizar la consulta."); return; }

      toast.success("Consulta actualizada.");
      setEditConsultOpen(false);
      setEditingConsultId(null);
      if (patientId) await fetchConsultationsForPatient(patientId);
    } catch (e) {
      console.error(e);
      toast.error("Error al actualizar la consulta.");
    }
  }

  // === eliminar
  async function handleDeleteConsultation() {
    if (!deleteConsultId) return;
    try {
      setDeletingConsult(true);
      const { error } = await supabase.from("consultations").delete().eq("id", deleteConsultId);
      if (error) { console.error(error); toast.error("No se pudo eliminar la consulta."); return; }
      toast.success("Consulta eliminada.");
      setShowDeleteConsultDialog(false);
      setDeleteConsultId(null);
      if (patientId) await fetchConsultationsForPatient(patientId);
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar la consulta.");
    } finally {
      setDeletingConsult(false);
    }
  }

  return (
    <>
      {/* Tabla de consultas */}
      <div className="mt-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Consultas</CardTitle>
              <Button size="sm" onClick={handleCreateConsultClick}>Nueva consulta</Button>
            </div>
          </CardHeader>

          <CardContent>
            {loadingConsults ? (
              <div className="text-sm text-muted-foreground">Cargando consultas…</div>
            ) : consultations.length === 0 ? (
              <div className="rounded border bg-muted/20 p-3 text-sm text-muted-foreground">
                No hay consultas registradas para este paciente.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Servicio</th>
                      <th className="px-3 py-2 text-left">Motivo</th>
                      <th className="px-3 py-2 text-left">Diagnóstico inicial</th>
                      <th className="px-3 py-2 text-left">Diagnóstico final</th>
                      <th className="px-3 py-2 text-left">
                        <span className="inline-flex items-center gap-1">
                          <FileImageIcon className="h-3.5 w-3.5" /> RX
                        </span>
                      </th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-left">Médico</th>
                      <th className="px-3 py-2 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultations.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-3 py-2">{fmtDateTime(c.fecha_hora)}</td>
                        <td className="px-3 py-2">{c.servicio ?? "—"}</td>
                        <td className="px-3 py-2">{c.motivo_consulta ?? "—"}</td>
                        <td className="px-3 py-2">{c.diagnostico_inicial ?? "—"}</td>
                        <td className="px-3 py-2">{c.diagnostico_final ?? "—"}</td>
                        <td className="px-3 py-2">
                          <RxBadge requiere_rx={c.requiere_rx} estudios_estado={c.estudios_estado} />
                        </td>
                        <td className="px-3 py-2">{c.estado_salida ?? "—"}</td>
                        <td className="px-3 py-2">{c.medico_responsable ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditConsultation(c.id)} title="Editar">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => { setDeleteConsultId(c.id); setShowDeleteConsultDialog(true); }} title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Nueva Consulta */}
      <Dialog open={addConsultOpen} onOpenChange={setAddConsultOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva consulta</DialogTitle>
            <DialogDescription>Registra la atención clínica del paciente. Los campos marcados con * son obligatorios.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <label className="inline-flex items-center gap-0.5 text-sm font-medium">Servicio <span className="text-red-500">*</span></label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={cService} onChange={(e) => setCService(e.target.value)}>
                <option value="" disabled>Selecciona servicio</option>
                <option value="Emergencia">Emergencia</option>
                <option value="Atención general">Atención general</option>
                <option value="Especialidad">Especialidad</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-center gap-0.5 text-sm font-medium">Motivo de consulta <span className="text-red-500">*</span></label>
              <Input value={cMotivo} onChange={(e) => setCMotivo(e.target.value)} placeholder='p. ej. "Dolor torácico"' />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Historia de la enfermedad actual</label>
              <Textarea rows={4} value={cHEA} onChange={(e) => setCHEA(e.target.value)} placeholder="Inicio, evolución, factores asociados…" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Examen físico</label>
              <Textarea rows={4} value={cExamen} onChange={(e) => setCExamen(e.target.value)} placeholder="Hallazgos por sistemas" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Estudios solicitados</label>
              <Input value={cEstudios} onChange={(e) => setCEstudios(e.target.value)} placeholder='Separa por comas: Rx Tórax, Hemograma' />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Diagnóstico inicial</label>
              <Input value={cDxInicial} onChange={(e) => setCDxInicial(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Diagnóstico final</label>
              <Input value={cDxFinal} onChange={(e) => setCDxFinal(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddConsultOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateConsultation} disabled={!cService.trim() || !cMotivo.trim() || savingConsult}>
              {savingConsult ? "Guardando…" : "Guardar consulta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Consulta */}
      <Dialog open={editConsultOpen} onOpenChange={setEditConsultOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar consulta</DialogTitle>
            <DialogDescription>Modifica los datos de la consulta. Los campos marcados con * son obligatorios.</DialogDescription>
          </DialogHeader>

          {loadingEditingConsult ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : (
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <div className="space-y-2">
                <label className="inline-flex items-center gap-0.5 text-sm font-medium">Servicio <span className="text-red-500">*</span></label>
                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={eService} onChange={(e) => setEService(e.target.value)}>
                  <option value="" disabled>Selecciona servicio</option>
                  <option value="Emergencia">Emergencia</option>
                  <option value="Atención general">Atención general</option>
                  <option value="Especialidad">Especialidad</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="inline-flex items-center gap-0.5 text-sm font-medium">Motivo de consulta <span className="text-red-500">*</span></label>
                <Input value={eMotivo} onChange={(e) => setEMotivo(e.target.value)} placeholder='p. ej. "Dolor torácico"' />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Historia de la enfermedad actual</label>
                <Textarea rows={4} value={eHEA} onChange={(e) => setEHEA(e.target.value)} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Examen físico</label>
                <Textarea rows={4} value={eExamen} onChange={(e) => setEExamen(e.target.value)} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Estudios solicitados</label>
                <Input value={eEstudios} onChange={(e) => setEEstudios(e.target.value)} placeholder='Separa por comas: Rx Tórax, Hemograma' />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Diagnóstico inicial</label>
                <Input value={eDxInicial} onChange={(e) => setEDxInicial(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Diagnóstico final</label>
                <Input value={eDxFinal} onChange={(e) => setEDxFinal(e.target.value)} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Conducta / Tratamiento</label>
                <Textarea rows={3} value={eTx} onChange={(e) => setETx(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Estado de salida</label>
                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={eEstado} onChange={(e) => setEEstado(e.target.value)}>
                  <option value="Alta">Alta</option>
                  <option value="Tratamiento">Tratamiento</option>
                  <option value="Referido">Referido</option>
                  <option value="Hospitalizado">Hospitalizado</option>
                </select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditConsultOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateConsultation} disabled={!eService.trim() || !eMotivo.trim()}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar eliminación de consulta */}
      <Dialog open={showDeleteConsultDialog} onOpenChange={setShowDeleteConsultDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar consulta</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. ¿Deseas eliminar la consulta?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConsultDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteConsultation} disabled={deletingConsult}>
              {deletingConsult ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* botones flotantes para abrir AddConsult (desde la página si quieres) */}
      <div className="hidden" id="__home_internals__">
        <button id="open-add-consult" onClick={handleCreateConsultClick} />
      </div>
    </>
  );
}
