# 🛡️ Threat Intelligence Guide

Integrate threat feeds, track indicators of compromise (IOCs), and map threats to your compliance controls.

## Overview

The Threat Intelligence module lets you connect to external threat feeds, ingest IOCs and threat data, and correlate threats against your asset inventory and compliance controls.

---

## Supported Threat Feed Types

| Feed Type | Source | Data Provided |
|-----------|--------|---------------|
| **NVD** | NIST National Vulnerability Database | CVE data with CVSS scores |
| **CISA KEV** | CISA Known Exploited Vulnerabilities | Actively exploited CVEs |
| **MITRE ATT&CK** | MITRE Corporation | Adversary tactics and techniques |
| **OTX** | AlienVault Open Threat Exchange | Community threat indicators, IOCs |

---

## Managing Threat Feeds

### Viewing Feeds

1. Click **Threat Intelligence** in the left sidebar
2. Go to **Feeds** tab
3. See all configured threat feeds with status, last sync time, and item count

### Adding a Threat Feed

1. Click **Add Feed**
2. Select the **Feed Type** (nvd, cisa_kev, mitre, otx)
3. Enter the **Feed Name** — your label for this feed
4. Configure feed-specific settings:
   - **NVD**: Optional API key for higher rate limits
   - **OTX (AlienVault)**: API key required
   - **CISA KEV**: No credentials needed (public feed)
   - **MITRE ATT&CK**: No credentials needed (public data)
5. Click **Create Feed**

### Updating Feed Configuration

1. Find the feed in the list
2. Click the feed's action menu → **Edit**
3. Update configuration (credentials, filters, etc.)
4. Click **Save**

### Deleting a Feed

1. Find the feed in the list
2. Click **Delete**
3. Confirm deletion — this removes the feed configuration but not ingested threat data

---

## Syncing Feeds

### Manual Sync

To immediately pull the latest threat data:

1. Find the feed you want to sync
2. Click **Sync Now**
3. ControlWeave fetches the latest threat indicators from the source
4. New IOCs and threats are ingested into your threat library
5. A sync confirmation shows items added/updated

> **💡 Tip**: Sync results are logged in the audit trail for traceability.

### Automatic Sync

Feeds are synchronized automatically on a schedule. Check **Settings** → **Integrations** for sync frequency configuration.

---

## Threat Data

### Indicators of Compromise (IOCs)

Once feeds are synced, IOCs appear in your threat library:

1. Go to **Threat Intelligence** → **IOCs**
2. Browse or search IOCs by:
   - **Type** (IP address, domain, file hash, URL, CVE)
   - **Severity** (Critical, High, Medium, Low)
   - **Source Feed**
   - **Tags**

### Threat Actors and TTPs

From MITRE ATT&CK integration:
- Browse adversary groups (Threat Actors)
- See Tactics, Techniques, and Procedures (TTPs)
- Understand attack patterns relevant to your industry

---

## Mapping Threats to Controls

Threat intelligence is most valuable when connected to your compliance controls. ControlWeave allows you to:

1. **View control-threat linkages** — see which controls address which threat categories
2. **Identify gaps** — controls not yet implemented that address active threats
3. **Prioritize remediation** — focus on controls that mitigate the highest-severity active threats

### Threat-Control Mapping Workflow

1. Go to **Threat Intelligence** → **Control Mapping**
2. Filter by threat type or severity
3. See which controls from your active frameworks map to each threat
4. Click any control to navigate to its detail and implementation view

---

## Integration with Other Modules

### Vulnerability Management

Threat feeds (especially NVD and CISA KEV) enrich your vulnerability findings:
- CVE details are pulled from NVD
- CISA KEV flags CVEs actively exploited in the wild
- Exploited CVEs are automatically escalated in priority

### CMDB

Threats can be linked to specific assets in your CMDB:
- See which assets are exposed to which threats
- Prioritize patching and hardening for high-value assets

### SBOM

SBOM component vulnerabilities are enriched with NVD and CISA KEV data to show:
- CVSS scores for component CVEs
- Whether the CVE is on the CISA Known Exploited list

---

ControlWeaver has no tier gating — Threat Intelligence, the NVD/CISA KEV/MITRE ATT&CK/AlienVault OTX feeds, and manual sync are all available to every authenticated user.

---

## Related Features

- [Vulnerabilities Guide](VULNERABILITIES.md) — Remediate CVEs from threat feeds
- [SBOM Guide](SBOM.md) — Enrich component vulnerabilities with threat data
- [CMDB Guide](CMDB.md) — Link threats to your asset inventory
- [Security Posture Guide](SECURITY_POSTURE.md) — Aggregate threat data into risk scores
- [Integrations Guide](INTEGRATIONS.md) — Configure threat feed credentials
