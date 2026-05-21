# Phase 7: External Integrations - Implementation Plan

## Overview

This phase integrates ControlWeave with external threat intelligence feeds, vendor security posture APIs, and regulatory news feeds to provide real-time, automated updates and enhanced risk intelligence.

## Scope

### 1. Threat Intelligence Integration

#### Supported Threat Intelligence Providers

**1. MITRE ATT&CK**
- Free, community-driven threat intelligence
- Tactics, techniques, and procedures (TTPs)
- Mappings to NIST 800-53 controls

**2. NIST NVD (National Vulnerability Database)**
- CVE database integration
- CVSS scoring
- CPE matching for vulnerability assessment

**3. CISA KEV (Known Exploited Vulnerabilities)**
- List of actively exploited vulnerabilities
- Priority for remediation
- Free government feed

**4. AlienVault OTX (Open Threat Exchange)**
- Community threat intelligence
- Indicators of Compromise (IOCs)
- Community tier available

**5. Commercial Providers (Optional)**
- Recorded Future
- ThreatQuotient
- Anomali ThreatStream

#### Implementation

**Threat Intelligence Service**:
```javascript
// backend/src/services/threatIntelligenceService.js

class ThreatIntelligenceService {
  constructor() {
    this.providers = {
      nvd: new NVDProvider(),
      cisaKev: new CISAKEVProvider(),
      mitreAttack: new MITREAttackProvider(),
      alienVault: new AlienVaultProvider()
    };
  }
  
  async syncThreatIntelligence(organizationId) {
    const results = {};
    
    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        console.log(`Syncing threat intelligence from ${name}...`);
        const data = await provider.fetch();
        await this.processAndStore(organizationId, name, data);
        results[name] = { success: true, count: data.length };
      } catch (error) {
        console.error(`Failed to sync from ${name}:`, error);
        results[name] = { success: false, error: error.message };
      }
    }
    
    return results;
  }
  
  async processAndStore(organizationId, provider, data) {
    // Match threat intelligence against organization's assets and vulnerabilities
    const assets = await this.getOrganizationAssets(organizationId);
    const matches = await this.matchThreats(assets, data);
    
    // Store threat intelligence and matches
    for (const match of matches) {
      await pool.query(
        `INSERT INTO threat_intelligence_matches (
          organization_id,
          provider,
          threat_id,
          threat_type,
          severity,
          asset_id,
          vulnerability_id,
          matched_at,
          details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
        ON CONFLICT (organization_id, provider, threat_id, asset_id) 
        DO UPDATE SET matched_at = NOW(), details = EXCLUDED.details`,
        [
          organizationId,
          provider,
          match.threat_id,
          match.threat_type,
          match.severity,
          match.asset_id,
          match.vulnerability_id,
          JSON.stringify(match.details)
        ]
      );
    }
  }
  
  async matchThreats(assets, threats) {
    const matches = [];
    
    for (const threat of threats) {
      for (const asset of assets) {
        if (this.isMatch(threat, asset)) {
          matches.push({
            threat_id: threat.id,
            threat_type: threat.type,
            severity: threat.severity,
            asset_id: asset.id,
            vulnerability_id: threat.vulnerability_id,
            details: threat
          });
        }
      }
    }
    
    return matches;
  }
  
  isMatch(threat, asset) {
    // Match based on CVE, CPE, software versions, etc.
    if (threat.type === 'vulnerability' && asset.sbom) {
      // Check if asset's SBOM contains affected software
      const components = asset.sbom.components || [];
      return components.some(comp => 
        this.componentMatchesCVE(comp, threat.cve_id)
      );
    }
    
    return false;
  }
  
  componentMatchesCVE(component, cveId) {
    // Simplified matching logic
    // In production, use CPE matching and version comparisons
    return component.vulnerabilities?.includes(cveId);
  }
}

// Provider implementations
class NVDProvider {
  async fetch() {
    // Fetch from NIST NVD API
    const response = await fetch(
      'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=100'
    );
    const data = await response.json();
    
    return data.vulnerabilities.map(vuln => ({
      id: vuln.cve.id,
      type: 'vulnerability',
      severity: this.getSeverity(vuln.cve.metrics),
      cve_id: vuln.cve.id,
      description: vuln.cve.descriptions[0]?.value,
      published: vuln.cve.published,
      modified: vuln.cve.lastModified,
      cvss_score: vuln.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore
    }));
  }
  
  getSeverity(metrics) {
    const score = metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore;
    if (!score) return 'unknown';
    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'high';
    if (score >= 4.0) return 'medium';
    return 'low';
  }
}

class CISAKEVProvider {
  async fetch() {
    const response = await fetch(
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
    );
    const data = await response.json();
    
    return data.vulnerabilities.map(vuln => ({
      id: vuln.cveID,
      type: 'exploited_vulnerability',
      severity: 'critical', // KEV are all critical
      cve_id: vuln.cveID,
      description: vuln.vulnerabilityName,
      exploit_added: vuln.dateAdded,
      due_date: vuln.dueDate,
      notes: vuln.notes
    }));
  }
}

class MITREAttackProvider {
  async fetch() {
    // Fetch from MITRE ATT&CK STIX data
    // For simplicity, using a cached/preprocessed version
    const response = await fetch(
      'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json'
    );
    const data = await response.json();
    
    // Process STIX objects into simplified format
    return data.objects
      .filter(obj => obj.type === 'attack-pattern')
      .map(pattern => ({
        id: pattern.id,
        type: 'attack_pattern',
        severity: 'high',
        name: pattern.name,
        description: pattern.description,
        tactics: pattern.kill_chain_phases?.map(p => p.phase_name),
        mitigations: pattern.x_mitre_mitigation || []
      }));
  }
}

class AlienVaultProvider {
  async fetch() {
    const apiKey = process.env.ALIENVAULT_API_KEY;
    if (!apiKey) {
      throw new Error('AlienVault API key not configured');
    }
    
    const response = await fetch(
      'https://otx.alienvault.com/api/v1/pulses/subscribed',
      {
        headers: {
          'X-OTX-API-KEY': apiKey
        }
      }
    );
    const data = await response.json();
    
    return data.results.flatMap(pulse => 
      pulse.indicators.map(indicator => ({
        id: indicator.id,
        type: 'indicator',
        severity: this.getSeverity(pulse.tags),
        indicator_type: indicator.type,
        indicator_value: indicator.indicator,
        pulse_name: pulse.name,
        description: pulse.description,
        tags: pulse.tags
      }))
    );
  }
  
  getSeverity(tags) {
    const lowerTags = tags.map(t => t.toLowerCase());
    if (lowerTags.some(t => t.includes('critical') || t.includes('apt'))) return 'critical';
    if (lowerTags.some(t => t.includes('malware') || t.includes('exploit'))) return 'high';
    return 'medium';
  }
}

module.exports = new ThreatIntelligenceService();
```

### 2. Vendor Security Posture APIs

#### Supported Vendor Posture Providers

**1. SecurityScorecard**
- Automated vendor security ratings
- Continuous monitoring
- Risk scoring

**2. BitSight**
- Security ratings platform
- Supply chain risk management
- Compliance monitoring

**3. UpGuard**
- Vendor risk management
- Data breach monitoring
- Security questionnaires

#### Implementation

**Vendor Posture Service**:
```javascript
// backend/src/services/vendorPostureService.js

class VendorPostureService {
  constructor() {
    this.providers = {
      securityscorecard: new SecurityScorecardProvider(),
      bitsight: new BitSightProvider()
    };
  }
  
  async syncVendorPosture(organizationId, vendorId) {
    const vendor = await this.getVendor(vendorId);
    const results = {};
    
    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        const rating = await provider.getRating(vendor.domain);
        await this.storeRating(organizationId, vendorId, name, rating);
        results[name] = { success: true, rating: rating.score };
      } catch (error) {
        console.error(`Failed to get rating from ${name}:`, error);
        results[name] = { success: false, error: error.message };
      }
    }
    
    // Update vendor assessment with latest ratings
    await this.updateVendorAssessment(vendorId, results);
    
    return results;
  }
  
  async storeRating(organizationId, vendorId, provider, rating) {
    await pool.query(
      `INSERT INTO vendor_security_ratings (
        organization_id,
        vendor_id,
        provider,
        score,
        grade,
        factors,
        fetched_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        organizationId,
        vendorId,
        provider,
        rating.score,
        rating.grade,
        JSON.stringify(rating.factors)
      ]
    );
  }
  
  async updateVendorAssessment(vendorId, ratings) {
    // Calculate aggregate score from multiple providers
    const scores = Object.values(ratings)
      .filter(r => r.success)
      .map(r => r.rating);
    
    if (scores.length === 0) return;
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const securityRiskScore = Math.round((100 - avgScore));
    
    await pool.query(
      `UPDATE ai_vendor_assessments
       SET security_risk_score = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [securityRiskScore, vendorId]
    );
  }
}

class SecurityScorecardProvider {
  async getRating(domain) {
    const apiKey = process.env.SECURITYSCORECARD_API_KEY;
    const response = await fetch(
      `https://api.securityscorecard.io/companies/${domain}`,
      {
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    
    return {
      score: data.score,
      grade: data.grade,
      factors: data.factors.map(f => ({
        name: f.name,
        score: f.score,
        grade: f.grade
      }))
    };
  }
}

class BitSightProvider {
  async getRating(domain) {
    const apiKey = process.env.BITSIGHT_API_KEY;
    const response = await fetch(
      `https://api.bitsighttech.com/ratings/v1/companies/${domain}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    
    return {
      score: data.rating,
      grade: this.scoreToGrade(data.rating),
      factors: data.rating_details.map(d => ({
        name: d.name,
        score: d.rating,
        grade: this.scoreToGrade(d.rating)
      }))
    };
  }
  
  scoreToGrade(score) {
    if (score >= 740) return 'A';
    if (score >= 690) return 'B';
    if (score >= 640) return 'C';
    if (score >= 580) return 'D';
    return 'F';
  }
}

module.exports = new VendorPostureService();
```

### 3. Regulatory News Feeds

#### News Sources

**1. Government Agencies**
- CISA (US)
- ENISA (EU)
- ICO (UK)
- Cyberspace Administration of China

**2. Industry Publications**
- Compliance Week
- SecurityWeek Compliance
- PrivacyTech
- AI Regulation Tracker

**3. RSS/Atom Feeds**
- Aggregate from multiple sources
- Parse and categorize
- AI-powered relevance scoring

#### Implementation

**Regulatory News Service**:
```javascript
// backend/src/services/regulatoryNewsService.js
const Parser = require('rss-parser');

class RegulatoryNewsService {
  constructor() {
    this.parser = new Parser();
    this.feeds = [
      {
        url: 'https://www.cisa.gov/cybersecurity-advisories/rss.xml',
        source: 'CISA',
        jurisdiction: 'US',
        type: 'advisory'
      },
      {
        url: 'https://www.enisa.europa.eu/publications/rss',
        source: 'ENISA',
        jurisdiction: 'EU',
        type: 'publication'
      },
      // Add more feeds
    ];
  }
  
  async syncNewsFeeds() {
    const results = [];
    
    for (const feed of this.feeds) {
      try {
        const parsed = await this.parser.parseURL(feed.url);
        
        for (const item of parsed.items) {
          // Check if already exists
          const exists = await this.newsItemExists(item.guid || item.link);
          if (exists) continue;
          
          // Analyze relevance using AI
          const relevance = await this.analyzeRelevance(item);
          
          // Store news item
          await this.storeNewsItem({
            source: feed.source,
            jurisdiction: feed.jurisdiction,
            type: feed.type,
            title: item.title,
            summary: item.contentSnippet || item.summary,
            url: item.link,
            published_at: new Date(item.pubDate || item.isoDate),
            relevance_score: relevance.score,
            relevance_tags: relevance.tags,
            guid: item.guid || item.link
          });
          
          results.push(item.title);
        }
      } catch (error) {
        console.error(`Failed to sync feed ${feed.url}:`, error);
      }
    }
    
    return results;
  }
  
  async analyzeRelevance(item) {
    // Use LLM to determine relevance to AI governance
    const prompt = `Analyze if this regulatory news is relevant to AI governance, compliance, or cybersecurity.

Title: ${item.title}
Summary: ${item.contentSnippet || item.summary || 'N/A'}

Provide:
1. Relevance score (0-100)
2. Relevant tags (choose from: ai-governance, data-privacy, cybersecurity, compliance, risk-management, vendor-management)
3. Brief reason

Format as JSON: {"score": 85, "tags": ["ai-governance", "compliance"], "reason": "..."}`;
    
    try {
      const response = await callLLM(null, prompt, {
        feature: 'news_relevance',
        temperature: 0.3,
        max_tokens: 200
      });
      
      return JSON.parse(response);
    } catch (error) {
      // Fallback to keyword-based scoring
      return this.keywordBasedScoring(item);
    }
  }
  
  keywordBasedScoring(item) {
    const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
    const keywords = {
      'ai': 20,
      'artificial intelligence': 25,
      'machine learning': 20,
      'compliance': 15,
      'regulation': 15,
      'gdpr': 20,
      'privacy': 15,
      'cybersecurity': 15,
      'vendor': 10,
      'risk': 10
    };
    
    let score = 0;
    const tags = [];
    
    for (const [keyword, points] of Object.entries(keywords)) {
      if (text.includes(keyword)) {
        score += points;
        if (keyword.includes('ai') || keyword.includes('artificial')) {
          tags.push('ai-governance');
        } else if (keyword.includes('compliance') || keyword.includes('regulation')) {
          tags.push('compliance');
        }
      }
    }
    
    return {
      score: Math.min(score, 100),
      tags: [...new Set(tags)],
      reason: 'Keyword-based scoring'
    };
  }
  
  async storeNewsItem(item) {
    await pool.query(
      `INSERT INTO regulatory_news (
        source, jurisdiction, type, title, summary, url,
        published_at, relevance_score, relevance_tags, guid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        item.source, item.jurisdiction, item.type, item.title,
        item.summary, item.url, item.published_at,
        item.relevance_score, JSON.stringify(item.relevance_tags), item.guid
      ]
    );
  }
  
  async newsItemExists(guid) {
    const result = await pool.query(
      'SELECT 1 FROM regulatory_news WHERE guid = $1',
      [guid]
    );
    return result.rows.length > 0;
  }
}

module.exports = new RegulatoryNewsService();
```

### 4. Scheduled Sync Jobs

#### Cron Job Configuration

```javascript
// backend/src/jobs/integrationSyncJobs.js
const cron = require('node-cron');

class IntegrationSyncJobs {
  start() {
    // Sync threat intelligence every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Running threat intelligence sync...');
      await threatIntelligenceService.syncThreatIntelligence();
    });
    
    // Sync vendor posture daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Running vendor posture sync...');
      const vendors = await this.getActiveVendors();
      for (const vendor of vendors) {
        await vendorPostureService.syncVendorPosture(
          vendor.organization_id,
          vendor.id
        );
      }
    });
    
    // Sync regulatory news every 4 hours
    cron.schedule('0 */4 * * *', async () => {
      console.log('Running regulatory news sync...');
      await regulatoryNewsService.syncNewsFeeds();
    });
    
    console.log('Integration sync jobs scheduled');
  }
  
  async getActiveVendors() {
    const result = await pool.query(
      `SELECT id, organization_id, vendor_name
       FROM ai_vendor_assessments
       WHERE status = 'active'
       AND vendor_website IS NOT NULL`
    );
    return result.rows;
  }
}

