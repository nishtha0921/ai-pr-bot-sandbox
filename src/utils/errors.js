/**
 * Custom Error Types
 * Define specific error types for better error handling
 */

class BaseError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class GitHubAPIError extends BaseError {
  constructor(message, statusCode, details = {}) {
    super(message, details);
    this.statusCode = statusCode;
  }
}

class AIProviderError extends BaseError {
  constructor(message, provider, details = {}) {
    super(message, details);
    this.provider = provider;
  }
}

class DiffParsingError extends BaseError {
  constructor(message, details = {}) {
    super(message, details);
  }
}

class ConfigurationError extends BaseError {
  constructor(message, details = {}) {
    super(message, details);
  }
}

class ReviewError extends BaseError {
  constructor(message, details = {}) {
    super(message, details);
  }
}

module.exports = {
  BaseError,
  GitHubAPIError,
  AIProviderError,
  DiffParsingError,
  ConfigurationError,
  ReviewError,
};




