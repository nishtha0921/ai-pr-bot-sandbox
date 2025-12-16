/**
 * Logger Utility
 * Provides consistent logging across the application
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

class Logger {
  constructor() {
    this.level = LOG_LEVELS.INFO;
    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      green: '\x1b[32m',
      blue: '\x1b[34m',
      gray: '\x1b[90m',
    };
  }

  /**
   * Set log level
   */
  setLevel(level) {
    if (typeof level === 'string') {
      this.level = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    } else {
      this.level = level;
    }
  }

  /**
   * Format timestamp
   */
  timestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message
   */
  format(level, message, color) {
    const ts = this.timestamp();
    const colorCode = this.colors[color] || '';
    const reset = this.colors.reset;
    return `${this.colors.gray}[${ts}]${reset} ${colorCode}[${level}]${reset} ${message}`;
  }

  /**
   * Log error message
   */
  error(message, error) {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error(this.format('ERROR', message, 'red'));
      if (error) {
        console.error(error);
      }
    }
  }

  /**
   * Log warning message
   */
  warn(message) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(this.format('WARN', message, 'yellow'));
    }
  }

  /**
   * Log info message
   */
  info(message) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.log(this.format('INFO', message, 'green'));
    }
  }

  /**
   * Log debug message
   */
  debug(message, data) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.log(this.format('DEBUG', message, 'blue'));
      if (data) {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }

  /**
   * Log section header
   */
  section(title) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.log('\n' + this.colors.green + '='.repeat(50) + this.colors.reset);
      console.log(this.colors.green + title + this.colors.reset);
      console.log(this.colors.green + '='.repeat(50) + this.colors.reset + '\n');
    }
  }

  /**
   * Log success message
   */
  success(message) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.log(this.colors.green + '✓ ' + message + this.colors.reset);
    }
  }
}

// Export singleton instance
module.exports = new Logger();




