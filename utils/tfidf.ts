/**
 * TF-IDF Calculation Utility
 * Shared between scrap_jobs_usecase and update_jobs_usecase
 */

/**
 * Calculate TF-IDF scores for job keywords
 * TF = keyword frequency in job / total keywords in job
 * IDF = log(total_jobs / (job_count + 1))
 * TF-IDF = TF * IDF
 * 
 * @param jobKeywords - Array of [keyword, frequency] tuples
 * @param keywordFreqMap - Map of keyword -> document frequency (how many jobs contain this keyword)
 * @param totalJobs - Total number of jobs for IDF calculation
 * @returns Array of [keyword, tfidf_score] tuples sorted by score descending
 */
export function calculateTfIdfScores(
  jobKeywords: [string, number][],
  keywordFreqMap: Map<string, number>,
  totalJobs: number
): [string, number][] {
  if (!jobKeywords || jobKeywords.length === 0) return [];

  // Calculate total keyword count in this job
  const totalKeywordCount = jobKeywords.reduce((sum, [, freq]) => sum + freq, 0);

  const scores: [string, number][] = [];

  for (const [keyword, freq] of jobKeywords) {
    // Use default job_count of 1 for keywords not in the frequency table
    const jobCount = keywordFreqMap.get(keyword);
    const effectiveJobCount = jobCount ?? 1;

    // TF: term frequency in this job
    const tf = freq / totalKeywordCount;

    // IDF: inverse document frequency with smoothing
    const idf = Math.log(totalJobs / (effectiveJobCount + 1));

    // TF-IDF score
    const tfidf = tf * idf;

    scores.push([keyword, tfidf]);
  }

  // Sort by score descending
  return scores.sort((a, b) => b[1] - a[1]);
}
