import { JobsEtlType } from "../../../../api_sqlite/table_jobs.ts";
import { JobsSaveType } from "../../../../api_sqlite/table_jobs_save.ts";

// @ts-ignore - marked library doesn't export types properly for Deno
import { marked } from "marked";

/** Build AI-generated tags display */
const buildAITags = (item: JobsEtlType): string => {
  if (!item.tag || typeof item.tag === "string") {
    return "";
  }

  const tags = (item.tag as string[]).map((t) =>
    `<span class="tag tag-success">${t}</span>`
  ).join("");

  return `<div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">${tags}</div>`;
};

/** Build keywords display with scoring */
const buildKeywords = (item: JobsEtlType): string => {
  const keywords = item.jobKeywordScore && item.jobKeywordScore.length > 0
    ? item.jobKeywordScore
    : item.jobKeywords;

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return "";
  }

  const topKeywords = keywords.slice(0, 20);
  const isScore = item.jobKeywordScore && item.jobKeywordScore.length > 0;

  const keywordTags = topKeywords.map(([keyword, value]) => {
    let tagClass = "";
    if (isScore) {
      if (value >= 0.5) tagClass = "tag-danger";
      else if (value >= 0.3) tagClass = "tag-warning";
      else if (value >= 0.15) tagClass = "tag-success";
    } else {
      if (value >= 10) tagClass = "tag-danger";
      else if (value >= 7) tagClass = "tag-warning";
      else if (value >= 5) tagClass = "tag-success";
    }

    const displayValue = isScore ? value.toFixed(2) : value;

    return `
      <span class="tag ${tagClass}">
        ${keyword}
        <span class="badge">${displayValue}</span>
      </span>
    `;
  }).join("");

  return `
    <div style="margin-top: var(--space-sm);">
      <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">
        ${keywordTags}
      </div>
    </div>
  `;
};

/** Parse markdown to HTML */
const parseMarkdown = (text: string): string => {
  if (!text) return "";
  try {
    return marked.parse(text, { async: false }) as string;
  } catch {
    return text;
  }
};

