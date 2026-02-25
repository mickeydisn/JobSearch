// HTML processing utilities for cleaning and transforming HTML content

/**
 * Strip HTML tags from text
 */
export const stripHtml = (html: string | null | undefined): string => {
  if (!html || typeof html !== "string") return "";
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  // Replace HTML tags with spaces
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&/g, "&");
  text = text.replace(/</g, "<");
  text = text.replace(/>/g, ">");
  text = text.replace(/"/g, '"');
  text = text.replace(/&#39;/g, "'");
  // Normalize whitespace
  text = text.replace(/\s+/g, " ");
  return text.trim();
};

/**
 * Process jobHtml to limit image sizes to max 100x100 pixels
 * Adds style="max-width:100px;max-height:100px" to all img tags
 */
export const processJobHtmlImages = (
  html: string | null | undefined,
): string => {
  if (!html || typeof html !== "string") return "";

  // Add max-width and max-height constraints to all img tags
  // Handle various img tag formats (with or without existing attributes)
  return html.replace(
    /<img\b([^>]*)>/gi,
    (match, attributes) => {
      // Remove existing width/height attributes to ensure consistent sizing
      let cleanedAttrs = attributes
        .replace(/\s+(width|height)\s*=\s*["']?[^"'>\s]+["']?/gi, "")
        .trim();

      // Add style attribute with max dimensions, preserving any existing styles
      if (cleanedAttrs.includes('style="')) {
        // Append to existing style
        cleanedAttrs = cleanedAttrs.replace(
          /style="([^"]*)"/i,
          'style="$1;max-width:100px;max-height:100px"',
        );
      } else if (cleanedAttrs.includes("style='")) {
        // Append to existing single-quoted style
        cleanedAttrs = cleanedAttrs.replace(
          /style='([^']*)'/i,
          "style='$1;max-width:100px;max-height:100px'",
        );
      } else {
        // Add new style attribute
        cleanedAttrs += ' style="max-width:100px;max-height:100px"';
      }

      return `<img ${cleanedAttrs}>`;
    },
  );
};
