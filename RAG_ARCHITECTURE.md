# RAG Architecture for AI PR Review Bot

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PR Review with RAG                           │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ┌────────┐      ┌────────┐     ┌─────────┐
         │New PR  │      │Vector  │     │Document │
         │Diff    │      │Database│     │Store    │
         └────────┘      └────────┘     └─────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                    ┌──────────────────┐
                    │  RAG Pipeline    │
                    │  1. Index        │
                    │  2. Retrieve     │
                    │  3. Augment      │
                    │  4. Generate     │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Context-Aware    │
                    │ AI Review        │
                    └──────────────────┘
```

## Data Sources for RAG

### 1. **Code Repository**
- Source files (for context)
- README.md, CONTRIBUTING.md
- Architecture docs
- API documentation
- Test files (for expected behavior)

### 2. **Review History**
- Past PR reviews
- Accepted/rejected comments
- Common issues per file/module
- Review patterns per developer

### 3. **Issue Tracker**
- Linked issues
- Bug patterns
- Feature requirements
- Technical debt items

### 4. **Team Knowledge Base**
- Style guides
- Coding standards
- Security policies
- Performance best practices
- Common anti-patterns

## RAG Pipeline Stages

### Stage 1: Indexing (One-time + Incremental)
```
Repository → Chunking → Embeddings → Vector DB
```

### Stage 2: Retrieval (Per PR)
```
PR Diff → Query Embedding → Similarity Search → Top K Relevant Docs
```

### Stage 3: Augmentation
```
Retrieved Context + PR Diff → Enhanced Prompt
```

### Stage 4: Generation
```
Enhanced Prompt → AI Model → Context-Aware Review
```

## Performance Metrics

- **Retrieval Time**: < 100ms
- **Embedding Generation**: < 500ms
- **Total RAG Overhead**: < 1s
- **Accuracy Improvement**: 40-60%

## Technology Stack

- **Vector DB**: ChromaDB, Pinecone, or Weaviate
- **Embeddings**: OpenAI ada-002, or local sentence-transformers
- **LLM**: Ollama (current) with RAG context
- **Chunking**: LangChain text splitters