/** Build saved job controls section (priority, status, tags, review) */
const buildSavedJobControls = (jobId: string, savedJob: JobsSaveType): string => {
  // Parse user tags
  let userTags: string[] = [];
  if (typeof savedJob.userTags === "string") {
    try {
      userTags = JSON.parse(savedJob.userTags);
    } catch {
      userTags = [];
    }
  } else if (Array.isArray(savedJob.userTags)) {
    userTags = savedJob.userTags;
  }

  // Status options
  const statusOptions = ["saved", "applied", "interview", "rejected", "offer"];
  const statusActive = savedJob.userStatus || "saved";
  const statusSelect = statusOptions.map((status) => 
    `<option value="${status}" ${statusActive === status ? 'selected' : ''}>${status}</option>`
  ).join("");

  // Priority options
  const priorityOptions = ["low", "medium", "high"];
  const priorityActive = savedJob.userPriority || "medium";
  const prioritySelect = priorityOptions.map((priority) =>
    `<option value="${priority}" ${priorityActive === priority ? 'selected' : ''}>${priority}</option>`
  ).join("");

  // User review - parse markdown
  const userReview = savedJob.userReview || "";
  const userReviewHtml = parseMarkdown(userReview);

  return `
    <details open style="margin-top: var(--space-md); padding: var(--space-md); background: var(--color-gray-50); border-radius: var(--radius-md);">
      <summary style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-success); cursor: pointer; display: flex; align-items: center; gap: var(--space-xs);">
        <i class="fa fa-bookmark"></i> Saved Job Controls
      </summary>
      
      <div style="margin-top: var(--space-md);">
        <!-- Priority and Status -->
        <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md); flex-wrap: wrap;">
          <span style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-gray-600);">Priority:</span>
          <select 
            class="form-control form-control-sm"
            data-action="updateJobPriority"
            data-job-id="${jobId}"
            onchange="handleMenuAction(this)"
            style="width: auto;">
            ${prioritySelect}
          </select>
          
          <span style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-gray-600);">Status:</span>
          <select 
            class="form-control form-control-sm"
            data-action="updateJobStatus"
            data-job-id="${jobId}"
            onchange="handleMenuAction(this)"
            style="width: auto;">
            ${statusSelect}
          </select>
        </div>

        <!-- User Tags -->
        <div style="margin-bottom: var(--space-md);">
          <div style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-gray-600); margin-bottom: var(--space-xs);">
            🏷️ Tags
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs); align-items: center; margin-bottom: var(--space-xs);">
            ${userTags.length > 0 ? userTags.map((tag) => `
              <span class="tag tag-info" style="padding: 4px 8px;">
                ${tag}
                <i class="fa fa-times" 
                   data-action="removeJobTag" 
                   data-job-id="${jobId}" 
                   data-tag="${tag}"
                   onclick="handleMenuAction(this)"
                   style="cursor: pointer; margin-left: 4px;"></i>
              </span>
            `).join("") : '<span style="font-size: var(--font-size-xs); color: var(--color-gray-400);">No tags</span>'}
          </div>
          <div style="display: flex; gap: var(--space-xs);">
            <input type="text" 
                   class="form-control form-control-xs" 
                   id="tag-input-${jobId}"
                   placeholder="Add tag..."
                   style="width: 150px;"
                   onkeypress="if(event.key === 'Enter') { 
                     const input = document.getElementById('tag-input-${jobId}');
                     if(input.value.trim()) {
                       handleMenuAction({ 
                         dataset: { action: 'addJobTag', jobId: '${jobId}', tag: input.value.trim() },
                         value: input.value.trim() 
                       });
                       input.value = '';
                     }
                   }">
            <button class="btn btn-ghost btn-xs"
                    data-action="addJobTag"
                    data-job-id="${jobId}"
                    onclick="const input = document.getElementById('tag-input-${jobId}'); if(input.value.trim()) { handleMenuAction(this, input.value); input.value = ''; }">
              <i class="fa fa-tag"></i> Tag
            </button>
          </div>
        </div>

        <!-- User Review -->
        <div>
          <div style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-gray-600); margin-bottom: var(--space-xs);">
            📝 Review Notes
          </div>
          <!-- Display mode -->
          <div id="review-display-${jobId}" style="margin-bottom: var(--space-xs);">
            ${userReview ? `
              <div style="font-size: var(--font-size-xs); color: var(--color-gray-500); background: var(--color-white); padding: var(--space-sm); border-radius: var(--radius-sm); border: 1px solid var(--color-gray-200);" class="review-markdown">${userReviewHtml}</div>
            ` : `
              <span style="font-size: var(--font-size-xs); color: var(--color-gray-400);">No review notes yet. Click Edit to add one.</span>
            `}
          </div>
          <!-- Edit mode -->
          <textarea 
            class="form-control form-control-xs" 
            id="review-text-input-${jobId}"
            placeholder="Add your review notes... (Markdown supported)"
            rows="1"
            style="width: 100%; margin-bottom: var(--space-xs); resize: none; display: none; padding: var(--space-sm); field-sizing: content; min-height: 60px;"
            oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px';">${userReview || ''}</textarea>
          <div>
            <button class="btn btn-ghost btn-xs"
                    id="edit-review-btn-${jobId}"
                    onclick="document.getElementById('edit-review-btn-${jobId}').style.display='none'; document.getElementById('save-review-btn-${jobId}').style.display='inline-block'; document.getElementById('review-display-${jobId}').style.display='none'; document.getElementById('review-text-input-${jobId}').style.display='block';">
              <i class="fa fa-edit"></i> Edit
            </button>
            <button class="btn btn-ghost btn-xs"
                    id="save-review-btn-${jobId}"
                    data-action="saveJobReview"
                    data-job-id="${jobId}"
                    style="display: none;"
                    onclick="const textarea = document.getElementById('review-text-input-${jobId}'); document.getElementById('edit-review-btn-${jobId}').style.display='inline-block'; document.getElementById('save-review-btn-${jobId}').style.display='none'; document.getElementById('review-display-${jobId}').style.display='block'; document.getElementById('review-text-input-${jobId}').style.display='none'; if(textarea.value.trim()) { handleMenuAction(this, textarea.value); }">
              <i class="fa fa-save"></i> Save
            </button>
          </div>
        </div>
      </div>
    </details>
  `;
};

