import { describe, expect, it, vi } from "vitest";
import { loadSessionCatalog, sessionContentUrl } from "../import/sessionCatalog";

describe("deployed session catalog", () => {
  it("falls back to bundled sessions when the local API is unavailable", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [{ path: "featured session.jsonl" }] }),
      });

    const catalog = await loadSessionCatalog(fetcher);

    expect(catalog).toEqual({
      origin: "bundled",
      sessions: [{ origin: "bundled", path: "featured session.jsonl" }],
    });
    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/sessions");
    expect(fetcher).toHaveBeenNthCalledWith(2, "/sessions/index.json");
    expect(sessionContentUrl(catalog.sessions[0])).toBe(
      "/sessions/featured%20session.jsonl",
    );
  });
});
