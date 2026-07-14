# 📦 SBOM / AIBOM Guide

Track software and AI components, manage license compliance, and link vulnerabilities to your bill of materials.

## Overview

ControlWeave's SBOM (Software Bill of Materials) and AIBOM (AI Bill of Materials) module lets you upload standard SBOM files, automatically parse their components into your asset inventory, detect license risks, and link discovered vulnerabilities to specific components.

---

## What is an SBOM?

A **Software Bill of Materials (SBOM)** is a machine-readable inventory of all software components in an application — including open-source libraries, their versions, licenses, and dependencies.

An **AIBOM** is an SBOM extended to cover AI/ML components including models, datasets, and AI frameworks.

---

## Supported SBOM Formats

ControlWeave accepts SBOM files in these standard formats (up to **25 MB**):

| Format | File Extension |
|--------|---------------|
| CycloneDX (JSON) | `.json` |
| CycloneDX (XML) | `.xml` |
| SPDX (JSON) | `.json`, `.spdx+json` |
| SPDX (YAML) | `.yaml`, `.yml` |
| SPDX (RDF) | `.rdf` |
| SWID Tag | `.swid`, `.swidtag` |

---

## Uploading an SBOM

### Step 1: Navigate to SBOM

1. Click **SBOM** in the left sidebar
2. You'll see existing SBOM imports and component inventory

### Step 2: Upload an SBOM File

1. Click **Upload SBOM**
2. Select the **Asset** this SBOM belongs to (from your CMDB)
3. Choose or drag-and-drop your SBOM file
4. Click **Upload**

### Step 3: Review Parsed Results

After upload, ControlWeave parses the SBOM and:

- Creates **Software Asset** records for each component in your CMDB
- Links each component to the parent asset
- Detects **License Risk** (prohibited, review-required, or acceptable)
- Flags components with **Known Vulnerabilities**
- Automatically creates **Vulnerability Findings** for CVEs found in the SBOM

> **💡 Tip**: If a component already exists in your CMDB (matched by PURL, BOM reference, or name+version), it is updated rather than duplicated.

---

## Component Details

Each parsed component becomes an asset record showing:

- **Component Name** and **Version**
- **Package URL (PURL)** — standard package identifier
- **BOM Reference** — SBOM-specific reference
- **License(s)** — detected software licenses
- **License Risk** — Prohibited, Review Required, or Acceptable
- **Known Vulnerabilities** — count of CVEs affecting this component
- **Supplier** — originating organization or repository
- **Approved for Use** — whether this component is authorized

### License Risk Classification

| Status | Licenses | Action Required |
|--------|----------|-----------------|
| **Prohibited** | GPL-3.0, AGPL-3.0 | Remove or replace component |
| **Review Required** | LGPL-2.1, MPL-2.0 | Legal review needed |
| **Acceptable** | MIT, Apache-2.0, BSD, etc. | No action required |

---

## Vulnerability Integration

When SBOM components have known CVEs, ControlWeave automatically creates **Vulnerability Findings** with:

- CVE identifier and description
- Severity level
- Due date based on severity:
  - Critical → 14 days
  - High → 30 days
  - Medium → 60 days
  - Low → 90 days
- Link back to the affected SBOM component

These findings appear in your **Vulnerabilities** module for remediation tracking.

---

## Viewing Your Component Inventory

### Component List

1. Go to **SBOM** → **Components**
2. See all parsed components across all SBOM imports
3. Filter by:
   - **Asset** (parent system)
   - **License Risk** (Prohibited / Review Required / Acceptable)
   - **Has Vulnerabilities** (components with known CVEs)
   - **Approved for Use**

### Component Detail

Click any component to see:
- Full metadata (name, version, PURL, supplier)
- License details
- CVEs linked to this component
- Approval status

---

## SBOM History

Each uploaded SBOM file is preserved with:

- Upload date and uploaded-by user
- File name and format
- Number of components parsed
- Number of new vs. updated components
- Number of vulnerability findings created

---

## AIBOM (AI Bill of Materials)

For AI/ML systems, ControlWeave handles AIBOM files with the same upload flow. AI-specific component types are recognized:

- **Model** — AI/ML model files (e.g., LLMs, classifiers)
- **Dataset** — training or evaluation datasets
- **Library** — AI/ML frameworks (e.g., PyTorch, TensorFlow)
- **Infrastructure** — GPU/compute infrastructure components
- **API** — external AI API dependencies
- **Tool** — AI development tools

AIBOM components link to the **AI Governance** module for additional risk assessment.

---

ControlWeaver has no tier gating — SBOM upload, component parsing, license risk detection, vulnerability linking, and AIBOM support are all available to every authenticated user.

---

## Related Features

- [CMDB Guide](CMDB.md) — Manage the assets that SBOMs are associated with
- [Vulnerabilities Guide](VULNERABILITIES.md) — Remediate CVEs discovered in SBOMs
- [AI Governance Guide](AI_GOVERNANCE.md) — Govern AI components from your AIBOM
- [Threat Intelligence Guide](THREAT_INTELLIGENCE.md) — Enrich SBOM vulnerabilities with threat feeds
