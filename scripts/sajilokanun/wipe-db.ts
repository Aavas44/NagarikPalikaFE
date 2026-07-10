/**
 * Apply section migration and wipe all documents/chunks.
 * Uses Supabase REST for wipe; pg (IPv4) for DDL when DATABASE_URL is reachable.
 */
import { config } from "dotenv";
import dns from "dns";
import fs from "fs";
import path from "path";
import pg from "pg";
import { getSupabaseAdmin } from "../../src/lib/sajilokanun/supabase";

config({ path: ".env.local" });
dns.setDefaultResultOrder("ipv4first");

async function wipeViaSupabase() {
  const supabase = getSupabaseAdmin();
  const { error: chunkError } = await supabase
    .from("chunks")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (chunkError) throw new Error(`Wipe chunks failed: ${chunkError.message}`);

  const { error: docError } = await supabase
    .from("documents")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (docError) throw new Error(`Wipe documents failed: ${docError.message}`);

  console.log("Wiped chunks and documents via Supabase API");
}

async function migrateViaPg() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for migration");
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  try {
    for (const file of ["migration-sections.sql", "migration-chunk-metadata.sql"]) {
      const sql = fs.readFileSync(
        path.join(process.cwd(), "supabase", "sajilokanun", file),
        "utf8"
      );
      await client.query(sql);
      console.log(`Applied ${file}`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    await migrateViaPg();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Direct Postgres migration failed: ${message}`);
    console.warn(
      "If columns are missing, run supabase/migration-sections.sql in Supabase SQL Editor."
    );
  }

  await wipeViaSupabase();

  const supabase = getSupabaseAdmin();
  const { count: chunkCount } = await supabase
    .from("chunks")
    .select("*", { count: "exact", head: true });
  const { count: docCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true });

  console.log(`Chunks: ${chunkCount ?? 0}, Documents: ${docCount ?? 0}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
