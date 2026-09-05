export const runtime = "nodejs";

function apiBaseUrl(): string {
  return process.env.API_URL ?? "http://127.0.0.1:4000";
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const upstream = await fetch(`${apiBaseUrl()}/api/ward/documents/from-html`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      return Response.json(
        {
          error:
            (data as { error?: string }).error ?? "Failed to convert edited preview",
        },
        { status: upstream.status }
      );
    }

    const buffer = await upstream.arrayBuffer();
    return new Response(buffer, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") ??
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          upstream.headers.get("Content-Disposition") ??
          'attachment; filename="document.docx"',
      },
    });
  } catch (error) {
    console.error("[ward from-html]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to convert edited preview",
      },
      { status: 500 }
    );
  }
}
