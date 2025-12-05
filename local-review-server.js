const express = require("express");
// Node.js 18+ has built-in fetch, no need to import

const app = express();
app.use(express.json());

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL_NAME = "llama3"; // or any model you pulled with Ollama

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

    const prompt = `You are a thorough code reviewer. Analyze this diff and provide feedback on code quality, style, potential improvements, and any issues.

Review the following changes and suggest improvements. Comment on:
- Code style and formatting
- Potential bugs or edge cases
- Performance improvements
- Best practices
- Documentation needs

Pull Request: ${pr?.title || "N/A"}
Files: ${(files || []).map(f => f.filename).join(", ")}

Diff (first 3000 chars):
${diff.substring(0, 3000)}

IMPORTANT: Return ONLY valid JSON with no other text. For each comment, "line" must be the NEW line number from the diff (lines starting with +).

Format:
{
  "comments": [
    {
      "path": "exact/file/path.js",
      "line": 42,
      "body": "Your specific feedback"
    }
  ]
}

If you have suggestions, return them in the JSON format above. Try to find at least 2-3 things to comment on.`.trim();

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