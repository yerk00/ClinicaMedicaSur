-- Tabla de roles
CREATE TABLE public.roles (
  id integer NOT NULL DEFAULT nextval('roles_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

-- Tabla de páginas (para permisos por página)
CREATE TABLE public.pages (
  id integer NOT NULL DEFAULT nextval('pages_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  CONSTRAINT pages_pkey PRIMARY KEY (id)
);

-- Relación roles ↔ páginas
CREATE TABLE public.roles_pages (
  id integer NOT NULL DEFAULT nextval('roles_pages_id_seq'::regclass),
  role_id integer,
  page_id integer,
  CONSTRAINT roles_pages_pkey PRIMARY KEY (id),
  CONSTRAINT roles_pages_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id),
  CONSTRAINT roles_pages_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id)
);