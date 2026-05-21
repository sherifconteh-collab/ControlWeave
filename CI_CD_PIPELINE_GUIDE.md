# CI/CD Pipeline & Branch Protection Guide

## Overview

This document describes the comprehensive CI/CD pipeline for ControlWeave that implements NIST 800-160 Systems Security Engineering principles. **All pull requests MUST pass this pipeline before merging.**

## NIST 800-160 Compliance

Our CI/CD pipeline implements key NIST 800-160 principles:

### 1. **Security by Design**
- Static Application Security Testing (SAST) with CodeQL
- Dependency vulnerability scanning
- Secrets detection
- Container security scanning

### 2. **Continuous Verification**
- Comprehensive QA test suite
- Syntax and code hygiene checks
- Type checking and linting
- Build verification at every stage

### 3. **Supply Chain Security**
- Software Bill of Materials (SBOM) generation
- AI Bill of Materials (AIBOM) generation
- Dependency tracking and verification

### 4. **Defense in Depth**
- Multiple layers of security scanning
- SAST (Static) + DAST (Dynamic) testing
- Secrets scanning at multiple points
- Container and runtime security

## Pipeline Stages

### Stage 1: Build & Test ✅
**Required for all PRs**

- **Backend Build**
  - Node.js 20 environment
  - `npm install` for clean dependency installation
  - Syntax validation (`check:syntax`)
  - IP hygiene verification (`check:ip-hygiene`)
  - Build verification
  - Security audit (fails on moderate+ vulnerabilities)

- **Frontend Build**
  - TypeScript type checking
  - ESLint code quality checks
  - Production build verification
  - Security audit (fails on moderate+ vulnerabilities)

### Stage 2: QA Testing Suite ✅
**Required for all PRs - implements continuous verification**

- Full PostgreSQL test database
- Database migrations execution
- Syntax checking
- IP hygiene standards enforcement
- Dynamic E2E test suite:
  - `syntax` - JavaScript syntax validation
  - `mega` - Comprehensive end-to-end tests
  - `dynamic` - SBOM/vulnerability scenarios
  - `auditor` - Auditor workflow verification
- Crosswalk verification
- Test results artifact generation

**Exit Criteria:** All QA tests must pass for pipeline to continue

### Stage 3: Security Scanning (SAST) 🔒
**Required for all PRs**

#### CodeQL Analysis
- JavaScript security and quality analysis
- CVE detection in code patterns
- Security best practices verification
- Results uploaded to GitHub Security tab

#### Dependency Scanning
- Backend npm audit (moderate+ severity fails build)
- Frontend npm audit (moderate+ severity fails build)
- JSON reports generated for review
- Artifact retention: 30 days

#### Secrets Scanning
- TruffleHog verified secrets detection
- Gitleaks comprehensive scanning
- Fails immediately on detected secrets
- Prevents credential leaks

### Stage 4: SBOM & AIBOM Generation 📋
**Required for all PRs**

#### SBOM (Software Bill of Materials)
- CycloneDX format
- Backend dependencies catalog
- Frontend dependencies catalog
- Retention: 90 days

#### AIBOM (AI Bill of Materials)
- Documents all AI/ML dependencies
- LLM provider tracking (Anthropic, OpenAI, Google, xAI, Groq, Ollama)
- AI model usage documentation
- Data flow and privacy controls
- NIST AI RMF compliance status
- Retention: 90 days

### Stage 5: Container Security 🐳
**Required for main branch and PRs**

- Docker build verification
- Trivy vulnerability scanning
- Critical/High/Medium severity detection
- SARIF results uploaded to GitHub Security
- Separate scans for backend and frontend

### Stage 6: DAST (Dynamic Application Security Testing) 🌐
**Required for main branch deployments**

- OWASP ZAP baseline scanning
- Active security testing against running application
- HTML and JSON reports
- Configurable rules via `.zap/rules.tsv`

### Stage 7: Security Report Generation 📊
**Always runs - consolidates all findings**

- Aggregates all security scan results
- HTML report generation
- Critical/High/Medium/Low/Info categorization
- Available as pipeline artifact
- PR comment with summary

### Stage 8: Final Gate - All Checks Must Pass ✅
**MANDATORY - enforces quality gates**

This job ensures ALL previous stages completed successfully:
- ✅ Backend build passed
- ✅ Frontend build passed
- ✅ QA testing passed
- ✅ CodeQL analysis passed
- ✅ Dependency scan passed
- ✅ Secrets scan passed
- ✅ SBOM generated
- ✅ AIBOM generated
- ✅ Security report completed

**If ANY check fails, the entire pipeline fails and merge is blocked.**

## Branch Protection Rules

### Required Setup in GitHub

To enforce this pipeline, configure the following branch protection rules:

#### For `main` branch:

```yaml
Branch Protection Rules:
  Require pull request reviews before merging: ✅
    Required approving reviews: 1
    Dismiss stale pull request approvals: ✅
  
  Require status checks to pass before merging: ✅
    Required status checks:
      - Backend Build & Test
      - Frontend Build & Test
      - QA Testing Suite
      - Validate CM Branch Name
      - CodeQL Security Analysis
      - Dependency Vulnerability Scan
      - Secrets Detection
      - Generate Software Bill of Materials
      - Generate AI Bill of Materials
      - ✅ All Security & QA Checks Passed  # CRITICAL
    Require branches to be up to date: ✅
  
  Require conversation resolution before merging: ✅
  
  Require signed commits: ⚠️ Recommended
  
  Include administrators: ✅
  
  Restrict who can push to matching branches: ✅
    - CI/CD service accounts only
  
  Allow force pushes: ❌
  Allow deletions: ❌
```

