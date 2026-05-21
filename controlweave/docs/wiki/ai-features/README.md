# AI-Powered Features

> 📦 **Tier**: Varies by feature

## Overview

ControlWeave includes advanced AI-powered features for predictive analytics, risk scoring, and automated compliance analysis. These features leverage machine learning to help you stay ahead of compliance risks.

## Available Features

### Predictive Risk Scoring (Phase 6)
> 📦 **Tier**: ❌ Free | ❌ Starter | ✅ Professional | ✅ Enterprise

Automated risk assessment with 0-100 scoring algorithm using multi-factor weighted analysis.

**Features:**
- Controls compliance (40% weight)
- Vulnerabilities (25% weight)
- Evidence quality (20% weight)
- Assessment results (15% weight)
- Trend analysis and A-F grading
- 30/60/90-day predictions

**API Endpoints:**
```bash
GET /api/v1/phase6/risk-score/:organizationId
GET /api/v1/phase6/risk-trends/:organizationId
POST /api/v1/phase6/risk-forecast/:organizationId
```

[View Full Documentation](../../../PHASE_6_AI_POWERED_ANALYSIS.md)

### Regulatory Impact Analysis (Phase 6)
> 📦 **Tier**: ❌ Free | ❌ Starter | ✅ Professional | ✅ Enterprise

AI-powered analysis of regulatory changes with impact scoring and recommendations.

**Features:**
- Impact scoring (0-100)
- Effort estimation (person-hours)
- Affected systems identification
- Timeline analysis
- Actionable recommendations

**API Endpoints:**
```bash
POST /api/v1/phase6/regulatory-impact/analyze
GET /api/v1/phase6/regulatory-impact/:analysisId
```

### Smart Remediation Plans (Phase 6)
> 📦 **Tier**: ❌ Free | ❌ Starter | ✅ Professional | ✅ Enterprise

Enhanced AI-generated remediation plans with priority scoring and cost-benefit analysis.

**Features:**
- Priority scoring (0-100)
- Timeline estimation
- Cost-benefit analysis  
- Step-by-step action plans
- Implementation tracking

**API Endpoints:**
```bash
POST /api/v1/phase6/remediation/generate
GET /api/v1/phase6/remediation/:planId
PUT /api/v1/phase6/remediation/:planId/status
```

## Real-Time Features (Phase 5)
> 📦 **Tier**: ❌ Free | ✅ Starter | ✅ Professional | ✅ Enterprise

WebSocket-based real-time updates for instant notification of compliance events.

**Features:**
- WebSocket server with Socket.IO
- Redis pub/sub messaging
- Push notifications (browser + service worker)
- Online user tracking
- 8+ real-time event types

**API Endpoints:**
```bash
GET /api/v1/realtime/online-users
POST /api/v1/realtime/broadcast
WebSocket: ws://server/socket.io
```

[View Full Documentation](../../../PHASE_5_REALTIME_FEATURES.md)

## Getting Started

### Prerequisites
- ControlWeave account (Professional+ tier for Phase 6 features)
- API key configured (for programmatic access)
- LLM provider configured (for AI analysis features)

### Quick Start
1. Navigate to Settings → LLM Configuration
2. Configure your AI provider (OpenAI, Anthropic, etc.)
3. Set usage limits and safety thresholds
4. Start using AI features from dashboards or API

## Tier Comparison

| Feature | Community | Pro | Pro | Enterprise |
|---------|------|---------|--------------|------------|
| AI Copilot | 10/mo | 50/mo | Unlimited | Unlimited |
| Predictive Risk Scoring | ❌ | ❌ | ✅ | ✅ |
| Regulatory Impact Analysis | ❌ | ❌ | ✅ | ✅ |
| Smart Remediation | ❌ | ❌ | ✅ | ✅ |
| Real-Time Updates | ❌ | ✅ | ✅ | ✅ |
| AI Reasoning Memory | ❌ | ❌ | ✅ | ✅ |
| Organization RAG | ❌ | ❌ | ✅ | ✅ |

### AI Reasoning Memory (NEW)
> 📦 **Tier**: ❌ Free | ❌ Starter | ✅ Professional | ✅ Enterprise

