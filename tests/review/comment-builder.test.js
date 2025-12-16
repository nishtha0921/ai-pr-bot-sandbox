/**
 * Tests for comment builder
 */

const commentBuilder = require('../../src/review/comment-builder');

describe('Comment Builder', () => {
  test('should build inline comment', () => {
    const comment = commentBuilder.buildInlineComment(
      'src/file.js',
      10,
      'Test comment',
      false // no signature
    );
    expect(comment).toHaveProperty('path', 'src/file.js');
    expect(comment).toHaveProperty('position', 10);
    expect(comment).toHaveProperty('body', 'Test comment');
  });

  test('should add bot signature to inline comment', () => {
    const comment = commentBuilder.buildInlineComment(
      'src/file.js',
      10,
      'Test comment',
      true // with signature
    );
    expect(comment.body).toContain('Test comment');
    expect(comment.body).toContain('---');
  });

  test('should build summary comment', () => {
    const summary = commentBuilder.buildSummaryComment(
      { comments: [{ path: 'test.js', line: 1, body: 'Test' }] },
      { filesChanged: 2, additions: 10, deletions: 5 }
    );
    expect(summary).toContain('Code Review Summary');
    expect(summary).toContain('2 files');
    expect(summary).toContain('1 inline comment');
  });

  test('should format comment body with severity', () => {
    const formatted = commentBuilder.formatCommentBody(
      'Memory leak detected',
      'Use proper cleanup in useEffect',
      'error'
    );
    expect(formatted).toContain('🔴');
    expect(formatted).toContain('Memory leak detected');
    expect(formatted).toContain('Suggestion:');
    expect(formatted).toContain('Use proper cleanup in useEffect');
  });

  test('should build approval comment', () => {
    const approval = commentBuilder.buildApprovalComment();
    expect(approval).toContain('✅');
  });

  test('should build request changes comment', () => {
    const request = commentBuilder.buildRequestChangesComment(3);
    expect(request).toContain('3 issues');
  });
});




