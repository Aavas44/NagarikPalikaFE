import { handleWardDocumentRequest } from "@/lib/ward/ward-document-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await handleWardDocumentRequest(request, "preview");
  } catch (error) {
    console.error("[ward preview]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to preview document",
      },
      { status: 500 }
    );
  }
}
