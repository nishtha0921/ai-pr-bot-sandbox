/**
 * Configuration Management
 * Loads and validates configuration from environment variables
 */

const fs = require('fs');
const path = require('path');

class Config {
  constructor() {
    this.loaded = false;
    this.config = {};
  }

  /**
   * Load configuration from .env.local file
   */
  load(envPath = '.env.local') {
    if (this.loaded) {
      return this.config;
    }

    const fullPath = path.resolve(process.cwd(), envPath);
    
    if (fs.existsSync(fullPath)) {
      const envContent = fs.readFileSync(fullPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim();
          if (key && value) {
            process.env[key.trim()] = value;
          }
        }
      }
    }

    this.config = {
      github: {
        token: process.env.GITHUB_TOKEN,
      },
      ollama: {
        url: process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
        model: process.env.OLLAMA_MODEL || 'llama3.1',
      },
      reviewApi: {
        url: process.env.REVIEW_API_URL || 'http://localhost:8100/review',
      },
      bot: {
        name: process.env.BOT_NAME || 'AI Code Review Bot',
        emoji: process.env.BOT_EMOJI || '🤖',
      },
      server: {
        port: parseInt(process.env.PORT || '8100', 10),
      },
    };

    this.loaded = true;
    return this.config;
  }

  /**
   * Get configuration value by path (e.g., 'github.token')
   */
  get(path) {
    if (!this.loaded) {
      this.load();
    }

    const parts = path.split('.');
    let value = this.config;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }

  /**
   * Validate required configuration
   */
  validate() {
    if (!this.loaded) {
      this.load();
    }

    const errors = [];

    if (!this.config.github.token) {
      errors.push('GITHUB_TOKEN is required');
    }

    if (!this.config.ollama.url) {
      errors.push('OLLAMA_URL is required');
    }

    if (!this.config.ollama.model) {
      errors.push('OLLAMA_MODEL is required');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    return true;
  }

  /**
   * Get all configuration
   */
  getAll() {
    if (!this.loaded) {
      this.load();
    }
    return this.config;
  }
}

// Export singleton instance
module.exports = new Config();