Persistent semantic memory that stores key findings from every AI analysis. Subsequent analyses automatically receive relevant historical context, making compliance guidance progressively smarter.

**How It Works:**
- After each AI analysis (gap analysis, risk scoring, compliance forecast, etc.), key findings and keywords are stored
- When a new analysis runs, the reasoning memory retrieves relevant past findings via keyword similarity
- Retrieved context is injected into the AI system prompt, giving the model organizational history
- Entries expire automatically after the configured retention period (default: 30 days)

**Features:**
- Per-organization, per-feature memory isolation
- In-memory cache with database persistence
- Keyword-based similarity retrieval
- Configurable retention period via `REASONING_MEMORY_RETENTION_DAYS`
- Automatic expired-entry cleanup

**Database Table:** `ai_reasoning_memory` (Migration 083)

### Organization RAG — Document Retrieval (NEW)
> 📦 **Tier**: ❌ Free | ❌ Starter | ✅ Professional | ✅ Enterprise

Vector-based Retrieval-Augmented Generation that indexes your organization's documents (policies, evidence, procedures) and injects semantically relevant excerpts into every AI analysis.

**How It Works:**
1. Upload or index a document via the RAG API (`POST /api/v1/rag/index`)
2. The document is split into overlapping chunks (~800 tokens each)
3. Each chunk is embedded using OpenAI `text-embedding-3-small` (1536 dimensions)
4. Embeddings are stored in PostgreSQL via pgvector with HNSW indexing
5. When an AI analysis runs, the system embeds the query and retrieves the top-K most relevant chunks by cosine similarity
6. Retrieved chunks are injected into the LLM system prompt alongside org context

**Features:**
- Per-organization document isolation
- Supports PDF, DOCX, TXT, MD, CSV file uploads
- Automatic deduplication via SHA-256 file hashing
- Configurable similarity threshold (default: 0.72)
- HNSW index for sub-millisecond approximate nearest-neighbor search
- Automatic integration into `buildPersonalizedSystem()` — all 25+ AI features benefit

**API Endpoints:**
```bash
POST /api/v1/rag/index          # Upload and index a document file
POST /api/v1/rag/index-text     # Index raw text directly
POST /api/v1/rag/search         # Semantic search across indexed docs
GET  /api/v1/rag/documents      # List indexed documents
GET  /api/v1/rag/stats          # RAG statistics for the org
DELETE /api/v1/rag/documents/:id # Remove an indexed document
```

**Configuration (env vars):**
- `RAG_CHUNK_SIZE` — Tokens per chunk (default: 800)
- `RAG_CHUNK_OVERLAP` — Overlap tokens between chunks (default: 100)
- `RAG_DEFAULT_TOP_K` — Number of chunks to retrieve (default: 5)
- `RAG_SIMILARITY_THRESHOLD` — Minimum cosine similarity (default: 0.72)
- `RAG_EMBEDDING_MODEL` — OpenAI embedding model (default: text-embedding-3-small)

**Database Tables:** `org_document_embeddings`, `org_rag_index_status` (Migration 084)

---

## Best Practices

### Risk Scoring
- Run risk scores weekly for trending data
- Set up alerts for scores dropping below 70
- Review risk factors driving the score
- Document mitigation plans for high-risk areas

### Regulatory Analysis
- Analyze new regulations as soon as announced
- Involve legal team in impact assessment
- Create action plans with clear owners
- Track implementation progress

### Remediation Planning
- Generate plans for all high-priority findings
- Assign clear ownership and deadlines
- Track progress through completion
- Document lessons learned

## API Authentication

All AI feature endpoints require authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.controlweave.com/api/v1/phase6/risk-score/org-id
```

## Related Documentation

- [Phase 6 Implementation Guide](../../../PHASE_6_IMPLEMENTATION_COMPLETE.md)
- [Phase 5 Real-Time Features](../../../PHASE_5_COMPLETE.md)
- [AI Copilot Guide](../../guides/AI_COPILOT.md)
- [LLM Configuration](../operations/LLM-Configuration)

---
**Category**: AI Features  
**Tier**: Professional+ (most features)  
**Last Updated**: February 18, 2026
