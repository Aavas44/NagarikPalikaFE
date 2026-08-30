import {
  isWardAiLocalizeEnabled,
  localizeWardUserVariables,
} from "@/lib/ward/ward-variable-localize";
import type { WardTemplateVariable } from "@/lib/ward-access";

function apiBaseUrl(): string {
  return process.env.API_URL ?? "http://127.0.0.1:4000";
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header;
}

async function fetchTemplateUserFields(
  templateId: string,
  authorization: string
): Promise<WardTemplateVariable[]> {
  const res = await fetch(
    `${apiBaseUrl()}/api/ward/templates/${encodeURIComponent(templateId)}/fields`,
    {
      headers: { Authorization: authorization },
      cache: "no-store",
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    userFields?: WardTemplateVariable[];
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load template fields");
  }
  return data.userFields ?? [];
}

export async function handleWardDocumentRequest(
  request: Request,
  mode: "preview" | "generate"
): Promise<Response> {
  const authorization = getBearerToken(request);
  if (!authorization) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as {
    templateId?: string;
    variables?: Record<string, string | number>;
    skipLocalize?: boolean;
  };

  const templateId = body.templateId?.trim();
  if (!templateId) {
    return Response.json({ error: "templateId is required" }, { status: 400 });
  }

  const inputValues = Object.fromEntries(
    Object.entries(body.variables ?? {}).map(([key, value]) => [
      key,
      value === undefined || value === null ? "" : String(value),
    ])
  ) as Record<string, string>;

  let variables = inputValues;
  if (isWardAiLocalizeEnabled() && !body.skipLocalize) {
    const userFields = await fetchTemplateUserFields(templateId, authorization);
    variables = await localizeWardUserVariables(userFields, inputValues);
  }

  const upstream = await fetch(`${apiBaseUrl()}/api/ward/documents/${mode}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({ templateId, variables }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    return Response.json(
      { error: (data as { error?: string }).error ?? `Failed to ${mode} document` },
      { status: upstream.status }
    );
  }

  const buffer = await upstream.arrayBuffer();
  const contentType =
    upstream.headers.get("Content-Type") ??
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const disposition =
    upstream.headers.get("Content-Disposition") ??
    (mode === "generate"
      ? 'attachment; filename="document.docx"'
      : 'inline; filename="document.docx"');

  return new Response(buffer, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
    },
  });
}

export async function handleWardLocalizeRequest(request: Request): Promise<Response> {
  const authorization = getBearerToken(request);
  if (!authorization) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as {
    templateId?: string;
    variables?: Record<string, string | number>;
  };

  const templateId = body.templateId?.trim();
  if (!templateId) {
    return Response.json({ error: "templateId is required" }, { status: 400 });
  }

  const inputValues = Object.fromEntries(
    Object.entries(body.variables ?? {}).map(([key, value]) => [
      key,
      value === undefined || value === null ? "" : String(value),
    ])
  ) as Record<string, string>;

  if (!isWardAiLocalizeEnabled()) {
    return Response.json({ variables: inputValues, localized: false });
  }

  const userFields = await fetchTemplateUserFields(templateId, authorization);
  const variables = await localizeWardUserVariables(userFields, inputValues);
  return Response.json({ variables, localized: true });
}
