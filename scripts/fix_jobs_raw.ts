#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
/**
 * Script to fix data quality issues in jobs_raw table
 * - Fixes tag field: converts plain strings to arrays
 * - Fixes company field: extracts from title if empty
 */

import { getDb, closeDb } from "../api_sqlite/db.ts";
import { JobsRaw, JobsRawType } from "../api_sqlite/table_jobs_raw.ts";

type FixStats = {
  totalJobs: number;
  fixedTag: number;
  fixedCompany: number;
  fixedBoth: number;
  noChange: number;
  errors: number;
};

/**
 * Fix a single job record
 */
function fixJob(job: JobsRawType): { fixed: JobsRawType; changes: string[] } {
  const changes: string[] = [];
  let fixed = { ...job };

  // Fix 1: Convert tag from string to array
  if (typeof job.tag === "string") {
    if (job.tag.trim() === "") {
      fixed.tag = [];
      changes.push(`tag: "" → []`);
    } else {
      fixed.tag = [job.tag];
      changes.push(`tag: "${job.tag.substring(0, 30)}..." → ["${job.tag.substring(0, 30)}..."]`);
    }
  } else if (job.tag === undefined || job.tag === null) {
    fixed.tag = [];
    changes.push(`tag: undefined → []`);
  }

  // Fix 2: Extract company from title if empty
  if (!job.company || job.company.trim() === "") {
    const titleParts = job.title?.split("\n") || [];
    if (titleParts.length > 1 && titleParts[1].trim()) {
      fixed.company = titleParts[1].trim();
      changes.push(`company: "" → "${fixed.company.substring(0, 30)}..." (from title)`);
    } else {
      // Try to extract from jobText or use placeholder
      fixed.company = "Unknown";
      changes.push(`company: "" → "Unknown"`);
    }
  }

  return { fixed, changes };
}

async function fixAllJobs(): Promise<FixStats> {
  const db = getDb();
  const jobsRaw = new JobsRaw();

  console.log("🔍 Fetching all jobs from jobs_raw table...");
  const allJobs = await jobsRaw.search({}, 100000, 0);
  console.log(`📊 Found ${allJobs.length} jobs to process\n`);

  const stats: FixStats = {
    totalJobs: allJobs.length,
    fixedTag: 0,
    fixedCompany: 0,
    fixedBoth: 0,
    noChange: 0,
    errors: 0,
  };

  console.log("🔧 Fixing jobs...");

  for (let i = 0; i < allJobs.length; i++) {
    const job = allJobs[i];

    try {
      const { fixed, changes } = fixJob(job);

      if (changes.length > 0) {
        // Track what was fixed
        const fixedTag = changes.some(c => c.startsWith("tag:"));
        const fixedCompany = changes.some(c => c.startsWith("company:"));

        if (fixedTag && fixedCompany) stats.fixedBoth++;
        else if (fixedTag) stats.fixedTag++;
        else if (fixedCompany) stats.fixedCompany++;

        // Save the fixed job
        await jobsRaw.save(fixed);

        // Log first 5 examples
        if (stats.fixedTag + stats.fixedCompany + stats.fixedBoth <= 5) {
          console.log(`\n📝 Fixed: ${job.id}`);
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
      console.error(`\n❌ Error fixing job ${job.id}:`, error);
    }
  }

  console.log("\n");
  closeDb();
  return stats;
}

function printStats(stats: FixStats) {
  console.log("=".repeat(80));
  console.log("🔧 JOBS_RAW DATA FIX REPORT");
  console.log("=".repeat(80));
  console.log();

  console.log("📊 SUMMARY");
  console.log("-".repeat(40));
  console.log(`Total Jobs Processed: ${stats.totalJobs.toLocaleString()}`);
  console.log();

  console.log("✅ FIXES APPLIED");
  console.log("-".repeat(40));
  console.log(`Tag fixed only:       ${stats.fixedTag.toLocaleString()}`);
  console.log(`Company fixed only:   ${stats.fixedCompany.toLocaleString()}`);
  console.log(`Both fixed:           ${stats.fixedBoth.toLocaleString()}`);
  console.log(`-`.repeat(40));
  console.log(`Total Fixed:          ${(stats.fixedTag + stats.fixedCompany + stats.fixedBoth).toLocaleString()}`);
  console.log();

  console.log("📈 OTHER");
  console.log("-".repeat(40));
  console.log(`No changes needed:    ${stats.noChange.toLocaleString()}`);
  console.log(`Errors:               ${stats.errors.toLocaleString()}`);
  console.log();

  console.log("=".repeat(80));
  console.log("✅ Fix complete");
  console.log("=".repeat(80));
}

// Main execution
if (import.meta.main) {
  console.log("⚠️  This will modify the jobs_raw table.");
  console.log("   Press Ctrl+C to cancel, or wait 3 seconds to proceed...\n");

  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    const stats = await fixAllJobs();
    printStats(stats);
  } catch (error) {
    console.error("\n❌ Error during fix:", error);
    closeDb();
    Deno.exit(1);
  }
}
