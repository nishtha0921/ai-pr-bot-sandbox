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

    const prompt = `
You are a senior engineer reviewing a GitHub pull request.

Pull request context:
- Title: ${pr?.title || "N/A"}
- Description: ${pr?.body || "N/A"}
- Author: ${pr?.author || "N/A"}
- Branches: ${pr?.head || "?"} -> ${pr?.base || "?"}

Changed files (summary):
${(files || []).map(f => `- ${f.filename} (+${f.additions} -${f.deletions})`).join("\n")}

Here is the unified diff:
${diff}

Your task: Analyze the diff and identify lines with potential issues, bugs, code smells, or improvements.

Respond ONLY with valid JSON in this exact format:
{
  "comments": [
    {
      "path": "path/to/file.js",
      "line": 42,
      "body": "Your specific feedback for this line"
    }
  ]
}

Your task: Analyze the diff and identify lines with potential issues, bugs, code smells, or improvements.

Respond ONLY with valid JSON in this exact format:
{
  "comments": [
    {
      "path": "path/to/file.js",
      "line": 42,
      "body": "Your specific feedback for this line"
    }
  ]
}`.trim();

const ollamaResp = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_NAME,
      prompt,
      stream: false,
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

  let comments = [];
try {
  const parsed = JSON.parse(review);
  comments = parsed.comments || [];
} catch (err) {
  console.error("Failed to parse Ollama response as JSON:", err);
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