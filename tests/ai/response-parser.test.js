/**
 * Tests for AI response parser
 */

const { parseJSON, validateComment, validateComments, parseReviewResponse } = require('../../src/ai/response-parser');

describe('Response Parser', () => {
  test('should parse valid JSON', () => {
    const json = '{"comments": []}';
    const result = parseJSON(json);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ comments: [] });
  });

  test('should handle invalid JSON', () => {
    const json = 'not valid json';
    const result = parseJSON(json);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should validate valid comment', () => {
    const comment = {
      path: 'src/file.js',
      line: 10,
      body: 'Test comment',
    };
    const isValid = validateComment(comment);
    expect(isValid).toBe(true);
  });

  test('should reject comment without path', () => {
    const comment = {
      line: 10,
      body: 'Test comment',
    };
    const isValid = validateComment(comment);
    expect(isValid).toBe(false);
  });

  test('should reject comment without line', () => {
    const comment = {
      path: 'src/file.js',
      body: 'Test comment',
    };
    const isValid = validateComment(comment);
    expect(isValid).toBe(false);
  });

  test('should reject comment with invalid line number', () => {
    const comment = {
      path: 'src/file.js',
      line: -1,
      body: 'Test comment',
    };
    const isValid = validateComment(comment);
    expect(isValid).toBe(false);
  });

  test('should validate comments array', () => {
    const comments = [
      { path: 'src/file.js', line: 10, body: 'Valid' },
      { path: 'src/file.js', line: -1, body: 'Invalid line' },
      { line: 20, body: 'Missing path' },
    ];
    const valid = validateComments(comments);
    expect(valid.length).toBe(1);
  });

  test('should parse review response', () => {
    const response = JSON.stringify({
      comments: [
        { path: 'src/file.js', line: 10, body: 'Test' },
      ],
    });
    const result = parseReviewResponse(response);
    expect(result.comments.length).toBe(1);
  });

  test('should handle malformed review response', () => {
    const response = 'not json';
    const result = parseReviewResponse(response);
    expect(result.comments.length).toBe(0);
    expect(result.parseError).toBeDefined();
  });
});




