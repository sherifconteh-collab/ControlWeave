# 🚨 Error Messages Reference

Common error messages in ControlWeave and how to resolve them.

## Authentication Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `Invalid credentials` | Wrong email or password | Use Forgot Password to reset |
| `Account locked` | Too many failed login attempts | Wait 15 minutes or contact admin |
| `Session expired` | Login session timed out | Log in again |
| `SSO configuration error` | SAML setup misconfiguration | Check IdP metadata and attribute mappings |
| `Passkey authentication failed` | Device/browser mismatch | Re-register passkey on current device |

## Permission Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `Insufficient permissions` | Role doesn't allow the action | Request role upgrade from admin |
| `Access denied` | Resource not in your organization | Confirm you're in the correct org |

## AI & LLM Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `LLM provider not configured` | No AI provider set up | Go to Settings → LLM Configuration |
| `Invalid API key` | API key expired or incorrect | Update the API key in Settings |
| `Provider unavailable` | LLM service outage | Try a different provider |
| `Context too large` | Too much data for model | Apply filters to narrow scope |

## File & Evidence Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `File too large` | File exceeds 25MB limit | Compress or split the file |
| `Unsupported file type` | Format not allowed | Convert to PDF, DOCX, XLSX, PNG, or CSV |
| `Upload failed` | Network or server error | Check connection and retry |
| `Evidence not found` | File was deleted or moved | Re-upload the evidence |

## Database & Data Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `Duplicate entry` | Already exists in system | Check for existing records before creating |

## Integration Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `Webhook delivery failed` | Endpoint not responding | Verify webhook URL and test manually |
| `API rate limit exceeded` | Too many API requests | Implement request throttling |
| `Invalid API token` | API token expired or revoked | Generate a new API token |
| `SIEM connection failed` | Splunk/SIEM connectivity issue | Check network and Splunk configuration |

## General Tips for Error Resolution

1. **Refresh the page** — Many transient errors resolve with a refresh
2. **Check browser console** — Press F12 → Console for detailed errors
3. **Try a different browser** — Rules out browser-specific issues
4. **Check service status** — Visit the platform status page
5. **Contact support** — contehconsulting@gmail.com for persistent issues

## Related Guides

- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [FAQ](FAQ.md) - Frequently asked questions
- [Getting Started](GETTING_STARTED.md) - Initial setup guide
