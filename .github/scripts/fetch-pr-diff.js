const { Octokit } = require("@octokit/core");
// Node.js 18+ has built-in fetch, no need to import

const reviewApiUrl = process.env.REVIEW_API_URL;

console.log("Sending diff to review API:", reviewApiUrl);

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

  const diffText = diffResp.data;

  // For now just log a truncated version so logs are manageable
  const maxChars = 4000;
  const preview =
    diffText.length > maxChars
      ? diffText.slice(0, maxChars) + "\n--- TRUNCATED ---"
      : diffText;

  console.log("\n=== PR DIFF PREVIEW ===");
  console.log(preview);


console.log("\n=== OLLAMA REVIEW API ===");
  // 3) Send diff to review API
  const reviewResp = await fetch(reviewApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ diff: preview }),
  });

  const reviewData = await reviewResp.json();
  console.log("Review API response:", reviewData);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
