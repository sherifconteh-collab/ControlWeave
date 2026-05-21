# Phase 7: External Integrations

## Overview
Phase 7 introduces comprehensive external integrations for threat intelligence, vendor security APIs, and regulatory news aggregation. This enhances ControlWeave's ability to provide real-time security insights, vendor risk management, and compliance intelligence.

## Timeline
- **Duration**: 4-5 weeks
- **Resources**: 1-2 backend developers
- **Priority**: High

## Components

### 1. Threat Intelligence Integrations

#### 1.1 NIST NVD (National Vulnerability Database)
- **Purpose**: CVE vulnerability data aggregation
- **API**: https://services.nvd.nist.gov/rest/json/cves/2.0
- **Features**:
  - Real-time CVE feed ingestion
  - CVSS score tracking
  - Vulnerability metadata (CWE, references, descriptions)
  - Historical vulnerability data
- **Rate Limit**: 5 requests per 30 seconds (without API key), 50 requests per 30 seconds (with API key)
- **Authentication**: Optional API key (recommended)
- **Tier Requirement**: Professional+

#### 1.2 CISA KEV (Known Exploited Vulnerabilities)
- **Purpose**: Actively exploited vulnerability tracking
- **API**: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
- **Features**:
  - Known exploited vulnerabilities catalog
  - Due date tracking for remediation
  - Vendor and product mapping
  - Notes on exploitation details
- **Rate Limit**: Public JSON feed (no authentication required)
- **Update Frequency**: Daily
- **Tier Requirement**: Starter+

#### 1.3 MITRE ATT&CK
- **Purpose**: Adversary tactics, techniques, and procedures (TTPs)
- **API**: https://github.com/mitre/cti (STIX/TAXII)
- **Features**:
  - Threat actor profiles
  - Attack techniques mapping
  - Mitigation strategies
  - Detection methods
- **Rate Limit**: Public GitHub repository
- **Update Frequency**: Quarterly major updates
- **Tier Requirement**: Professional+

#### 1.4 AlienVault OTX (Open Threat Exchange)
- **Purpose**: Community-driven threat intelligence
- **API**: https://otx.alienvault.com/api/v1/
- **Features**:
  - Threat pulses (IoCs, TTPs)
  - IP/domain/hash reputation
  - Malware analysis reports
  - Community threat sharing
- **Rate Limit**: 10 requests per second (free tier)
- **Authentication**: API key (free registration)
- **Tier Requirement**: Professional+

### 2. Vendor Security APIs

#### 2.1 SecurityScorecard
- **Purpose**: Third-party security posture ratings
- **API**: https://api.securityscorecard.io/
- **Features**:
  - Vendor security ratings (A-F)
  - Risk factors by category
  - Historical score trends
  - Automated vendor monitoring
- **Authentication**: API key (commercial license required)
- **Rate Limit**: Varies by license tier
- **Tier Requirement**: Enterprise

#### 2.2 BitSight
- **Purpose**: Continuous security ratings
- **API**: https://api.bitsighttech.com/
- **Features**:
  - Security ratings (250-900 scale)
  - Risk vectors and findings
  - Vendor comparison
  - Portfolio monitoring
- **Authentication**: API key (commercial license required)
- **Rate Limit**: Varies by license tier
- **Tier Requirement**: Enterprise

### 3. Regulatory News Aggregation

#### 3.1 Data Sources
- **FedRAMP Updates**: https://www.fedramp.gov/
- **NIST Publications**: https://csrc.nist.gov/publications
- **CISA Alerts**: https://www.cisa.gov/news-events/cybersecurity-advisories
- **GDPR Updates**: Official EU sources
- **HIPAA Guidance**: HHS.gov
- **PCI DSS Updates**: PCI Security Standards Council

#### 3.2 Features
- RSS feed aggregation
- Keyword filtering by framework
- Automated change detection
- Compliance impact assessment
- Email notifications for relevant updates

## Technical Architecture

### Database Schema

