#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
/**
 * Script to validate jobs_raw data against the schema
 * Generates an analysis report showing data quality issues
 */

import { getDb, closeDb } from "../api_sqlite/db.ts";
import { JobsRaw, JobsRawType } from "../api_sqlite/table_jobs_raw.ts";

// Required fields that must be present and non-empty
const REQUIRED_FIELDS: (keyof JobsRawType)[] = [
  "id",
  "createAt",
  "scraper",
  "updateAt",
  "status",
  "title",
  "link",
  "date",
  "jobText",
  "jobHtml",
  "company",
];

// Fields that can be empty but should have default values
const OPTIONAL_FIELDS_WITH_DEFAULTS: (keyof JobsRawType)[] = [
  "loc",
  "tag",
  "contract",
];

// Optional fields (ETL-generated, may be missing)
const OPTIONAL_FIELDS: (keyof JobsRawType)[] = [
  "jobHead",
  "titleKey",
  "dateClean",
  "entrepriseLinks",
];

// Array fields that should be string[]
const ARRAY_FIELDS: (keyof JobsRawType)[] = ["tag", "titleKey"];

// String fields that should not be empty
const NON_EMPTY_STRING_FIELDS: (keyof JobsRawType)[] = [
  "id",
  "title",
  "link",
  "scraper",
  "status",
];

type ValidationIssue = {
  jobId: string;
  field: string;
  issue: string;
  value: unknown;
};

type ValidationReport = {
  totalJobs: number;
  validJobs: number;
  jobsWithIssues: number;
  issuesByType: Map<string, number>;
  issuesByField: Map<string, number>;
  scraperStats: Map<string, { total: number; issues: number }>;
  sampleIssues: ValidationIssue[];
};

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function isValidArray(value: unknown): boolean {
  return Array.isArray(value);
}

function validateJob(job: JobsRawType): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    const value = job[field];
    if (isEmpty(value)) {
      issues.push({
        jobId: job.id,
        field,
        issue: "MISSING_REQUIRED",
        value,
      });
    }
  }

  // Check array fields have correct type
  for (const field of ARRAY_FIELDS) {
    const value = job[field];
    if (value !== undefined && !isValidArray(value)) {
      issues.push({
        jobId: job.id,
        field,
        issue: "INVALID_TYPE (expected array)",
        value,
      });
    }
  }

  // Check non-empty string fields
  for (const field of NON_EMPTY_STRING_FIELDS) {
    const value = job[field];
    if (typeof value === "string" && value.trim() === "") {
      issues.push({
        jobId: job.id,
        field,
        issue: "EMPTY_STRING",
        value,
      });
    }
  }

  // Check tag is array of strings
  if (job.tag !== undefined) {
    if (!Array.isArray(job.tag)) {
      issues.push({
        jobId: job.id,
        field: "tag",
        issue: "TAG_NOT_ARRAY",
        value: job.tag,
      });
    } else {
      // Check if any tag element is not a string
      const nonStringTag = job.tag.find((t) => typeof t !== "string");
      if (nonStringTag !== undefined) {
        issues.push({
          jobId: job.id,
          field: "tag",
          issue: "TAG_ELEMENT_NOT_STRING",
          value: nonStringTag,
        });
      }
    }
  }

  // Check status values are valid
  const validStatuses = ["New", "Updated", "ERROR", "ERROR_NO_EXIST", "Archived", "ACTIF", "DEAD"];
  if (job.status && !validStatuses.includes(job.status)) {
    issues.push({
      jobId: job.id,
      field: "status",
      issue: `INVALID_STATUS (expected one of: ${validStatuses.join(", ")})`,
      value: job.status,
    });
  }

  // Check scraper values are valid
  const validScrapers = ["hellowork", "welcome", "linkedin"];
  if (job.scraper && !validScrapers.includes(job.scraper)) {
    issues.push({
      jobId: job.id,
      field: "scraper",
      issue: `INVALID_SCRAPER (expected one of: ${validScrapers.join(", ")})`,
      value: job.scraper,
    });
  }

  // Check date format (should be parseable)
  if (job.date && typeof job.date === "string") {
    // Accept various formats: YYYY/MM/DD, DD/MM/YYYY, or text like "Publiée le 12/01/2024"
    const hasDate = /\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(job.date);
    if (!hasDate && job.date.length > 0) {
      issues.push({
        jobId: job.id,
        field: "date",
        issue: "DATE_FORMAT_UNRECOGNIZED",
        value: job.date,
      });
    }
  }

  // Check createAt and updateAt are valid ISO dates
  for (const field of ["createAt", "updateAt"] as const) {
    const value = job[field];
    if (value && typeof value === "string") {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        issues.push({
          jobId: job.id,
          field,
          issue: "INVALID_ISO_DATE",
          value,
        });
      }
    }
  }

  // Check link is valid URL
  if (job.link && typeof job.link === "string") {
    try {
      new URL(job.link);
    } catch {
      issues.push({
        jobId: job.id,
        field: "link",
        issue: "INVALID_URL",
        value: job.link,
      });
    }
  }

  return issues;
}

