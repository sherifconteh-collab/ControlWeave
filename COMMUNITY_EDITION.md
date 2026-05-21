# Controlweave Community Edition

## Overview

Controlweave Community Edition is a fully functional, open source GRC (Governance, Risk, and Compliance) platform designed for organizations managing compliance across multiple frameworks.

## Architecture & Security

Controlweave uses a multi-layer security architecture to ensure proper feature access:

1. **Build-Time Filtering**: Community repository only includes community features
2. **Edition Enforcement**: Server validates `EDITION` environment variable  
3. **Database Validation**: Organization-specific access controls
4. **Permission Control**: Role-based access control (RBAC)

This architecture ensures secure, multi-tenant operation.

See [EDITION_SECURITY.md](./EDITION_SECURITY.md) for technical security details.

## What's Included

### Core Compliance Management
- **Framework Support** - NIST 800-53, ISO 27001, SOC 2, GDPR, HIPAA, and more
- **Control Management** - 500+ controls with implementation tracking
- **Control Crosswalks** - Automatic mapping between frameworks
- **Control Health** - Real-time health scoring
- **Control Exceptions** - Track approved exceptions with expiry dates

### Assessment & Audit Workflows
- **Assessment Procedures** - 186 procedures based on NIST 800-53A, ISO 19011, SOC 2, HIPAA, GDPR
- **Assessment Plans** - Create and track assessment campaigns
- **Results Recording** - NIST-standard outcomes (Satisfied / Other Than Satisfied / Not Applicable)
- **Auditor Workspace** - Dedicated portal for external auditors
- **Audit Logging** - Complete trail of all user actions for AU-2 compliance

### AI-Powered Analysis
- **AI Copilot** - Organization-aware conversational assistant
- **Gap Analysis** - Identify compliance gaps across frameworks
- **Crosswalk Optimizer** - Find overlap opportunities
- **Compliance Forecast** - Predict compliance trajectory
- **Remediation Playbooks** - Generate step-by-step plans
- **Risk Heatmaps** - Visualize risk across control families
- **BYOK Support** - Bring Your Own Key for Anthropic, OpenAI, Google, xAI, Groq, or Ollama

### User & Access Management
- **User Management** - Create and manage user accounts
- **Role-Based Access Control** - Custom roles with granular permissions
- **Multi-Organization** - Support multiple organizations in single deployment
- **Passkeys/WebAuthn** - Modern passwordless authentication

### Policy & Risk Management
- **Policy Management** - Create and track organizational policies
- **POAM** - Track remediation efforts (Plan of Action & Milestones)
- **Policy Engine** - Automate policy enforcement
- **Control Implementation** - Track implementation status and assignments

### Developer Features
- **REST API** - Complete API for programmatic access
- **MCP Server** - Model Context Protocol support for LLM integration
- **Webhooks** - Outbound webhooks for external integrations
- **Performance Monitoring** - Built-in application performance tracking

## Technology Stack

### Backend
- **Language**: JavaScript (Node.js 18+)
- **Framework**: Express.js
- **Database**: PostgreSQL 17+
- **Authentication**: JWT with bcryptjs
- **AI Integration**: Multi-provider support with BYOK

### Frontend
- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS

## Getting Started

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

# Seed frameworks
node scripts/seed-frameworks.js
node scripts/seed-missing-controls.js

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

### Configuration

Required environment variables:

```bash
# Backend .env
DATABASE_URL=postgresql://user:pass@localhost:5432/controlweave
JWT_SECRET=your-secret-key-here
EDITION=community

# Frontend .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

## Community Contributions

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

## Architecture

### Security
- JWT-based authentication
- Role-based access control (RBAC)
- Comprehensive audit logging
- Input validation and sanitization
- SQL injection prevention
- XSS protection

### Database Schema
- Organizations and users
- Frameworks and controls
- Control implementations and evidence
- Assessments and audit trails
- Policies and POAM items
- Performance metrics

### API Design
- RESTful API endpoints
- Consistent response format
- Comprehensive error handling
- Rate limiting
- Request context tracking

## Deployment

### Self-Hosted
Deploy to your own infrastructure using:
- Docker containers
- Railway
- Heroku
- AWS/GCP/Azure
- Any Node.js hosting platform

### Database
- Managed PostgreSQL recommended
- Self-hosted PostgreSQL supported
- Minimum PostgreSQL 17+
- SSL/TLS encryption supported

### Scaling
- Horizontal scaling supported
- Load balancer compatible
- Session-less architecture
- Database connection pooling
- Performance monitoring included

## Support

### Community Support
- GitHub Issues for bug reports
- GitHub Discussions for questions
- Pull requests welcome

### Documentation
- Setup guides in `/docs`
- API documentation (OpenAPI)
- Architecture documentation
- Migration guides

## License

See LICENSE file for details.

## Roadmap

Community-driven development focuses on:
- Enhanced compliance workflows
- Additional framework support
- Performance improvements
- UI/UX enhancements
- Integration ecosystem growth
- Documentation expansion

Suggest features via GitHub Issues!

## Success Stories

Controlweave Community Edition is used by organizations worldwide for:
- SOC 2 compliance management
- ISO 27001 certification
- NIST 800-53 implementation
- Multi-framework compliance tracking
- Audit preparation and management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

See CONTRIBUTING.md for detailed guidelines.

## Contact

- GitHub: https://github.com/your-org/controlweave
- Website: https://controlweave.com
- Community: GitHub Discussions

---

**Controlweave** - Open Source GRC Platform
