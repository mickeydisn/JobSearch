# JobSave Pipeline

## Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the saved job entry |
| `saved_at` | Timestamp when the job was first saved |
| `updated_at` | Timestamp of the last modification |
| `userStatus` | Application status: saved, applied, interview, rejected, offer |
| `userPriority` | User priority: low, medium, high |
| `userTags` | JSON array of user-defined tags |
| `reviewTags` | JSON array of review tags (good, bad, etc.) |
| `userReview` | User's personal review notes |
| `userMetadata` | JSON object for custom data (contact, salary, etc.) |
| `archive` | Soft delete flag: 0 = active, 1 = archived |
| `archived_at` | Timestamp when the job was archived |

### ETL Fields (Copied from JobEtl)

| Field | Description |
|-------|-------------|
| `job_etl_id` | Reference to the original JobEtl entry |
| `createAt` | Original creation timestamp from scraper |
| `scraper` | Source scraper (linkedin, hellowork, etc.) |
| `updateAt` | Last update from the source |
| `status` | Job status from the source |
| `title` | Job title |
| `link` | URL to the original job posting |
| `loc` | Location |
| `tag` | Category tag |
| `contract` | Contract type (CDI, CDD, etc.) |
| `entrepriseLinks` | Company links |
| `date` | Posting date |
| `jobHead` | Job header/summary |
| `jobText` | Full job description (text) |
| `jobHtml` | Full job description (HTML) |
| `company` | Company name |
| `titleKey` | JSON array of keywords from title |
| `dateClean` | Cleaned/normalized date |
| `jobKeywords` | JSON array of [keyword, frequency] tuples |
| `jobKeywordScore` | JSON array of [keyword, tfidf_score] tuples |
| `iaKeywordsW5a` | AI-extracted keywords |
| `iaScoreW5a` | AI relevance score |
| `iaScoreW6a` | AI quality score |
| `userTag` | User-defined tag |

## Actions

| Action | Description |
|--------|-------------|
| Save Job | Copies all JobEtl fields to JobSave, preserving existing user data if already saved |
| Unsave Job | Archives the saved job (sets archive = 1) |
| Update Status | Changes userStatus while syncing ETL data |
| Update Priority | Changes userPriority while syncing ETL data |
| Add Tag | Adds a tag to userTags, auto-saves if needed, syncs ETL data |
| Remove Tag | Removes a tag from userTags |
| Update Review | Saves user review, auto-saves if needed, syncs ETL data |
| Add Review Tag | Adds a tag to reviewTags |
| Remove Review Tag | Removes a tag from reviewTags |
| Archive | Soft deletes (archive = 1) |
| Restore | Unarchives (archive = 0) |

## Data Flow

When saving or updating a job, the system first syncs all ETL fields from JobEtl to JobSave. This ensures JobSave always has current job information while preserving user data (tags, reviews, status, priority).

See: [table_jobs_save.ts](../api_sqlite/table_jobs_save.ts), [handlers_async.ts](../web_service/actions/handlers_async.ts)
