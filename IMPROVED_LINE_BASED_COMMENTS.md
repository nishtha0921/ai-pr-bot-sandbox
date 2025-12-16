# Improved Line-Based PR Comments

## What Changed?

Instead of manually calculating "positions" in the diff, we now use **GitHub's line-based API** which is simpler and more reliable.

---

## Old Approach (Position-based) ❌

### How it worked:
1. Parse entire diff text
2. Track position counter through diff
3. Map line numbers → positions
4. Post comments with `position`

### Problems:
- Complex position calculation
- Easy to get positions wrong
- Difficult to debug
- AI must output line numbers, then we convert

### Code:
```javascript
// Had to parse diff and calculate positions
const diffPositions = parseDiffPositions(prData.diff);
const comments = mapCommentsToPositions(aiComments, diffPositions);

// Post with position
{
  path: "src/file.js",
  position: 5,  // ← Fragile!
  body: "Comment"
}
```

---

## New Approach (Line-based) ✅

### How it works:
1. AI outputs line numbers directly
2. Validate line is in diff patch
3. Post comments with `line` + `side`

### Benefits:
- ✅ **Simpler:** No position calculation
- ✅ **More reliable:** GitHub handles the mapping
- ✅ **Better for AI:** Direct line numbers
- ✅ **Easier to debug:** Line numbers are intuitive

### Code:
```javascript
// Just validate and map directly
const comments = mapCommentsToLines(aiComments, prData.files, commitId);

// Post with line number
{
  path: "src/file.js",
  line: 42,        // ← Direct line number!
  side: "RIGHT",   // RIGHT = new file
  commit_id: "abc123",
  body: "Comment"
}
```

---

## API Comparison

### Position-Based (Old)
```javascript
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
{
  "event": "COMMENT",
  "comments": [
    {
      "path": "src/file.js",
      "position": 5,      // ← Must calculate
      "body": "Fix this"
    }
  ]
}
```

### Line-Based (New)
```javascript
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
{
  "event": "COMMENT",
  "comments": [
    {
      "path": "src/file.js",
      "line": 42,           // ← Direct!
      "side": "RIGHT",      // RIGHT = after changes
      "commit_id": "abc123",
      "body": "Fix this"
    }
  ]
}
```

---

## Usage

### Basic Usage
```javascript
const { mapCommentsToLines } = require('./src/diff/line-mapper');

// AI returns comments with line numbers
const aiComments = [
  { path: 'src/api.js', line: 15, body: 'Add validation' },
  { path: 'src/api.js', line: 42, body: 'Handle errors' }
];

// Map to GitHub format (validates lines are in diff)
const reviewComments = mapCommentsToLines(
  aiComments,
  prData.files,      // Files from GitHub API (includes patches)
  prData.commitId    // Latest commit SHA
);

// Post to GitHub
await reviewPoster.postInlineComments(owner, repo, prNumber, reviewComments);
```

### Hybrid Approach (Best of Both)
```javascript
const { mapCommentsHybrid } = require('./src/diff/line-mapper');

// Try line-based first, fall back to position-based
const reviewComments = mapCommentsHybrid(
  aiComments,
  prData.files,
  diffPositions,  // Fallback
  commitId
);
```

---

## Migration Path

### Option 1: Full Migration (Recommended)
Replace `mapCommentsToPositions` with `mapCommentsToLines` everywhere.

### Option 2: Hybrid Approach (Safest)
Use `mapCommentsHybrid` which tries line-based first, falls back to position-based.

### Option 3: Gradual
Keep both, add flag to choose:
```javascript
if (useLineBased) {
  comments = mapCommentsToLines(...);
} else {
  comments = mapCommentsToPositions(...);
}
```

---

## Validation

The new approach validates that line numbers are actually in the diff:

```javascript
function isLineInDiff(lineNumber, patch) {
  // Parses patch hunks
  // Returns true if line is in changed code
  // Returns false if line is outside diff ranges
}
```

This prevents posting comments on lines that weren't changed!

---

## Side Values

```javascript
side: "RIGHT"  // Comment on new file (after changes)
side: "LEFT"   // Comment on old file (before changes)
```

For PR reviews, you almost always want `"RIGHT"` (the new code).

---

## Benefits for RAG

With line-based comments:
- ✅ AI can reference line numbers from retrieved context
- ✅ Can point to specific lines in documentation
- ✅ More accurate cross-referencing
- ✅ Easier to explain "see line 42 in auth.js"

---

## Example Output

### AI generates:
```json
{
  "path": "src/api/users.js",
  "line": 15,
  "body": "Add input validation using Joi as per CONTRIBUTING.md line 42"
}
```

### We map to:
```json
{
  "path": "src/api/users.js",
  "line": 15,
  "side": "RIGHT",
  "commit_id": "abc123def",
  "body": "Add input validation using Joi as per CONTRIBUTING.md line 42"
}
```

### GitHub displays:
```
📍 src/api/users.js:15
💬 Add input validation using Joi as per CONTRIBUTING.md line 42
```

Perfect alignment! 🎯

---

## Testing

```bash
# Test line mapper
node -e "
const { mapCommentsToLines, isLineInDiff } = require('./src/diff/line-mapper');

const comments = [
  { path: 'test.js', line: 5, body: 'Test' }
];

const files = [
  {
    filename: 'test.js',
    patch: '@@ -1,3 +1,4 @@\n context\n+new line\n context'
  }
];

console.log(mapCommentsToLines(comments, files, 'abc123'));
"
```

---

## Conclusion

**Line-based comments are:**
- ✅ Simpler
- ✅ More reliable
- ✅ Easier to debug
- ✅ Better for AI
- ✅ Recommended by GitHub

**Switch to line-based approach for better PR reviews!** 🚀



