import { config } from "dotenv";
import { getSupabaseAdmin } from "../../src/lib/sajilokanun/supabase";

config({ path: ".env.local" });

const supabaseRequired = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
] as const;

async function main() {
  console.log("HandyLaw setup check\n");

  let ok = true;
  const provider =
    process.env.LLM_PROVIDER ??
    (process.env.OPENAI_API_KEY ? "openai" : "gemini");

  console.log(`LLM provider: ${provider}`);

  const llmKey =
    provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
  const llmValue = process.env[llmKey];
  const llmSet = Boolean(llmValue && llmValue !== "..." && !llmValue.includes("[YOUR"));
  console.log(`${llmSet ? "✓" : "✗"} ${llmKey}`);
  if (!llmSet) ok = false;

  for (const key of supabaseRequired) {
    const value = process.env[key];
    const set = Boolean(
      value && !value.includes("[YOUR") && value !== "..."
    );
    console.log(`${set ? "✓" : "✗"} ${key}`);
    if (!set) ok = false;
  }

  if (!ok) {
    console.log(
      "\nCreate .env.local from .env.local.example and fill in your credentials."
    );
    process.exit(1);
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("documents").select("id").limit(1);

  if (error) {
    console.log(`\n✗ Supabase connection: ${error.message}`);
    console.log("Run: npm run setup");
    process.exit(1);
  }

  const { count } = await supabase
    .from("chunks")
    .select("*", { count: "exact", head: true });

  const { count: embeddedCount } = await supabase
    .from("chunks")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);

  console.log(`\n✓ Supabase connected`);
  console.log(`✓ Chunks in database: ${count ?? 0}`);
  console.log(`✓ Chunks with embeddings: ${embeddedCount ?? 0}`);

  if ((embeddedCount ?? 0) === 0) {
    console.log("\nTip: run npm run ingest for vector search (keyword mode works without it)");
  }

  console.log("\nReady: npm run dev");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
