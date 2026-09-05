import type { UserType } from "@/types";

export type LocalBodyType = "nagarpalika" | "gaupalika" | "mahanagarpalika";

export interface WardOperatorProfile {
  id: string;
  userId: string;
  username: string;
  operatorName: string;
  districtName: string;
  wardNo: string;
  localBodyType: LocalBodyType;
  localBodyName: string;
  formerLocalBodyType: LocalBodyType;
  formerLocalBodyName: string;
  formerWardNo: string;
  generationLimit: number | null;
  generationCount: number;
  generationRemaining: number | null;
  generationUnlimited: boolean;
  starredTemplateIds: string[];
  active: boolean;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WardTemplateVariableType = "text" | "date" | "number";

export interface WardTemplateVariable {
  key: string;
  label: { en: string; ne: string };
  type: WardTemplateVariableType;
  required: boolean;
}

export interface WardDocumentTemplate {
  id: string;
  slug: string;
  name: { en: string; ne: string };
  description: { en: string; ne: string };
  variables: WardTemplateVariable[];
  fileType: "docx" | "pdf";
  originalFileName: string;
  status: "draft" | "published";
  hasFile: boolean;
  createdAt: string;
  updatedAt: string;
}

export const WARD_BUILTIN_VARIABLES: WardTemplateVariable[] = [
  {
    key: "current_address",
    label: { en: "Current address", ne: "हालको ठेगाना" },
    type: "text",
    required: false,
  },
  {
    key: "application_date",
    label: { en: "Application date", ne: "आवेदन मिति" },
    type: "date",
    required: false,
  },
  {
    key: "today",
    label: { en: "Today's date (Nepali)", ne: "आजको मिति" },
    type: "date",
    required: false,
  },
  {
    key: "date",
    label: { en: "Date (Nepali BS)", ne: "मिति" },
    type: "date",
    required: false,
  },
  {
    key: "operator_name",
    label: { en: "Operator name", ne: "सञ्चालकको नाम" },
    type: "text",
    required: false,
  },
  {
    key: "district_name",
    label: { en: "District", ne: "जिल्ला" },
    type: "text",
    required: false,
  },
  {
    key: "ward_no",
    label: { en: "Current ward no.", ne: "हालको वडा नं." },
    type: "text",
    required: false,
  },
  {
    key: "local_body_type",
    label: { en: "Local body type", ne: "स्थानीय तहको प्रकार" },
    type: "text",
    required: false,
  },
  {
    key: "local_body_name",
    label: { en: "Nagarpalika / Gaupalika / Mahanagarpalika", ne: "नगरपालिका / गाउँपालिका / महानगरपालिका" },
    type: "text",
    required: false,
  },
  {
    key: "former_local_body_type",
    label: {
      en: "Former local body type",
      ne: "पूर्व स्थानीय तहको प्रकार",
    },
    type: "text",
    required: false,
  },
  {
    key: "former_local_body_name",
    label: { en: "Former local body name", ne: "पूर्व स्थानीय तहको नाम" },
    type: "text",
    required: false,
  },
  {
    key: "former_ward_no",
    label: { en: "Former ward no.", ne: "पूर्व वडा नं." },
    type: "text",
    required: false,
  },
];

export function formatWardGenerationQuota(profile: WardOperatorProfile): string {
  if (profile.generationUnlimited) {
    return `${profile.generationCount} / Unlimited`;
  }
  return `${profile.generationCount} / ${profile.generationLimit ?? 0}`;
}

export async function wardLogin(
  identifier: string,
  password: string
): Promise<{ token: string; profile: WardOperatorProfile }> {
  const body = identifier.includes("@")
    ? { email: identifier, password }
    : { username: identifier, password };
  const res = await fetch("/api/ward/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  const { setToken } = await import("@/lib/auth");
  setToken(data.token);
  return { token: data.token, profile: data.profile as WardOperatorProfile };
}

export async function wardFetchMe(): Promise<{
  profile: WardOperatorProfile;
}> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/ward/me");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load profile");
  return data;
}

