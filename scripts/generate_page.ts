#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Page Generator Script
 * Usage: deno task generate:page PageName
 * Example: deno task generate:page Settings
 */

const USAGE = `
Usage: deno task generate:page <PageName>

Example:
  deno task generate:page Settings
  
This will create:
  - web_service/routes/settings/page.ts
  - web_service/routes/settings/components/
`;

/** Convert camelCase/PascalCase to kebab-case */
const toKebabCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase();
};

/** Generate page template */
const generatePageTemplate = (name: string, id: string): string => {
  return `import { CurrentState } from "../../types/index.ts";
import { Page, registerPage } from "../../pages/page_registry.ts";

/** Build the ${id} page */
const build${name}Page = async (_state: CurrentState): Promise<string> => {
  return \`
    <div id="page-content">
      <div class="empty">
        <i class="fa fa-file-o empty-icon"></i>
        <h3>${name} Page</h3>
        <p>This is the ${name} page. Add your content here.</p>
      </div>
    </div>
  \`;
};

/** ${name} Page implementation */
const ${id}Page: Page = {
  id: "${id}",
  name: "${name}",
  icon: "fa-file-o",
  build: build${name}Page,
};

// Register the page
registerPage(${id}Page);

// Keep exports for backwards compatibility
export { build${name}Page };
`;
};

/** Main function */
const main = async (): Promise<void> => {
  const args = Deno.args;

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(USAGE);
    Deno.exit(0);
  }

  const pageName = args[0];
  
  // Validate page name (should be PascalCase)
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(pageName)) {
    console.error(`Error: Page name "${pageName}" should be PascalCase (e.g., Settings, UserProfile)`);
    Deno.exit(1);
  }

  const pageId = toKebabCase(pageName);
  const baseDir = `./web_service/routes/${pageId}`;
  const componentsDir = `${baseDir}/components`;

  try {
    // Check if page already exists
    try {
      await Deno.stat(baseDir);
      console.error(`Error: Page "${pageName}" already exists at ${baseDir}`);
      Deno.exit(1);
    } catch {
      // Directory doesn't exist, which is what we want
    }

    // Create directories
    await Deno.mkdir(componentsDir, { recursive: true });
    console.log(`📁 Created: ${baseDir}/`);
    console.log(`📁 Created: ${componentsDir}/`);

    // Create page.ts
    const pageContent = generatePageTemplate(pageName, pageId);
    const pagePath = `${baseDir}/page.ts`;
    await Deno.writeTextFile(pagePath, pageContent);
    console.log(`📝 Created: ${pagePath}`);

    // Create .gitkeep in components folder
    const gitkeepPath = `${componentsDir}/.gitkeep`;
    await Deno.writeTextFile(gitkeepPath, "");
    console.log(`📝 Created: ${gitkeepPath}`);

    // Update pages/mod.ts to import the new page
    const modPath = `./web_service/pages/mod.ts`;
    let modContent = await Deno.readTextFile(modPath);
    
    // Add import statement before the comment
    const importLine = `import "../routes/${pageId}/page.ts";`;
    if (!modContent.includes(importLine)) {
      // Find the last import statement and add after it
      const lines = modContent.split("\n");
      const lastImportIndex = lines.findLastIndex((line) => line.startsWith("import "));
      if (lastImportIndex !== -1) {
        lines.splice(lastImportIndex + 1, 0, importLine);
        modContent = lines.join("\n");
        await Deno.writeTextFile(modPath, modContent);
        console.log(`📝 Updated: ${modPath}`);
      }
    }

    console.log("\n✅ Page generated successfully!");
    console.log(`\nNext steps:`);
    console.log(`  1. Customize the page in ${pagePath}`);
    console.log(`  2. Add components to ${componentsDir}/`);
    console.log(`  3. Update the icon in the Page object (currently "fa-file-o")`);
    console.log(`  4. Run: deno check web_service/server.ts`);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    Deno.exit(1);
  }
};

if (import.meta.main) {
  main();
}
