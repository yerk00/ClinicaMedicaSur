-- Citas médicas
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  service text,
  reason text,
  appointment_time timestamp with time zone NOT NULL,
  location text,
  status USER-DEFINED NOT NULL DEFAULT 'scheduled'::appointment_status,
  notes text,
  canceled_reason text,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id),
  CONSTRAINT appointments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.user_profiles(id),
  CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.user_profiles(id),
  CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.user_profiles(id)
);

-- Consultas médicas
CREATE TABLE public.consultations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_consulta text NOT NULL UNIQUE,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  fecha_hora timestamp with time zone NOT NULL DEFAULT now(),
  servicio text,
  motivo_consulta text,
  historia_enfermedad_actual text,
  examen_fisico text,
  estudios_solicitados ARRAY,
  diagnostico_inicial text,
  diagnostico_final text,
  conducta_tratamiento text,
  estado_salida text,
  medico_responsable text,
  created_at timestamp with time zone DEFAULT now(),
  primary_health_log_id uuid,
  estudios_estado text CHECK (estudios_estado = ANY (ARRAY['pendiente','completado'])),
  requiere_rx boolean,
  CONSTRAINT consultations_pkey PRIMARY KEY (id),
  CONSTRAINT consultations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.user_profiles(id),
  CONSTRAINT consultations_primary_health_log_id_fkey FOREIGN KEY (primary_health_log_id) REFERENCES public.health_logs(id),
  CONSTRAINT consultations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.user_profiles(id)
);

-- Recordatorios de medicación
CREATE TABLE public.medication_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_profile_id uuid NOT NULL,
  medication_name text NOT NULL,
  dosage text,
  reminder_time timestamp with time zone NOT NULL,
  recurrence text,
  calendar_sync_token text,
  created_at timestamp with time zone DEFAULT now(),
  notified boolean DEFAULT false,
  consultation_id uuid,
  CONSTRAINT medication_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT medication_reminders_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id),
  CONSTRAINT medication_reminders_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES public.user_profiles(id)
);