#### external_threat_feeds
```sql
CREATE TABLE external_threat_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feed_type VARCHAR(50) NOT NULL, -- 'nvd', 'cisa_kev', 'mitre', 'otx'
  feed_name VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  api_key_encrypted TEXT,
  configuration JSONB DEFAULT '{}',
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(50), -- 'success', 'error', 'pending'
  sync_error_message TEXT,
  rate_limit_remaining INTEGER,
  rate_limit_reset_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### threat_intelligence_items
```sql
CREATE TABLE threat_intelligence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES external_threat_feeds(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- 'cve', 'kev', 'attack_technique', 'pulse'
  external_id VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity VARCHAR(20), -- 'critical', 'high', 'medium', 'low'
  cvss_score NUMERIC(3,1),
  cvss_vector TEXT,
  cwe_ids TEXT[],
  affected_products TEXT[],
  exploit_available BOOLEAN DEFAULT false,
  exploit_maturity VARCHAR(50),
  published_at TIMESTAMP,
  modified_at TIMESTAMP,
  due_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (organization_id, feed_id, external_id)
);
```

#### vendor_security_scores
```sql
CREATE TABLE vendor_security_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_name VARCHAR(255) NOT NULL,
  vendor_domain VARCHAR(255),
  score_provider VARCHAR(50) NOT NULL, -- 'securityscorecard', 'bitsight'
  score_value INTEGER,
  score_grade VARCHAR(5), -- 'A', 'B', 'C', 'D', 'F' or numeric
  score_date DATE NOT NULL,
  risk_factors JSONB DEFAULT '{}',
  findings_summary JSONB DEFAULT '{}',
  previous_score INTEGER,
  score_trend VARCHAR(20), -- 'improving', 'stable', 'declining'
  assessment_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### regulatory_news_items
```sql
CREATE TABLE regulatory_news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source VARCHAR(100) NOT NULL, -- 'fedramp', 'nist', 'cisa', 'gdpr', etc.
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  url TEXT NOT NULL,
  published_at TIMESTAMP NOT NULL,
  relevant_frameworks TEXT[], -- ['NIST 800-53', 'ISO 27001', etc.]
  impact_level VARCHAR(20), -- 'high', 'medium', 'low'
  keywords TEXT[],
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (organization_id, source, url)
);
```

### Service Layer

#### threatIntelService.js
Core service for managing threat intelligence feeds:
- Feed registration and configuration
- Sync scheduling and orchestration
- Data aggregation and normalization
- Cache management
- Error handling and retry logic

#### Individual Feed Services
- `nvdService.js` - NIST NVD integration
- `cisaKevService.js` - CISA KEV integration
- `mitreService.js` - MITRE ATT&CK integration
- `alienVaultService.js` - AlienVault OTX integration

#### vendorSecurityService.js
- Vendor score retrieval
- Score history tracking
- Risk assessment
- Automated monitoring

#### regulatoryNewsService.js
- RSS/Atom feed parsing
- Content extraction and summarization
- Framework relevance matching
- Change detection

### API Endpoints

#### Threat Intelligence
```
GET    /api/v1/threat-intel/feeds              - List configured feeds
POST   /api/v1/threat-intel/feeds              - Configure new feed
PATCH  /api/v1/threat-intel/feeds/:id          - Update feed config
DELETE /api/v1/threat-intel/feeds/:id          - Remove feed
POST   /api/v1/threat-intel/feeds/:id/sync     - Trigger manual sync
GET    /api/v1/threat-intel/items              - List threat intel items
GET    /api/v1/threat-intel/items/:id          - Get item details
GET    /api/v1/threat-intel/stats              - Get statistics
```

#### Vendor Security
```
GET    /api/v1/vendor-security/scores          - List vendor scores
POST   /api/v1/vendor-security/scores          - Add vendor monitoring
GET    /api/v1/vendor-security/scores/:id      - Get score details
POST   /api/v1/vendor-security/scores/:id/refresh - Refresh score
DELETE /api/v1/vendor-security/scores/:id      - Remove vendor
GET    /api/v1/vendor-security/trends          - Get trend analysis
```

