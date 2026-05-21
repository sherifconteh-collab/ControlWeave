# External Integrations

> 📦 **Tier**: ❌ Free | ❌ Starter | ✅ Professional | ✅ Enterprise

## Overview

ControlWeave integrates with external threat intelligence feeds, vendor security rating services, and regulatory news sources to provide comprehensive, real-time security and compliance intelligence.

## Available Integrations (Phase 7)

### Threat Intelligence Feeds
Aggregate threat intelligence from multiple sources for proactive security monitoring.

**Supported Sources:**
- **NIST NVD**: CVE database with CVSS v2/v3/v3.1 support
- **CISA KEV**: Known Exploited Vulnerabilities with exploit maturity tracking
- **MITRE ATT&CK**: STIX parser for attack patterns and techniques
- **AlienVault OTX**: Open Threat Exchange pulse aggregation

**Features:**
- Automatic feed synchronization (hourly/daily/weekly)
- CVE correlation with your assets
- Exploit availability tracking
- Threat trend analysis

**API Endpoints:**
```bash
GET /api/v1/threat-intel/feeds
POST /api/v1/threat-intel/feeds/:id/sync
GET /api/v1/threat-intel/items?severity=critical
GET /api/v1/threat-intel/statistics
```

### Vendor Security Monitoring
Continuous monitoring of third-party vendor security posture.

**Supported Services:**
- **SecurityScorecard**: A-F security ratings
- **BitSight**: 250-900 security ratings
- Automatic score normalization
- Trend calculation and alerts

**Features:**
- Daily security score updates
- Automated vendor risk alerts
- Historical trend tracking
- Risk factor decomposition

**API Endpoints:**
```bash
GET /api/v1/vendor-security/scores
POST /api/v1/vendor-security/providers/:provider/refresh
GET /api/v1/vendor-security/trends/:vendorId
```

### Regulatory News Aggregation
Stay informed about regulatory changes affecting your compliance program.

**Sources:**
- RSS feeds from regulatory bodies
- Framework-specific news (NIST, ISO, PCI DSS, etc.)
- Keyword-based filtering
- Impact classification

**Features:**
- Framework relevance matching
- Keyword extraction
- Unread tracking
- Batch mark as read

**API Endpoints:**
```bash
GET /api/v1/regulatory-news/items?unread=true
POST /api/v1/regulatory-news/items/:id/mark-read
POST /api/v1/regulatory-news/items/mark-all-read
GET /api/v1/regulatory-news/sources
```

## Getting Started

### Step 1: Configure API Keys
1. Navigate to Settings → External Integrations
2. Select integration type (Threat Intel, Vendor Security, Regulatory News)
3. Enter API credentials:
   - NIST NVD: API key (optional, rate limits apply without)
   - SecurityScorecard: API token
   - BitSight: API key
4. Test connection
5. Save configuration

### Step 2: Set Up Feed Sync
1. Go to Integrations → Threat Intelligence
2. Click "Add Feed"
3. Select source (NIST NVD, CISA KEV, etc.)
4. Configure sync schedule:
   - **Hourly**: Critical feeds (CISA KEV)
   - **Daily**: Standard feeds (NIST NVD)
   - **Weekly**: Less time-sensitive feeds
5. Enable feed
6. Run initial sync

### Step 3: Configure Vendor Monitoring
1. Go to Integrations → Vendor Security
2. Add vendors to monitor:
   - Enter vendor domain
   - Select monitoring service
   - Set alert thresholds
3. Run initial assessment
4. Configure alert recipients

### Step 4: Subscribe to Regulatory News
1. Go to Integrations → Regulatory News
2. Select frameworks to monitor
3. Add custom RSS feeds (optional)
4. Configure notification preferences
5. Start receiving updates

## Database Schema

### Threat Intelligence
**Tables:**
- `external_threat_feeds`: Feed configuration and sync status
- `threat_intelligence_items`: CVEs, vulnerabilities, threats

**Fields:**
- CVSS scores (v2, v3, v3.1)
- Exploit availability
- Affected products
- Remediation guidance

### Vendor Security
**Tables:**
- `vendor_security_scores`: Security ratings by vendor

**Fields:**
- Provider (SecurityScorecard, BitSight)
- Current score
- Previous scores (trend tracking)
- Risk factors
- Last updated timestamp

