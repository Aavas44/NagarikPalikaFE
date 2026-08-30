import { handleWardDocumentRequest } from "@/lib/ward/ward-document-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await handleWardDocumentRequest(request, "generate");
  } catch (error) {
    console.error("[ward generate]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate document",
      },
      { status: 500 }
    );
  }
}
