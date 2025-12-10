const { Octokit } = require("@octokit/core");
// Node.js 18+ has built-in fetch, no need to import

const reviewApiUrl = process.env.REVIEW_API_URL;

console.log("Sending diff to review API:", reviewApiUrl);

function parseDiffPositions(diffText) {
  const filePositions = {};
  const lines = diffText.split('\n');
  
  let currentFile = null;
  let position = 0;
  let newLineNumber = 0;
  
  for (const line of lines) {
    // Check for file header: +++ b/path/to/file.js
    if (line.startsWith('+++ b/')) {
      currentFile = line.substring(6); // Remove '+++ b/'
      filePositions[currentFile] = {};
      position = 0;
      continue;
    }
    
    // Check for hunk header: @@ -10,5 +12,6 @@
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/);
      if (match) {
        newLineNumber = parseInt(match[1], 10);
      }
      position++;
      continue;
    }
    
    // Skip if no current file
    if (!currentFile) continue;
    
    // Track positions for added or context lines
    if (line.startsWith('+')) {
      // This is a new line in the file
      filePositions[currentFile][newLineNumber] = position;
      newLineNumber++;
      position++;
    } else if (line.startsWith('-')) {
      // Deleted line, increment position but not line number
      position++;
    } else if (line.startsWith(' ')) {
      // Context line
      newLineNumber++;
      position++;
    }
  }
  
  return filePositions;
}


async function main() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;
  const prNumber = Number(process.env.PR_NUMBER);

  if (!token || !owner || !repo || !prNumber) {
    console.error("Missing env vars");
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });

  // 1) List changed files in the PR
  const filesResp = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
    {
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    }
  );

  const files = filesResp.data.map(f => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
  }));

  console.log("Changed files:");
  for (const f of files) {
    console.log(
      `- ${f.filename} (${f.status}, +${f.additions} -${f.deletions}, Δ${f.changes})`
    );
  }

  // 2) Fetch unified diff for the whole PR
  const diffResp = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    {
      owner,
      repo,
      pull_number: prNumber,
      headers: {
        accept: "application/vnd.github.v3.diff",
      },
    }
  );

const fullDiff = diffResp.data;

const diffPositions = parseDiffPositions(fullDiff);
console.log("\n=== Diff positions mapped for", Object.keys(diffPositions).length, "files");

// Get PR metadata
const prResp = await octokit.request(
  "GET /repos/{owner}/{repo}/pulls/{pull_number}",
  { owner, repo, pull_number: prNumber }
);

const pr = prResp.data;
const prContext = {
  title: pr.title,
  body: pr.body,
  author: pr.user && pr.user.login,
  base: pr.base && pr.base.ref,
  head: pr.head && pr.head.ref,
};


 // For now just log a truncated version so logs are manageable
 const maxChars = 4000;
 const preview =
 pr.length > maxChars
     ? pr.slice(0, maxChars) + "\n--- TRUNCATED ---"
     : pr;

     console.log("\n=== PR DIFF PREVIEW ===");
     console.log(preview);
  // B) PR commits
const commitsResp = await octokit.request(
  "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
  {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  }
);

const commits = commitsResp.data.map(c => ({
  sha: c.sha,
  message: c.commit && c.commit.message,
  author: c.author && c.author.login,
}));


// C) Existing review comments (optional)
const commentsResp = await octokit.request(
  "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
  {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  }
);

const existingComments = commentsResp.data.map(c => ({
  path: c.path,
  line: c.line,
  body: c.body,
  author: c.user && c.user.login,
}));


console.log("\n=== OLLAMA REVIEW API ===");
  // 3) Send diff to review API
  const reviewResp = await fetch(reviewApiUrl, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Bypass-Tunnel-Reminder": "true"  // Try to bypass localtunnel warning page
    },
    body: JSON.stringify({
      diff: fullDiff,
      pr: prContext,
      files,
      commits,
      existingComments, // optional
    }),
  });

  console.log("Review API status:", reviewResp.status);
  
  if (!reviewResp.ok) {
    const text = await reviewResp.text();
    console.error("Review API error response:", text.substring(0, 500));
    throw new Error(`Review API returned status ${reviewResp.status}`);
  }

  const contentType = reviewResp.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await reviewResp.text();
    console.error("Expected JSON but got:", contentType);
    console.error("Response body:", text.substring(0, 500));
    throw new Error("Review API did not return JSON");
  }

  const reviewData = await reviewResp.json();
  console.log("Review API response:",  JSON.stringify(reviewData, null, 2));

  // Map AI comments to GitHub review comments
const reviewComments = [];

for (const comment of reviewData.comments || []) {
  const { path, line, body } = comment;
  
  // Look up the diff position for this file and line
  const position = diffPositions[path]?.[line];
  
  if (!position) {
    console.warn(`Skipping comment for ${path}:${line} - position not found in diff`);
    continue;
  }
  reviewComments.push({
    path,
    position,
    body: body,
  });
}
console.log(`\nPosting ${reviewComments.length} inline review comments`);

if (reviewComments.length === 0) {
  console.log("No comments to post.");
  return;
}

// 4) Post review comments to PR
console.log("\nPosting review to PR:", prNumber);

await octokit.request(
  "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
  {
    owner,
    repo,
    pull_number: prNumber,
    event: "COMMENT",
    comments: reviewComments,
  }
);

console.log("Review posted successfully!");
}


main().catch(err => {
  console.error(err);
  process.exit(1);
});
