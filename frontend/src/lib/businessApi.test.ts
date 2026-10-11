import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  authenticatedFetch: vi.fn(),
  getApiBaseUrl: vi.fn(() => "https://api.bertcom.test"),
}));

vi.mock("@/lib/api", () => apiMocks);

import { businessApi } from "@/lib/businessApi";

describe("Business API reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getApiBaseUrl.mockReturnValue("https://api.bertcom.test");
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:bertcom-receipt-preview"),
    });
  });

  it("uses the authenticated PDF stream for a saved receipt preview", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      document_id: "doc-1",
      document_number: "RCT-2026-0001",
      filename: "RCT-2026-0001.pdf",
      download_url: "https://storage.test/signed-receipt.pdf",
      stored: true,
    });
    apiMocks.authenticatedFetch.mockResolvedValue(
      new Response(new Blob(["%PDF-test"], { type: "application/pdf" }), { status: 200 }),
    );

    const preview = await businessApi.previewReceipt("payment-1");

    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "/business/receipts/payment-1/preview",
      { method: "POST" },
    );
    expect(apiMocks.authenticatedFetch).toHaveBeenCalledWith(
      "https://api.bertcom.test/api/v1/business/receipts/payment-1/pdf",
      { headers: { Accept: "application/pdf" } },
    );
    expect(preview.document_id).toBe("doc-1");
    expect(preview.stored).toBe(true);
    expect(preview.download_url).toBe("blob:bertcom-receipt-preview");
  });

  it("still previews the generated PDF when the archived-preview action is unavailable", async () => {
    apiMocks.apiRequest.mockRejectedValue(new Error("storage preview unavailable"));
    apiMocks.authenticatedFetch.mockResolvedValue(
      new Response(new Blob(["%PDF-fallback"], { type: "application/pdf" }), { status: 200 }),
    );

    const preview = await businessApi.previewReceipt("payment-2");

    expect(preview.document_id).toBeNull();
    expect(preview.stored).toBe(false);
    expect(preview.download_url).toBe("blob:bertcom-receipt-preview");
  });

  it("does not let optional Documents data take down the Business workspace", async () => {
    apiMocks.apiRequest.mockRejectedValue(new Error("documents unavailable"));

    await expect(businessApi.documents()).resolves.toEqual([]);
    await expect(businessApi.projects()).resolves.toEqual([]);
  });
});
