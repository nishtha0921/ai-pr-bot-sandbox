#!/usr/bin/env node

/**
 * Test ChromaDB Connection
 */

const VectorStore = require('./src/rag/vector-store');

async function testConnection() {
  console.log('Testing ChromaDB connection...\n');
  
  try {
    const vectorStore = new VectorStore({
      chromaUrl: 'http://localhost:8002'
    });
    
    console.log('✓ VectorStore created');
    
    const initialized = await vectorStore.initialize();
    
    if (initialized) {
      console.log('✓ VectorStore initialized successfully');
      
      const stats = await vectorStore.getStats();
      console.log(`✓ Collection: ${stats.collection}`);
      console.log(`✓ Documents: ${stats.documentCount}`);
      
      console.log('\n🎉 ChromaDB is working correctly!');
      process.exit(0);
    } else {
      console.error('✗ Failed to initialize VectorStore');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('\nMake sure ChromaDB is running:');
    console.error('  docker run -d -p 8002:8000 chromadb/chroma');
    process.exit(1);
  }
}

testConnection();

