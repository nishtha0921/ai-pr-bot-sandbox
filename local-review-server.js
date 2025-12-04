const express = require("express");
const fetch = require("node-fetch");

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
    const diff = req.body.diff || "";

    const prompt = `You are a senior software engineer doing a code review.

Given this unified diff, respond in markdown with:

Summary
Briefly summarize the main changes.

Potential Issues
List any possible bugs, risky changes, missing tests, or code smells.

Suggestions
Suggest improvements in clarity, structure, tests, or performance.

Diff:
${diff}
`.trim();
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

  res.json({ review_markdown: review });
} catch (err) {
  console.error(err);
  res.status(500).json({ error: "Internal error" });
}
});

const PORT = process.env.PORT || 8100;
app.listen(PORT, () => {
console.log(`Review server listening on port ${PORT}`);
});