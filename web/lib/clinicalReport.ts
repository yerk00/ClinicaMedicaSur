// web/lib/clinicalReport.ts
import type {
  PatientProfile,
  MedicalRecordLite,
  ConsultationLite,
  FileLite,
} from "@/lib/historyDetails";

const BRAND = { r: 10, g: 132, b: 153 };
const TEXT = { r: 33, g: 37, b: 41 };
const MUTED = { r: 108, g: 117, b: 125 };

const MARGIN_L = 15;
const MARGIN_R = 15;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

type Pdf = any;

function setFill(doc: Pdf, c: { r: number; g: number; b: number }) { doc.setFillColor(c.r, c.g, c.b); }
function setText(doc: Pdf, c: { r: number; g: number; b: number }) { doc.setTextColor(c.r, c.g, c.b); }
function setDraw(doc: Pdf, c: { r: number; g: number; b: number }) { doc.setDrawColor(c.r, c.g, c.b); }

function ensureSpace(doc: Pdf, y: number, needed = 18) {
  if (y + needed <= PAGE_H - 15) return y;
  doc.addPage();
  return 20;
}

function sectionTitle(doc: Pdf, y: number, title: string) {
  y = ensureSpace(doc, y, 16);
  setFill(doc, BRAND);
  doc.rect(MARGIN_L, y - 5, 3, 10, "F");
  setText(doc, TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text(title, MARGIN_L + 6, y + 2);
  return y + 10;
}

function labelValue(doc: Pdf, y: number, label: string, value: string, opts?: { labelW?: number }) {
  const labelW = opts?.labelW ?? 44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, TEXT);
  const labelX = MARGIN_L;
  const textX = MARGIN_L + labelW + 2;
  const maxW = CONTENT_W - labelW - 2;

  y = ensureSpace(doc, y, 8);
  doc.text(label, labelX, y);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(value || "—", maxW);
  doc.text(lines, textX, y);
  const lineH = 5.6;
  return y + Math.max(7, lines.length * lineH + 1);
}

function paragraph(doc: Pdf, y: number, text: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setText(doc, TEXT);
  const lines = doc.splitTextToSize(text || "—", CONTENT_W);
  const needed = lines.length * 5.6 + 6;
  y = ensureSpace(doc, y, needed);
  doc.text(lines, MARGIN_L, y);
  return y + needed;
}

function softDivider(doc: Pdf, y: number) {
  setDraw(doc, MUTED);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
  return y + 3;
}

/** Loader 1: HTMLImageElement -> Canvas -> DataURL (mejor con CORS configurado) */
function loadImageAsDataURL(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/** Loader 2: fetch Blob -> FileReader DataURL (fallback) */
async function fetchAsDataURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Usa los dos loaders para maximizar probabilidad de éxito */
async function toDataURLBestEffort(url?: string | null) {
  if (!url) return null;
  const viaImg = await loadImageAsDataURL(url);
  if (viaImg) return viaImg;
  return await fetchAsDataURL(url);
}

async function drawHeader(doc: Pdf, opts: { institutionName: string; logoUrl?: string | null }) {
  setFill(doc, BRAND);
  doc.rect(0, 0, PAGE_W, 12, "F");

  let x = MARGIN_L;
  let y = 18;

  // Logo con mejor loader
  if (opts.logoUrl) {
    const dataUrl = await toDataURLBestEffort(opts.logoUrl);
    if (dataUrl) {
      const w = 22;
      const h = 22;
      doc.addImage(dataUrl, "PNG", MARGIN_L, 14, w, h);
      x = MARGIN_L + w + 6;
    }
  }

  setText(doc, TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(opts.institutionName || "Institución", x, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.2);
  setText(doc, MUTED);
  doc.text("Historia clínica – Reporte de consulta", x, y + 9);
  return 40;
}

function drawFooters(doc: Pdf, doctor?: string | null) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const footerY = PAGE_H - 10;
    setDraw(doc, MUTED);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_L, footerY - 4, PAGE_W - MARGIN_R, footerY - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setText(doc, MUTED);
    const left = `Generado: ${new Date().toLocaleString()}`;
    const right = `Página ${i} de ${total}`;
    doc.text(left, MARGIN_L, footerY);
    doc.text(right, PAGE_W - MARGIN_R, footerY, { align: "right" });

    if (doctor) {
      doc.text(String(doctor), MARGIN_L, footerY - 6);
    }
  }
}

