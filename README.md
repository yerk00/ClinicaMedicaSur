# Diagnóstico ERS CMS

Sistema clínico para gestión de pacientes, historial médico y **asistencia diagnóstica con IA** (radiografías con Grad-CAM), construido con **Next.js (carpeta `web/`)** y **Supabase (carpeta `supabase/`)**.



---

## 📦 Stack

- **Frontend:** Next.js + React + TypeScript, TailwindCSS, shadcn/ui (Radix), TanStack Query, React Hook Form + Zod, Framer Motion.
- **Gráficos:** Recharts / Chart.js.
- **PDF:** jsPDF / pdf-lib para reportes clínicos.
- **Escáner:** ZXing (lectura de códigos).
- **Backend de datos:** Supabase (Postgres, Auth, Storage + cron de recordatorios).
- **IA (asistencia diagnóstica):** Endpoints externos configurables (Predicción y Grad-CAM).


---

## ✨ Funcionalidades principales

- **Gestión de pacientes:** perfiles, historial clínico, consultas y archivos asociados.
- **Subida de documentos:** bucket `documents` con metadatos (`user_profile_id`, `uploaded_by`, `tags`).
- **Asistencia diagnóstica (IA):** inferencia sobre radiografías, visualización **Grad-CAM** y Top-K de hallazgos.
- **Reportes PDF:** generación de informes de consultas/historial.
- **Recordatorios:** de citas y medicación, con job programado que crea notificaciones.
- **Módulo Admin:** base para gestión de usuarios y permisos.

---

## 🗂️ Estructura del repositorio