### Regulatory News
**Tables:**
- `regulatory_news_items`: News articles and updates

**Fields:**
- Title, content, source
- Framework relevance
- Publication date
- Read status

## Tier Information

| Integration | Community | Pro | Pro | Enterprise |
|-------------|------|---------|--------------|------------|
| Threat Intelligence | ❌ | ❌ | ✅ | ✅ |
| Vendor Security Monitoring | ❌ | ❌ | ✅ | ✅ |
| Regulatory News | ❌ | ❌ | ✅ | ✅ |
| Custom RSS Feeds | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ | ✅ |
| Continuous Monitoring | ❌ | ❌ | ❌ | ✅ |

## Common Tasks

### Correlate CVE with Assets
When a new CVE is discovered:
1. Go to Threat Intelligence dashboard
2. Filter for new CVEs (last 24 hours)
3. Click on CVE
4. View "Affected Assets" section
5. System automatically correlates with CMDB
6. Create remediation tasks for affected systems

### Set Up Critical Vendor Alert
For high-risk vendors:
1. Go to Vendor Security
2. Find vendor in list
3. Click "Configure Alerts"
4. Set threshold (e.g., score drops below 700)
5. Add alert recipients
6. Save configuration
7. Receive email when score changes

### Monitor Framework Updates
For NIST 800-53 updates:
1. Go to Regulatory News
2. Click "Add Source"
3. Select "NIST" from framework dropdown
4. Enable notifications
5. Receive alerts when NIST publishes updates

## API Examples

### Sync Threat Feed
```bash
# Trigger manual sync of NIST NVD feed
POST /api/v1/threat-intel/feeds/nvd/sync
Authorization: Bearer YOUR_JWT_TOKEN

# Response
{
  "success": true,
  "sync_job_id": "job-123",
  "estimated_duration": "5-10 minutes"
}
```

### Get Critical Vulnerabilities
```bash
# Get CVEs with CVSS >= 9.0
GET /api/v1/threat-intel/items?severity=critical&cvss_min=9.0
Authorization: Bearer YOUR_JWT_TOKEN

# Response
{
  "items": [
    {
      "cve_id": "CVE-2026-12345",
      "cvss_score": 9.8,
      "exploit_available": true,
      "affected_products": ["Apache HTTP Server 2.4.x"],
      "published_date": "2026-02-18"
    }
  ],
  "total": 15,
  "page": 1
}
```

### Check Vendor Security Score
```bash
# Get latest score for vendor
GET /api/v1/vendor-security/scores/acme-corp
Authorization: Bearer YOUR_JWT_TOKEN

# Response
{
  "vendor_domain": "acme-corp.com",
  "provider": "securityscorecard",
  "current_score": "B",
  "numeric_score": 85,
  "previous_score": 82,
  "trend": "improving",
  "risk_factors": [
    {"category": "patching", "score": 90},
    {"category": "network_security", "score": 80}
  ]
}
```

## Security Considerations

### API Key Management
- Store API keys in environment variables
- Rotate keys quarterly
- Use separate keys for dev/staging/prod
- Monitor API usage for anomalies

### Data Retention
- Threat intelligence: 90 days (configurable)
- Vendor scores: 365 days (for trending)
- Regulatory news: Indefinite (archive old items)

### Rate Limiting
- Threat intel: 200 requests/15 minutes
- Vendor security: 100 requests/15 minutes
- Regulatory news: 300 requests/15 minutes

## Troubleshooting

### Issue: Feed sync failing
**Solution**: Check API key is valid and not expired. Verify network connectivity to external service.

### Issue: Vendor score not updating
**Solution**: Check vendor domain is correct. Some vendors may not be in provider's database.

### Issue: Too many threat intel alerts
**Solution**: Adjust severity threshold or enable CVE correlation to filter only relevant vulnerabilities.

## Related Documentation

- [Phase 7 Implementation Guide](../../../PHASE_7_IMPLEMENTATION_SUMMARY.md)
- [Threat Intelligence Guide](../../../PHASE_7_EXTERNAL_INTEGRATIONS.md)
- [Vendor Risk Management](../dashboards/Vendor-Risk-Dashboard)
- [Security Baseline](../security/Security-Baseline)

---
**Category**: Integrations  
**Tier**: Professional+  
**Last Updated**: February 18, 2026
