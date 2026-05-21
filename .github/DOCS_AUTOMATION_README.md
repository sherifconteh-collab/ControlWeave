# 📚 Automated Documentation Update System

This system automatically detects feature changes in the codebase and updates the documentation accordingly, including capturing new screenshots when UI changes are detected.

## Overview

When code changes are pushed that affect features, the system:
1. **Detects** which features have changed
2. **Identifies** which documentation files need updates
3. **Captures** screenshots if UI changes are detected
4. **Generates** documentation updates
5. **Creates** a Pull Request for review

## How It Works

### 1. Change Detection

The system monitors changes to:
- **Backend Routes** (`controlweave/backend/src/routes/**`)
- **Backend Services** (`controlweave/backend/src/services/**`)
- **Frontend Components** (`controlweave/frontend/src/**`)

When changes are detected, it:
- Matches changed files to feature patterns
- Determines change type (major, minor, patch, UI)
- Identifies affected documentation files

### 2. Screenshot Automation

For UI changes, the system:
- Launches a headless browser (Playwright)
- Logs into a demo environment
- Navigates to affected pages
- Captures screenshots automatically
- Saves them to `controlweave/docs/screenshots/`

### 3. Documentation Updates

The system:
- Reads documentation templates
- Generates updated sections
- Updates feature descriptions
- Adds new screenshots
- Maintains consistent formatting

### 4. Review Process

A Pull Request is created with:
- All documentation changes
- New screenshots (if any)
- Checklist for manual review
- Links to changed features

## Configuration

### Feature Mapping

Edit `.github/feature-docs-map.json` to configure:

```json
{
  "featureMapping": {
    "feature-name": {
      "codePatterns": [
        "path/to/code/**/*.js"
      ],
      "documentation": [
        "docs/guides/FEATURE.md"
      ],
      "screenshots": [
        "feature-screenshot-01.png"
      ],
      "changeTypes": ["major", "minor", "removal"]
    }
  }
}
```

### Screenshot Routes

Edit `.github/scripts/capture-screenshots.js` to add routes:

```javascript
const captureRoutes = {
  'feature-name': [
    { 
      path: '/dashboard/feature', 
      name: 'feature-screenshot-01.png',
      description: 'Feature overview'
    }
  ]
};
```

## Triggering Updates

### Automatic Triggers

The workflow runs automatically when:
- Code is pushed to `main` or `develop` branches
- A Pull Request is opened/updated
- Changes affect monitored paths

### Manual Trigger

Run manually via GitHub Actions:
```bash
gh workflow run docs-auto-update.yml
```

## Change Types

### Major Changes
**Triggers**: Breaking changes, removed features, API changes  
**Actions**: Full documentation rewrite, migration guides  
**Keywords**: `BREAKING CHANGE:`, `removed feature`, `deprecated`

### Minor Changes
**Triggers**: New features, enhancements  
**Actions**: Add new sections, update feature lists  
**Keywords**: `feat:`, `feature:`, `add:`

### Patch Changes
**Triggers**: Bug fixes, small tweaks  
**Actions**: Update existing sections, fix errors  
**Keywords**: `fix:`, `bugfix:`, `patch:`

### UI Changes
**Triggers**: Frontend changes, styling updates  
**Actions**: Capture new screenshots, update visual guides  
**Keywords**: `ui:`, `style:`, `design:`

## Environment Variables

Set these in GitHub repository settings (Settings → Secrets and variables → Actions):

### Required
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

