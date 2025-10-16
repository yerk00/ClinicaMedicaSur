import * as React from "react";
import { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { format } from "date-fns";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Search, Edit3, Trash2, Pill, Clock, Plus } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { CustomTimePicker } from "@/components/ui/time-picker";
import { BarcodeScanModal, type MedInfo } from "@/components/ScanMedication";

import {
  getPaginatedMedicationRemindersByUser,
  getMedicationRemindersByUser,
  createMedicationReminder,
  updateMedicationReminder,
  deleteMedicationReminder,
  type MedicationReminder,
} from "@/lib/medications";

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

const MedsSection = forwardRef<SectionHandle, Props>(function MedsSection(
  { patientId, onDataChanged, sendBroadcast },
  ref
) {
  // ======== estado base ========
  const [isLoading, setIsLoading] = useState(true);

  // Medicaciones
  const [allMedications, setAllMedications] = useState<MedicationReminder[]>([]);
  const [totalMeds, setTotalMeds] = useState(0);
  const [meds, setMeds] = useState<MedicationReminder[]>([]);
  const [medPage, setMedPage] = useState(1);
  const [medSearch, setMedSearch] = useState("");
  const [debouncedMedSearch, setDebouncedMedSearch] = useState("");
  const [medsOpen, setMedsOpen] = useState(true);

  // Vistas / modales
  const [viewingMed, setViewingMed] = useState<MedicationReminder | null>(null);

  // Crear med
  const [addMedOpen, setAddMedOpen] = useState(false);
  const [newMedName, setNewMedName] = useState("");
  const [newMedDosage, setNewMedDosage] = useState("");
  const [newMedDosageUnit, setNewMedDosageUnit] = useState("mg");
  const [newMedDate, setNewMedDate] = useState<Date | undefined>(undefined);
  const [newMedTimePicker, setNewMedTimePicker] = useState("00:00");
  const [newMedRecurrence, setNewMedRecurrence] = useState("Daily");
  const [newMedCalendarSync, setNewMedCalendarSync] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  // Edit med
  const [editingMed, setEditingMed] = useState<MedicationReminder | null>(null);
  const [editMedName, setEditMedName] = useState("");
  const [editMedDosage, setEditMedDosage] = useState("");
  const [editMedDosageUnit, setEditMedDosageUnit] = useState("mg");
  const [editMedDate, setEditMedDate] = useState<Date | undefined>(undefined);
  const [editMedTimePicker, setEditMedTimePicker] = useState("00:00");
  const [editMedRecurrence, setEditMedRecurrence] = useState("Daily");
  const [editMedCalendarSync, setEditMedCalendarSync] = useState("");
  const [showDeleteMedDialog, setShowDeleteMedDialog] = useState(false);
  const [deleteMedId, setDeleteMedId] = useState<string | null>(null);

  // de a 1 por página
  const medPageSize = 1;

  // ======== efectos: debounce ========
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMedSearch(medSearch), 300);
    return () => clearTimeout(t);
  }, [medSearch]);
  useEffect(() => setMedPage(1), [debouncedMedSearch]);

  // ======== cargar datos base ========
  async function fetchAll(uid: string) {
    setIsLoading(true);
    try {
      const medRes = await getPaginatedMedicationRemindersByUser(uid, 1, medPageSize);
      setMeds(medRes.data);
      setTotalMeds(medRes.count);
      const allM = await getMedicationRemindersByUser(uid);
      setAllMedications(allM);
    } catch (e) {
      toast.error("Error cargando medicaciones");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (patientId) fetchAll(patientId);
  }, [patientId]);

  // ======== realtime: meds ========
  useEffect(() => {
    if (!patientId) return;
    const medsCh = supabase.channel("medicationChanges");
    medsCh
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "medication_reminders", filter: `user_profile_id=eq.${patientId}` }, () => fetchAll(patientId))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "medication_reminders", filter: `user_profile_id=eq.${patientId}` }, () => fetchAll(patientId))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "medication_reminders" }, () => fetchAll(patientId))
      .subscribe();
    return () => { supabase.removeChannel(medsCh); };
  }, [patientId]);

  // ======== filtros + paginación local ========
  const medsFiltered = useMemo(() => {
    const t = debouncedMedSearch.trim().toLowerCase();
    if (!t) return allMedications;
    return allMedications.filter((m) => (m.medication_name || "").toLowerCase().includes(t));
  }, [allMedications, debouncedMedSearch]);

  const medsTotalPages = Math.max(1, Math.ceil(medsFiltered.length / medPageSize));
  useEffect(() => { setMedPage((p) => Math.min(Math.max(1, p), medsTotalPages)); }, [medsTotalPages]);

  const medsPageItems = useMemo(
    () =>
      medsFiltered
        .slice((medPage - 1) * medPageSize, (medPage - 1) * medPageSize + medPageSize)
        .sort((a, b) => new Date(a.reminder_time).getTime() - new Date(b.reminder_time).getTime()),
    [medsFiltered, medPage]
  );

  // ======== CRUD: meds ========
  async function handleAddMedication() {
    if (!patientId || !newMedName || !newMedDate) return;
    try {
      const dateString = format(newMedDate, "yyyy-MM-dd");
      const combined = `${dateString}T${newMedTimePicker}`;
      const localDate = new Date(combined);
      const combinedDosage = newMedDosage ? `${newMedDosage} ${newMedDosageUnit}` : "";

      await createMedicationReminder({
        user_profile_id: patientId,
        medication_name: newMedName,
        dosage: combinedDosage || null,
        reminder_time: localDate.toISOString(),
        recurrence: newMedRecurrence || null,
        calendar_sync_token: newMedCalendarSync || null,
      });

      sendBroadcast?.("med-add", `New medication reminder "${newMedName}" added.`);
      await fetchAll(patientId);

      setNewMedName(""); setNewMedDosage(""); setNewMedDosageUnit("mg");
      setNewMedDate(undefined); setNewMedTimePicker("00:00");
      setNewMedRecurrence("Daily"); setNewMedCalendarSync("");
      setAddMedOpen(false);
      onDataChanged?.();
      toast.success("Medication reminder added successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Error creating medication reminder.");
    }
  }

  function openEditMedDialog(med: MedicationReminder) {
    setEditingMed(med);
    setEditMedName(med.medication_name);
    if (med.dosage) {
      const parts = med.dosage.split(" ");
      setEditMedDosage(parts[0] || "");
      setEditMedDosageUnit(parts[1] || "mg");
    } else {
      setEditMedDosage(""); setEditMedDosageUnit("mg");
    }
    const medDate = new Date(med.reminder_time);
    setEditMedDate(medDate);
    setEditMedTimePicker(medDate.toTimeString().slice(0, 5));
    setEditMedRecurrence(med.recurrence ?? "Daily");
    setEditMedCalendarSync(med.calendar_sync_token ?? "");
  }

  async function handleUpdateMed() {
    if (!editingMed || !patientId || !editMedDate) return;
    try {
      const dateString = format(editMedDate, "yyyy-MM-dd");
      const combined = `${dateString}T${editMedTimePicker}`;
      const isoString = new Date(combined).toISOString();
      const combinedDosage = editMedDosage ? `${editMedDosage} ${editMedDosageUnit}` : "";

      await updateMedicationReminder(editingMed.id, {
        medication_name: editMedName,
        dosage: combinedDosage,
        reminder_time: isoString,
        recurrence: editMedRecurrence,
        calendar_sync_token: editMedCalendarSync,
      });

      sendBroadcast?.("med-update", `Medication reminder "${editMedName}" updated successfully.`);
      await fetchAll(patientId);
      setEditingMed(null);
      onDataChanged?.();
      toast.success("Medication reminder updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Error updating medication reminder.");
    }
  }

  async function handleDeleteMedication(id: string) {
    if (!patientId) return;
    try {
      await deleteMedicationReminder(id);
      await fetchAll(patientId);
      sendBroadcast?.("med-delete", "Medication reminder deleted successfully.");
      onDataChanged?.();
      toast.success("Medication reminder deleted successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Error deleting medication reminder.");
    }
  }

  // ======== Imperative handle (para “expandir/colapsar todo” desde el padre) ========
  useImperativeHandle(ref, () => ({
    expand: () => setMedsOpen(true),
    collapse: () => setMedsOpen(false),
  }), []);

  // ======== UI ========
  return (
    <section id="medicaciones">
      <Card className="bg-card border border-white/10 rounded-lg min-w-[280px] transition-all shadow-sm hover:shadow-xl p-0">
        <CardHeader className="py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base md:text-lg">Medicaciones</CardTitle>
            <span className="text-xs text-muted-foreground">{totalMeds} total</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-cyan-700/30 hover:bg-cyan-50/60 dark:hover:bg-cyan-900/20"
              onClick={() => setAddMedOpen(true)}
              title="Agregar medicación"
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
            <button
              type="button"
              onClick={() => setMedsOpen(v => !v)}
              aria-expanded={medsOpen}
              aria-controls="meds-section"
              className="rounded-md p-2 hover:bg-muted transition"
              title={medsOpen ? "Ocultar" : "Mostrar"}
            >
              <ChevronDown className={`h-5 w-5 transition-transform ${medsOpen ? "rotate-180" : "rotate-0"}`} />
            </button>
          </div>
        </CardHeader>

        {medsOpen && (
          <CardContent className="space-y-4 text-sm pb-4 px-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar medicaciones…" value={medSearch} onChange={(e) => setMedSearch(e.target.value)} className="pl-10" />
            </div>

            {medsPageItems.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-muted-foreground">No hay resultados.</div>
            ) : (
              medsPageItems.map((med) => (
                <div
                  key={med.id}
                  className="rounded-xl border border-cyan-700/15 bg-white/60 dark:bg-background/60 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition cursor-pointer"
                  onClick={() => setViewingMed(med)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200 grid place-items-center">
                        <Pill className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold leading-tight">{safeDisplay(med.medication_name)}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {med.recurrence && (
                            <span className="text-[11px] rounded-full px-2 py-[2px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border border-emerald-700/20">{med.recurrence}</span>
                          )}
                          {med.dosage && (
                            <span className="text-[11px] rounded-full px-2 py-[2px] bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-200 border border-cyan-700/20">{med.dosage}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); openEditMedDialog(med); }} className="h-8">
                        <Edit3 className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setDeleteMedId(med.id); setShowDeleteMedDialog(true); }} className="h-8">
                        <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Fecha</div>
                        <div className="font-medium">{new Date(med.reminder_time).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Hora</div>
                        <div className="font-medium">{new Date(med.reminder_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 opacity-70" />
                      <div>
                        <div className="text-muted-foreground">Creado</div>
                        <div className="font-medium">{new Date(med.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setMedPage(1)} disabled={medPage <= 1} title="Primera">
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={() => setMedPage((p) => Math.max(p - 1, 1))} disabled={medPage <= 1} title="Anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              <span className="text-sm">
                Página <strong>{medPage}</strong> de <strong>{medsTotalPages}</strong>
              </span>

              <div className="flex gap-1">
                <Button size="sm" onClick={() => setMedPage((p) => (p < medsTotalPages ? p + 1 : p))} disabled={medPage >= medsTotalPages} title="Siguiente">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMedPage(medsTotalPages)} disabled={medPage >= medsTotalPages} title="Última">
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ===== Modales ===== */}
      <Dialog open={addMedOpen} onOpenChange={setAddMedOpen}>
        <DialogContent className="max-w-lg w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Medication</DialogTitle>
            <DialogDescription>Fill out all fields to add a new medication reminder.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>Scan Barcode/QR Code</Button>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-0.5">Medication Name <span className="text-red-500">*</span></Label>
              <Input value={newMedName} onChange={(e) => setNewMedName(e.target.value)} placeholder="e.g. Ibuprofen" />
            </div>

            <div className="space-y-2">
              <Label>Dosage</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min="0" max="1000" step="0.1" value={newMedDosage} onChange={(e) => setNewMedDosage(e.target.value)} placeholder="e.g. 200" />
                <Select value={newMedDosageUnit} onValueChange={setNewMedDosageUnit}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mg">mg</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-0.5">Schedule (Date & Time) <span className="text-red-500">*</span></Label>
              <div className="mb-2">
                <Label className="text-xs">Date</Label>
                <DatePicker value={newMedDate} onChange={setNewMedDate} className="w-full" />
              </div>
              <div>
                <Label className="text-xs">Time (24h)</Label>
                <CustomTimePicker value={newMedTimePicker} onChange={setNewMedTimePicker} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-0.5">Recurrence <span className="text-red-500">*</span></Label>
              <Select value={newMedRecurrence} onValueChange={setNewMedRecurrence}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select recurrence" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Daily">Daily</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Biweekly">Biweekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="As Needed">As Needed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddMedOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMedication} disabled={!newMedName || !newMedDate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingMed && (
        <Dialog open={Boolean(editingMed)} onOpenChange={() => setEditingMed(null)}>
          <DialogContent className="max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Medication</DialogTitle>
              <DialogDescription>Update your medication details.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="inline-flex items-center gap-0.5">Medication Name <span className="text-red-500">*</span></Label>
                <Input value={editMedName} onChange={(e) => setEditMedName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Dosage</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" max="1000" step="0.1" value={editMedDosage} onChange={(e) => setEditMedDosage(e.target.value)} />
                  <Select value={editMedDosageUnit} onValueChange={setEditMedDosageUnit}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mg">mg</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="inline-flex items-center gap-0.5">Schedule (Date & Time) <span className="text-red-500">*</span></Label>
                <div className="mb-2">
                  <Label className="text-xs">Date</Label>
                  <DatePicker value={editMedDate} onChange={setEditMedDate} className="w-full" />
                </div>
                <div>
                  <Label className="text-xs">Time (24h)</Label>
                  <CustomTimePicker value={editMedTimePicker} onChange={setEditMedTimePicker} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="inline-flex items-center gap-0.5">Recurrence <span className="text-red-500">*</span></Label>
                <Select value={editMedRecurrence} onValueChange={setEditMedRecurrence}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select recurrence" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Biweekly">Biweekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="As Needed">As Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setEditingMed(null)}>Cancel</Button>
              <Button onClick={handleUpdateMed} disabled={!editMedName || !editMedDate}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showDeleteMedDialog} onOpenChange={(open) => !open && setShowDeleteMedDialog(false)}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>¿Seguro que deseas eliminar esta medicación? Esto quitará sus recordatorios asociados.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowDeleteMedDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if (deleteMedId) handleDeleteMedication(deleteMedId); setShowDeleteMedDialog(false); }}>
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Med */}
      {viewingMed && (
        <Dialog open onOpenChange={() => setViewingMed(null)}>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-indigo-600" />
                Detalles de medicación
              </DialogTitle>
              <DialogDescription className="text-foreground text-left">Resumen del recordatorio seleccionado.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="flex items-center gap-2"><Pill className="w-5 h-5 text-indigo-500" /><span><strong>Nombre:</strong> {safeDisplay(viewingMed.medication_name)}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-gray-600" /><span><strong>Dosis:</strong> {safeDisplay(viewingMed.dosage)}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-green-600" /><span><strong>Programación:</strong> {new Date(viewingMed.reminder_time).toLocaleDateString()} {new Date(viewingMed.reminder_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
              <div className="flex items-center gap-2"><Edit3 className="w-5 h-5 text-purple-600" /><span><strong>Recurrencia:</strong> {safeDisplay(viewingMed.recurrence)}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-gray-400" /><span><strong>Creado:</strong> {new Date(viewingMed.created_at).toLocaleString()}</span></div>
            </div>
            <DialogFooter><Button variant="secondary" onClick={() => setViewingMed(null)}>Cerrar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Scanner */}
      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onConfirm={(info: MedInfo) => {
          setNewMedName(info.name);
          setNewMedDosage(info.dosage);
          setNewMedDosageUnit(info.unit || "mg");
          setScanOpen(false);
        }}
      />

      {/* trigger oculto para abrir AddMed desde la página */}
      <div className="hidden" id="__home_internals__">
        <button id="open-add-med" onClick={() => setAddMedOpen(true)} />
      </div>
    </section>
  );
});

export default MedsSection;
