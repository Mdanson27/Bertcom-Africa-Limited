import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, FileText, ScanLine, Search, UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { workspaceApi, uploadToPresignedUrl, type DocumentRecord, type Project } from "@/lib/workspaceApi";

const categories = ["contract", "proposal", "invoice", "receipt", "purchase_order", "delivery_note", "technical", "other"];

function extractFields(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const invoice = text.match(/(?:invoice|receipt|po|purchase order)\s*(?:no\.?|#|number)?\s*[:#-]?\s*([A-Z0-9-]{3,})/i);
  const amount = text.match(/(?:total|amount due|grand total)\s*[:\-]?\s*(?:UGX|USh|Shs)?\s*([0-9,\.]+)/i);
  const dateMatch = text.match(/\b(?:0?[1-9]|[12][0-9]|3[01])[\/\-.](?:0?[1-9]|1[0-2])[\/\-.](?:20)?[0-9]{2}\b/);
  if (invoice) result.document_number = invoice[1];
  if (amount) result.amount = amount[1].replaceAll(",", "");
  if (dateMatch) result.date = dateMatch[0];
  return result;
}

const niceCategory = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("other");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [docs, nextProjects] = await Promise.all([workspaceApi.documents(), workspaceApi.projects()]);
    setDocuments(docs);
    setProjects(nextProjects);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return documents;
    return documents.filter((doc) =>
      [doc.title, doc.original_filename, doc.category, doc.ocr_text || ""].some((value) => value.toLowerCase().includes(q)),
    );
  }, [documents, query]);

  const processFile = async (file: File, scan: boolean) => {
    setBusy(true);
    setProgress(scan ? "Reading document..." : "Preparing upload...");
    try {
      let ocrText = "";
      let ocrStatus = "not_requested";
      let extractedFields: Record<string, string> = {};

      if (scan && file.type.startsWith("image/")) {
        ocrStatus = "processing";
        const tesseractUrl = "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.esm.min.js";
        const { recognize } = await import(/* @vite-ignore */ tesseractUrl);
        const result = await recognize(file, "eng", {
          logger: (message) => {
            if (typeof message.progress === "number") {
              setProgress(`Reading document... ${Math.round(message.progress * 100)}%`);
            }
          },
        });
        ocrText = result.data.text.trim();
        extractedFields = extractFields(ocrText);
        ocrStatus = "completed";
      }

      setProgress("Uploading securely...");
      const signed = await workspaceApi.createUploadUrl({
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        project_id: projectId || null,
      });
      await uploadToPresignedUrl(signed.upload_url, file);

      setProgress("Saving document...");
      await workspaceApi.createDocument({
        title: file.name.replace(/\.[^.]+$/, ""),
        original_filename: file.name,
        category,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        storage_key: signed.storage_key,
        project_id: projectId || null,
        ocr_status: ocrStatus,
        ocr_text: ocrText || null,
        extracted_fields: extractedFields,
      });
      await load();
      setProgress("Saved");
      window.setTimeout(() => setProgress(""), 1200);
    } catch (error) {
      setProgress(error instanceof Error ? error.message : "Document could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const download = async (document: DocumentRecord) => {
    const { url } = await workspaceApi.downloadDocument(document.id);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upload, scan, search and keep every business document in one place.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => fileInput.current?.click()} disabled={busy}>
            <UploadCloud className="h-4 w-4" /> Upload file
          </Button>
          <Button className="gap-2" onClick={() => cameraInput.current?.click()} disabled={busy}>
            <ScanLine className="h-4 w-4" /> Scan document
          </Button>
        </div>
      </div>

      <input ref={fileInput} type="file" className="hidden" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) void processFile(file, false); e.currentTarget.value = ""; }} />
      <input ref={cameraInput} type="file" className="hidden" accept="image/*" capture="environment"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) void processFile(file, true); e.currentTarget.value = ""; }} />

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_190px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names, OCR text, invoice numbers..."
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="">General documents</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
            {categories.map((item) => <option key={item} value={item}>{niceCategory(item)}</option>)}
          </select>
        </div>
        {progress && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
            <Camera className="h-4 w-4" /> {progress}
          </div>
        )}
      </Card>

      {filtered.length === 0 ? (
        <Card className="py-14 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No documents yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a file or scan a receipt, invoice or contract.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((document) => {
            const project = projects.find((item) => item.id === document.project_id);
            return (
              <Card key={document.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{document.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {niceCategory(document.category)} {project ? `- ${project.name}` : "- General"} - {Math.max(1, Math.round(document.size_bytes / 1024))} KB
                    </p>
                    {document.ocr_status === "completed" && (
                      <p className="mt-1 text-[10px] text-emerald-500">OCR indexed and searchable</p>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => void download(document)}>
                  <Download className="h-3.5 w-3.5" /> Open
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
