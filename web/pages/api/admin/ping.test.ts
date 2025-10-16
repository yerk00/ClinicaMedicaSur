import handler from "./ping";
import { createMocks } from "node-mocks-http";

describe("GET /api/admin/ping", () => {
  it("responde 200 { ok: true }", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await handler(req as any, res as any);

    const status = res._getStatusCode();
    const raw = res._getData();
    const body = JSON.parse(raw);

    // Logs detallados (aparecen en el reporter)
    console.log("Status:", status);
    console.log("Body:", body);

    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true });
  });
});