#### For `develop` branch:

Same as `main` but with relaxed review requirements:
- Required approving reviews: 1
- All other rules identical

### Setting Up Branch Protection

1. **Navigate to Repository Settings**
   ```
   Repository → Settings → Branches → Add rule
   ```

2. **Branch name pattern:** `main`

3. **Enable all protection rules** as listed above

4. **Critical: Add required status checks**
   - Type the exact job names from the workflow
   - The most important check: `✅ All Security & QA Checks Passed`

5. **Save changes**

6. **Repeat for `develop` branch**

## Workflow Files

### GitHub Actions
- **Primary:** `.github/workflows/security-pipeline.yml`
- **Documentation:** `.github/workflows/docs-auto-update.yml`
- **Public Mirror:** `.github/workflows/public-mirror.yml`

### Azure DevOps
- **Primary:** `azure-pipelines.yml` (root directory)

Both pipelines implement identical security controls and quality gates.

## Testing the Pipeline

### Local Testing Before Push

```bash
# Backend checks
cd controlweave/backend
npm run check:syntax
npm run check:ip-hygiene
npm run build
npm audit

# Frontend checks
cd controlweave/frontend
npm run typecheck
npm run lint
npm run build
npm audit

# QA tests (requires database)
cd controlweave/backend
npm run qa:e2e:dynamic
```

### PR Testing

1. Create a CM branch: `<type>/CW-<number>/<short-description>`
2. Make your changes
3. Push to GitHub
4. Open pull request
5. Pipeline runs automatically
6. Review all check results
7. Fix any failures
8. Push fixes to same branch
9. Pipeline re-runs automatically
10. Once all checks pass, request review

## Pipeline Artifacts

The following artifacts are generated and retained:

| Artifact | Retention | Purpose |
|----------|-----------|---------|
| Dependency Audit Results | 30 days | Vulnerability tracking |
| Container Scan Results | 30 days | Image security status |
| DAST Results | 30 days | Runtime vulnerability detection |
| SBOM Artifacts | 90 days | Software supply chain transparency |
| AIBOM Artifacts | 90 days | AI/ML dependency documentation |
| Security Report | 90 days | Consolidated security findings |
| QA Test Results | 30 days | Quality verification evidence |

## Failure Handling

### When the Pipeline Fails

1. **Review the failed job** in the Actions tab
2. **Check the logs** for specific error messages
3. **Common failures and fixes:**

   - **Syntax errors:** Fix JavaScript/TypeScript syntax
   - **Type errors:** Resolve TypeScript type issues
   - **Security audit fails:** Update vulnerable dependencies
   - **Secrets detected:** Remove hardcoded secrets, use environment variables
   - **CodeQL issues:** Review and fix security vulnerabilities
   - **QA tests fail:** Debug failing test scenarios
   - **Build fails:** Check for missing dependencies or configuration

4. **Push fixes** to the same branch
5. **Pipeline re-runs automatically**

### Emergency Bypass (NOT RECOMMENDED)

In exceptional circumstances (production incident, critical security patch):

1. Contact repository administrator
2. Provide justification
3. Administrator can temporarily disable required checks
4. **MUST** re-enable immediately after merge
5. **MUST** create follow-up PR to fix any skipped checks

## Monitoring & Compliance

### Audit Trail

All pipeline runs are logged and retained:
- Run history: 90 days minimum
- Artifacts: As specified above
- Security findings: GitHub Security tab

### Compliance Reporting

1. **Monthly Security Review**
   - Review all CodeQL findings
   - Check dependency audit trends
   - Verify SBOM/AIBOM accuracy
   - Update security policies

2. **Quarterly Compliance Audit**
   - Verify NIST 800-160 implementation
   - Review branch protection rules
   - Check pipeline success rate
   - Update procedures as needed

## Integration with ControlWeave Features

This pipeline is specifically designed for ControlWeave's architecture:

- **Backend:** Express.js, PostgreSQL, Node.js 20
- **Frontend:** Next.js 16, TypeScript, React 19
- **AI Integration:** Multiple LLM providers (Anthropic, OpenAI, Google, xAI, Groq, Ollama)
- **Compliance:** 15+ frameworks supported
- **Security:** NIST 800-53, SOC 2, ISO 27001, HIPAA, etc.

## Support & Questions

For pipeline issues or questions:

1. Check this documentation first
2. Review GitHub Actions logs
3. Check `QUICK_START.md` for setup issues
4. Review NIST 800-160 documentation for compliance questions
5. Contact DevSecOps team

## Updates to This Pipeline

When modifying the CI/CD pipeline:

1. **Test changes** in a feature branch first
2. **Document changes** in this file
3. **Update branch protection rules** if job names change
4. **Notify team** of new requirements
5. **Update NIST 800-160 compliance** mapping if needed

---

**Remember:** This pipeline is not optional. It is a critical security control that protects ControlWeave and its users. Every PR must pass all checks before merge.

**NIST 800-160 Principle:** "Security is achieved through the application of trustworthy, secure design principles at all stages of the system life cycle."
