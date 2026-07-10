import { config } from "dotenv";
import dns from "dns";
import fs from "fs";
import path from "path";
import pg from "pg";

config({ path: ".env.local" });
dns.setDefaultResultOrder("ipv4first");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in .env.local");
  }

  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "sajilokanun", "migration-fts.sql"),
    "utf8"
  );

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 300000,
  });

  console.log("Connecting to Postgres...");
  await client.connect();

  console.log("Raising maintenance_work_mem for GIN / generated column build...");
  await client.query("set maintenance_work_mem = '256MB'");

  try {
    console.log("Applying migration-fts.sql (search_vector + GIN + search_chunks_fts)...");
    await client.query(sql);
    console.log("FTS migration applied.");
  } finally {
    await client.query("reset maintenance_work_mem");
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
