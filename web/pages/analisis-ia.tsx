// web/pages/analisis-ia.tsx
"use client";

import Head from "next/head";
import Studio from "@/components/ia/Studio";

export default function AnalisisIaPage() {
  return (
    <>
      <Head>
        <title>Asistencia IA</title>
        <meta name="description" content="Asistencia diagnóstica por IA" />
      </Head>
      <Studio />
    </>
  );
}