export async function wardFetchTemplateFields(templateId: string): Promise<{
  placeholderKeys: string[];
  userFields: WardTemplateVariable[];
  autoFieldKeys: string[];
}> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/ward/templates/${templateId}/fields`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load template fields");
  return data;
}

export async function wardFetchTemplates(): Promise<WardDocumentTemplate[]> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/ward/templates");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load templates");
  return data as WardDocumentTemplate[];
}

export async function wardSetStarredTemplate(
  templateId: string,
  starred: boolean
): Promise<string[]> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/ward/starred-templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify({ starred }),
  });
  const data = (await res.json()) as {
    error?: string;
    starredTemplateIds?: string[];
  };
  if (!res.ok) throw new Error(data.error ?? "Failed to update bookmark");
  return data.starredTemplateIds ?? [];
}

export async function wardLocalizeVariables(input: {
  templateId: string;
  variables: Record<string, string>;
}): Promise<{ variables: Record<string, string>; localized: boolean }> {
  const { getToken } = await import("@/lib/auth");
  const token = getToken();
  const res = await fetch("/api/ward/localize-variables", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to localize fields to Nepali");
  }
  return data as { variables: Record<string, string>; localized: boolean };
}

export async function wardPreviewDocument(input: {
  templateId: string;
  variables: Record<string, string>;
  skipLocalize?: boolean;
}): Promise<{ blob: Blob; fileName: string }> {
  const { getToken } = await import("@/lib/auth");
  const token = getToken();
  const res = await fetch("/api/ward/documents/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to preview document");
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const fileName = match?.[1]
    ? decodeURIComponent(match[1])
    : "document.docx";
  const blob = await res.blob();
  return { blob, fileName };
}

export async function wardGenerateDocument(input: {
  templateId: string;
  variables: Record<string, string>;
  skipLocalize?: boolean;
  allowIncomplete?: boolean;
}): Promise<{ blob: Blob; fileName: string }> {
  const { getToken } = await import("@/lib/auth");
  const token = getToken();
  const res = await fetch("/api/ward/documents/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to generate document");
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const fileName = match?.[1]
    ? decodeURIComponent(match[1])
    : "document.docx";
  const blob = await res.blob();
  return { blob, fileName };
}

export async function wardDocxFromEditedHtml(input: {
  html: string;
  fileName?: string;
}): Promise<{ blob: Blob; fileName: string }> {
  const { getToken } = await import("@/lib/auth");
  const token = getToken();
  const res = await fetch("/api/ward/documents/from-html", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to convert edited preview");
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const fileName = match?.[1]
    ? decodeURIComponent(match[1])
    : input.fileName || "document.docx";
  const blob = await res.blob();
  return { blob, fileName };
}

export async function adminFetchWardOperators(): Promise<WardOperatorProfile[]> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/ward-operators");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load ward operators");
  return data as WardOperatorProfile[];
}

export async function adminCreateWardOperator(input: {
  username: string;
  email?: string;
  password: string;
  operatorName: string;
  districtName: string;
  wardNo: string;
  localBodyType: LocalBodyType;
  localBodyName: string;
  formerLocalBodyType: LocalBodyType;
  formerLocalBodyName: string;
  formerWardNo: string;
  generationLimit?: number | null;
}): Promise<WardOperatorProfile> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/ward-operators", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      email: input.email?.trim() || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create ward operator");
  return data as WardOperatorProfile;
}

export async function adminUpdateWardOperator(
  id: string,
  input: Partial<{
    active: boolean;
    username: string;
    email: string;
    operatorName: string;
    districtName: string;
    wardNo: string;
    localBodyType: LocalBodyType;
    localBodyName: string;
    formerLocalBodyType: LocalBodyType;
    formerLocalBodyName: string;
    formerWardNo: string;
    generationLimit?: number | null;
    resetGenerationCount?: boolean;
    password: string;
  }>
): Promise<WardOperatorProfile> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/ward-operators/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update ward operator");
  return data as WardOperatorProfile;
}

export async function adminFetchWardTemplates(): Promise<WardDocumentTemplate[]> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/ward-templates");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load ward templates");
  return data as WardDocumentTemplate[];
}

export async function adminCreateWardTemplate(input: {
  nameEn: string;
  nameNe?: string;
  descriptionEn?: string;
  descriptionNe?: string;
  variables: WardTemplateVariable[];
  status?: "draft" | "published";
  fileName: string;
  fileData: string;
}): Promise<WardDocumentTemplate> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch("/admin/ward-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create template");
  return data as WardDocumentTemplate;
}

export async function adminUpdateWardTemplate(
  id: string,
  input: Partial<{
    nameEn: string;
    nameNe: string;
    descriptionEn: string;
    descriptionNe: string;
    variables: WardTemplateVariable[];
    status: "draft" | "published";
    fileName: string;
    fileData: string;
  }>
): Promise<WardDocumentTemplate> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/ward-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update template");
  return data as WardDocumentTemplate;
}

export async function adminSaveWardTemplateContent(
  id: string,
  content: string
): Promise<WardDocumentTemplate> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/ward-templates/${id}/content`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to save template content");
  }
  return data as WardDocumentTemplate;
}

export async function adminFetchWardTemplateFile(id: string): Promise<Blob> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/ward-templates/${id}/file`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to load template file");
  }
  return res.blob();
}

export async function adminDeleteWardTemplate(id: string): Promise<void> {
  const { authedFetch } = await import("@/lib/auth");
  const res = await authedFetch(`/admin/ward-templates/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to delete template");
  }
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
