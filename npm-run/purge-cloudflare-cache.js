/**
 * Script to purge Cloudflare cache
 * Requires CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN in the environment or .env file.
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!zoneId || !apiToken) {
  console.error(
    "Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN environment variables.",
  );
  process.exit(1);
}

async function purgeCache() {
  try {
    console.log(`Purging Cloudflare cache for zone: ${zoneId}...`);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          purge_everything: true,
        }),
      },
    );

    const data = await response.json();

    if (response.ok && data.success) {
      console.log("✅ Successfully purged Cloudflare cache.");
    } else {
      console.error("❌ Failed to purge cache:", data.errors);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error purging cache:", error.message);
    process.exit(1);
  }
}

purgeCache();