async function generateReport(): Promise<ValidationReport> {
  const db = getDb();
  const jobsRaw = new JobsRaw();

  console.log("🔍 Fetching all jobs from jobs_raw table...");

  // Get all jobs
  const allJobs = await jobsRaw.search({}, 100000, 0);
  console.log(`📊 Found ${allJobs.length} jobs to validate\n`);

  const report: ValidationReport = {
    totalJobs: allJobs.length,
    validJobs: 0,
    jobsWithIssues: 0,
    issuesByType: new Map(),
    issuesByField: new Map(),
    scraperStats: new Map(),
    sampleIssues: [],
  };

  // Initialize scraper stats
  for (const scraper of ["hellowork", "welcome", "linkedin"]) {
    report.scraperStats.set(scraper, { total: 0, issues: 0 });
  }

  console.log("🧪 Validating jobs...");

  for (let i = 0; i < allJobs.length; i++) {
    const job = allJobs[i];

    // Update scraper stats
    const scraperStat = report.scraperStats.get(job.scraper);
    if (scraperStat) {
      scraperStat.total++;
    }

    const issues = validateJob(job);

    if (issues.length === 0) {
      report.validJobs++;
    } else {
      report.jobsWithIssues++;

      // Update scraper issue count
      if (scraperStat) {
        scraperStat.issues++;
      }

      // Track issues by type and field
      for (const issue of issues) {
        const currentTypeCount = report.issuesByType.get(issue.issue) || 0;
        report.issuesByType.set(issue.issue, currentTypeCount + 1);

        const currentFieldCount = report.issuesByField.get(issue.field) || 0;
        report.issuesByField.set(issue.field, currentFieldCount + 1);

        // Keep first 20 sample issues
        if (report.sampleIssues.length < 20) {
          report.sampleIssues.push(issue);
        }
      }
    }

    // Progress indicator
    if ((i + 1) % 100 === 0 || i === allJobs.length - 1) {
      process.stdout.write(`\r  Progress: ${i + 1}/${allJobs.length} (${Math.round(((i + 1) / allJobs.length) * 100)}%)`);
    }
  }

  console.log("\n");
  closeDb();
  return report;
}

function printReport(report: ValidationReport) {
  console.log("=".repeat(80));
  console.log("📋 JOBS_RAW DATA VALIDATION REPORT");
  console.log("=".repeat(80));
  console.log();

  // Summary
  console.log("📊 SUMMARY");
  console.log("-".repeat(40));
  console.log(`Total Jobs:        ${report.totalJobs.toLocaleString()}`);
  console.log(`Valid Jobs:        ${report.validJobs.toLocaleString()} (${((report.validJobs / report.totalJobs) * 100).toFixed(1)}%)`);
  console.log(`Jobs with Issues:  ${report.jobsWithIssues.toLocaleString()} (${((report.jobsWithIssues / report.totalJobs) * 100).toFixed(1)}%)`);
  console.log();

  // Scraper stats
  console.log("🔧 BY SCRAPER");
  console.log("-".repeat(40));
  for (const [scraper, stats] of report.scraperStats) {
    const issueRate = stats.total > 0 ? ((stats.issues / stats.total) * 100).toFixed(1) : "0.0";
    console.log(`${scraper.padEnd(12)} | Total: ${stats.total.toString().padStart(4)} | Issues: ${stats.issues.toString().padStart(4)} (${issueRate}%)`);
  }
  console.log();

  // Issues by field
  if (report.issuesByField.size > 0) {
    console.log("📁 ISSUES BY FIELD");
    console.log("-".repeat(40));
    const sortedFields = Array.from(report.issuesByField.entries())
      .sort((a, b) => b[1] - a[1]);
    for (const [field, count] of sortedFields) {
      console.log(`${field.padEnd(20)} | ${count.toString().padStart(5)} occurrences`);
    }
    console.log();
  }

  // Issues by type
  if (report.issuesByType.size > 0) {
    console.log("⚠️  ISSUES BY TYPE");
    console.log("-".repeat(40));
    const sortedTypes = Array.from(report.issuesByType.entries())
      .sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sortedTypes) {
      console.log(`${type.padEnd(30)} | ${count.toString().padStart(5)} occurrences`);
    }
    console.log();
  }

  // Sample issues
  if (report.sampleIssues.length > 0) {
    console.log("🔍 SAMPLE ISSUES (first 20)");
    console.log("-".repeat(40));
    for (const issue of report.sampleIssues) {
      console.log(`Job: ${issue.jobId.substring(0, 50)}...`);
      console.log(`  Field: ${issue.field}`);
      console.log(`  Issue: ${issue.issue}`);
      console.log(`  Value: ${JSON.stringify(issue.value).substring(0, 60)}`);
      console.log();
    }
  }

  console.log("=".repeat(80));
  console.log("✅ Validation complete");
  console.log("=".repeat(80));
}

async function saveReportToFile(report: ValidationReport, filename: string) {
  const reportData = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalJobs: report.totalJobs,
      validJobs: report.validJobs,
      jobsWithIssues: report.jobsWithIssues,
      validPercentage: ((report.validJobs / report.totalJobs) * 100).toFixed(1),
      issuesPercentage: ((report.jobsWithIssues / report.totalJobs) * 100).toFixed(1),
    },
    byScraper: Object.fromEntries(report.scraperStats),
    byField: Object.fromEntries(report.issuesByField),
    byIssueType: Object.fromEntries(report.issuesByType),
    sampleIssues: report.sampleIssues,
  };

  await Deno.writeTextFile(filename, JSON.stringify(reportData, null, 2));
  console.log(`\n💾 Report saved to: ${filename}`);
}

// Main execution
if (import.meta.main) {
  try {
    const report = await generateReport();
    printReport(report);

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await saveReportToFile(report, `./reports/jobs_raw_validation_${timestamp}.json`);
  } catch (error) {
    console.error("❌ Error during validation:", error);
    closeDb();
    Deno.exit(1);
  }
}
