# CI/CD Pipeline Quick Reference

## 🚀 For Developers

### Before You Push

Run these checks locally to catch issues early:

```bash
# Backend checks
cd controlweave/backend
npm run check:syntax        # JavaScript syntax validation
npm run check:ip-hygiene   # IP address hygiene check
npm run build              # Build verification
npm audit                  # Security audit

# Frontend checks
cd controlweave/frontend
npm run typecheck          # TypeScript type checking
npm run lint               # Code quality
npm run build              # Build verification
npm audit                  # Security audit
```

### What Happens When You Open a PR

**Automatic Checks (All Must Pass):**

1. **Build & Test** (~3-5 min)
   - Backend: Syntax, IP hygiene, build, security audit
   - Frontend: TypeScript, lint, build, security audit

2. **QA Testing** (~5-10 min)
   - Database migrations
   - Dynamic E2E test suite
   - Crosswalk verification

3. **Security Scanning** (~10-15 min)
   - CodeQL: Code security analysis
   - Dependencies: npm audit for vulnerabilities
   - Secrets: TruffleHog + Gitleaks scanning
   - Containers: Trivy security scan

4. **SBOM/AIBOM** (~2-3 min)
   - Software Bill of Materials generation
   - AI Bill of Materials generation

5. **Vulnerability Analysis** (~2-3 min)
   - Analyzes all security findings
   - **Medium+ vulnerabilities are flagged**
   - **High/Critical vulnerabilities block merge**
   - Automatic issue creation for review

6. **Final Gate** (~1 min)
   - Verifies all checks passed
   - Posts success comment on PR

**Total Time:** ~20-35 minutes

### Understanding Vulnerability Levels

| Severity | Description | Action |
|----------|-------------|--------|
| 🔴 **Critical** | Exploitable, immediate risk | **BLOCKS MERGE** - Fix immediately |
| 🟠 **High** | Serious security issue | **BLOCKS MERGE** - Fix before merge |
| 🟡 **Medium** | Potential security concern | **FLAGGED** - Review required, document decision |
| 🔵 **Low** | Minor issue or best practice | Informational only |
| ⚪ **Info** | No security impact | No action required |

### If Your PR Fails

**1. Check the Failed Job**
- Click on "Details" next to the failed check
- Read the error message carefully

**2. Common Failures & Fixes**

| Error | Fix |
|-------|-----|
| Syntax error | Fix JavaScript/TypeScript syntax |
| Type error | Resolve TypeScript type issues |
| Lint error | Run `npm run lint -- --fix` |
| Build failed | Check for missing dependencies |
| Security audit failed | Update vulnerable packages: `npm audit fix` |
| Secrets detected | Remove hardcoded secrets, use env vars |
| High/Critical vuln found | See vulnerability review process below |

**3. Push Your Fix**
```bash
git add .
git commit -m "Fix: resolve CI/CD issues"
git push
```
The pipeline will automatically re-run.

### Vulnerability Review Process

When medium+ vulnerabilities are detected:

**1. Check the Created Issue**
- Go to Issues tab
- Look for "🚨 Security Vulnerabilities Requiring Review"
- Review detailed findings

**2. For Each Vulnerability, Choose:**

**Option A: Fix**
```bash
# Update the vulnerable package
npm update [package-name]
# Or manually update in package.json
npm install
npm audit  # Verify fix
```

**Option B: Mitigate**
- Implement security controls that reduce risk
- Document in the issue
- Example: "Package only used in dev, not in production"

**Option C: Accept Risk**
- Document why the risk is acceptable
- Get approval from security team
- Set expiration date for re-review
- Example: "No patch available, compensating controls in place"

**Option D: False Positive**
- Document why this is not a real vulnerability
- Example: "CVE doesn't apply to our usage pattern"

**3. Document Your Decision**
- Comment on the issue with your choice
- Include justification
- Tag relevant team members

**4. Re-run Pipeline**
```bash
git commit --allow-empty -m "Trigger pipeline after vulnerability review"
git push
```

### Required PR Checks

These must pass before merge:

- ✅ Backend Build & Test
- ✅ Frontend Build & Test
- ✅ QA Testing Suite
- ✅ CodeQL Security Analysis
- ✅ Dependency Vulnerability Scan
- ✅ Secrets Detection
- ✅ Generate Software Bill of Materials
- ✅ Generate AI Bill of Materials
- ✅ Analyze & Flag Vulnerabilities
- ✅ **All Security & QA Checks Passed**

### Branch Protection

**Main Branch:**
- Requires 1 approval
- All status checks must pass
- No force push
- No deletion

**Your Feature Branch:**
- Can push freely
- Will be tested on every push
- Squash before merge

### Pipeline Artifacts

After each run, these artifacts are available:

| Artifact | What It Contains | Retention |
|----------|------------------|-----------|
| `dependency-audit-results` | npm audit JSON | 30 days |
| `container-scan-results` | Trivy scan results | 30 days |
| `sbom-artifacts` | Software Bill of Materials | 90 days |
| `aibom-artifacts` | AI Bill of Materials | 90 days |
| `vulnerability-analysis` | Detailed vulnerability report | 90 days |
| `security-report` | Consolidated HTML report | 90 days |
| `qa-test-results` | QA test outcomes | 30 days |

### Getting Help

**Pipeline Issues:**
1. Check `CI_CD_PIPELINE_GUIDE.md` for detailed troubleshooting
2. Review the logs in GitHub Actions tab
3. Ask in #devops channel

**Security Questions:**
1. Review vulnerability report in artifacts
2. Check GitHub Security tab for CodeQL findings
3. Ask in #security channel

**QA Test Failures:**
1. Check controlweave/backend QA scripts
2. Review database migration logs
3. Ask in #qa channel

### Pro Tips

**Speed Up Your PRs:**
- Run tests locally before pushing
- Keep PRs small and focused
- Update dependencies regularly
- Don't introduce new vulnerabilities

**Security Best Practices:**
- Never commit secrets (use .env files)
- Keep dependencies updated
- Review security scan results
- Document risk acceptance decisions

**Quality Best Practices:**
- Write meaningful commit messages
- Keep code changes minimal
- Test locally first
- Respond to PR comments promptly

### Emergency Bypass

**⚠️ ONLY in critical situations (production down, security patch):**

1. Contact repository admin
2. Provide justification and incident ticket
3. Admin can temporarily disable checks
4. **MUST re-enable immediately after merge**
5. **MUST create follow-up PR to address skipped checks**

This should be extremely rare (< 1% of PRs).

### NIST 800-160 Compliance

This pipeline implements:
- **Security by Design**: SAST + DAST + secrets scanning
- **Continuous Verification**: QA tests + build checks
- **Supply Chain Security**: SBOM + AIBOM + dependency tracking
- **Defense in Depth**: Multiple layers of security controls

By following this process, you're helping maintain ControlWeave's security posture and regulatory compliance.

---

**Questions?** Check the full guide: `CI_CD_PIPELINE_GUIDE.md`
