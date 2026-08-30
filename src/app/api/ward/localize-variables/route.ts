import { handleWardLocalizeRequest } from "@/lib/ward/ward-document-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return await handleWardLocalizeRequest(request);
  } catch (error) {
    console.error("[ward localize]", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to localize variables to Nepali",
      },
      { status: 500 }
    );
  }
}