/** Build unsaved state section - prompt to save */
const buildUnsavedPrompt = (jobId: string): string => {
  return `
    <details open style="margin-top: var(--space-md); padding: var(--space-md); background: var(--color-gray-50); border-radius: var(--radius-md);">
      <summary style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-accent); cursor: pointer; display: flex; align-items: center; gap: var(--space-xs);">
        <i class="fa fa-bookmark-o"></i> Save This Job
      </summary>
      <div style="margin-top: var(--space-md); text-align: center;">
        <button class="btn btn-outline save-btn"
                data-action="saveJob"
                data-job-id="${jobId}"
                onclick="handleMenuAction(this)">
          <i class="fa fa-bookmark"></i> Save Job
        </button>
      </div>
    </details>
  `;
};

/** Main job card component */
export const itemDiv = (item: JobsEtlType, savedJob?: JobsSaveType | null): string => {
  let insideText = item.jobText;
  const isSaved = !!savedJob;

  if (item.jobHtml) {
    const html: string = typeof item.jobHtml === "string"
      ? item.jobHtml
      : String(item.jobHtml);
    const matches = [...html.matchAll(/<section>(.*)<\/section>/gs)];
    if (matches.length > 0) {
      insideText = matches.map((match) => match[1]).join("");
    } else {
      insideText = html;
    }

    insideText = insideText
      .replaceAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, "")
      .replaceAll(/<button\b[^>]*>[\s\S]*?<\/button>/g, "")
      .replaceAll(/<img\b[^>]*>[\s\S]*?<\/img>/g, "");
  }

  // Build the job description section content
  const jobDescriptionContent = `
    <div style="font-size: var(--font-size-sm); line-height: 1.7; color: var(--color-gray-700); margin-top: var(--space-sm);">
      ${insideText}
    </div>
  `;


  return `
    <article class="card">
      <div class="card-header">
        <div>
          <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-xs);">
            <a href="${item.link}" target="_blank" class="btn btn-primary btn-sm">
              <i class="fa fa-external-link"></i>
            </a>
            <h3 style="font-size: var(--font-size-lg); font-weight: 600;">${item.title}</h3>
          </div>
          <div style="font-size: var(--font-size-sm); color: var(--color-gray-500);">
            <span style="font-weight: 500;">${item.scraper}</span>
            <span style="margin: 0 var(--space-xs);">•</span>
            <a href="${item.entrepriseLinks}" target="_blank" style="color: var(--color-accent);">
              ${item.company || "Unknown"}
            </a>
            <span style="margin: 0 var(--space-xs);">•</span>
            <span>${item.contract}</span>
            <span style="margin: 0 var(--space-xs);">•</span>
            <span style="color: var(--color-gray-400);">${item.dateClean}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: var(--space-xs);">
          <button class="btn btn-ghost btn-sm" onclick="this.closest('.card').style.display='none'">
            <i class="fa fa-times"></i>
          </button>
        </div>
      </div>

      ${item.tag && typeof item.tag !== "string" ? `
        <div style="margin-bottom: var(--space-md); padding: var(--space-md); background: var(--color-gray-50); border-radius: var(--radius-md);">
          <div style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-gray-600); margin-bottom: var(--space-sm);">
            🤖 AI Tags
          </div>
          ${buildAITags(item)}
        </div>
      ` : ''}

      <details open style="margin-top: var(--space-md); padding: var(--space-md); background: var(--color-gray-50); border-radius: var(--radius-md);">
        <summary style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-gray-600); cursor: pointer;">
          🔑 ${item.jobKeywordScore && item.jobKeywordScore.length > 0 ? 'Top Keywords (TF-IDF)' : 'Top Keywords'}
        </summary>
        ${buildKeywords(item)}
      </details>

      <details style="margin-top: var(--space-md); padding: var(--space-md); background: var(--color-gray-50); border-radius: var(--radius-md);">
        <summary style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-gray-600); cursor: pointer;">
          📝 Job Description
        </summary>
        ${jobDescriptionContent}
      </details>

      ${isSaved && savedJob ? buildSavedJobControls(item.id, savedJob) : buildUnsavedPrompt(item.id)}
    </article>
  `;
};
