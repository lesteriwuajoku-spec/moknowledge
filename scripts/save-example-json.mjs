/**
 * Generates example-knowledge-base.json by scraping a URL (default: J&D Insurance).
 * Requires dev server running. Usage: npm run example:json  or  node scripts/save-example-json.mjs [url]
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = "http://localhost:3000/api/scrape";
const DEFAULT_URL = "https://jdinsassociates.com/";
const OUT_PATH = join(__dirname, "..", "example-knowledge-base.json");

const url = process.argv[2] || DEFAULT_URL;

async function main() {
  console.log("Scraping:", url);
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    console.error("Scrape failed:", data.error || res.statusText);
    process.exit(1);
  }
  writeFileSync(OUT_PATH, JSON.stringify(data.knowledge, null, 2), "utf8");
  console.log("Written:", OUT_PATH);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
