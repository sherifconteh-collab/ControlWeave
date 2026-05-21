# Controlweave

**Open Source GRC (Governance, Risk, and Compliance) Platform**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/postgresql-recommended%2017%2B%20(14%2B%20supported)-blue.svg)](https://www.postgresql.org)

Controlweave is a fully functional GRC platform for managing compliance across multiple frameworks with AI-powered analysis, assessment workflows, and comprehensive audit capabilities.

## 🌟 Features

### Core Compliance Management
- **Multi-Framework Support** - NIST 800-53, ISO 27001, SOC 2, GDPR, HIPAA, PCI DSS, and more
- **500+ Controls** - Pre-loaded controls with implementation tracking
- **Control Crosswalks** - Automatic mapping between frameworks (implement once, satisfy many)
- **Control Health Scoring** - Real-time health metrics based on evidence and assessments
- **Control Exceptions** - Track approved exceptions with expiry dates

### Assessment & Audit
- **186 Assessment Procedures** - Based on NIST 800-53A, ISO 19011, SOC 2, HIPAA, GDPR
- **Assessment Plans** - Create and track assessment campaigns
- **NIST-Standard Outcomes** - Satisfied / Other Than Satisfied / Not Applicable
- **Auditor Workspace** - Dedicated portal for external auditors
- **Audit Logging** - Complete trail of all actions for AU-2 compliance

### AI Insights (Optional)
AI is optional — the platform works without any API key configured.
- **Gap Analysis** - Identify compliance gaps across frameworks
- **Crosswalk Optimizer** - Find overlap opportunities to reduce work
- **Compliance Forecast** - Predict compliance trajectory
- **Audit Readiness** - Score preparedness ahead of fieldwork
- **Remediation Playbooks** - Generate step-by-step remediation plans
- **Risk Heatmaps** - Visualize risk across control families
- **BYOK Support** - Bring Your Own Key (Anthropic, OpenAI, Google, xAI, Groq, Ollama)

### User & Access Management
- **Role-Based Access Control** - Granular permissions (admin, user, auditor)
- **Multi-Organization** - Support multiple organizations in single deployment
- **Passkeys/WebAuthn** - Modern passwordless authentication
- **JWT Authentication** - Secure token-based auth with refresh tokens

### Policy & Risk
- **Policy Management** - Create and track organizational policies
- **POAM** - Plan of Action & Milestones for remediation tracking
- **Policy Engine** - Automate policy enforcement
- **Implementation Tracking** - Track control implementation status and assignments

### Developer Features
- **REST API** - Complete API for programmatic access
- **MCP Server** - Model Context Protocol support for LLM integration
- **Webhooks** - Outbound webhooks for external integrations
- **Performance Monitoring** - Built-in APM with request tracking

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 17+
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/controlweave.git
cd controlweave

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run migrate

# Seed frameworks and controls
node scripts/seed-frameworks.js
node scripts/seed-missing-controls.js
node scripts/seed-assessment-procedures.js

# Start backend
npm run dev

# Frontend setup (in new terminal)
cd ../frontend
npm install
cp .env.example .env.local
# Edit .env.local with backend URL

# Start frontend
npm run dev
```

Visit `http://localhost:3000` to access the application.

## 📋 Configuration

### Backend (.env)
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/controlweave
JWT_SECRET=your-secret-key-here
PORT=3001
NODE_ENV=development
EDITION=community
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=Controlweave
```

## 🏗️ Architecture

### Technology Stack
**Backend:**
- Node.js 18+ with Express.js
- PostgreSQL 17+ (no ORM, direct SQL)
- JWT authentication with bcryptjs
- Multi-provider AI integration

**Frontend:**
- Next.js 16+ (App Router)
- TypeScript
- Tailwind CSS
- Axios for API calls

### Security
- JWT-based authentication
- Role-based access control (RBAC)
- Comprehensive audit logging
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Rate limiting
- Security headers

## 📚 Documentation

- [Community Edition Guide](COMMUNITY_EDITION.md) - Complete feature documentation
- [Quick Start Guide](QUICK_START.md) - Detailed setup instructions
- [MCP Setup](docs/MCP_SETUP.md) - Model Context Protocol integration
- [API Documentation](docs/openapi.yaml) - OpenAPI specification

## 🤝 Contributing

We welcome contributions! Here are ways to get involved:

### Code Contributions
- Fix bugs and improve performance
- Enhance existing features
- Improve documentation
- Add test coverage
- Optimize database queries

### Integration Development
- Build connectors for third-party tools
- Create webhook integrations
- Develop MCP extensions
- Add AI provider support

### Framework Support
- Add new compliance frameworks
- Update existing framework mappings
- Contribute control definitions
- Improve assessment procedures

### Documentation
- Improve setup guides
- Add use case examples
- Translate documentation
- Create video tutorials

## 🌐 Deployment

### Self-Hosted Options
- Docker containers
- Railway
- Heroku
- AWS/GCP/Azure
- Any Node.js hosting platform

### Database
- Managed PostgreSQL (recommended)
- Self-hosted PostgreSQL
- Minimum PostgreSQL 17+
- SSL/TLS encryption supported

### Scaling
- Horizontal scaling supported
- Load balancer compatible
- Session-less architecture
- Database connection pooling
- Performance monitoring included

## 💬 Community & Support

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and community help
- **Pull Requests** - Code contributions welcome

## 📄 License

See [LICENSE](LICENSE) file for details.

## 🗺️ Roadmap

Community-driven development focuses on:
- Enhanced compliance workflows
- Additional framework support
- Performance improvements
- UI/UX enhancements
- Integration ecosystem growth
- Documentation expansion

Suggest features via GitHub Issues!

## 🎯 Use Cases

Controlweave is used by organizations worldwide for:
- SOC 2 compliance management
- ISO 27001 certification
- NIST 800-53 implementation
- Multi-framework compliance tracking
- Audit preparation and management
- Compliance gap analysis
- Risk assessment and management

## 🔧 Development

### Running Tests
```bash
cd backend
npm test
```

### Building for Production
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm start
```

### Database Migrations
```bash
cd backend
npm run migrate          # Run all migrations
npm run migrate:one      # Run single migration
```

## 📧 Contact

- GitHub: https://github.com/your-org/controlweave
- Website: https://controlweave.com
- Community: GitHub Discussions

---

**Controlweave** - Open Source GRC Platform

Built with ❤️ by the open source community
