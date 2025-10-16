// web/__tests__/ResultsPanel.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ResultsPanel from "@/components/ia/ResultsPanel";

describe("ResultsPanel", () => {
  it("muestra el estado vacío", () => {
    // Render mínimo: sin selección -> muestra el hint
    render(<ResultsPanel />);
    expect(
      screen.getByText(/Selecciona una imagen en la lista/i)
    ).toBeInTheDocument();
  });

  // Cuando quieras probar top-k/gradcam, pásame la firma exacta de props
  // y te lo dejo listo. Sin esa info, el empty-state es lo más robusto.
});
