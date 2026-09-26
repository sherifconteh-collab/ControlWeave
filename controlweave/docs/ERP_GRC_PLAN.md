# ControlWeave for ERP Customers: Assessment and Plan

## Short answer

Yes, ERP customers are a good market for ControlWeave, but as the **governance, risk and audit layer that sits beside the ERP**, not as an ERP. The buyers that run Oracle E-Business Suite, SAP, Oracle Cloud ERP, Workday or Deltek Costpoint already pay for GRC. Some of that spend goes to ERP-specific tools, such as:

- SAP GRC Access Control
- Oracle Advanced Controls
- Pathlock
- SafePaaS
- Fastpath

The rest goes to general-purpose audit, SOX and integrated-risk platforms.

The federal financial-management world is an especially good fit, and it overlaps directly with what ControlWeave already does well. The Air Force's DEAMS is built on Oracle E-Business Suite, and DoD components are working through FIAR audit readiness, NFRs/CAPs, FISCAM IT control testing and RMF authorizations.

Today ControlWeave covers the **audit workflow and IT general controls** side well. It does **not yet** cover the part ERP buyers ask about first: **segregation of duties and access analysis inside the ERP itself**, plus continuous monitoring of ERP transactions. Closing that gap is roughly two to three quarters of focused work (phases 1 and 2 below). Phase 1 alone produces something sellable to federal audit-readiness teams without any ERP integration.

## Implementation status

Phases 1 to 3 have shipped, together with the code-side items from phase 4. ERP access governance and monitoring are sold as the separately licensed **ERP Governance** add-on; financial audit readiness stays in the free Community plan.