#### Regulatory News
```
GET    /api/v1/regulatory-news                 - List news items
GET    /api/v1/regulatory-news/:id             - Get news details
PATCH  /api/v1/regulatory-news/:id             - Mark as read/archived
GET    /api/v1/regulatory-news/unread-count    - Get unread count
POST   /api/v1/regulatory-news/refresh         - Trigger refresh
```

### Integration Hub Templates

New connector types to add to integrationsHub.js:

```javascript
{
  type: 'nvd',
  label: 'NIST NVD',
  category: 'Threat Intelligence',
  required: [],
  optional: ['apiKey'],
  supports_realtime: true,
  description: 'National Vulnerability Database CVE feed'
},
{
  type: 'cisa_kev',
  label: 'CISA KEV',
  category: 'Threat Intelligence',
  required: [],
  supports_realtime: true,
  description: 'Known Exploited Vulnerabilities catalog'
},
{
  type: 'mitre_attack',
  label: 'MITRE ATT&CK',
  category: 'Threat Intelligence',
  required: [],
  supports_realtime: false,
  description: 'Adversary tactics and techniques'
},
{
  type: 'alienvault_otx',
  label: 'AlienVault OTX',
  category: 'Threat Intelligence',
  required: ['apiKey'],
  supports_realtime: true,
  description: 'Open Threat Exchange'
},
{
  type: 'securityscorecard',
  label: 'SecurityScorecard',
  category: 'Vendor Security',
  required: ['apiKey'],
  supports_realtime: false,
  description: 'Third-party security ratings'
},
{
  type: 'bitsight',
  label: 'BitSight',
  category: 'Vendor Security',
  required: ['apiKey'],
  supports_realtime: false,
  description: 'Continuous security ratings'
}
```

## Scheduled Jobs

### Threat Intelligence Sync Jobs
- **Frequency**: Every 6 hours (configurable)
- **Job Type**: `threat_intel_sync`
- **Priority**: Medium
- **Timeout**: 15 minutes

### Vendor Security Score Refresh
- **Frequency**: Daily at 2 AM (configurable)
- **Job Type**: `vendor_security_refresh`
- **Priority**: Low
- **Timeout**: 30 minutes

### Regulatory News Aggregation
- **Frequency**: Every 4 hours (configurable)
- **Job Type**: `regulatory_news_refresh`
- **Priority**: Medium
- **Timeout**: 10 minutes

## Security Considerations

### API Key Management
- All API keys stored encrypted using AES-256
- Keys never logged or exposed in responses
- Masked display in UI (show only last 4 characters)
- Audit logging for all key operations

### Rate Limiting
- Respect external API rate limits
- Implement exponential backoff for failures
- Cache responses where appropriate
- Track rate limit quotas per feed

### Data Privacy
- Threat intelligence data is organization-scoped
- No cross-organization data sharing
- Comply with data retention policies
- Allow data export and deletion

### Error Handling
- Graceful degradation on API failures
- Retry logic with exponential backoff
- Error notification to administrators
- Fallback to cached data when available

## Tier Requirements

| Feature | Community | Pro | Pro | Enterprise |
|---------|------|---------|--------------|------------|
| CISA KEV | ❌ | ✅ | ✅ | ✅ |
| NIST NVD | ❌ | ❌ | ✅ | ✅ |
| MITRE ATT&CK | ❌ | ❌ | ✅ | ✅ |
| AlienVault OTX | ❌ | ❌ | ✅ | ✅ |
| SecurityScorecard | ❌ | ❌ | ❌ | ✅ |
| BitSight | ❌ | ❌ | ❌ | ✅ |
| Regulatory News | ❌ | ✅ | ✅ | ✅ |

## Vulnerability Correlation

Threat intelligence items will be correlated with existing vulnerability findings:

```sql
-- Correlate CVEs with vulnerability findings
UPDATE vulnerability_findings vf
SET metadata = jsonb_set(
  COALESCE(vf.metadata, '{}'),
  '{threat_intel}',
  (
    SELECT jsonb_build_object(
      'kev_listed', ti.exploit_available,
      'exploit_maturity', ti.exploit_maturity,
      'cvss_score', ti.cvss_score,
      'published_at', ti.published_at
    )
    FROM threat_intelligence_items ti
    WHERE ti.external_id = vf.vulnerability_id
    AND ti.item_type = 'cve'
    LIMIT 1
  )
)
WHERE vf.vulnerability_id LIKE 'CVE-%';
```

## Integration with Existing Features

### CMDB Integration
- Link threat intelligence to affected assets
- Automatic asset vulnerability scoring
- Risk-based prioritization

### Compliance Framework Mapping
- Map vulnerabilities to control requirements
- Generate evidence for RA-5, CA-7, SI-2
- Automated compliance impact assessment

### Audit Logging
- Log all external API calls
- Track data synchronization events
- Record configuration changes

### AI Copilot Enhancement
- Provide threat context to AI analyses
- Enhance gap analysis with real-time threats
- Improve risk prioritization recommendations

## Testing Strategy

### Unit Tests
- Service layer functionality
- API endpoint validation
- Data transformation logic
- Error handling scenarios

### Integration Tests
- Mock external API responses
- Test rate limiting
- Verify data persistence
- Check audit logging

### End-to-End Tests
- Full sync workflow (with mocked APIs)
- Vendor score retrieval
- Regulatory news aggregation
- UI integration

## Monitoring and Alerts

### Metrics to Track
- Feed sync success rate
- API response times
- Rate limit utilization
- Data freshness age
- Error rates by feed type

### Alerts
- Feed sync failures (after 3 retries)
- Rate limit approaching (>80%)
- API authentication failures
- Stale data (>24 hours old)

## Future Enhancements

### Phase 7.1 (Post-MVP)
- Custom threat intelligence feeds
- Webhook notifications for critical threats
- Advanced threat correlation
- Machine learning for threat prioritization

### Phase 7.2
- ISAC/ISAO integration
- Commercial threat intelligence feeds (Recorded Future, CrowdStrike)
- Automated response playbooks
- Threat hunting capabilities

## Success Metrics

### Technical Metrics
- Feed sync uptime: >99%
- API response time: <2 seconds (p95)
- Data freshness: <6 hours
- Zero API key exposures

### Business Metrics
- Vendor risk visibility: 100% of critical vendors monitored
- Threat detection time: <1 hour from publication
- Compliance evidence automation: >80% of RA-5 evidence
- User adoption: >60% of Professional+ orgs use threat intel

## Dependencies

### External Dependencies
- axios (HTTP client)
- node-cron (job scheduling)
- rss-parser (RSS feed parsing)
- stix2 (MITRE ATT&CK parsing)
- crypto (encryption)

### Internal Dependencies
- Existing integration framework
- Job queue system
- Webhook service
- Encryption utilities
- Audit logging

## Rollout Plan

### Week 1-2: Foundation
- Database migrations
- Core service structure
- API endpoint scaffolding
- Integration hub templates

### Week 2-3: Feed Implementation
- NIST NVD integration
- CISA KEV integration
- MITRE ATT&CK integration
- AlienVault OTX integration

### Week 3-4: Vendor Security
- SecurityScorecard integration
- BitSight integration
- Score tracking and trends

### Week 4-5: Regulatory News & Polish
- Regulatory news aggregation
- Frontend integration
- Testing and documentation
- Bug fixes and optimization

## Documentation Requirements

- [ ] API documentation for all endpoints
- [ ] Integration setup guides for each feed
- [ ] Admin guide for configuration
- [ ] User guide for interpreting threat data
- [ ] Troubleshooting guide
- [ ] Security best practices

## Conclusion

Phase 7 External Integrations significantly enhances ControlWeave's capabilities by providing real-time threat intelligence, vendor risk visibility, and regulatory awareness. This positions ControlWeave as a comprehensive GRC platform with proactive security insights.

**Estimated Effort**: 160-200 hours (4-5 weeks with 1-2 developers)
**Risk Level**: Medium (dependent on external API availability and rate limits)
**Business Value**: High (differentiating feature for competitive advantage)
