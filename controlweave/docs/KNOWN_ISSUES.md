# ⚠️ Known Issues

This document tracks currently known issues in ControlWeave and available workarounds.

## Active Issues

### AI Features

**Issue**: AI Copilot occasionally returns generic responses instead of org-specific answers  
**Severity**: Medium  
**Workaround**: Rephrase your question to include more specific context (e.g., mention the framework name or control ID)  
**Status**: Fix in progress for v2.3.1

**Issue**: AI Analysis may fail for organizations with more than 2,000 controls active simultaneously  
**Severity**: Medium  
**Workaround**: Filter by specific framework before running AI analysis  
**Status**: Performance optimization planned for Q2 2026

---

### Evidence Management

**Issue**: PDF files with encrypted/password-protected content cannot be parsed for AI analysis  
**Severity**: Low  
**Workaround**: Remove password protection before uploading, or upload as a scanned image  
**Status**: Known limitation, under review

---

### CMDB / Vulnerability Management

**Issue**: CVSS score auto-population may not work for CVEs published after December 2025  
**Severity**: Low  
**Workaround**: Manually enter CVSS scores for recent CVEs  
**Status**: CVE database sync improvement planned

---

### Reporting

**Issue**: Large PDF reports (100+ controls) may take up to 60 seconds to generate  
**Severity**: Low  
**Workaround**: Use section filters to generate focused reports  
**Status**: Performance improvement in progress

---

### Browser Compatibility

**Issue**: Passkey authentication is not supported in Firefox versions below 119  
**Severity**: Low  
**Workaround**: Update Firefox to version 119+ or use Chrome/Edge/Safari  
**Status**: Platform limitation (WebAuthn support)

---

## Recently Resolved Issues

| Issue | Fixed In | Description |
|-------|----------|-------------|
| AI Analysis timeout | v2.3.0 | Large dataset AI analysis timing out |
| Control status badge display | v2.3.0 | Display bug on Controls page |
| Evidence pagination | v2.3.0 | Pagination breaking with 1000+ items |
| Grok provider error messages | v2.2.1 | Unclear error when Grok API is down |

---

## Reporting a New Issue

Found a bug? Please report it:
- **In-App**: Settings → Help → Report a Bug
- **Email**: contehconsulting@gmail.com (include browser, OS, and steps to reproduce)

## Related Documents

- [Release Notes](RELEASE_NOTES.md) - Recent fixes and improvements
- [Troubleshooting Guide](guides/TROUBLESHOOTING.md) - Common issue resolutions
- [FAQ](guides/FAQ.md) - Frequently asked questions
