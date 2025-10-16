// @vitest-environment node
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { runPredictFromUrl, runGradcamFromUrl } from "@/lib/assistance";

describe("ia-client (vía assistance)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).fetch = vi.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";

      if (url.includes("/predict")) {
        return new Response(
          JSON.stringify({
            threshold: 0.5,
            probabilities: { neumonia: 0.9 },
            present: ["neumonia"],
            top_k: [{ class: "Neumonía", prob: 0.9 }],
            model_version: "1.0.0",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/gradcam")) {
        return new Response(
          JSON.stringify({
            class: "Neumonía",
            prob: 0.9,
            heatmap_data_url: "data:image/png;base64,AAAA",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Primera llamada: descargar la imagen
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
      return new Response(blob, { status: 200 });
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("predict retorna top_k", async () => {
    const res = await runPredictFromUrl("https://cdn.example/x.jpg", "x.jpg", 0.5);
    expect(res.error).toBeNull();
    expect(res.data?.top_k?.[0].class).toMatch(/neumon/i);
    expect((global.fetch as any).mock.calls.length).toBe(2); // 1 descarga + 1 POST /predict
  });

  it("gradcam retorna url heatmap", async () => {
    const res = await runGradcamFromUrl("https://cdn.example/x.jpg", "x.jpg", "Neumonía");
    expect(res.error).toBeNull();
    expect(res.data?.heatmap_data_url).toMatch(/^data:image\/png;base64,/);
    expect((global.fetch as any).mock.calls.length).toBe(2); // 1 descarga + 1 POST /gradcam
  });
});
