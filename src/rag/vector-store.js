/**
 * Vector Store Manager
 * Handles embedding storage and similarity search using ChromaDB
 */

const { ChromaClient } = require('chromadb');
const logger = require('../utils/logger');

class VectorStore {
  constructor(config = {}) {
    this.client = new ChromaClient({
      path: config.chromaUrl || 'http://localhost:8002',
      // Use default fetch which should handle v2 API
    });
    this.collectionName = config.collectionName || 'pr-reviews';
    this.collection = null;
  }

  /**
   * Initialize the vector store
   */
  async initialize() {
    try {
      // Get or create collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { description: 'PR review context and history' }
      });
      logger.info(`Vector store initialized: ${this.collectionName}`);
      return true;
    } catch (error) {
      logger.error('Failed to initialize vector store', error);
      return false;
    }
  }

  /**
   * Add documents to vector store
   * @param {Array} documents - Array of {id, text, metadata}
   */
  async addDocuments(documents) {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      const ids = documents.map(doc => doc.id);
      const texts = documents.map(doc => doc.text);
      const metadatas = documents.map(doc => doc.metadata || {});

      await this.collection.add({
        ids,
        documents: texts,
        metadatas
      });

      logger.info(`Added ${documents.length} documents to vector store`);
      return true;
    } catch (error) {
      logger.error('Failed to add documents', error);
      return false;
    }
  }

  /**
   * Search for similar documents
   * @param {string} query - Search query
   * @param {number} k - Number of results to return
   * @param {Object} filter - Metadata filter
   */
  async search(query, k = 5, filter = null) {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: k,
        where: filter
      });

      // Format results
      const documents = [];
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          documents.push({
            id: results.ids[0][i],
            text: results.documents[0][i],
            metadata: results.metadatas[0][i],
            distance: results.distances[0][i]
          });
        }
      }

      logger.debug(`Found ${documents.length} similar documents`);
      return documents;
    } catch (error) {
      logger.error('Search failed', error);
      return [];
    }
  }

  /**
   * Delete documents by filter
   */
  async deleteDocuments(filter) {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      await this.collection.delete({
        where: filter
      });
      logger.info('Documents deleted successfully');
      return true;
    } catch (error) {
      logger.error('Failed to delete documents', error);
      return false;
    }
  }

  /**
   * Get collection stats
   */
  async getStats() {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      const count = await this.collection.count();
      return {
        collection: this.collectionName,
        documentCount: count
      };
    } catch (error) {
      logger.error('Failed to get stats', error);
      return null;
    }
  }
}

module.exports = VectorStore;

