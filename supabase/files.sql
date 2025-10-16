-- Archivos subidos (imágenes, documentos, etc.)
CREATE TABLE public.files (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_profile_id uuid NOT NULL,
  filename text NOT NULL,
  url text NOT NULL,
  file_type text,
  uploaded_at timestamp with time zone DEFAULT now(),
  tags ARRAY DEFAULT '{}'::text[],
  uploaded_by uuid,
  diagnosis_ia text,
  CONSTRAINT files_pkey PRIMARY KEY (id),
  CONSTRAINT files_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES public.user_profiles(id),
  CONSTRAINT fk_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES public.user_profiles(id)
);

-- Inferencias de IA
CREATE TABLE public.ia_inferencias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  archivo_id uuid NOT NULL,
  modelo_nombre text NOT NULL,
  modelo_version text NOT NULL,
  modelo_tarea text,
  modelo_parametros jsonb,
  umbral numeric NOT NULL CHECK (umbral >= 0 AND umbral <= 1),
  clase_top1 text,
  prob_top1 numeric CHECK (prob_top1 IS NULL OR (prob_top1 >= 0 AND prob_top1 <= 1)),
  presentes ARRAY NOT NULL DEFAULT '{}'::text[],
  probabilidades jsonb NOT NULL,
  topk jsonb,
  clase_seleccionada text,
  url_mapa_calor text,
  tiempo_ms_prediccion integer,
  tiempo_ms_gradcam integer,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  creado_por uuid,
  CONSTRAINT ia_inferencias_pkey PRIMARY KEY (id),
  CONSTRAINT ia_inferencias_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES public.files(id),
  CONSTRAINT ia_inferencias_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES auth.users(id)
);

-- Informes generados por IA
CREATE TABLE public.ia_informes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  archivo_id uuid NOT NULL,
  inferencia_id uuid,
  autor_id uuid NOT NULL,
  hallazgos_seleccionados ARRAY NOT NULL DEFAULT '{}'::text[],
  narrativa text NOT NULL,
  estado text NOT NULL DEFAULT 'final' CHECK (estado = ANY (ARRAY['borrador','final'])),
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  actualizado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ia_informes_pkey PRIMARY KEY (id),
  CONSTRAINT ia_informes_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES public.files(id),
  CONSTRAINT ia_informes_inferencia_id_fkey FOREIGN KEY (inferencia_id) REFERENCES public.ia_inferencias(id),
  CONSTRAINT ia_informes_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id)
);
