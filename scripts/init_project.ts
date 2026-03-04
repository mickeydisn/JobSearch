#!/usr/bin/env deno run --allow-all

/**
 * Project Initialization Script
 * 
 * This script sets up the JobSearch project by:
 * 1. Creating necessary directories
 * 2. Initializing database tables
 * 3. Providing setup information
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";

// Import database initialization
import { JobsEtl } from "../api_sqlite/table_jobs.ts";
import { JobsRaw } from "../api_sqlite/table_jobs_raw.ts";
import { JobsSave } from "../api_sqlite/table_jobs_save.ts";
import { Keywords } from "../api_sqlite/table_keywords.ts";
import { KeywordFrequency } from "../api_sqlite/table_keyword_frequency.ts";
import { FilterProfile } from "../api_sqlite/table_filter_profile.ts";

console.log("🚀 JobSearch Project Initialization");
console.log("====================================");

async function initProject() {
  try {
    // 1. Create data directory
    console.log("📁 Creating data directory...");
    const dataDir = join(Deno.cwd(), "data");
    await ensureDir(dataDir);
    console.log("✅ Data directory created at:", dataDir);

    // 2. Initialize database tables
    console.log("\n🏗️ Initializing database tables...");
    
    const tables = [
      { name: "jobs_raw", class: JobsRaw },
      { name: "jobs_etl", class: JobsEtl },
      { name: "jobs_save", class: JobsSave },
      { name: "keywords", class: Keywords },
      { name: "keyword_frequency", class: KeywordFrequency },
      { name: "filter_profile", class: FilterProfile },
    ];

    for (const table of tables) {
      console.log(`  📋 Creating ${table.name} table...`);
      const tableInstance = new table.class();
      await tableInstance.createTable();
      console.log(`  ✅ ${table.name} table ready`);
    }

    console.log("\n🎉 Database initialization complete!");

    // 3. Display setup information
    console.log("\n📋 Project Setup Complete!");
    console.log("====================================");
    console.log("Available commands:");
    console.log("  deno task dev          - Start development server");
    console.log("  deno task check        - Type check the project");
    console.log("  deno task generate:page - Generate page files");
    console.log("");
    console.log("Server will be available at: http://localhost:8080");
    console.log("Database file: ./data/jobsearch.db");
    console.log("");
    console.log("Next steps:");
    console.log("1. Run 'deno task dev' to start the development server");
    console.log("2. Open http://localhost:8080 in your browser");
    console.log("3. Use the processing page to scrape jobs");
    console.log("4. View jobs, keywords, and analysis in the respective pages");

  } catch (error) {
    console.error("❌ Initialization failed:", error);
    Deno.exit(1);
  }
}

// Run initialization
await initProject();