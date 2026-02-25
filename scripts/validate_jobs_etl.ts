#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
/**
 * Script to validate jobs_etl data against the schema
 */

import { getDb, closeDb } from "../api_sqlite/db.ts";
import { JobsEtl, JobsEtlType } from "../api_sqlite/table_jobs.ts";

// Required fields
const REQUIRED_FIELDS: (keyof JobsEtlType)[] = [
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
  "tag",      // string in ETL (flattened from array)
  "loc",      // can be "empty"
  "contract", // can be "empty"
];

// Array fields
const ARRAY_FIELDS: (keyof JobsEtlType)[] = ["titleKey", "jobKeywords", "jobKeywordScore", "iaKeywordsW5a"];

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
  sampleIssues: ValidationIssue[];
};

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function validateJob(job: JobsEtlType): ValidationIssue[] {
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
    if (value !== undefined && !Array.isArray(value)) {
      issues.push({
        jobId: job.id,
        field,
        issue: "INVALID_TYPE (expected array)",
        value,
      });
    }
  }

  // Check tag is string (not array) in ETL
  if (job.tag !== undefined && typeof job.tag !== "string") {
    issues.push({
      jobId: job.id,
      field: "tag",
      issue: "TAG_NOT_STRING (ETL should have string, not array)",
      value: job.tag,
    });
  }

  return issues;
}

async function generateReport(): Promise<ValidationReport> {
  const jobsEtl = new JobsEtl();

  console.log("🔍 Fetching all jobs from jobs_etl table...");
  const allJobs = await jobsEtl.search({}, 100000, 0);
  console.log(`📊 Found ${allJobs.length} jobs to validate\n`);

  const report: ValidationReport = {
    totalJobs: allJobs.length,
    validJobs: 0,
    jobsWithIssues: 0,
    issuesByType: new Map(),
    issuesByField: new Map(),
    sampleIssues: [],
  };

  console.log("🧪 Validating jobs...");

  for (let i = 0; i < allJobs.length; i++) {
    const job = allJobs[i];
    const issues = validateJob(job);

    if (issues.length === 0) {
      report.validJobs++;
    } else {
      report.jobsWithIssues++;
      for (const issue of issues) {
        const currentTypeCount = report.issuesByType.get(issue.issue) || 0;
        report.issuesByType.set(issue.issue, currentTypeCount + 1);
        const currentFieldCount = report.issuesByField.get(issue.field) || 0;
        report.issuesByField.set(issue.field, currentFieldCount + 1);
        if (report.sampleIssues.length < 20) {
          report.sampleIssues.push(issue);
        }
      }
    }

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
  console.log("📋 JOBS_ETL DATA VALIDATION REPORT");
  console.log("=".repeat(80));
  console.log();

  console.log("📊 SUMMARY");
  console.log("-".repeat(40));
  console.log(`Total Jobs:        ${report.totalJobs.toLocaleString()}`);
  console.log(`Valid Jobs:        ${report.validJobs.toLocaleString()} (${((report.validJobs / report.totalJobs) * 100).toFixed(1)}%)`);
  console.log(`Jobs with Issues:  ${report.jobsWithIssues.toLocaleString()} (${((report.jobsWithIssues / report.totalJobs) * 100).toFixed(1)}%)`);
  console.log();

  if (report.issuesByField.size > 0) {
    console.log("📁 ISSUES BY FIELD");
    console.log("-".repeat(40));
    const sortedFields = Array.from(report.issuesByField.entries()).sort((a, b) => b[1] - a[1]);
    for (const [field, count] of sortedFields) {
      console.log(`${field.padEnd(20)} | ${count.toString().padStart(5)} occurrences`);
    }
    console.log();
  }

  if (report.issuesByType.size > 0) {
    console.log("⚠️  ISSUES BY TYPE");
    console.log("-".repeat(40));
    const sortedTypes = Array.from(report.issuesByType.entries()).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sortedTypes) {
      console.log(`${type.padEnd(40)} | ${count.toString().padStart(5)} occurrences`);
    }
    console.log();
  }

  console.log("=".repeat(80));
  console.log("✅ Validation complete");
  console.log("=".repeat(80));
}

// Main execution
if (import.meta.main) {
  try {
    const report = await generateReport();
    printReport(report);
  } catch (error) {
    console.error("❌ Error during validation:", error);
    closeDb();
    Deno.exit(1);
  }
}
