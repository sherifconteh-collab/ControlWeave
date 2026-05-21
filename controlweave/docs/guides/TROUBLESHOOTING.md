# 🆘 Troubleshooting Guide

Solutions for common issues encountered in ControlWeave.

## Login Issues

### Can't Log In / Invalid Credentials
- Ensure you're using the correct email address
- Use **Forgot Password** to reset your credentials
- Check if your account has been deactivated by your administrator
- Clear browser cache and cookies, then try again

### Passkey Not Working
- Ensure you're using the same device/browser where you registered the passkey
- For hardware keys, ensure the key is plugged in and press the button when prompted
- Remove the old passkey in **Account Settings** → **Security** and re-register

### SSO/SAML Login Fails (Enterprise)
- Confirm the IdP attribute mappings include `email`
- Verify the SP entity ID and ACS URL match your IdP configuration
- Check with your identity provider admin that your account is assigned to the application

---

## AI Features Issues

### AI Analysis Fails or Shows No Results
1. Verify your LLM provider is configured in **Settings** → **LLM Configuration**
2. Confirm the API key is valid and has not expired
3. Check your AI request quota (visible in Settings → LLM Configuration)
4. Try a different LLM provider if one is unavailable

### AI Copilot Not Responding
- Ensure your LLM provider API key is active
- Check browser console for network errors (F12 → Console)
- Refresh the page and try again
- Try switching to a different provider in Settings

---

## Evidence Upload Issues

### File Upload Fails
- Maximum file size: **25MB** per file
- Supported formats: PDF, DOCX, XLSX, PNG, JPG, CSV, TXT
- Ensure you have write permissions for the control
- Try a different browser if the issue persists

### Evidence Not Appearing After Upload
- Refresh the page
- Check the **Pending** queue in Evidence Management
- Verify the file was linked to the correct control

---

## Assessment Issues

### Assessment Results Not Saving
- Ensure you have the **Analyst** role or above
- Check your internet connection
- The assessment auto-saves every 30 seconds; look for the "Saved" indicator

---

## Performance Issues

### Dashboard Loading Slowly
- Large datasets (500+ controls, 1000+ evidence items) may cause slow loads
- Use framework or control family filters to narrow scope
- Clear browser cache

---

## Getting Additional Help

- **AI Copilot**: Ask the purple chat button for guidance
- **Email Support**: contehconsulting@gmail.com (Professional & Enterprise)
- **Dedicated CSM**: Available for Enterprise customers

## Related Guides

- [FAQ](FAQ.md) - Frequently asked questions
- [Error Messages](ERROR_MESSAGES.md) - Error message reference
- [Account Setup](ACCOUNT_SETUP.md) - Initial configuration guide
