# Tests

This directory contains unit tests for the AI PR Review Bot.

## Running Tests

```bash
# Install dev dependencies first
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Test Structure

- `tests/utils/` - Tests for utility modules (config, logger, errors)
- `tests/github/` - Tests for GitHub API integration
- `tests/ai/` - Tests for AI provider integration
- `tests/diff/` - Tests for diff parsing and position mapping
- `tests/review/` - Tests for review orchestration

## Writing Tests

Tests use Jest as the testing framework. Each test file follows this pattern:

```javascript
const module = require('../../src/path/to/module');

describe('Module Name', () => {
  test('should do something', () => {
    const result = module.doSomething();
    expect(result).toBe(expected);
  });
});
```

## Mocking

When testing modules that depend on external services (GitHub API, Ollama), use Jest mocks:

```javascript
jest.mock('../../src/github/client');
```

## Coverage

Aim for at least 80% code coverage. Run coverage reports with:

```bash
npm test -- --coverage
```


