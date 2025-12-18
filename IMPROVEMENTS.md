# 🚀 Improvements Roadmap

A checklist of improvements to enhance the AI PR Review Bot.

---

## 🎯 High Priority - Better Review Quality

### Prompt Engineering
- [ ] **Add specialized review types** - Create focused prompts for security, performance, best practices, and testing
- [ ] **Add language-specific hints** - JavaScript, Python, Java, Go specific review guidelines
- [ ] **Improve line number accuracy** - Better instructions for AI to extract correct line numbers from diff
- [ ] **Add severity levels** - Categorize comments as critical, warning, or suggestion

### Multi-Pass Review System
- [ ] **Implement multi-pass reviews** - Run separate passes for different concern types:
  - Pass 1: Security vulnerabilities (SQL injection, XSS, auth issues)
  - Pass 2: Logic bugs and edge cases
  - Pass 3: Code style and best practices
  - Pass 4: Consolidate and deduplicate comments
- [ ] **Add comment quality scoring** - Filter low-quality comments before posting

### Smarter Context
- [ ] **Add AST parsing** - Parse code structure to understand function signatures, imports, class hierarchy
- [ ] **Extract function context** - Include full function body when commenting on a specific line
- [ ] **Detect file type** - Auto-detect language and apply appropriate review rules

---

## 🔧 Medium Priority - Technical Improvements

### Simplify Architecture
- [x] **Replace line-mapper.js with GitHub validation** - ✅ Completed!
  - ✅ Deleted `src/diff/line-mapper.js`
  - ✅ Post comments directly to GitHub API
  - ✅ Let GitHub validate line numbers (returns 422 for invalid)
  - ✅ Handle batch failures by falling back to individual posts
  - ✅ Skip invalid comments and log warnings
  - Implementation: `review-poster.js` now tries batch posting first, automatically falls back to individual posts if validation fails
- [x] **Add retry logic** - ✅ Exponential backoff for rate limits and transient failures implemented
- [ ] **Add caching layer** - Cache PR data and embeddings to avoid redundant API calls

### Better Error Handling
- [ ] **Graceful degradation** - Continue review even if some steps fail
- [ ] **Detailed error messages** - Show which comment failed and why
- [ ] **Rate limit handling** - Handle GitHub and Ollama rate limits with exponential backoff

### Performance
- [ ] **Streaming responses** - Stream AI output for large PRs
- [ ] **Parallel processing** - Review multiple files in parallel
- [ ] **Incremental reviews** - Only review new commits since last review

---

## ✨ New Features

### PR Summary
- [ ] **Generate PR summary comment** - Post a summary at the top of the PR:
  ```markdown
  ## 🤖 AI Review Summary
  **Risk Level:** 🟡 Medium
  **Files Reviewed:** 5
  **Issues Found:** 3 (1 critical, 2 suggestions)
  
  ### Key Findings:
  - ⚠️ Potential SQL injection in query.js:45
  - 💡 Consider adding error handling
  ```

### Auto-Fix Suggestions
- [ ] **Generate fix suggestions** - Use GitHub's suggestion block format:
  ```markdown
  ```suggestion
  const result = user?.name ?? 'Unknown';
  ```
  ```
- [ ] **One-click apply** - Users can apply fixes with one click

### Learning & Feedback
- [ ] **Store feedback** - Track which comments were resolved vs dismissed
- [ ] **Learn from feedback** - Use feedback to improve future reviews
- [ ] **Personalize per repo** - Learn each repo's coding style and conventions

### Incremental Reviews
- [ ] **Track last review** - Store timestamp of last bot review
- [ ] **Review only new commits** - Skip already-reviewed code
- [ ] **Re-review on request** - Allow manual trigger for full re-review

---

## 📦 Technology Upgrades

### AI Models
- [ ] **Add OpenAI support** - Support GPT-4 as alternative to Ollama
- [ ] **Add Claude support** - Support Anthropic Claude API
- [ ] **Model selection** - Auto-select best model based on task (security vs style)
- [ ] **Fine-tuned model** - Train on high-quality code reviews

### Vector Store
- [ ] **Upgrade to Pinecone** - Managed vector store for better scalability
- [ ] **Better embeddings** - Use OpenAI embeddings instead of local
- [ ] **Hybrid search** - Combine keyword and semantic search

### GitHub Integration
- [ ] **Convert to GitHub App** - Better than personal tokens:
  - Automatic webhook triggers
  - Per-repo permissions
  - Better rate limits
  - No personal token needed
- [ ] **Webhook support** - Auto-trigger on PR open/update
- [ ] **Status checks** - Report as GitHub check run

---

## 📚 Documentation

- [ ] **Update README.md** - Reflect current architecture
- [ ] **Update ARCHITECTURE.md** - Document new structure
- [ ] **Add API documentation** - Document server endpoints
- [ ] **Add configuration guide** - Document all env variables and options

---

## 🧪 Testing

- [ ] **Add integration tests** - Test full review flow
- [ ] **Add mock AI responses** - Test without hitting Ollama
- [ ] **Add GitHub API mocks** - Test without hitting GitHub
- [ ] **CI/CD pipeline** - Run tests on every PR

---

## 🗑️ Cleanup (Completed ✅)

- [x] Consolidate `reviewer.js` and `reviewer-rag.js`
- [x] Consolidate `ollama.js`, `ollama-rag.js`, and `base.js`
- [x] Remove unused `comment-builder.js`
- [x] Remove unused diff files (`parser.js`, `formatter.js`, `position-mapper.js`)
- [x] Delete `old/` directory
- [x] Delete outdated documentation (11 .md files)
- [x] Delete test files and empty directories
- [x] Remove duplicate scripts (`review-pr.sh`, `RAG_QUICKSTART.sh`)

---

## Priority Matrix

| Priority | Improvement | Impact | Effort |
|----------|-------------|--------|--------|
| 🔴 High | Better prompts | High | Low |
| 🔴 High | Multi-pass reviews | High | Medium |
| 🔴 High | PR summary | High | Low |
| 🟡 Medium | Auto-fix suggestions | High | Medium |
| 🟡 Medium | Remove line-mapper | Medium | Low |
| 🟡 Medium | Learning from feedback | High | High |
| 🟢 Low | GitHub App | Medium | High |
| 🟢 Low | Streaming | Low | Medium |
| 🟢 Low | OpenAI/Claude support | Medium | Medium |

---

## Getting Started

Pick an improvement and check it off as you complete it!

```bash
# Run the bot
npm run review owner/repo 123

# Run tests
npm test

# Start server
npm start
```