### Optional (for screenshots)
- `DEMO_URL` - URL of demo environment (default: http://localhost:3000)
- `DEMO_USERNAME` - Demo account email
- `DEMO_PASSWORD` - Demo account password

## File Structure

```
.github/
├── workflows/
│   └── docs-auto-update.yml          # Main workflow
├── scripts/
│   ├── detect-feature-changes.js     # Change detection
│   ├── capture-screenshots.js        # Screenshot automation
│   ├── generate-doc-updates.js       # Doc generation
│   └── update-feature-map.js         # Mapping updates
├── feature-docs-map.json             # Feature → Docs mapping
└── DOCS_AUTOMATION_README.md         # This file
```

## Review Process

### Automated PR Checklist

When a documentation PR is created, reviewers should:

- [ ] Review all documentation changes for accuracy
- [ ] Verify screenshots show correct UI state
- [ ] Check that examples are up-to-date
- [ ] Ensure terminology is consistent
- [ ] Validate links and cross-references
- [ ] Test all code examples
- [ ] Verify tier-specific information is correct

### Approval

Documentation PRs require:
1. **Review** by docs team member
2. **Approval** by feature owner (for major changes)
3. **Testing** of code examples (if applicable)

## Maintenance

### Adding New Features

When adding a new feature:

1. **Update feature mapping**:
   ```json
   {
     "new-feature": {
       "codePatterns": ["path/to/new-feature/**"],
       "documentation": ["docs/guides/NEW_FEATURE.md"],
       "screenshots": ["new-feature-01.png"],
       "changeTypes": ["major", "minor"]
     }
   }
   ```

2. **Create documentation template**:
   - Add to `docs/guides/`
   - Include screenshot placeholders
   - Follow existing guide structure

3. **Add screenshot routes**:
   - Edit `capture-screenshots.js`
   - Define navigation paths
   - Add custom actions if needed

### Updating Screenshot Automation

To add new screenshot capture:

```javascript
{
  path: '/dashboard/new-feature',
  name: 'new-feature-overview-01.png',
  description: 'New feature overview',
  action: async (page) => {
    // Custom actions before screenshot
    await page.click('[data-testid="open-modal"]');
    await page.waitForTimeout(1000);
  }
}
```

### Troubleshooting

**Screenshots not capturing?**
- Check demo environment is running
- Verify credentials are correct
- Check browser can access demo URL
- Review screenshot script logs

**Documentation not updating?**
- Check feature mapping is correct
- Verify file paths match actual structure
- Review git diff output
- Check workflow logs

**PR not being created?**
- Verify GITHUB_TOKEN permissions
- Check branch protection rules
- Review workflow logs for errors

## Best Practices

### Commit Messages

Use conventional commits to help detection:

```bash
feat: Add new dashboard widget
fix: Correct assessment results display
ui: Update controls list styling
BREAKING CHANGE: Remove legacy API endpoint
```

### Documentation Writing

When the system updates docs:
- Maintains consistent tone and style
- Uses existing templates
- Preserves formatting
- Adds proper cross-references

### Screenshot Quality

Automated screenshots should:
- Use consistent resolution (1920x1080)
- Show realistic data (not test/demo placeholders)
- Include relevant UI state
- Be properly cropped and sized

## Integration with Development Workflow

### Pull Request Workflow

```
1. Developer creates PR with feature changes
   ↓
2. CI detects documentation impact
   ↓
3. Bot comments on PR with documentation requirements
   ↓
4. Automated documentation PR is created
   ↓
5. Docs team reviews documentation PR
   ↓
6. Feature PR and docs PR are merged together
```

### Release Workflow

```
1. Feature release is tagged
   ↓
2. Documentation PR is created
   ↓
3. Docs are reviewed and approved
   ↓
4. Release notes include documentation updates
   ↓
5. Documentation is published
```

## Metrics

Track documentation automation effectiveness:
- **Detection Rate**: % of feature changes detected
- **Automation Rate**: % of docs updated automatically
- **Review Time**: Time to review auto-generated docs
- **Screenshot Quality**: % of screenshots needing retakes
- **Documentation Lag**: Time from code change to docs update

## Future Enhancements

Planned improvements:
- [ ] AI-powered documentation generation
- [ ] Video capture for complex workflows
- [ ] Multi-language documentation support
- [ ] Documentation testing (link checking, etc.)
- [ ] Integration with release notes
- [ ] Automated tier comparison updates
- [ ] Example code testing
- [ ] Documentation version management

## Support

For issues with documentation automation:
1. Check workflow logs in GitHub Actions
2. Review feature mapping configuration
3. Test scripts locally if possible
4. Contact @docs-team for assistance

## Contributing

To contribute to the automation system:
1. Test changes locally first
2. Update this README with new features
3. Add examples for new capabilities
4. Document configuration changes
5. Test with real feature changes

---

**Last Updated**: February 2026  
**Maintained By**: @docs-team  
**Questions?** Open an issue with label `documentation-automation`
