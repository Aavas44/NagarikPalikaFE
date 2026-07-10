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
    throw new Error("DATABASE_URL is required");
  }

  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "sajilokanun", "migration-sections.sql"),
    "utf8"
  );

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000,
  });

  console.log("Connecting to Postgres (IPv4)...");
  await client.connect();
  console.log("Applying migration-sections.sql...");
  await client.query(sql);
  await client.end();
  console.log("Migration applied.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
