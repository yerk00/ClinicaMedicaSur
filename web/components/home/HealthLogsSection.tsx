import * as React from "react";
import { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Search, Edit3, Trash2,
  HeartPulse, Thermometer, Wind, Gauge, Droplets, Scale, Ruler, Clock, Plus
} from "lucide-react";

import {
  getPaginatedHealthLogsByUser,
  getHealthLogsByUser,
  createHealthLog,
  updateHealthLog,
  deleteHealthLog,
  type HealthLog,
} from "@/lib/healthLogs";

function safeDisplay(val: string | null | undefined) {
  return val && val.trim() !== "" ? val : "N/A";
}

export type SectionHandle = {
  expand: () => void;
  collapse: () => void;
};

type Props = {
  patientId: string | null;
  onDataChanged?: () => void;
  sendBroadcast?: (ev: string, msg: string) => void;
};

function sortLogsForDisplay(input: HealthLog[]) {
  return [...input].sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

const HealthLogsSection = forwardRef<SectionHandle, Props>(function HealthLogsSection(
  { patientId, onDataChanged, sendBroadcast },
  ref
) {
  const [isLoading, setIsLoading] = useState(true);

  // Logs
  const [allLogs, setAllLogs] = useState<HealthLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logSearch, setLogSearch] = useState("");
  const [debouncedLogSearch, setDebouncedLogSearch] = useState("");
  const [logsOpen, setLogsOpen] = useState(true);

  // Vistas / modales
  const [viewingLog, setViewingLog] = useState<HealthLog | null>(null);

  // Crear log
  const [addLogOpen, setAddLogOpen] = useState(false);
  const [hlSymptomType, setHlSymptomType] = useState("");
  const [hlSeverity, setHlSeverity] = useState<number>(0);
  const [hlMood, setHlMood] = useState("");
  const [hlHeartRate, setHlHeartRate] = useState("");
  const [hlBloodPressureSys, setHlBloodPressureSys] = useState("");
  const [hlBloodPressureDia, setHlBloodPressureDia] = useState("");
  const [hlTemperature, setHlTemperature] = useState("");
  const [hlRespiratoryRate, setHlRespiratoryRate] = useState("");
  const [hlSpO2, setHlSpO2] = useState("");
  const [hlWeight, setHlWeight] = useState("");
  const [hlHeight, setHlHeight] = useState("");
  const [hlPainScore, setHlPainScore] = useState("");

  // Edit log
  const [editingLog, setEditingLog] = useState<HealthLog | null>(null);
  const [editSymptomType, setEditSymptomType] = useState("");
  const [editSeverity, setEditSeverity] = useState<number>(0);
  const [editMood, setEditMood] = useState("");
  const [editHeartRate, setEditHeartRate] = useState("");
  const [editBloodPressureSys, setEditBloodPressureSys] = useState("");
  const [editBloodPressureDia, setEditBloodPressureDia] = useState("");
  const [editTemperature, setEditTemperature] = useState("");
  const [editRespiratoryRate, setEditRespiratoryRate] = useState("");
  const [editSpO2, setEditSpO2] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editPainScore, setEditPainScore] = useState("");

  const [showDeleteLogDialog, setShowDeleteLogDialog] = useState(false);
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);

  // de a 1 por página
  const logPageSize = 1;

  // ======== debounce ========
  useEffect(() => {
    const t = setTimeout(() => setDebouncedLogSearch(logSearch), 300);
    return () => clearTimeout(t);
  }, [logSearch]);
  useEffect(() => setLogPage(1), [debouncedLogSearch]);

  // ======== cargar ========
  async function fetchAll(uid: string) {
    setIsLoading(true);
    try {
      const logRes = await getPaginatedHealthLogsByUser(uid, 1, logPageSize);
      setLogs(logRes.data);
      setTotalLogs(logRes.count);

      const allL = await getHealthLogsByUser(uid);
      setAllLogs(allL);
    } catch (e) {
      toast.error("Error cargando registros de salud");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (patientId) fetchAll(patientId);
  }, [patientId]);

  // ======== realtime: logs ========
  useEffect(() => {
    if (!patientId) return;
    const logsCh = supabase.channel("healthLogChanges");
    logsCh
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "health_logs", filter: `user_profile_id=eq.${patientId}` }, () => fetchAll(patientId))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "health_logs", filter: `user_profile_id=eq.${patientId}` }, () => fetchAll(patientId))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "health_logs" }, () => fetchAll(patientId))
      .subscribe();

    return () => { supabase.removeChannel(logsCh); };
  }, [patientId]);

  // ======== filtros + paginación ========
  const logsFiltered = useMemo(() => {
    const t = debouncedLogSearch.trim().toLowerCase();
    if (!t) return allLogs;
    return allLogs.filter((l) =>
      (l.symptom_type || "").toLowerCase().includes(t) ||
      (l.mood || "").toLowerCase().includes(t)
    );
  }, [allLogs, debouncedLogSearch]);

  const logsTotalPages = Math.max(1, Math.ceil(logsFiltered.length / logPageSize));
  useEffect(() => { setLogPage((p) => Math.min(Math.max(1, p), logsTotalPages)); }, [logsTotalPages]);

  const logsPageItems = useMemo(
    () => sortLogsForDisplay(logsFiltered.slice((logPage - 1) * logPageSize, (logPage - 1) * logPageSize + logPageSize)),
    [logsFiltered, logPage]
  );

  // ======== CRUD: logs ========
  async function handleAddHealthLog() {
    if (!patientId) return;
    try {
      await createHealthLog({
        user_profile_id: patientId,
        symptom_type: hlSymptomType || null,
        severity: hlSeverity ?? null,
        mood: hlMood || null,
        heart_rate_bpm: hlHeartRate ? Number(hlHeartRate) : null,
        bp_systolic_mmhg: hlBloodPressureSys ? Number(hlBloodPressureSys) : null,
        bp_diastolic_mmhg: hlBloodPressureDia ? Number(hlBloodPressureDia) : null,
        temperature_c: hlTemperature ? Number(hlTemperature) : null,
        respiratory_rate_bpm: hlRespiratoryRate ? Number(hlRespiratoryRate) : null,
        spo2_percent: hlSpO2 ? Number(hlSpO2) : null,
        weight_kg: hlWeight ? Number(hlWeight) : null,
        height_m: hlHeight ? Number(hlHeight) : null,
        pain_score: hlPainScore ? Number(hlPainScore) : null,
      });

      sendBroadcast?.("log-add", "New health log added successfully.");
      await fetchAll(patientId);
      onDataChanged?.();

      setHlSymptomType(""); setHlSeverity(0); setHlMood("");
      setHlHeartRate(""); setHlBloodPressureSys(""); setHlBloodPressureDia("");
      setHlTemperature(""); setHlRespiratoryRate(""); setHlSpO2("");
      setHlWeight(""); setHlHeight(""); setHlPainScore("");

      setAddLogOpen(false);
      toast.success("Health log added successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Error creating health log.");
    }
  }

  function openEditLogDialog(log: HealthLog) {
    setEditingLog(log);
    setEditSymptomType(log.symptom_type ?? "");
    setEditSeverity(log.severity ?? 0);
    setEditMood(log.mood ?? "");
    setEditHeartRate(log.heart_rate_bpm != null ? String(log.heart_rate_bpm) : "");
    setEditBloodPressureSys(log.bp_systolic_mmhg != null ? String(log.bp_systolic_mmhg) : "");
    setEditBloodPressureDia(log.bp_diastolic_mmhg != null ? String(log.bp_diastolic_mmhg) : "");
    setEditTemperature(log.temperature_c != null ? String(log.temperature_c) : "");
    setEditRespiratoryRate(log.respiratory_rate_bpm != null ? String(log.respiratory_rate_bpm) : "");
    setEditSpO2(log.spo2_percent != null ? String(log.spo2_percent) : "");
    setEditWeight(log.weight_kg != null ? String(log.weight_kg) : "");
    setEditHeight(log.height_m != null ? String(log.height_m) : "");
    setEditPainScore(log.pain_score != null ? String(log.pain_score) : "");
  }

  async function handleUpdateLog() {
    if (!editingLog || !patientId) return;
    try {
      await updateHealthLog(editingLog.id, {
        symptom_type: editSymptomType ?? null,
        severity: editSeverity ?? null,
        mood: editMood ?? null,
        heart_rate_bpm: editHeartRate ? Number(editHeartRate) : null,
        bp_systolic_mmhg: editBloodPressureSys ? Number(editBloodPressureSys) : null,
        bp_diastolic_mmhg: editBloodPressureDia ? Number(editBloodPressureDia) : null,
        temperature_c: editTemperature ? Number(editTemperature) : null,
        respiratory_rate_bpm: editRespiratoryRate ? Number(editRespiratoryRate) : null,
        spo2_percent: editSpO2 ? Number(editSpO2) : null,
        weight_kg: editWeight ? Number(editWeight) : null,
        height_m: editHeight ? Number(editHeight) : null,
        pain_score: editPainScore ? Number(editPainScore) : null,
      });

      sendBroadcast?.("log-update", "Health log updated successfully.");
      await fetchAll(patientId);
      setEditingLog(null);
      onDataChanged?.();
      toast.success("Health log updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Error updating health log.");
    }
  }

  async function handleDeleteLog(id: string) {
    if (!patientId) return;
    try {
      await deleteHealthLog(id);
      await fetchAll(patientId);
      sendBroadcast?.("log-delete", "Health log deleted successfully.");
      onDataChanged?.();
      toast.success("Health log deleted successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Error deleting health log.");
    }
  }

  // ======== Imperative handle ========
  useImperativeHandle(ref, () => ({
    expand: () => setLogsOpen(true),
    collapse: () => setLogsOpen(false),
  }), []);

  // ======== UI ========
  return (
    <section id="sintomas">
      <Card className="bg-card border border-white/10 rounded-lg min-w-[280px] transition-all shadow-sm hover:shadow-xl p-0 mt-6">
        <CardHeader className="py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base md:text-lg">Registro de síntomas</CardTitle>
            <span className="text-xs text-muted-foreground">{totalLogs} total</span>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="border-emerald-700/30 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20" onClick={() => setAddLogOpen(true)} title="Agregar registro">
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
            <button
              type="button"
              onClick={() => setLogsOpen((v) => !v)}
              aria-expanded={logsOpen}
              aria-controls="logs-section"
              className="rounded-md p-2 hover:bg-muted transition"
              title={logsOpen ? "Ocultar" : "Mostrar"}
            >
              <ChevronDown className={`h-5 w-5 transition-transform ${logsOpen ? "rotate-180" : "rotate-0"}`} />
            </button>
          </div>
        </CardHeader>

        {logsOpen && (
          <CardContent className="space-y-4 text-sm pb-4 px-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar registros de salud…" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className="pl-10" />
            </div>

            {logsPageItems.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-muted-foreground">No hay resultados.</div>
            ) : (
              logsPageItems.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-emerald-700/15 bg-white/60 dark:bg-background/60 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition cursor-pointer"
                  onClick={() => setViewingLog(log)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 grid place-items-center">
                        <HeartPulse className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold leading-tight">
                          {safeDisplay(log.symptom_type) || "Síntomas"}
                        </h3>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {log.mood && (
                            <span className="text-[11px] rounded-full px-2 py-[2px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border border-emerald-700/20">
                              Ánimo: {log.mood}
                            </span>
                          )}
                          <span className="text-[11px] rounded-full px-2 py-[2px] bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-200 border border-cyan-700/20">
                            Severidad: {log.severity ?? "N/A"}/10
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); openEditLogDialog(log); }} className="h-8">
                        <Edit3 className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setShowDeleteLogDialog(true); setDeleteLogId(log.id); }} className="h-8">
                        <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="h-2 w-full rounded bg-muted overflow-hidden">
                      <div
                        className="h-2 rounded bg-emerald-500/90"
                        style={{ width: `${Math.max(0, Math.min(10, Number(log.severity ?? 0))) * 10}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-[13px]">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Temperatura</div>
                        <div className="font-medium">{log.temperature_c != null ? `${log.temperature_c} °C` : "N/A"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Frec. cardíaca</div>
                        <div className="font-medium">{log.heart_rate_bpm != null ? `${log.heart_rate_bpm} LPM` : "N/A"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Wind className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Frec. respiratoria</div>
                        <div className="font-medium">{log.respiratory_rate_bpm != null ? `${log.respiratory_rate_bpm} RPM` : "N/A"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Presión arterial</div>
                        <div className="font-medium">
                          {log.bp_systolic_mmhg != null && log.bp_diastolic_mmhg != null
                            ? `${log.bp_systolic_mmhg}/${log.bp_diastolic_mmhg} mmHg`
                            : "N/A"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">SpO₂</div>
                        <div className="font-medium">{log.spo2_percent != null ? `${log.spo2_percent}%` : "N/A"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Peso</div>
                        <div className="font-medium">{log.weight_kg != null ? `${log.weight_kg} kg` : "N/A"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Talla</div>
                        <div className="font-medium">{log.height_m != null ? `${log.height_m} m` : "N/A"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Dolor</div>
                        <div className="font-medium">{log.pain_score != null ? log.pain_score : "N/A"} / 10</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Fecha</div>
                        <div className="font-medium">{new Date((log as any)?.created_at ?? Date.now()).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setLogPage(1)} disabled={logPage <= 1} title="Primera">
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={() => setLogPage((p) => Math.max(p - 1, 1))} disabled={logPage <= 1} title="Anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              <span className="text-sm">Página <strong>{logPage}</strong> de <strong>{logsTotalPages}</strong></span>

              <div className="flex gap-1">
                <Button size="sm" onClick={() => setLogPage((p) => (p < logsTotalPages ? p + 1 : p))} disabled={logPage >= logsTotalPages} title="Siguiente">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLogPage(logsTotalPages)} disabled={logPage >= logsTotalPages} title="Última">
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ===== Modales ===== */}
      <Dialog open={addLogOpen} onOpenChange={setAddLogOpen}>
        <DialogContent className="max-w-xl w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo registro de signos vitales</DialogTitle>
            <DialogDescription>Registra síntomas, ánimo y signos vitales del paciente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-0.5">Síntoma(s) <span className="text-red-500">*</span></Label>
              <Input value={hlSymptomType} onChange={(e) => setHlSymptomType(e.target.value)} placeholder="Separa múltiples con comas" />
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-0.5">Severidad (0-10) <span className="text-red-500">*</span></Label>
              <Slider value={[hlSeverity]} onValueChange={(value) => setHlSeverity(value[0])} min={0} max={10} step={1} className="w-full" />
              <div className="text-xs">Actual: {hlSeverity}</div>
            </div>

            <div className="space-y-2">
              <Label>Ánimo</Label>
              <Select value={hlMood} onValueChange={setHlMood}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona ánimo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Feliz">Feliz</SelectItem>
                  <SelectItem value="Triste">Triste</SelectItem>
                  <SelectItem value="Neutral">Neutral</SelectItem>
                  <SelectItem value="Estresado">Estresado</SelectItem>
                  <SelectItem value="Cansado">Cansado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Frecuencia cardíaca</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min="0" max="300" value={hlHeartRate} onChange={(e) => setHlHeartRate(e.target.value)} placeholder="p. ej. 72" />
                <span className="text-sm">LPM</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Presión arterial</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min="0" max="300" value={hlBloodPressureSys} onChange={(e) => setHlBloodPressureSys(e.target.value)} placeholder="Sistólica" />
                <span>/</span>
                <Input type="number" min="0" max="300" value={hlBloodPressureDia} onChange={(e) => setHlBloodPressureDia(e.target.value)} placeholder="Diastólica" />
                <span className="text-sm">mmHg</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Temperatura (°C)</Label>
              <Input type="number" step="0.1" value={hlTemperature} onChange={(e) => setHlTemperature(e.target.value)} placeholder="p. ej. 36.8" />
            </div>

            <div className="space-y-2">
              <Label>Frecuencia respiratoria (RPM)</Label>
              <Input type="number" value={hlRespiratoryRate} onChange={(e) => setHlRespiratoryRate(e.target.value)} placeholder="p. ej. 16" />
            </div>

            <div className="space-y-2">
              <Label>Saturación de oxígeno (SpO₂ %)</Label>
              <Input type="number" value={hlSpO2} onChange={(e) => setHlSpO2(e.target.value)} placeholder="p. ej. 98" />
            </div>

            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input type="number" step="0.1" value={hlWeight} onChange={(e) => setHlWeight(e.target.value)} placeholder="p. ej. 70.5" />
            </div>

            <div className="space-y-2">
              <Label>Talla (m)</Label>
              <Input type="number" step="0.01" value={hlHeight} onChange={(e) => setHlHeight(e.target.value)} placeholder="p. ej. 1.73" />
            </div>

            <div className="space-y-2">
              <Label>Dolor (0-10)</Label>
              <Slider value={[Number(hlPainScore || 0)]} onValueChange={(v) => setHlPainScore(String(v[0]))} min={0} max={10} step={1} className="w-full" />
              <div className="text-xs">Actual: {hlPainScore || 0}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddLogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddHealthLog} disabled={!hlSymptomType}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingLog && (
        <Dialog open={Boolean(editingLog)} onOpenChange={() => setEditingLog(null)}>
          <DialogContent className="max-w-xl w-full max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar registro de salud</DialogTitle>
              <DialogDescription>Actualiza síntomas, ánimo y signos vitales.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="inline-flex items-center gap-0.5">Síntoma(s) <span className="text-red-500">*</span></Label>
                <Input value={editSymptomType} onChange={(e) => setEditSymptomType(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label className="inline-flex items-center gap-0.5">Severidad (0-10) <span className="text-red-500">*</span></Label>
                <Slider value={[editSeverity]} onValueChange={(value) => setEditSeverity(value[0])} min={0} max={10} step={1} className="w-full" />
                <div className="text-xs">Actual: {editSeverity}</div>
              </div>

              <div className="space-y-2">
                <Label>Ánimo</Label>
                <Select value={editMood ?? undefined} onValueChange={setEditMood}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona ánimo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Feliz">Feliz</SelectItem>
                    <SelectItem value="Triste">Triste</SelectItem>
                    <SelectItem value="Neutral">Neutral</SelectItem>
                    <SelectItem value="Estresado">Estresado</SelectItem>
                    <SelectItem value="Cansado">Cansado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frecuencia cardíaca</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" max="300" value={editHeartRate} onChange={(e) => setEditHeartRate(e.target.value)} placeholder="p. ej. 72" />
                  <span className="text-sm">LPM</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Presión arterial</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" max="300" value={editBloodPressureSys} onChange={(e) => setEditBloodPressureSys(e.target.value)} placeholder="Sistólica" />
                  <span>/</span>
                  <Input type="number" min="0" max="300" value={editBloodPressureDia} onChange={(e) => setEditBloodPressureDia(e.target.value)} placeholder="Diastólica" />
                  <span className="text-sm">mmHg</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Temperatura (°C)</Label>
                <Input type="number" step="0.1" value={editTemperature} onChange={(e) => setEditTemperature(e.target.value)} placeholder="p. ej. 36.8" />
              </div>

              <div className="space-y-2">
                <Label>Frecuencia respiratoria (RPM)</Label>
                <Input type="number" value={editRespiratoryRate} onChange={(e) => setEditRespiratoryRate(e.target.value)} placeholder="p. ej. 16" />
              </div>

              <div className="space-y-2">
                <Label>Saturación de oxígeno (SpO₂ %)</Label>
                <Input type="number" value={editSpO2} onChange={(e) => setEditSpO2(e.target.value)} placeholder="p. ej. 98" />
              </div>

              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input type="number" step="0.1" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} placeholder="p. ej. 70.5" />
              </div>

              <div className="space-y-2">
                <Label>Talla (m)</Label>
                <Input type="number" step="0.01" value={editHeight} onChange={(e) => setEditHeight(e.target.value)} placeholder="p. ej. 1.73" />
              </div>

              <div className="space-y-2">
                <Label>Dolor (0-10)</Label>
                <Slider value={[Number(editPainScore || 0)]} onValueChange={(v) => setEditPainScore(String(v[0]))} min={0} max={10} step={1} className="w-full" />
                <div className="text-xs">Actual: {editPainScore || 0}</div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setEditingLog(null)}>Cancelar</Button>
              <Button onClick={handleUpdateLog} disabled={!editSymptomType}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showDeleteLogDialog} onOpenChange={(open) => !open && setShowDeleteLogDialog(false)}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>¿Seguro que deseas eliminar este registro de salud?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowDeleteLogDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if (deleteLogId) handleDeleteLog(deleteLogId); setShowDeleteLogDialog(false); }}>
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Log */}
      {viewingLog && (
        <Dialog open onOpenChange={() => setViewingLog(null)}>
          <DialogContent className="max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-red-500" />
                Detalles del registro de salud
              </DialogTitle>
              <DialogDescription className="text-foreground text-left">Resumen del registro seleccionado.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-4 text-sm">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-pink-500" />
                <span><strong>Síntomas:</strong> {safeDisplay(viewingLog.symptom_type)}</span>
              </div>
              <div><strong>Severidad:</strong> {viewingLog.severity ?? "N/A"}</div>
              <div><strong>Ánimo:</strong> {safeDisplay(viewingLog.mood)}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                <p><strong>Temperatura:</strong> {viewingLog.temperature_c != null ? `${viewingLog.temperature_c} °C` : "N/A"}</p>
                <p><strong>Frec. cardíaca:</strong> {viewingLog.heart_rate_bpm != null ? `${viewingLog.heart_rate_bpm} LPM` : "N/A"}</p>
                <p><strong>Frec. respiratoria:</strong> {viewingLog.respiratory_rate_bpm != null ? `${viewingLog.respiratory_rate_bpm} RPM` : "N/A"}</p>
                <p><strong>Presión arterial:</strong> {viewingLog.bp_systolic_mmhg != null && viewingLog.bp_diastolic_mmhg != null ? `${viewingLog.bp_systolic_mmhg}/${viewingLog.bp_diastolic_mmhg} mmHg` : "N/A"}</p>
                <p><strong>SpO₂:</strong> {viewingLog.spo2_percent != null ? `${viewingLog.spo2_percent}%` : "N/A"}</p>
                <p><strong>Peso:</strong> {viewingLog.weight_kg != null ? `${viewingLog.weight_kg} kg` : "N/A"}</p>
                <p><strong>Talla:</strong> {viewingLog.height_m != null ? `${viewingLog.height_m} m` : "N/A"}</p>
                <p><strong>Dolor:</strong> {viewingLog.pain_score != null ? viewingLog.pain_score : "N/A"} / 10</p>
              </div>
            </div>

            <DialogFooter><Button variant="secondary" onClick={() => setViewingLog(null)}>Cerrar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* trigger oculto para abrir AddLog desde la página */}
      <div className="hidden" id="__home_internals__">
        <button id="open-add-log" onClick={() => setAddLogOpen(true)} />
      </div>
    </section>
  );
});

export default HealthLogsSection;
