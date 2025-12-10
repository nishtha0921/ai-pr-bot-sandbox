const express = require("express");
// Node.js 18+ has built-in fetch, no need to import

const app = express();
app.use(express.json());

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const MODEL_NAME = process.env.OLLAMA_MODEL || "llama3.1";

// Root route to verify server is running
app.get("/", (req, res) => {
  res.json({ 
    status: "Server is running", 
    endpoints: {
      "POST /review": "Submit a diff for code review"
    }
  });
});

app.post("/review", async (req, res) => {
  try {
    const { diff = "", pr, files, commits, existingComments } = req.body;

    const prompt = `You are a code reviewer. Analyze this git diff and provide feedback ONLY on changed lines.

CRITICAL RULES:
1. Look for lines starting with "+" in the diff - these are NEW/CHANGED lines
2. The "line" number MUST be from the @@ hunk header (the number after the + sign)
3. Only comment on lines that were actually changed (start with +)
4. Return ONLY valid JSON, no other text

Pull Request: ${pr?.title || "N/A"}

Diff to review:
${diff.substring(0, 4000)}

Example of reading line numbers from diff:
@@ -10,5 +12,8 @@ means new code starts at line 12
+const x = 1;  <- this is line 12
+const y = 2;  <- this is line 13
+const z = 3;  <- this is line 14

Return JSON ONLY:
{
  "comments": [
    {
      "path": "src/file.js",
      "line": 13,
      "body": "Consider using const for y"
    }
  ]
}

Find 2-5 issues in the changed lines. If no issues, return empty array.`.trim();

const ollamaResp = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_NAME,
      prompt,
      stream: false,
      format: "json",  // Tell Ollama to return JSON format
    }),
  });

  if (!ollamaResp.ok) {
    const text = await ollamaResp.text();
    console.error("Ollama error:", ollamaResp.status, text);
    return res
      .status(500)
      .json({ error: "Ollama error", details: text });
  }

  const data = await ollamaResp.json();
  const review = data.response || "";

  console.log("\n=== OLLAMA RAW RESPONSE ===");
  console.log(review.substring(0, 1000));

  let comments = [];
try {
  const parsed = JSON.parse(review);
  comments = parsed.comments || [];
  console.log(`\n=== PARSED ${comments.length} COMMENTS ===`);
  console.log(JSON.stringify(comments, null, 2));
} catch (err) {
  console.error("Failed to parse Ollama response as JSON:", err);
  console.error("Response was:", review.substring(0, 500));
  comments = [];
}

res.json({ comments });
} catch (err) {
  console.error(err);
  res.status(500).json({ error: "Internal error" });
}
});

const PORT = process.env.PORT || 8100;
app.listen(PORT, () => {
console.log(`Review server listening on port ${PORT}`);
});