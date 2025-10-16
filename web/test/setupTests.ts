// web/test/setupTests.ts

// 👇 Debe ir ANTES de cualquier import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://scfujnwdfrawfespaotk.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjZnVqbndkZnJhd2Zlc3Bhb3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5NDUwNjUsImV4cCI6MjA2ODUyMTA2NX0.LTsmz_N5emd0OpJF46jRpO1JTaIcAFspby6bwxEn4I8";

import "@testing-library/jest-dom";
import React from "react";

// Mock <Image> de Next
vi.mock("next/image", () => ({
  default: (props: any) => React.createElement("img", props),
}));

// Mock del router de Next (Pages Router)
vi.mock("next/router", () => {
  const push = vi.fn();
  const replace = vi.fn();
  return {
    useRouter: () => ({
      pathname: "/",
      query: {},
      asPath: "/",
      push,
      replace,
      prefetch: vi.fn(),
    }),
  };
});

// --- Shim para evitar el error de FormData+Blob en jsdom/undici ---
class LooseFormData {
  private _data: any[] = [];
  append(name: any, value: any, filename?: any) {
    // aceptamos cualquier tipo; solo guardamos para trazabilidad
    this._data.push([name, value, filename]);
  }
  // opcional: método para inspección en tests
  getAll() {
    return this._data;
  }
}
// Forzamos a que todas las suites usen esta implementación tolerante.
(globalThis as any).FormData = LooseFormData as any;
