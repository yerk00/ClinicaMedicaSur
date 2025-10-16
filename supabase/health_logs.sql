-- Registros médicos principales
CREATE TABLE public.medical_records (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_profile_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  enfermedades_cronicas text,
  alergias text,
  medicacion_actual text,
  cirugias_previas text,
  grupo_sanguineo text CHECK (grupo_sanguineo IS NULL OR grupo_sanguineo = ANY (ARRAY['A+','A-','B+','B-','AB+','AB-','O+','O-'])),
  transfusiones_previas boolean,
  transfusiones_detalle text,
  antecedentes_familiares text,
  consumo_sustancias text,
  actividad_fisica text,
  vacunas text,
  CONSTRAINT medical_records_pkey PRIMARY KEY (id),
  CONSTRAINT medical_records_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES public.user_profiles(id),
  CONSTRAINT medical_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id)
);

-- Registros de salud (síntomas, signos vitales)
CREATE TABLE public.health_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_profile_id uuid NOT NULL,
  symptom_type text,
  severity integer,
  mood text,
  temperature_c numeric,
  heart_rate_bpm integer,
  respiratory_rate_bpm integer,
  bp_systolic_mmhg integer,
  bp_diastolic_mmhg integer,
  spo2_percent integer,
  weight_kg numeric,
  pain_score integer CHECK (pain_score >= 0 AND pain_score <= 10),
  height_m numeric,
  CONSTRAINT health_logs_pkey PRIMARY KEY (id),
  CONSTRAINT health_logs_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES public.user_profiles(id)
);
