# Small Start Deployment Profile

Recommended deployment configuration for small teams and initial ControlWeave adoption.

## Target

- Teams of 1–5 users
- Single-framework compliance (e.g., NIST AI RMF or EU AI Act)
- Community or Pro tier

## Infrastructure

| Component | Recommendation |
|-----------|---------------|
| Database | PostgreSQL 17+ (managed, e.g., Railway, Supabase) |
| Backend | Single Node.js instance, 512 MB RAM minimum |
| Frontend | Next.js, static export or Vercel/Railway |
| Storage | Local filesystem or S3-compatible for evidence uploads |

## Getting Started

1. Clone the repository
2. Run `npm install` in both `backend/` and `frontend/`
3. Configure `.env` with database credentials
4. Run `npm run migrate` to set up the database
5. Seed frameworks: `node scripts/seed-frameworks.js`
6. Start: `npm run dev`

See [QUICK_START.md](QUICK_START.md) for the full setup guide.
