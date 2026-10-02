import { ApiError, apiRequest } from "@/lib/api";

const request = apiRequest;

export interface Project {
  id: string;
  name: string;
  client_name: string;
  description: string | null;
  status: string;
  value_ugx: number;
  amount_paid_ugx: number;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  project_manager_email: string | null;
  created_by_email: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assignee_email: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFinance {
  project_value_ugx: number;
  amount_paid_ugx: number;
  project_outstanding_ugx: number;
  quotation_total_ugx: number;
  invoice_total_ugx: number;
  invoice_paid_ugx: number;
  invoice_outstanding_ugx: number;
  purchase_orders_ugx: number;
  expenses_ugx: number;
  quotations: Array<{ id: string; quotation_number: string; amount_ugx: number; status: string; issue_date: string }>;
  invoices: Array<{ id: string; invoice_number: string; amount_ugx: number; paid_amount_ugx: number; status: string; issue_date: string; due_date: string | null }>;
  purchase_orders: Array<{ id: string; po_number: string; supplier_name: string; amount_ugx: number; status: string; order_date: string }>;
  expenses: Array<{ id: string; description: string; category: string; amount_ugx: number; expense_date: string; reference: string | null }>;
}

export interface ProjectActivity {
  id: string;
  table_name: string;
  operation: string;
  record_id: string;
  title: string;
  changed_by: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  project_id: string | null;
  title: string;
  original_filename: string;
  category: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  uploaded_by_email: string;
  ocr_status: string;
  ocr_text: string | null;
  extracted_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectWorkspace {
  project: Project;
  tasks: ProjectTask[];
  documents: DocumentRecord[];
  finance: ProjectFinance;
  activity: ProjectActivity[];
}

export interface WorkspaceSummary {
  active_projects: number;
  due_tasks: number;
  pending_tasks: number;
  documents: number;
  outstanding_ugx: number;
}

export interface ClientRecord {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierRecord extends ClientRecord {}

export interface QuotationRecord {
  id: string;
  quotation_number: string;
  client_id: string | null;
  project_id: string | null;
  client_name: string;
  amount_ugx: number;
  status: string;
  issue_date: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  client_id: string | null;
  project_id: string | null;
  client_name: string;
  amount_ugx: number;
  paid_amount_ugx: number;
  status: string;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderRecord {
  id: string;
  po_number: string;
  supplier_id: string | null;
  project_id: string | null;
  supplier_name: string;
  amount_ugx: number;
  status: string;
  order_date: string;
  expected_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRecord {
  id: string;
  project_id: string | null;
  supplier_id: string | null;
  category: string;
  description: string;
  amount_ugx: number;
  expense_date: string;
  reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessSummary {
  clients: number;
  suppliers: number;
  quotations_open: number;
  invoice_outstanding_ugx: number;
  expenses_ugx: number;
}

export const workspaceApi = {
  summary: () => request<WorkspaceSummary>("/workspace/summary"),
  projects: () => request<Project[]>("/projects"),
  project: (id: string) => request<Project>(`/projects/${id}`),
  projectWorkspace: (id: string) => request<ProjectWorkspace>(`/projects/${id}/workspace`),
  createProject: (body: Record<string, unknown>) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
  updateProject: (id: string, body: Record<string, unknown>) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  tasks: (projectId?: string) =>
    request<ProjectTask[]>(projectId ? `/tasks?project_id=${encodeURIComponent(projectId)}` : "/tasks"),
  createTask: (body: Record<string, unknown>) =>
    request<ProjectTask>("/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: string, body: Record<string, unknown>) =>
    request<ProjectTask>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  documents: (projectId?: string) =>
    request<DocumentRecord[]>(
      projectId ? `/documents?project_id=${encodeURIComponent(projectId)}` : "/documents",
    ),
  createUploadUrl: (body: { filename: string; content_type: string; project_id?: string | null }) =>
    request<{ upload_url: string; storage_key: string; method: string }>("/documents/presign", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createDocument: (body: Record<string, unknown>) =>
    request<DocumentRecord>("/documents", { method: "POST", body: JSON.stringify(body) }),
  downloadDocument: (id: string) => request<{ url: string }>(`/documents/${id}/download`),

  businessSummary: () => request<BusinessSummary>("/business/summary"),
  clients: () => request<ClientRecord[]>("/business/clients"),
  createClient: (body: Record<string, unknown>) =>
    request<ClientRecord>("/business/clients", { method: "POST", body: JSON.stringify(body) }),
  suppliers: () => request<SupplierRecord[]>("/business/suppliers"),
  createSupplier: (body: Record<string, unknown>) =>
    request<SupplierRecord>("/business/suppliers", { method: "POST", body: JSON.stringify(body) }),
  quotations: () => request<QuotationRecord[]>("/business/quotations"),
  createQuotation: (body: Record<string, unknown>) =>
    request<QuotationRecord>("/business/quotations", { method: "POST", body: JSON.stringify(body) }),
  invoices: () => request<InvoiceRecord[]>("/business/invoices"),
  createInvoice: (body: Record<string, unknown>) =>
    request<InvoiceRecord>("/business/invoices", { method: "POST", body: JSON.stringify(body) }),
  purchaseOrders: () => request<PurchaseOrderRecord[]>("/business/purchase-orders"),
  createPurchaseOrder: (body: Record<string, unknown>) =>
    request<PurchaseOrderRecord>("/business/purchase-orders", { method: "POST", body: JSON.stringify(body) }),
  expenses: () => request<ExpenseRecord[]>("/business/expenses"),
  createExpense: (body: Record<string, unknown>) =>
    request<ExpenseRecord>("/business/expenses", { method: "POST", body: JSON.stringify(body) }),
};

export async function uploadToPresignedUrl(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) {
    throw new ApiError(
      "The document could not be uploaded. Please try again.",
      response.status,
    );
  }
}
