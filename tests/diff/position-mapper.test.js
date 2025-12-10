/**
 * Tests for position mapper
 */

const { parseDiffPositions, findPosition, mapCommentsToPositions } = require('../../src/diff/position-mapper');

const sampleDiff = `diff --git a/src/file.js b/src/file.js
index 1234567..89abcdef 100644
--- a/src/file.js
+++ b/src/file.js
@@ -10,5 +12,8 @@ function example() {
   const x = 1;
-  const y = 2;
+  const y = 3;
+  const z = 4;
   return x + y;
 }`;

describe('Position Mapper', () => {
  test('should parse diff positions', () => {
    const positions = parseDiffPositions(sampleDiff);
    expect(positions).toBeDefined();
    expect(positions['src/file.js']).toBeDefined();
  });

  test('should find position for line number', () => {
    const positions = parseDiffPositions(sampleDiff);
    const position = findPosition(positions, 'src/file.js', 13);
    expect(position).toBeDefined();
    expect(typeof position).toBe('number');
  });

  test('should return null for invalid file', () => {
    const positions = parseDiffPositions(sampleDiff);
    const position = findPosition(positions, 'invalid/file.js', 10);
    expect(position).toBeNull();
  });

  test('should map comments to positions', () => {
    const positions = parseDiffPositions(sampleDiff);
    const comments = [
      { path: 'src/file.js', line: 13, body: 'Test comment' },
    ];
    const mapped = mapCommentsToPositions(comments, positions);
    expect(mapped.length).toBeGreaterThan(0);
    expect(mapped[0]).toHaveProperty('position');
  });

  test('should skip comments with invalid positions', () => {
    const positions = parseDiffPositions(sampleDiff);
    const comments = [
      { path: 'src/file.js', line: 999, body: 'Invalid line' },
    ];
    const mapped = mapCommentsToPositions(comments, positions);
    expect(mapped.length).toBe(0);
  });
});


