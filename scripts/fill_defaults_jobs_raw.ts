#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
/**
 * Script to fill missing values with defaults in jobs_raw table
 * - tag: [] → ["empty"]
 * - loc: "" → "empty"
 * - contract: "" → "empty"
 */

import { getDb, closeDb } from "../api_sqlite/db.ts";
import { JobsRaw, JobsRawType } from "../api_sqlite/table_jobs_raw.ts";

type FixStats = {
  totalJobs: number;
  filledTag: number;
  filledLoc: number;
  filledContract: number;
  noChange: number;
  errors: number;
};

/**
 * Fill defaults for a single job record
 */
function fillDefaults(job: JobsRawType): { updated: JobsRawType; changes: string[] } {
  const changes: string[] = [];
  const updated = { ...job };

  // Fill tag: if empty array or undefined, set to ["empty"]
  if (!job.tag || (Array.isArray(job.tag) && job.tag.length === 0)) {
    updated.tag = ["empty"];
    changes.push(`tag: ${JSON.stringify(job.tag)} → ["empty"]`);
  }

  // Fill loc: if empty string or undefined, set to "empty"
  if (!job.loc || job.loc.trim() === "") {
    updated.loc = "empty";
    changes.push(`loc: "${job.loc}" → "empty"`);
  }

  // Fill contract: if empty string or undefined, set to "empty"
  if (!job.contract || job.contract.trim() === "") {
    updated.contract = "empty";
    changes.push(`contract: "${job.contract}" → "empty"`);
  }

  return { updated, changes };
}

async function fillAllDefaults(): Promise<FixStats> {
  const db = getDb();
  const jobsRaw = new JobsRaw();

  console.log("🔍 Fetching all jobs from jobs_raw table...");
  const allJobs = await jobsRaw.search({}, 100000, 0);
  console.log(`📊 Found ${allJobs.length} jobs to process\n`);

  const stats: FixStats = {
    totalJobs: allJobs.length,
    filledTag: 0,
    filledLoc: 0,
    filledContract: 0,
    noChange: 0,
    errors: 0,
  };

  console.log("🔧 Filling default values...");

  for (let i = 0; i < allJobs.length; i++) {
    const job = allJobs[i];

    try {
      const { updated, changes } = fillDefaults(job);

      if (changes.length > 0) {
        // Track what was filled
        if (changes.some(c => c.startsWith("tag:"))) stats.filledTag++;
        if (changes.some(c => c.startsWith("loc:"))) stats.filledLoc++;
        if (changes.some(c => c.startsWith("contract:"))) stats.filledContract++;

        // Save the updated job
        await jobsRaw.save(updated);

        // Log first 5 examples
        if (stats.filledTag + stats.filledLoc + stats.filledContract <= 5) {
          console.log(`\n📝 Updated: ${job.id}`);
          changes.forEach(c => console.log(`   ${c}`));
        }
      } else {
        stats.noChange++;
      }

      // Progress indicator
      if ((i + 1) % 100 === 0 || i === allJobs.length - 1) {
        process.stdout.write(`\r  Progress: ${i + 1}/${allJobs.length} (${Math.round(((i + 1) / allJobs.length) * 100)}%)`);
      }
    } catch (error) {
      stats.errors++;
      console.error(`\n❌ Error updating job ${job.id}:`, error);
    }
  }

  console.log("\n");
  closeDb();
  return stats;
}

function printStats(stats: FixStats) {
  console.log("=".repeat(80));
  console.log("🔧 JOBS_RAW FILL DEFAULTS REPORT");
  console.log("=".repeat(80));
  console.log();

  console.log("📊 SUMMARY");
  console.log("-".repeat(40));
  console.log(`Total Jobs Processed: ${stats.totalJobs.toLocaleString()}`);
  console.log();

  console.log("✅ DEFAULTS FILLED");
  console.log("-".repeat(40));
  console.log(`Tag filled:           ${stats.filledTag.toLocaleString()}`);
  console.log(`Location filled:      ${stats.filledLoc.toLocaleString()}`);
  console.log(`Contract filled:      ${stats.filledContract.toLocaleString()}`);
  console.log(`-`.repeat(40));
  console.log(`Total Updated:        ${(stats.filledTag + stats.filledLoc + stats.filledContract).toLocaleString()}`);
  console.log();

  console.log("📈 OTHER");
  console.log("-".repeat(40));
  console.log(`No changes needed:    ${stats.noChange.toLocaleString()}`);
  console.log(`Errors:               ${stats.errors.toLocaleString()}`);
  console.log();

  console.log("=".repeat(80));
  console.log("✅ Fill defaults complete");
  console.log("=".repeat(80));
}

// Main execution
if (import.meta.main) {
  console.log("⚠️  This will modify the jobs_raw table.");
  console.log("   Press Ctrl+C to cancel, or wait 3 seconds to proceed...\n");

  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    const stats = await fillAllDefaults();
    printStats(stats);
  } catch (error) {
    console.error("\n❌ Error during fill defaults:", error);
    closeDb();
    Deno.exit(1);
  }
}