/** Miniaturas RX (3/row) + METADATOS debajo (fecha, tipo, tags) */
async function drawRadiographsGrid(doc: Pdf, y: number, radiographs: FileLite[]) {
  if (!radiographs.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    setText(doc, TEXT);
    y = ensureSpace(doc, y, 12);
    doc.text("— No se registran imágenes en esta fecha —", MARGIN_L, y);
    return y + 10;
  }

  const COLS = 3;
  const GAP = 5;
  const cellW = (CONTENT_W - GAP * (COLS - 1)) / COLS;
  const imgH = 40;

  let col = 0;
  for (let i = 0; i < radiographs.length; i++) {
    const rx = radiographs[i];
    const dataUrl = await toDataURLBestEffort(rx.url);

    // Reservar espacio (imagen + metadatos ~20)
    y = ensureSpace(doc, y, imgH + 26);

    const x = MARGIN_L + col * (cellW + GAP);

    // Contenedor
    setDraw(doc, MUTED);
    doc.setLineWidth(0.2);
    doc.rect(x, y, cellW, imgH + 20);

    // Imagen
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "JPEG", x + 2, y + 2, cellW - 4, imgH - 2);
      } catch {
        // si hay error, dejamos placeholder
      }
    } else {
      // Placeholder si no carga (por CORS o formato)
      setText(doc, MUTED);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text("Vista no disponible", x + 4, y + 12);
    }

    // Metadatos
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setText(doc, TEXT);
    const label = (rx.filename || "Imagen").slice(0, 60);
    const dt = rx.uploaded_at ? new Date(rx.uploaded_at).toLocaleString() : "—";
    const type = rx.file_type || "—";
    const tags = rx.tags?.length ? rx.tags.join(", ") : "—";

    const meta = `${label}\nFecha: ${dt}\nTipo: ${type}\nTags: ${tags}`;
    const lines = doc.splitTextToSize(meta, cellW - 6);
    doc.text(lines, x + 3, y + imgH + 6);

    col++;
    if (col === COLS) {
      col = 0;
      y += imgH + 24;
    }
  }
  if (col !== 0) y += imgH + 24;
  return y;
}

