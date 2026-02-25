// Date parsing and formatting utilities

/**
 * Clean and normalize date strings to YYYY/MM/DD format
 * Handles multiple date formats and falls back to createAt date
 */
export const cleanDate = (
  sIn: string | string[],
  createAt?: string,
): string => {
  // Helper to convert createAt to YYYY/MM/DD format
  const formatCreateAt = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}/${month}/${day}`;
    } catch {
      return "2024/01/01";
    }
  };

  if (!sIn) return createAt ? formatCreateAt(createAt) : "2024/01/01";
  const s: string = typeof sIn == "string" ? sIn : sIn.join(" ");

  // Check for YYYY/MM/DD format first (already sortable)
  const ymdMatch = s.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}/${ymdMatch[2]}/${ymdMatch[3]}`;
  }

  // Check for DD/MM/YYYY format and convert
  const dmyMatch = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}/${dmyMatch[2]}/${dmyMatch[1]}`;
  }

  // Fallback to createAt if provided, otherwise default date
  return createAt ? formatCreateAt(createAt) : "2024/01/01";
};
