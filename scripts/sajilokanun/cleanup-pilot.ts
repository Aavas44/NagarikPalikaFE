import { config } from "dotenv";
import { getPilotPdfs } from "../../src/lib/sajilokanun/pilot";
import { getSupabaseAdmin } from "../../src/lib/sajilokanun/supabase";

config({ path: ".env.local" });

async function main() {
  const pilotPdfs = new Set(getPilotPdfs());
  const supabase = getSupabaseAdmin();

  const { data: docs, error } = await supabase.from("documents").select("id, filename");

  if (error) {
    throw new Error(error.message);
  }

  const toRemove = (docs ?? []).filter((doc) => !pilotPdfs.has(doc.filename));

  if (toRemove.length === 0) {
    console.log("No non-pilot documents to remove.");
    console.log("Pilot PDFs:", [...pilotPdfs].join(", "));
    return;
  }

  for (const doc of toRemove) {
    await supabase.from("chunks").delete().eq("document_id", doc.id);
    await supabase.from("documents").delete().eq("id", doc.id);
    console.log(`Removed: ${doc.filename}`);
  }

  console.log("\nPilot scope:");
  for (const name of pilotPdfs) {
    console.log(`  - ${name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
