import { CurrentState } from "../types/index.ts";

/** Page interface - all pages must implement this */
export interface Page {
  /** Unique identifier for the page */
  id: string;
  /** Display name for the page */
  name: string;
  /** Icon class (FontAwesome) */
  icon: string;
  /** Build the page HTML content */
  build(state: CurrentState): Promise<string>;
}

/** Storage for registered pages */
const pages = new Map<string, Page>();

/** Register a page with the registry */
export const registerPage = (page: Page): void => {
  pages.set(page.id, page);
  console.log(`📄 Registered page: ${page.id} (${page.name})`);
};

/** Get a page by ID */
export const getPage = (id: string): Page | undefined => {
  return pages.get(id);
};

/** Get all registered pages */
export const getAllPages = (): Page[] => {
  return Array.from(pages.values());
};

/** Check if a page exists */
export const hasPage = (id: string): boolean => {
  return pages.has(id);
};

/** Build page content by ID */
export const buildPageContent = async (
  pageId: string,
  state: CurrentState,
): Promise<string | null> => {
  const page = pages.get(pageId);
  if (!page) {
    console.warn(`Page not found: ${pageId}`);
    return null;
  }
  return await page.build(state);
};