| Phase | Shipped | Still open |
|---|---|---|
| 1. Audit readiness | Expanded FISCAM content (control activities, business process, interface and data management families), COSO 2013 principles, SOX ITGC library, OMB A-123 readiness checklist; risk-control matrix with assertions and CSV import; design and operating effectiveness testing with frequency-table and binomial attribute sampling; NFR fields and POA&M-based CAPs; readiness by process and assertion with matrix export. See [Financial Audit Readiness](./guides/FINANCIAL_AUDIT.md). | DISA STIG content for Oracle Database, WebLogic and Oracle Linux; a formatted A-123 Statement of Assurance package; CAP validation evidence on milestones |
| 2. ERP access governance | CSV entitlement import for any ERP in merge or full-snapshot mode; SAP USR02 / AGR_USERS / AGR_1251 table imports; direct read-only connectors for Workday (RaaS), Oracle Fusion Cloud ERP and SAP Cloud Identity Services (SCIM 2.0) and Oracle E-Business Suite (database); daily or weekly scheduled syncs with analysis and monitoring; SAP transaction-code and Oracle EBS form-function starter maps; 39 business functions and a 47-rule SoD library; role- and user-level analysis; mitigating controls and time-boxed acceptance; access reviews routed to managers, with Jira or ITSM revocation tickets and revocations verified by later syncs; emergency access review. See [ERP Access Governance](./guides/ERP_ACCESS_GOVERNANCE.md). | RFC connector for on-premises SAP (needs SAP's proprietary library); starter maps for Workday domains and Oracle Fusion privileges |
| 3. Continuous monitoring | Transaction import (payments, invoices, journals, vendor changes, purchase orders, goods receipts) and 17 full-population rules, including three-way match and purchasing SoD; configuration monitoring against baselines, with recommended SAP and Oracle EBS settings and change history; each run recorded as a control test when tied to the matrix. See [ERP Transaction Monitoring](./guides/ERP_TRANSACTION_MONITORING.md). | Pulling transactions and settings directly from the ERP (today they come from extracts) |
| 4. Federal | FIPS mode that verifies the host's OpenSSL FIPS provider; guidance for CAC/PIV through the agency IdP over SAML. See [Federal Deployment](./guides/FEDERAL_DEPLOYMENT.md). | Section 508 VPAT; FedRAMP 20x / IL4-IL5 hosting and assessment |

## What ERP customers expect (buyer checklist)

| Need | Why they need it | ControlWeave today |
|---|---|---|
| **SoD ruleset and conflict analysis at the ERP function level** (for example "create supplier" plus "approve payment") | Top audit finding in every ERP audit (SOX, FISCAM access controls, A-123) | No. SoD analysis covers ControlWeave's own roles only |
| **ERP user access reviews / certifications** with manager routing and revocation tracking | Quarterly or annual requirement (AC-2, FISCAM AC, SOX ITGC) | Partial. Campaigns exist for ControlWeave users; nothing imports ERP users and responsibilities |
| **Emergency ("firefighter") access** logging and after-the-fact review | Standard SAP/EBS control; auditors sample it | No |
| **ERP connectors**: Oracle EBS (FND_USER, FND_USER_RESP_GROUPS, responsibilities, menus, functions), SAP (USR02, AGR_USERS, AGR_1251), Workday, Oracle Cloud | Without data the SoD/UAR features are manual | No. The connector framework exists (Okta, Entra ID, Jira now real) |
| **IT general controls library** (access, change, operations, SDLC) mapped to FISCAM, SOX and 800-53 | Basis of every IT audit of an ERP | Partial. 800-53 is complete; FISCAM has 12 controls |
| **FISCAM 2023** full content: security management, access, segregation of duties, configuration management, contingency planning, business process application controls | Federal financial audits (GAO/IPA) test against it | Partial (12 controls) |
| **OMB A-123 Appendix A / ICOFR** and **SOX 404 / COSO 2013** (17 principles) | Federal and public-company internal control over financial reporting | No |
| **Risk-control matrix (RCM)** with key controls, financial statement assertions and test of design/effectiveness with sampling | How auditors actually work | Partial. Assessments, procedures, workpapers and findings exist; no RCM, assertions or sampling |
| **NFR/CAP tracking** (Notices of Findings and Recommendations, Corrective Action Plans) | DoD audit remediation currency | Close. Findings and POA&M map well; needs NFR fields, CAP milestones and FIAR reporting |
| **Continuous controls monitoring** (duplicate payments, vendor bank-account changes, journal entries over threshold or after hours, SoD conflicts actually exercised) | Moves from sampling to full-population testing | No |
| **ERP change management evidence** (patches, customizations, migrations, approvals) | ITGC change control | Partial via the ITSM/Jira connectors |
| **Hardening baselines** (DISA STIGs for Oracle Database 19c, WebLogic, Oracle Linux) | DoD ATO and FISCAM configuration management | Partial. STIG framework seeders exist; add the Oracle STIGs |
| **Federal hosting and identity**: FedRAMP High / DoD IL4-IL5, CAC/PIV sign-in, FIPS 140-3 crypto, Section 508 | Procurement gates for DoD | Partial. Self-hosted/air-gapped license, SAML (usable with DoD IdPs), CNSA-grade crypto; no CAC client-certificate sign-in, no FedRAMP/IL authorization, no VPAT |
| **Scale**: 50k-500k ERP users, millions of entitlements and transactions | DoD and large enterprise | Not proven. Designed for organization-scale data; needs partitioned entitlement tables and background analysis jobs |

## Where ControlWeave is already strong for this market

- RMF lifecycle, all of NIST 800-53 Rev 5, 800-171 Rev 3 and CMMC, with crosswalks. Financial systems need ATOs too.
- Audit engagements with PBC requests, workpapers, findings and sign-offs. This is the IPA/auditor collaboration model.
- POA&M with milestones and slippage tracking, and now Jira ticket sync. This is the backbone for CAPs.
- Evidence with SHA-256 integrity, versioning, retention and legal holds; a hash-chained, append-only audit log; the QA self-test.
- Self-hosted, offline-verified license keys for air-gapped environments; SAML/SCIM for enterprise identity.

## Plan

### Phase 1: Financial audit readiness (about 3 months, no ERP integration needed)

1. **Content:**
   - FISCAM 2023, all critical elements and control activities
   - OMB A-123 Appendix A
   - COSO 2013, all 17 principles and points of focus
   - a SOX 404 ITGC library
   - DISA STIGs for Oracle Database 19c, WebLogic and Oracle Linux
2. **Risk-control matrix:**
   - Processes (P2P, O2C, R2R, H2R, treasury), risks and key controls.
   - Financial statement assertions: existence, completeness, rights and obligations, valuation, presentation.
   - Control frequency and type (manual, automated, IT-dependent manual).
3. **Testing:**
   - Test of design and test of operating effectiveness on the existing assessment procedures.
   - An attribute sampling calculator (GAO FAM / AICPA tables by control frequency and risk).
   - Exceptions that roll into findings.
4. **NFR/CAP:**
   - Extend findings with the NFR number, auditor, fiscal year, material weakness or significant deficiency, and linked CAP.
   - Extend POA&M milestones into CAPs with validation evidence.
5. **Reports:**
   - An audit readiness dashboard per assessable unit and assertion.
   - An A-123 statement of assurance support package.

**Sellable to:** DoD and civilian financial-management offices, audit-readiness support contractors and IPAs.

### Phase 2: ERP access governance (about 3 to 4 months)

1. **Entitlement ingestion:**
   - A generic CSV/JSON importer (users, roles/responsibilities, role-to-function) that works with any ERP on day one.
   - Then read-only connectors: Oracle EBS via a read-only database account or EBS Integrated SOA Gateway; SAP via RFC/BAPI or SAP Cloud Identity APIs; Workday reports-as-a-service; Oracle Cloud ERP REST.
2. **SoD ruleset library:** about 100 function-level conflicts across P2P, O2C, R2R, H2R and treasury, per ERP. Rules are editable and versioned. Conflicts are analyzed at user, role and function level.
3. **Mitigating controls:** assign a compensating control to an accepted conflict, with an owner, review frequency and evidence.
4. **ERP access reviews:**
   - Campaigns over imported ERP users, routed to managers and application owners.
   - Revocations raised as Jira or ITSM tickets and verified on the next import.
5. **Emergency access:** import firefighter/break-glass sessions, then require and track after-the-fact review.
6. **Scale work:** partitioned entitlement tables, background analysis jobs, and incremental re-analysis. The target is 100k users and 10M entitlement rows.

**Sellable to:** commercial SOX companies on Oracle EBS, NetSuite, SAP or Workday; federal components on Oracle EBS (DEAMS) and SAP (GFEBS, AF ERP programs).

### Phase 3: Continuous controls monitoring (about 4 to 6 months)

1. Transaction analytics run on scheduled extracts:
   - duplicate invoices and payments
   - vendor master and bank-account changes
   - journal entries over threshold, after hours or self-approved
   - three-way-match exceptions
   - SoD conflicts actually exercised (from ERP audit trails), not merely assigned
2. Configuration monitoring: EBS profile options, approval hierarchies, SAP critical transactions.
3. Every exception becomes an evidence-backed test result. Controls move from sampled to full-population testing.

### Phase 4: Federal scale and authorization (in parallel, driven by the first federal deal)

- CAC/PIV sign-in (x.509 client certificates, or SAML through the agency IdP).
- FIPS 140-3 mode.
- A Section 508 VPAT.
- A FedRAMP 20x / DoD IL4-IL5 hosting path through a FedRAMP-authorized platform such as AWS GovCloud or Azure Government, instead of Railway.
- The existing self-hosted license covers on-premises and air-gapped deployments in the meantime.

## Go-to-market recommendation

1. **Lead with Phase 1 in the federal financial-management market**, where audit readiness, NFR/CAP and FISCAM are urgent and the product already matches most of the workflow. Partner with audit-readiness contractors and IPAs, which buy tools for their engagements.
2. **Add Phase 2 with a generic entitlement importer first.** It makes SoD and access reviews work for any ERP immediately. Build native connectors in the order customers ask for them.
3. **Position against the ERP vendors' own GRC** as ERP-neutral: one control framework and one audit trail across the ERP, cloud, identity and ticketing systems. Pair that with RMF/ATO and CMMC coverage that ERP-specific tools lack.
4. **Ethics and procurement.** Because you work on an Air Force Oracle EBS program, confirm with your employer's ethics or contracts office before selling to, or using non-public knowledge of, that program or its customer. Use only public requirements (GAO/DoD IG reports, FIAR guidance, FISCAM) in product and sales material.

## Rough sizing

| Phase | Team | Duration |
|---|---|---|
| 1. Audit readiness | 2 engineers + 1 GRC/audit SME | 3 months |
| 2. ERP access governance | 3 engineers + SME | 3-4 months |
| 3. Continuous monitoring | 3 engineers + data engineer | 4-6 months |
| 4. Federal authorization | Platform engineer + compliance lead, plus 3PAO/sponsor | 6-12 months, externally paced |
