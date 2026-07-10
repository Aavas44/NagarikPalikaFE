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

  const schemaPath = path.join(process.cwd(), "supabase", "sajilokanun", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  await client.connect();
  console.log("Connected to Supabase Postgres");

  try {
    await client.query(sql);
    console.log("Schema applied successfully.");
    console.log(
      "After ingestion, uncomment and run the IVFFlat index in supabase/schema.sql."
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
