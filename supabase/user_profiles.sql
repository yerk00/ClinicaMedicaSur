-- Perfiles de usuario (enlazados a auth.users)
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  role_id integer,
  ci text,
  fecha_nacimiento date,
  sexo text CHECK (sexo = ANY (ARRAY['masculino','femenino','otro','prefiere_no_decir'])),
  direccion_calle text,
  direccion_zona_ciudad text,
  direccion_departamento text,
  telefono_contacto text,
  status USER-DEFINED NOT NULL DEFAULT 'active'::user_status,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT user_profiles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id)
);