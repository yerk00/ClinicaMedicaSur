import { useEffect, useState } from "react";
import { createMedicalRecord, BLOOD_GROUPS } from "@/lib/medicalRecords";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  patientId: string;
  doctorId: string;
  existingRecord?: any;       // <-- opcional para editar (prefill)
  onRecordCreated?: () => void; // callback para refrescar vista
}

export default function MedicalRecordForm({ patientId, doctorId, existingRecord, onRecordCreated }: Props) {
  const [form, setForm] = useState({
    grupo_sanguineo: "" as string,
    transfusiones_previas: false,
    transfusiones_detalle: "",

    enfermedades_cronicas: "",
    alergias: "",
    medicacion_actual: "",
    cirugias_previas: "",
    antecedentes_familiares: "",
    consumo_sustancias: "",
    actividad_fisica: "",
    vacunas: "",
  });
  const [loading, setLoading] = useState(false);

  // Prefill cuando venga un registro existente
  useEffect(() => {
    if (!existingRecord) return;
    setForm({
      grupo_sanguineo: existingRecord.grupo_sanguineo ?? "",
      transfusiones_previas: Boolean(existingRecord.transfusiones_previas),
      transfusiones_detalle: existingRecord.transfusiones_detalle ?? "",

      enfermedades_cronicas: existingRecord.enfermedades_cronicas ?? "",
      alergias: existingRecord.alergias ?? "",
      medicacion_actual: existingRecord.medicacion_actual ?? "",
      cirugias_previas: existingRecord.cirugias_previas ?? "",
      antecedentes_familiares: existingRecord.antecedentes_familiares ?? "",
      consumo_sustancias: existingRecord.consumo_sustancias ?? "",
      actividad_fisica: existingRecord.actividad_fisica ?? "",
      vacunas: existingRecord.vacunas ?? "",
    });
  }, [existingRecord]);

  const handleText = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: checked,
      ...(name === "transfusiones_previas" && !checked
        ? { transfusiones_detalle: "" }
        : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Mantengo tu lógica: usa createMedicalRecord (si es upsert en tu backend, editará; si no, creará)
      await createMedicalRecord({
        user_profile_id: patientId,
        created_by: doctorId,

        grupo_sanguineo: form.grupo_sanguineo || null,
        transfusiones_previas: form.transfusiones_previas,
        transfusiones_detalle: form.transfusiones_previas ? form.transfusiones_detalle || null : null,

        enfermedades_cronicas: form.enfermedades_cronicas || null,
        alergias: form.alergias || null,
        medicacion_actual: form.medicacion_actual || null,
        cirugias_previas: form.cirugias_previas || null,
        antecedentes_familiares: form.antecedentes_familiares || null,
        consumo_sustancias: form.consumo_sustancias || null,
        actividad_fisica: form.actividad_fisica || null,
        vacunas: form.vacunas || null,
      });

      toast.success(existingRecord ? "Registro médico actualizado" : "Registro médico guardado");
      onRecordCreated?.();
    } catch (error: any) {
      toast.error(error?.message || "Error al guardar el registro médico");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto p-4 rounded-md border bg-card">
      <h2 className="text-lg font-semibold mb-2">
        {existingRecord ? "Editar registro médico" : "Registrar información médica"}
      </h2>

      {/* Datos clínicos */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Grupo sanguíneo</label>
          <select
            name="grupo_sanguineo"
            value={form.grupo_sanguineo}
            onChange={handleText}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Seleccione…</option>
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-6">
          <input
            id="transf"
            type="checkbox"
            name="transfusiones_previas"
            checked={form.transfusiones_previas}
            onChange={handleCheckbox}
            className="h-4 w-4"
          />
          <label htmlFor="transf" className="text-sm">Transfusiones previas</label>
        </div>

        {form.transfusiones_previas && (
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-muted-foreground">Detalle de transfusiones</label>
            <Textarea
              name="transfusiones_detalle"
              value={form.transfusiones_detalle}
              onChange={handleText}
              rows={2}
            />
          </div>
        )}
      </div>

      {/* Alergias / Medicación */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Alergias</label>
          <Textarea
            name="alergias"
            value={form.alergias}
            onChange={handleText}
            rows={3}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Medicación actual</label>
          <Textarea
            name="medicacion_actual"
            value={form.medicacion_actual}
            onChange={handleText}
            rows={3}
          />
        </div>
      </div>

      {/* Antecedentes */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Enfermedades crónicas</label>
          <Textarea
            name="enfermedades_cronicas"
            value={form.enfermedades_cronicas}
            onChange={handleText}
            rows={3}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Cirugías previas</label>
          <Textarea
            name="cirugias_previas"
            value={form.cirugias_previas}
            onChange={handleText}
            rows={3}
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-muted-foreground">Antecedentes familiares</label>
          <Textarea
            name="antecedentes_familiares"
            value={form.antecedentes_familiares}
            onChange={handleText}
            rows={3}
          />
        </div>
      </div>

      {/* Estilo de vida / Vacunas */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Consumo de sustancias</label>
          <Textarea
            name="consumo_sustancias"
            value={form.consumo_sustancias}
            onChange={handleText}
            rows={2}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Actividad física</label>
          <Textarea
            name="actividad_fisica"
            value={form.actividad_fisica}
            onChange={handleText}
            rows={2}
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-muted-foreground">Vacunas</label>
          <Textarea
            name="vacunas"
            value={form.vacunas}
            onChange={handleText}
            rows={2}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="cursor-pointer">
        {loading ? "Guardando..." : existingRecord ? "Guardar cambios" : "Guardar registro médico"}
      </Button>
    </form>
  );
}