module.exports = new IntegrationSyncJobs();
```

## Database Schema

### Threat Intelligence Matches Table

```sql
CREATE TABLE IF NOT EXISTS threat_intelligence_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  threat_id VARCHAR(255) NOT NULL,
  threat_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE SET NULL,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  details JSONB,
  
  UNIQUE (organization_id, provider, threat_id, asset_id)
);

CREATE INDEX idx_threat_matches_org ON threat_intelligence_matches (organization_id);
CREATE INDEX idx_threat_matches_asset ON threat_intelligence_matches (asset_id);
CREATE INDEX idx_threat_matches_severity ON threat_intelligence_matches (organization_id, severity);
```

### Vendor Security Ratings Table

```sql
CREATE TABLE IF NOT EXISTS vendor_security_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES ai_vendor_assessments(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  score INTEGER,
  grade VARCHAR(5),
  factors JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_ratings_vendor ON vendor_security_ratings (vendor_id);
CREATE INDEX idx_vendor_ratings_date ON vendor_security_ratings (fetched_at DESC);
```

### Regulatory News Table

```sql
CREATE TABLE IF NOT EXISTS regulatory_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(100) NOT NULL,
  jurisdiction VARCHAR(10),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  relevance_score INTEGER,
  relevance_tags JSONB,
  guid VARCHAR(500) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regulatory_news_relevance ON regulatory_news (relevance_score DESC);
CREATE INDEX idx_regulatory_news_published ON regulatory_news (published_at DESC);
CREATE INDEX idx_regulatory_news_tags ON regulatory_news USING GIN (relevance_tags);
```

## API Endpoints

```javascript
// GET /api/v1/integrations/threat-intelligence/matches
// GET /api/v1/integrations/vendor-ratings/:vendorId
// GET /api/v1/integrations/regulatory-news
// POST /api/v1/integrations/sync/threat-intelligence
// POST /api/v1/integrations/sync/vendor-posture/:vendorId
// POST /api/v1/integrations/sync/regulatory-news
```

## Acceptance Criteria

- [ ] Threat intelligence syncs automatically every 6 hours
- [ ] Vendor security ratings update daily
- [ ] Regulatory news feeds update every 4 hours
- [ ] AI matches threats to organization's assets
- [ ] Notifications sent for new critical threats
- [ ] Vendor ratings integrated into risk assessments
- [ ] News items categorized by relevance
- [ ] Manual sync triggers available
- [ ] Integration status dashboard showing last sync times
- [ ] Error handling and retry logic for failed syncs

---

**Ready for Development**: After Phases 4-6
**Dependencies**: External API keys, LLM service
**Estimated Timeline**: 4-5 weeks
**Team Size**: 1-2 backend developers
