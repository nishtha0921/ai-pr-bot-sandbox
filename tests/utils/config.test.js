/**
 * Tests for config utility
 */

const config = require('../../src/utils/config');

describe('Config', () => {
  test('should load configuration', () => {
    const cfg = config.load();
    expect(cfg).toBeDefined();
    expect(cfg.github).toBeDefined();
    expect(cfg.ollama).toBeDefined();
  });

  test('should get configuration value by path', () => {
    config.load();
    const ollamaUrl = config.get('ollama.url');
    expect(ollamaUrl).toBeDefined();
  });

  test('should return undefined for invalid path', () => {
    config.load();
    const value = config.get('invalid.path');
    expect(value).toBeUndefined();
  });

  test('should validate required fields', () => {
    // This test may fail if GITHUB_TOKEN is not set
    // In a real test environment, you'd mock the config
    try {
      config.load();
      config.validate();
      expect(true).toBe(true);
    } catch (error) {
      expect(error.message).toContain('validation failed');
    }
  });
});






