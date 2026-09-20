import type { CourtType } from "@/lib/sajilokanun/court-type";
import type { LegalCaseDocumentKind } from "@/lib/sajilokanun-access";

export type SkTemplateVariableType = "text" | "date" | "number";

export interface SkTemplateVariable {
  key: string;
  label: { en: string; ne: string };
  type: SkTemplateVariableType;
  required: boolean;
}

export interface SajiloKanunDocumentTemplate {
  id: string;
  slug: string;
  name: { en: string; ne: string; roman?: string };
  description: { en: string; ne: string };
  courtType: CourtType;
  documentKind: LegalCaseDocumentKind;
  documentKindTitle: string;
  variables: SkTemplateVariable[];
  fileType: "docx" | "pdf";
  originalFileName: string;
  status: "draft" | "published";
  hasFile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkTemplateMeta {
  courtTypes: Array<{ id: CourtType; labelNe: string; labelEn: string }>;
  documentKinds: Array<{ id: LegalCaseDocumentKind; title: string }>;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function adminFetchSkTemplateMeta(): Promise<SkTemplateMeta> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/sajilo-kanun-templates/meta");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load template meta");
  return data as SkTemplateMeta;
}

export async function adminFetchSkTemplates(): Promise<SajiloKanunDocumentTemplate[]> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/sajilo-kanun-templates");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load templates");
  return data as SajiloKanunDocumentTemplate[];
}

export async function adminCreateSkTemplate(input: {
  nameEn: string;
  nameNe?: string;
  nameRoman?: string;
  descriptionEn?: string;
  descriptionNe?: string;
  courtType: CourtType;
  documentKind: LegalCaseDocumentKind;
  variables: SkTemplateVariable[];
  status?: "draft" | "published";
  fileName: string;
  fileData: string;
}): Promise<SajiloKanunDocumentTemplate> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/sajilo-kanun-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create template");
  return data as SajiloKanunDocumentTemplate;
}

export async function adminUpdateSkTemplate(
  id: string,
  input: Partial<{
    nameEn: string;
    nameNe: string;
    nameRoman: string;
    descriptionEn: string;
    descriptionNe: string;
    courtType: CourtType;
    documentKind: LegalCaseDocumentKind;
    variables: SkTemplateVariable[];
    status: "draft" | "published";
    fileName: string;
    fileData: string;
  }>
): Promise<SajiloKanunDocumentTemplate> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/sajilo-kanun-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update template");
  return data as SajiloKanunDocumentTemplate;
}

export async function adminDeleteSkTemplate(id: string): Promise<void> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/sajilo-kanun-templates/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to delete template");
  }
}

export async function adminFetchSkTemplateFile(id: string): Promise<Blob> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/sajilo-kanun-templates/${id}/file`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to load template file");
  }
  return res.blob();
}

export async function adminSaveSkTemplateContent(
  id: string,
  content: string,
  options?: { publish?: boolean }
): Promise<SajiloKanunDocumentTemplate> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/sajilo-kanun-templates/${id}/content`, {
    method: "PUT",
    body: JSON.stringify({
      content,
      publish: options?.publish === true,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to save template content");
  }
  return data as SajiloKanunDocumentTemplate;
}

export type SkReviewCourtType = "supreme" | "high" | "district";

export type SkReviewCatalogItem = {
  courtType: SkReviewCourtType;
  formNumber: number;
  title: string;
  officialUrl: string;
  documentKind: string;
  template: SajiloKanunDocumentTemplate | null;
};

export type SkReviewCatalog = {
  sourceUrl: string;
  courtType: SkReviewCourtType;
  total: number;
  matched: number;
  items: SkReviewCatalogItem[];
};

export async function adminFetchSkReviewCatalog(
  courtType: SkReviewCourtType
): Promise<SkReviewCatalog> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(
    `/admin/sajilo-kanun-templates/review-catalog?courtType=${encodeURIComponent(courtType)}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load review catalog");
  return data as SkReviewCatalog;
}

export async function adminFetchSkOfficialFormFile(
  courtType: SkReviewCourtType,
  formNumber: number
): Promise<Blob> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(
    `/admin/sajilo-kanun-templates/review-official/${courtType}/${formNumber}`
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to load official form");
  }
  return res.blob();
}