export async function generateConsultationReportPDF(opts: {
  patient: PatientProfile;
  record: MedicalRecordLite | null;
  consult: ConsultationLite;
  radiographs: FileLite[];
  logoUrl?: string | null;
  institutionName?: string;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const {
    patient,
    record,
    consult,
    radiographs,
    logoUrl = "/images/clinic-logo.png",
    institutionName = "Clínica Medica Sur",
  } = opts;

  const f = (s?: string | null) => (s && String(s).trim().length ? String(s) : "—");
  const yesNo = (b?: boolean | null) => (b === true ? "Sí" : b === false ? "No" : "—");

  let y = await drawHeader(doc, { institutionName, logoUrl });

  // Meta consulta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setText(doc, MUTED);
  y = ensureSpace(doc, y, 10);
  doc.text(`Fecha/Hora: ${new Date(consult.fecha_hora).toLocaleString()}`, MARGIN_L, y);
  doc.text(`Servicio: ${f(consult.servicio)}`, PAGE_W - MARGIN_R, y, { align: "right" });
  y += 6;
  y = softDivider(doc, y);

  // I. Filiación
  y = sectionTitle(doc, y, "I. FILIACIÓN");
  y = labelValue(doc, y, "Nombre:", f(patient.full_name));
  y = labelValue(doc, y, "Email:", f(patient.email));
  y = labelValue(doc, y, "Grupo sanguíneo:", f(record?.grupo_sanguineo));
  y = softDivider(doc, y + 2);

  // II. Antecedentes clínicos (nuevo esquema)
  y = sectionTitle(doc, y, "II. ANTECEDENTES CLÍNICOS");
  y = labelValue(doc, y, "Alergias:", f(record?.alergias));
  y = labelValue(doc, y, "Enfermedades crónicas:", f(record?.enfermedades_cronicas));
  y = labelValue(doc, y, "Medicación actual:", f(record?.medicacion_actual));
  y = labelValue(doc, y, "Cirugías previas:", f(record?.cirugias_previas));
  y = labelValue(doc, y, "Transfusiones previas:", yesNo(record?.transfusiones_previas));
  y = labelValue(doc, y, "Detalle transfusiones:", f(record?.transfusiones_detalle));
  y = labelValue(doc, y, "Antecedentes familiares:", f(record?.antecedentes_familiares));
  y = labelValue(doc, y, "Consumo sustancias:", f(record?.consumo_sustancias));
  y = labelValue(doc, y, "Actividad física:", f(record?.actividad_fisica));
  y = labelValue(doc, y, "Vacunas:", f(record?.vacunas));
  y = softDivider(doc, y);

  // III. Motivo de consulta
  y = sectionTitle(doc, y, "III. MOTIVO DE CONSULTA");
  y = paragraph(doc, y, f(consult.motivo_consulta));
  y = softDivider(doc, y);

  // IV. Enfermedad actual
  y = sectionTitle(doc, y, "IV. ENFERMEDAD ACTUAL");
  y = paragraph(doc, y, f(consult.historia_enfermedad_actual));
  y = softDivider(doc, y);

  // V. Examen físico
  y = sectionTitle(doc, y, "V. EXAMEN FÍSICO");
  y = paragraph(doc, y, f(consult.examen_fisico));
  y = softDivider(doc, y);

  // VI. Estudios solicitados
  y = sectionTitle(doc, y, "VI. ESTUDIOS SOLICITADOS");
  const estudios = consult.estudios_solicitados;
  y = paragraph(doc, y, (estudios && estudios.length) ? estudios.join(", ") : "—");
  y = softDivider(doc, y);

  // VII. Diagnóstico
  y = sectionTitle(doc, y, "VII. DIAGNÓSTICO");
  y = labelValue(doc, y, "Inicial:", f(consult.diagnostico_inicial));
  y = labelValue(doc, y, "Final:", f(consult.diagnostico_final));
  y = softDivider(doc, y);

  // VIII. Conducta / Tratamiento
  y = sectionTitle(doc, y, "VIII. CONDUCTA / TRATAMIENTO");
  y = paragraph(doc, y, f(consult.conducta_tratamiento));
  y = softDivider(doc, y);

  // IX. Médico responsable
  y = sectionTitle(doc, y, "IX. MÉDICO RESPONSABLE");
  y = paragraph(doc, y, f(consult.medico_responsable));
  y = softDivider(doc, y);

  // X. Radiografías del día (miniaturas + metadatos)
  y = sectionTitle(doc, y, "X. RADIOGRAFÍAS DEL DÍA");
  y = await drawRadiographsGrid(doc, y, radiographs);

  // Firma
  y = ensureSpace(doc, y, 24);
  setDraw(doc, MUTED);
  doc.setLineWidth(0.2);
  const lineY = y + 12;
  doc.line(PAGE_W - 90, lineY, PAGE_W - MARGIN_R, lineY);
  setText(doc, MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text("Firma y sello", PAGE_W - 58, lineY + 6);

  drawFooters(doc, consult.medico_responsable);

  const fileName = `historia-${(patient.full_name || "paciente").replace(/\s+/g, "_")}-${new Date(consult.fecha_hora).toISOString().slice(0, 10)}.pdf`;
  doc.output("dataurlnewwindow", { filename: fileName });
  // doc.save(fileName);
}
