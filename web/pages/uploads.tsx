import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Trash2,
  Loader2,
  Download,
  Eye,
  Plus,
  Tag,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  HeartPulse,
  Edit3,
} from "lucide-react";
import Head from "next/head";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { fetchUserFiles, uploadUserFile } from "@/lib/files";
import { motion } from "framer-motion";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUserRole } from "@/lib/profile";

type FileRow = {
  id: string;
  filename: string;
  url: string;
  file_type: string;
  uploaded_at: string;
  path?: string;
  tags?: string[];
  diagnosis_ia?: string;
  uploader?: {
    full_name: string;
  };
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const ITEMS_PER_PAGE = 50;

export default function UploadsPage() {
  const router = useRouter();

  // Lee paciente desde ?id o ?pid (compatible con rutas antiguas)
  const queryPatientId = useMemo(() => {
    const raw = (router.query?.id ?? router.query?.pid) as string | string[] | undefined;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [router.query?.id, router.query?.pid]);

  const queryPatientName = useMemo(() => {
    const raw = router.query?.patientName as string | string[] | undefined;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [router.query?.patientName]);

  const queryActingRole = useMemo(() => {
    const raw = router.query?.actingRole as string | string[] | undefined;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [router.query?.actingRole]);

  const queryActingDoctorId = useMemo(() => {
    const raw = router.query?.actingDoctorId as string | string[] | undefined;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [router.query?.actingDoctorId]);

  const queryActingDoctorName = useMemo(() => {
    const raw = router.query?.actingDoctorName as string | string[] | undefined;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [router.query?.actingDoctorName]);

  const [userId, setUserId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetUserName, setTargetUserName] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [missingPatient, setMissingPatient] = useState(false);

  const [files, setFiles] = useState<FileRow[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [selectedForReport, setSelectedForReport] = useState<string[]>([]);
  const [reportProcessing, setReportProcessing] = useState(false);

  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [customFilename, setCustomFilename] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileRow | null>(null);
  const [editFilename, setEditFilename] = useState("");
  const [editTagsInput, setEditTagsInput] = useState("");
  const [editDiagnosisIa, setEditDiagnosisIa] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1) Inicialización robusta: quién soy, rol y paciente efectivo
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user;
      if (!me) {
        // si no hay sesión, redirige
        router.replace("/auth/login");
        return;
      }

      setUserId(me.id);

      const roleRes = await getCurrentUserRole();
      const roleName = typeof roleRes === "string" ? roleRes : (roleRes?.name ?? null);
      setCurrentUserRole(roleName);
      const isClinician = ["Doctor", "Radiologo", "Enfermero"].includes(roleName || "");

      // Preferimos SIEMPRE el id del query (viene desde Estudios)
      let effective: string | null =
        (queryPatientId as string) ||
        (typeof window !== "undefined" ? localStorage.getItem("targetProfileId") : null) ||
        null;

      // Si no hay paciente y NO soy clínico (soy paciente), uso mi propio id
      if (!effective && !isClinician) {
        effective = me.id;
      }

      // Si soy clínico y no hay paciente -> mostramos aviso y no cargamos nada
      if (!effective && isClinician) {
        setMissingPatient(true);
        setTargetUserId(null);
        setTargetUserName(null);
        return;
      }

      // Persistimos en localStorage para otras páginas
      if (typeof window !== "undefined") {
        if (queryPatientId) localStorage.setItem("targetProfileId", String(queryPatientId));
        if (queryPatientName) localStorage.setItem("targetProfileName", String(queryPatientName));
        if (queryActingRole) localStorage.setItem("actingRole", String(queryActingRole));
        if (queryActingDoctorId) localStorage.setItem("actingDoctorId", String(queryActingDoctorId));
        if (queryActingDoctorName) localStorage.setItem("actingDoctorName", String(queryActingDoctorName));
      }

      setTargetUserId(effective);

      // Nombre visible del paciente
      try {
        if (queryPatientName) {
          setTargetUserName(queryPatientName);
        } else if (effective) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("full_name, email")
            .eq("id", effective)
            .single();
          setTargetUserName(profile?.full_name ?? profile?.email ?? null);
        }
      } catch {
        setTargetUserName(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryPatientId, queryPatientName, queryActingRole, queryActingDoctorId, queryActingDoctorName]);

  // 2) Cargar archivos cuando cambie paciente o página
  useEffect(() => {
    if (!targetUserId) return;
    fetchFiles(targetUserId, currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, currentPage]);

  async function fetchFiles(effectiveTargetId: string, page: number) {
    setLoadingFiles(true);
    try {
      const docs = await fetchUserFiles(effectiveTargetId, page);
      setFiles(docs);

      const { count, error: countError } = await supabase
        .from("files")
        .select("id", { count: "exact", head: true })
        .eq("user_profile_id", effectiveTargetId);

      if (!countError) setTotalDocuments(count || 0);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("No se pudieron obtener los documentos");
    } finally {
      setLoadingFiles(false);
    }
  }

  // === Acciones ===
  async function handleUpload() {
    if (!fileToUpload) return;

    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user;
    if (!me) {
      toast.error("No has iniciado sesión");
      return;
    }

    if (!targetUserId) {
      toast.error("Selecciona un paciente para subir archivos.");
      return;
    }

    setUploading(true);
    try {
      let fileToProcess = fileToUpload;
      if (customFilename.trim()) {
        fileToProcess = new File([fileToUpload], customFilename.trim(), { type: fileToUpload.type });
      }

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const newFile = await uploadUserFile(fileToProcess, targetUserId, me.id, tags);
      setFiles((prev) => [newFile, ...prev]);
      toast.success("Archivo subido");

      setFileToUpload(null);
      setCustomFilename("");
      setTagsInput("");
      setDialogOpen(false);

      fetchFiles(targetUserId, currentPage);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(url: string, filename: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Error al descargar");
    }
  }

  function handleDownloadAll() {
    files.forEach((f) => handleDownload(f.url, f.filename));
  }

  function openEditDialog(file: FileRow) {
    setEditingFile(file);
    setEditFilename(file.filename);
    setEditTagsInput(file.tags?.join(", ") || "");
    setEditDiagnosisIa(file.diagnosis_ia || "");
    setEditDialogOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingFile) return;
    const newTags = editTagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      const { error } = await supabase
        .from("files")
        .update({
          filename: editFilename.trim(),
          tags: newTags,
          diagnosis_ia: editDiagnosisIa.trim(),
        })
        .eq("id", editingFile.id);

      if (error) throw error;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === editingFile.id ? { ...f, filename: editFilename.trim(), tags: newTags, diagnosis_ia: editDiagnosisIa.trim() } : f
        )
      );
      toast.success("Actualizado");
      setEditDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar");
    }
  }

  async function handleExportHealthReport() {
    if (!targetUserId) {
      toast.error("No hay paciente seleccionado");
      return;
    }
    setReportProcessing(true);

    try {
      const { data: record } = await supabase
        .from("medical_records")
        .select("*")
        .eq("user_profile_id", targetUserId)
        .single();

      const { data: healthLogs } = await supabase
        .from("health_logs")
        .select("*")
        .eq("user_profile_id", targetUserId);

      const idsElegidos = selectedForReport.length ? selectedForReport : files.map((f) => f.id);
      const { data: chosenFiles } = await supabase
        .from("files")
        .select("id, filename, path")
        .in("id", idsElegidos);

      const filesBucket = supabase.storage.from("radiografias");

      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([595.28, 841.89]); // A4
      const { width, height } = page.getSize();
      const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSmall = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const primaryColor = rgb(0.07, 0.45, 0.55);
      const margin = 50;
      let y = height - margin;

      page.drawText("CLÍNICA MÉDICA SUR", { x: margin, y, size: 20, font: fontBold, color: primaryColor });
      y -= 12;
      page.drawText("Reporte de Radiografías y Registros", { x: margin, y, size: 10, font: fontReg, color: rgb(0.35,0.35,0.35) });
      y -= 20;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 2, color: primaryColor });
      y -= 20;

      page.drawText("Paciente", { x: margin, y, size: 12, font: fontBold, color: primaryColor }); y -= 16;
      const patientInfo: [string, string][] = [
        ["Nombre", targetUserName || "—"],
        ["Historia Clínica", record?.id || "—"],
        ["Peso", record?.weight_kg ? `${record.weight_kg} kg` : "—"],
        ["Talla", record?.height_m ? `${record.height_m} m` : "—"],
        ["Sangre", record?.grupo_sanguineo || "—"],
        ["Alergias", record?.alergias || "—"],
      ];
      patientInfo.forEach(([k, v]) => {
        page.drawText(`${k}:`, { x: margin, y, size: 10, font: fontBold });
        page.drawText(String(v), { x: margin + 110, y, size: 10, font: fontReg });
        y -= 14;
      });
      y -= 10;

      page.drawText("Registros de Salud", { x: margin, y, size: 12, font: fontBold, color: primaryColor }); y -= 16;
      if (!healthLogs?.length) {
        page.drawText("Sin registros.", { x: margin, y, size: 10, font: fontReg });
        y -= 14;
      } else {
        healthLogs.forEach((log: any, idx: number) => {
          page.drawText(`Registro ${idx + 1} – ID ${log.id}`, { x: margin, y, size: 10, font: fontBold });
          y -= 14;
          const rows: [string, string][] = [
            ["Síntomas", log.symptom_type || "—"],
            ["Severidad", log.severity?.toString() || "—"],
            ["Ánimo", log.mood || "—"],
            ["Fecha", new Date(log.created_at).toLocaleString()],
          ];
          rows.forEach(([k, v]) => {
            page.drawText(`${k}:`, { x: margin + 16, y, size: 10, font: fontBold });
            page.drawText(String(v), { x: margin + 110, y, size: 10, font: fontReg });
            y -= 12;
          });
          y -= 6;
        });
      }
      y -= 10;

      page.drawText("Radiografías", { x: margin, y, size: 12, font: fontBold, color: primaryColor }); y -= 16;
      if (!chosenFiles?.length) {
        page.drawText("Sin imágenes.", { x: margin, y, size: 10, font: fontReg });
      } else {
        const cols = 2;
        const imgWidth = (width - margin * 2 - 10) / cols;
        let col = 0, row = 0;
        for (let i = 0; i < chosenFiles.length; i++) {
          const f = chosenFiles[i];
          if (!f.path) continue;
          try {
            const { data: fileData } = await filesBucket.download(f.path);
            const bytes = await fileData.arrayBuffer();
            let imgEmbed;
            try { imgEmbed = await pdfDoc.embedPng(bytes); }
            catch { imgEmbed = await pdfDoc.embedJpg(bytes); }
            const scale = imgWidth / imgEmbed.width;
            const imgHeight = imgEmbed.height * scale;
            const xPos = margin + col * (imgWidth + 10);
            const yPos = y - row * (imgHeight + 20);
            if (yPos < 80) {
              page = pdfDoc.addPage([595.28, 841.89]);
              y = 841.89 - margin;
              row = 0; col = 0;
            }
            page.drawImage(imgEmbed, { x: xPos, y: yPos, width: imgWidth, height: imgHeight });
            col = (col + 1) % cols;
            if (col === 0) row++;
          } catch {
            page.drawText(`Imagen no disponible: ${f.filename}`, { x: margin, y, size: 10, font: fontReg });
            y -= 12;
          }
        }
      }

      page.drawLine({ start: { x: margin, y: 40 }, end: { x: width - margin, y: 40 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
      page.drawText("© Clínica Médica Sur", { x: margin, y: 28, size: 8, font: fontSmall, color: rgb(0.5, 0.5, 0.5) });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte_${targetUserName || targetUserId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error generando PDF:", e);
      toast.error("Error al generar el PDF");
    } finally {
      setReportProcessing(false);
    }
  }

  // === Filtros y paginación local por búsqueda ===
  const filteredFiles = useMemo(
    () => files.filter((f) => f.filename.toLowerCase().includes(search.toLowerCase())),
    [files, search]
  );

  const startIndex = filteredFiles.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endIndex = (currentPage - 1) * ITEMS_PER_PAGE + filteredFiles.length;

  // Volver al Home del paciente
  const goBack = () => {
    const pidFromQuery = typeof router.query.id === "string"
      ? router.query.id
      : (typeof router.query.pid === "string" ? router.query.pid : null);

    const pidFromStorage = typeof window !== "undefined" ? localStorage.getItem("targetProfileId") : null;
    const pid = pidFromQuery || targetUserId || pidFromStorage || userId;

    router.push({ pathname: "/home", query: pid ? { id: pid } : undefined });
  };

  return (
    <>
      <Head>
        <title>Clínica Médica Sur | Radiografías</title>
        <meta name="description" content="Gestión de estudios por imagen del paciente." />
      </Head>

      <div className="flex flex-col min-h-screen">
        <style jsx global>{`
          html { scroll-behavior: smooth; }
          html, body { overscroll-behavior: none; }
        `}</style>

        <main className="flex-1 p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            {/* Topbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={goBack}
                  className="gap-2 border-cyan-200/80 hover:border-cyan-300 hover:bg-cyan-50/60 dark:border-cyan-700/40 dark:hover:bg-cyan-900/20"
                  title="Volver al Home del paciente"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Button>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Radiografías y Documentos</h1>
                  <p className="text-sm text-muted-foreground">
                    {missingPatient
                      ? "Selecciona un paciente desde Estudios para gestionar archivos."
                      : userId === targetUserId
                        ? "Tus documentos"
                        : `Paciente: ${targetUserName || "—"}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="gap-2 border-emerald-200/80 hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-emerald-700/40 dark:hover:bg-emerald-900/20"
                  onClick={handleDownloadAll}
                  disabled={!targetUserId}
                >
                  <Download className="h-4 w-4" />
                  Exportar imágenes
                </Button>

                <Button
                  variant="outline"
                  className="gap-2 border-cyan-200/80 hover:border-cyan-300 hover:bg-cyan-50/60 dark:border-cyan-700/40 dark:hover:bg-cyan-900/20"
                  onClick={() => setHealthDialogOpen(true)}
                  disabled={!targetUserId}
                >
                  <HeartPulse className="h-4 w-4" />
                  Exportar reporte
                </Button>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" disabled={!targetUserId}>
                      <Plus className="h-4 w-4" />
                      Nuevo archivo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cargar documento</DialogTitle>
                      <DialogDescription>Adjunta archivos clínicos del paciente.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 mt-2">
                      <Input
                        type="file"
                        onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                        className="cursor-pointer"
                      />
                      <Input
                        placeholder="Nombre personalizado (opcional)"
                        value={customFilename}
                        onChange={(e) => setCustomFilename(e.target.value)}
                      />
                      <Input
                        placeholder="Etiquetas separadas por comas (opcional)"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                      />
                      <Button onClick={handleUpload} disabled={!fileToUpload || uploading || !targetUserId}>
                        {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : "Subir"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Aviso si falta paciente */}
            {missingPatient && (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Abre <b>Estudios</b> y pulsa <b>Archivos</b> sobre la fila del paciente para cargar el contexto.
                </CardContent>
              </Card>
            )}

            {/* Filtros */}
            {!missingPatient && (
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    ref={searchInputRef}
                    placeholder="Buscar documento..."
                    className="w-full pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Tabla */}
            {!missingPatient && (
              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                <motion.div variants={fadeInUp}>
                  <Card className="shadow-sm border border-white/10">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-cyan-50 dark:bg-cyan-950/20 text-cyan-900 dark:text-cyan-100">
                              <th className="text-left p-3 font-semibold">Documento</th>
                              <th className="text-left p-3 font-semibold">Tipo</th>
                              <th className="text-left p-3 font-semibold">Fecha</th>
                              <th className="text-left p-3 font-semibold">Cargado por</th>
                              <th className="text-left p-3 font-semibold">Diagnóstico IA</th>
                              <th className="text-left p-3 font-semibold">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loadingFiles ? (
                              <tr>
                                <td colSpan={6} className="p-6 text-center">
                                  <Loader2 className="animate-spin inline h-6 w-6" />
                                </td>
                              </tr>
                            ) : filteredFiles.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                                  No hay documentos.
                                </td>
                              </tr>
                            ) : (
                              filteredFiles.map((file, idx) => (
                                <tr
                                  key={file.id}
                                  className={idx % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-muted/40"}
                                >
                                  <td className="p-3 align-top">
                                    <div className="font-medium">{file.filename}</div>
                                    {!!file.tags?.length && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {file.tags.map((tag, i) => (
                                          <span
                                            key={i}
                                            className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-xs border-cyan-200/70 text-cyan-800 bg-cyan-50 dark:border-cyan-700/40 dark:text-cyan-200 dark:bg-cyan-900/20"
                                          >
                                            <Tag size={12} /> {tag}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 align-top">{file.file_type || "—"}</td>
                                  <td className="p-3 align-top">
                                    {file.uploaded_at ? format(new Date(file.uploaded_at), "MMM d, yyyy") : "—"}
                                  </td>
                                  <td className="p-3 align-top">{file.uploader?.full_name || "—"}</td>
                                  <td className="p-3 align-top">
                                    {file.diagnosis_ia ? (
                                      <button
                                        className="text-left text-emerald-700 hover:underline dark:text-emerald-300 max-w-[220px] truncate"
                                        onClick={() => openEditDialog(file)}
                                        title={file.diagnosis_ia}
                                      >
                                        {file.diagnosis_ia}
                                      </button>
                                    ) : (
                                      <span className="text-muted-foreground italic">Pendiente</span>
                                    )}
                                  </td>
                                  <td className="p-3 align-top">
                                    <TooltipProvider>
                                      <div className="flex items-center gap-1">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => router.push(`/files/${file.id}`)}
                                            >
                                              <Eye size={18} />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Ver</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(file)}>
                                              <Edit3 size={18} />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Editar</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleDownload(file.url, file.filename)}
                                            >
                                              <Download size={18} />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Descargar</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="text-red-500"
                                              onClick={() => {
                                                setFileToDelete(file.id);
                                                setConfirmDeleteDialogOpen(true);
                                              }}
                                            >
                                              <Trash2 size={18} />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Eliminar</TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </TooltipProvider>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}

            {/* Paginación */}
            {!missingPatient && (
              <div className="mt-2 flex items-center justify-end gap-4">
                <Button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  variant="outline"
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <div className="text-sm text-muted-foreground">
                  {startIndex} - {endIndex} de {totalDocuments}
                </div>
                <Button
                  disabled={endIndex >= totalDocuments}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  variant="outline"
                  className="gap-1"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dialog: Exportar Reporte */}
      <Dialog open={healthDialogOpen} onOpenChange={setHealthDialogOpen}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle>Exportar</DialogTitle>
            <DialogDescription>
              Selecciona los documentos para incluir en el reporte (si no seleccionas, se incluirán todos).
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
            {filteredFiles
              .filter((f) => f.file_type === "application/pdf" || f.file_type?.startsWith("image/"))
              .map((file) => (
                <label key={file.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedForReport.includes(file.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedForReport((prev) => (checked ? [...prev, file.id] : prev.filter((id) => id !== file.id)));
                    }}
                  />
                  <span className="truncate">{file.filename}</span>
                </label>
              ))}
            {filteredFiles.filter((f) => f.file_type === "application/pdf" || f.file_type?.startsWith("image/")).length === 0 && (
              <p className="text-muted-foreground">No hay PDF ni imágenes disponibles.</p>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="secondary" onClick={() => setHealthDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExportHealthReport} disabled={reportProcessing || !targetUserId}>
              {reportProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : "Generar PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar archivo */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
            <DialogDescription>Actualiza nombre, etiquetas y diagnóstico IA.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <Input value={editFilename} onChange={(e) => setEditFilename(e.target.value)} placeholder="Nombre" />
            <Input value={editTagsInput} onChange={(e) => setEditTagsInput(e.target.value)} placeholder="Etiquetas (coma)" />
            <Input value={editDiagnosisIa} onChange={(e) => setEditDiagnosisIa(e.target.value)} placeholder="Diagnóstico IA" />
          </div>
          <div className="flex justify-end gap-3 mt-5">
            <Button variant="secondary" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar eliminación */}
      <Dialog open={confirmDeleteDialogOpen} onOpenChange={setConfirmDeleteDialogOpen}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle>Eliminar documento</DialogTitle>
            <DialogDescription>¿Seguro que deseas eliminar este archivo?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmDeleteDialogOpen(false);
                setFileToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (fileToDelete) {
                  try {
                    await supabase.from("files").delete().eq("id", fileToDelete);
                    toast.success("Archivo eliminado");
                    if (targetUserId) fetchFiles(targetUserId, currentPage);
                  } catch (error) {
                    console.error("Error deleting file:", error);
                    toast.error("No se pudo eliminar");
                  }
                }
                setConfirmDeleteDialogOpen(false);
                setFileToDelete(null);
              }}
            >
              Sí, eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
