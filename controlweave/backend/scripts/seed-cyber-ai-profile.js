// @tier: exclude
/**
 * Seed NIST IR 8596 – Cybersecurity Framework Profile for Artificial Intelligence
 *                      (Cyber AI Profile)
 *
 * Preliminary Draft released December 2025 by NIST.
 * Reference: https://nvlpubs.nist.gov/nistpubs/ir/2025/NIST.IR.8596.iprd.pdf
 *
 * The Cyber AI Profile is a NIST Cybersecurity Framework (CSF) 2.0 Profile that
 * provides AI-specific cybersecurity guidance organized around three focus areas:
 *
 *   SEC – Securing AI System Components
 *   DEF – Conducting AI-Enabled Cyber Defense
 *   THW – Thwarting AI-Enabled Cyber Attacks
 *
 * Controls use the naming convention: <FocusArea>.<CSF-Function>-<NN>
 *   e.g. SEC.GV-01, DEF.DE-01, THW.PR-01
 *
 * Non-destructive: uses upsert pattern — safe to re-run.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// ─── Focus Area: SEC – Securing AI System Components ─────────────────────────
// Controls address cybersecurity risks in the AI system lifecycle: data, models,
// pipelines, and infrastructure used to build, train, and deploy AI.

const CYBER_AI_SECURE_CONTROLS = [
  // GOVERN: AI Cybersecurity Governance for AI System Components
  { control_id: 'SEC.GV-01', title: 'AI Asset Governance Policy',
    description: 'Cybersecurity policies address the classification, ownership, and protection of AI assets including models, datasets, training infrastructure, and inference endpoints.',
    priority: '1', control_type: 'policy' },
  { control_id: 'SEC.GV-02', title: 'AI Cybersecurity Roles and Responsibilities',
    description: 'Roles and responsibilities for securing AI system components are defined and assigned, including accountability for AI model security and data integrity.',
    priority: '1', control_type: 'organizational' },
  { control_id: 'SEC.GV-03', title: 'AI Supply Chain Cybersecurity Risk Strategy',
    description: 'A strategy for managing cybersecurity risks in the AI supply chain (pre-trained models, datasets, MLOps tools, AI APIs) is established and communicated.',
    priority: '1', control_type: 'strategic' },

  // IDENTIFY: AI Asset Inventory and Risk Assessment
  { control_id: 'SEC.ID-01', title: 'AI Asset Inventory',
    description: 'Inventories of AI system components are maintained, including models, training datasets, inference pipelines, AI APIs, and supporting infrastructure.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.ID-02', title: 'AI Data Flow Mapping',
    description: 'Data flows for AI systems are mapped and documented, including training data ingestion, model inference inputs/outputs, and data persistence paths.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.ID-03', title: 'AI System Vulnerability Assessment',
    description: 'Vulnerabilities specific to AI systems are identified and assessed, including adversarial input weaknesses, model extraction risks, and training data poisoning vectors.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.ID-04', title: 'AI Supply Chain Risk Identification',
    description: 'Cybersecurity risks from third-party AI components are identified including pre-trained model provenance, dataset licensing and integrity, and dependency vulnerabilities.',
    priority: '1', control_type: 'strategic' },
  { control_id: 'SEC.ID-05', title: 'AI Risk Impact Analysis',
    description: 'Potential impacts of AI-specific cybersecurity incidents (model compromise, data poisoning, inference manipulation) on organizational missions are assessed.',
    priority: '2', control_type: 'strategic' },

  // PROTECT: Security Controls for AI System Components
  { control_id: 'SEC.PR-01', title: 'AI Model Access Control',
    description: 'Access to AI models, weights, training data, and inference endpoints is controlled using least-privilege principles and strong authentication.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.PR-02', title: 'Training Data Integrity Protection',
    description: 'Controls are in place to protect training datasets from unauthorized modification, poisoning, or substitution, including cryptographic hashing and provenance tracking.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.PR-03', title: 'AI Model Integrity and Provenance',
    description: 'AI model weights and artifacts are protected from unauthorized modification; model provenance and version history are maintained and verifiable.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.PR-04', title: 'AI Pipeline and Infrastructure Security',
    description: 'Security controls are applied to AI training and inference pipelines including secure containerization, dependency verification, and network segmentation.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.PR-05', title: 'Adversarial Input Defenses',
    description: 'Defenses against adversarial inputs (prompt injection, evasion attacks, model inversion) are implemented at AI inference endpoints.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.PR-06', title: 'AI Model Confidentiality Protections',
    description: 'Controls protect AI model intellectual property from unauthorized extraction, model stealing attacks, and unauthorized disclosure of model architecture.',
    priority: '2', control_type: 'technical' },
  { control_id: 'SEC.PR-07', title: 'AI Software and Dependency Security',
    description: 'AI-specific software dependencies (ML frameworks, libraries, toolchains) are inventoried, assessed for vulnerabilities, and kept current with security patches.',
    priority: '1', control_type: 'technical' },

  // DETECT: Monitoring AI Systems for Security Events
  { control_id: 'SEC.DE-01', title: 'AI System Security Monitoring',
    description: 'AI systems are continuously monitored for security events including anomalous inference patterns, unauthorized model access, data exfiltration, and pipeline tampering.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.DE-02', title: 'Adversarial Attack Detection',
    description: 'Mechanisms are in place to detect adversarial inputs, prompt injection attempts, and evasion attacks against deployed AI models in real time.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.DE-03', title: 'Training Data Anomaly Detection',
    description: 'Processes monitor training data ingestion pipelines for anomalies that may indicate poisoning attacks or unauthorized data manipulation.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.DE-04', title: 'AI Model Behavior Baseline Monitoring',
    description: 'Baseline AI model behavior is established and deviations are monitored and alerted, indicating potential compromise, drift from tampering, or backdoor activation.',
    priority: '2', control_type: 'technical' },

  // RESPOND: Incident Response for AI System Compromises
  { control_id: 'SEC.RS-01', title: 'AI Security Incident Response Plan',
    description: 'Incident response procedures address AI-specific security incidents including compromised models, data poisoning, adversarial attacks, and AI pipeline breaches.',
    priority: '1', control_type: 'organizational' },
  { control_id: 'SEC.RS-02', title: 'AI Model Quarantine and Containment',
    description: 'Procedures exist to quarantine and take offline compromised AI models and pipelines to contain security incidents while preserving forensic evidence.',
    priority: '1', control_type: 'organizational' },
  { control_id: 'SEC.RS-03', title: 'AI Security Incident Analysis',
    description: 'Processes analyze AI security incidents to determine root cause, extent of compromise (data, model, pipeline), and organizational impact.',
    priority: '1', control_type: 'organizational' },

  // RECOVER: Recovery of AI System Components
  { control_id: 'SEC.RC-01', title: 'AI System Recovery Planning',
    description: 'Recovery plans address restoration of AI system components including model rollback to known-good versions, clean dataset restoration, and pipeline rebuild procedures.',
    priority: '1', control_type: 'organizational' },
  { control_id: 'SEC.RC-02', title: 'AI Model Backup and Versioning',
    description: 'AI model weights and training artifacts are backed up with secure, versioned snapshots to enable rollback to verified-clean model states following a security incident.',
    priority: '1', control_type: 'technical' },
  { control_id: 'SEC.RC-03', title: 'Post-Incident AI Security Improvements',
    description: 'Lessons learned from AI security incidents are incorporated into updated security controls, model hardening procedures, and monitoring configurations.',
    priority: '2', control_type: 'organizational' },
];

// ─── Focus Area: DEF – Conducting AI-Enabled Cyber Defense ───────────────────
// Controls address the use of AI as a cybersecurity tool to enhance threat
// detection, analysis, triage, and response capabilities.

const CYBER_AI_DEFEND_CONTROLS = [
  // GOVERN: Governance of AI-Enabled Defense Tools
  { control_id: 'DEF.GV-01', title: 'AI Defense Tool Governance Policy',
    description: 'Policies govern the acquisition, deployment, and oversight of AI-powered cybersecurity tools including automated threat detection, SIEM AI analytics, and AI-driven SOC capabilities.',
    priority: '1', control_type: 'policy' },
  { control_id: 'DEF.GV-02', title: 'AI-Assisted Decision Accountability',
    description: 'Accountability frameworks ensure that AI-generated security decisions and recommendations are subject to appropriate human oversight before consequential actions are taken.',
    priority: '1', control_type: 'organizational' },

  // IDENTIFY: Using AI to Identify Cybersecurity Risks
  { control_id: 'DEF.ID-01', title: 'AI-Enhanced Asset and Vulnerability Discovery',
    description: 'AI-powered tools are used to identify and catalog assets, discover vulnerabilities, and maintain up-to-date network topology and attack surface awareness.',
    priority: '2', control_type: 'technical' },
  { control_id: 'DEF.ID-02', title: 'AI-Driven Threat Intelligence Analysis',
    description: 'AI analytics are applied to threat intelligence feeds to identify emerging threats, prioritize indicators of compromise, and predict threat actor tactics relevant to the organization.',
    priority: '2', control_type: 'technical' },
  { control_id: 'DEF.ID-03', title: 'AI-Assisted Risk Scoring and Prioritization',
    description: 'AI systems assist in risk scoring, prioritizing remediation activities, and identifying high-risk assets and exposures based on threat intelligence and asset criticality.',
    priority: '2', control_type: 'strategic' },

  // PROTECT: AI-Enhanced Protective Controls
  { control_id: 'DEF.PR-01', title: 'AI-Enabled Access Control Enforcement',
    description: 'AI systems support dynamic access control decisions, anomalous access detection, and continuous authentication by analyzing behavioral patterns and contextual signals.',
    priority: '2', control_type: 'technical' },
  { control_id: 'DEF.PR-02', title: 'AI-Driven Phishing and Social Engineering Defenses',
    description: 'AI-powered email filtering and web content inspection are used to detect and block phishing, spear-phishing, and AI-generated social engineering attacks.',
    priority: '1', control_type: 'technical' },
  { control_id: 'DEF.PR-03', title: 'Automated Vulnerability Remediation Assistance',
    description: 'AI tools assist in prioritizing and recommending vulnerability remediation actions based on exploit likelihood, asset criticality, and threat intelligence.',
    priority: '2', control_type: 'technical' },

  // DETECT: AI-Powered Threat Detection and Monitoring
  { control_id: 'DEF.DE-01', title: 'AI-Enhanced Threat Detection and Behavioral Analytics',
    description: 'AI-powered analytics detect anomalous user, device, and network behaviors by establishing baselines and identifying deviations that indicate compromise or insider threat.',
    priority: '1', control_type: 'technical' },
  { control_id: 'DEF.DE-02', title: 'AI-Assisted Log and Event Correlation',
    description: 'AI and machine learning are applied to security event logs to correlate events across data sources, reduce false positives, and surface high-fidelity security alerts.',
    priority: '1', control_type: 'technical' },
  { control_id: 'DEF.DE-03', title: 'AI-Driven Malware and Intrusion Detection',
    description: 'AI-based endpoint and network detection tools identify malware, novel attack patterns, and intrusion indicators beyond signature-based detection capabilities.',
    priority: '1', control_type: 'technical' },
  { control_id: 'DEF.DE-04', title: 'AI Model Performance and Reliability Monitoring',
    description: 'AI-powered defense tools are monitored for performance degradation, model drift, and reliability issues that could reduce detection effectiveness over time.',
    priority: '2', control_type: 'technical' },

  // RESPOND: AI-Assisted Incident Response
  { control_id: 'DEF.RS-01', title: 'AI-Assisted Incident Triage and Prioritization',
    description: 'AI tools assist SOC analysts in triaging security alerts, prioritizing incidents by severity and business impact, and recommending initial response actions.',
    priority: '1', control_type: 'technical' },
  { control_id: 'DEF.RS-02', title: 'AI-Enabled Security Orchestration and Automation',
    description: 'Security orchestration and automation platforms leverage AI to execute predefined playbooks, contain threats, and coordinate response actions with appropriate human oversight.',
    priority: '2', control_type: 'technical' },
  { control_id: 'DEF.RS-03', title: 'AI-Generated Incident Reporting',
    description: 'AI tools assist in generating accurate and timely incident reports, communicating incident scope, and producing artifacts for post-incident review and regulatory notification.',
    priority: '2', control_type: 'organizational' },

  // RECOVER: AI-Assisted Recovery
  { control_id: 'DEF.RC-01', title: 'AI-Assisted Recovery Prioritization',
    description: 'AI analytics assist in prioritizing system and service recovery actions following incidents, balancing business continuity needs with security requirements.',
    priority: '2', control_type: 'organizational' },
  { control_id: 'DEF.RC-02', title: 'AI-Driven Post-Incident Learning',
    description: 'AI tools analyze incident data to identify attack patterns, extract lessons learned, and recommend improvements to detection models and security configurations.',
    priority: '2', control_type: 'technical' },
];

// ─── Focus Area: THW – Thwarting AI-Enabled Cyber Attacks ────────────────────
// Controls address cybersecurity measures that protect against threat actors who
// use AI to enhance the speed, scale, or effectiveness of their attacks.

const CYBER_AI_THWART_CONTROLS = [
  // GOVERN: Governance for AI-Enabled Threat Landscape
  { control_id: 'THW.GV-01', title: 'AI Threat Landscape Awareness Policy',
    description: 'Policies require ongoing monitoring of the AI-enabled threat landscape including AI-generated phishing, deepfakes, AI-accelerated vulnerability exploitation, and autonomous attack tools.',
    priority: '1', control_type: 'policy' },
  { control_id: 'THW.GV-02', title: 'AI-Enabled Threat Risk Integration',
    description: 'Organizational risk management processes explicitly address risks from AI-enabled threat actors, integrating AI threat scenarios into risk assessments and threat models.',
    priority: '1', control_type: 'strategic' },

  // IDENTIFY: Identifying AI-Enabled Threats and Attack Vectors
  { control_id: 'THW.ID-01', title: 'AI-Enabled Threat Actor Profiling',
    description: 'Threat intelligence processes profile adversaries using AI capabilities, tracking AI-powered attack tools, tactics, techniques, and procedures (TTPs) relevant to the organization.',
    priority: '1', control_type: 'strategic' },
  { control_id: 'THW.ID-02', title: 'Deepfake and Synthetic Media Threat Assessment',
    description: 'Risks from AI-generated deepfakes, voice cloning, and synthetic media used for fraud, social engineering, and business email compromise are assessed and documented.',
    priority: '1', control_type: 'strategic' },
  { control_id: 'THW.ID-03', title: 'AI-Accelerated Vulnerability Exploitation Risk Assessment',
    description: 'Risk assessments account for AI-accelerated vulnerability discovery and exploitation, including automated fuzzing, AI-assisted exploit development, and rapid attack scaling.',
    priority: '1', control_type: 'strategic' },
  { control_id: 'THW.ID-04', title: 'AI-Generated Phishing and Social Engineering Risk',
    description: 'Risks from AI-generated highly personalized phishing, spear-phishing, vishing, and social engineering attacks are identified and incorporated into user awareness programs.',
    priority: '1', control_type: 'strategic' },

  // PROTECT: Protecting Against AI-Enabled Attacks
  { control_id: 'THW.PR-01', title: 'Anti-Deepfake and Synthetic Media Controls',
    description: 'Controls are implemented to detect and defend against deepfake attacks including identity verification processes, out-of-band authentication for sensitive transactions, and deepfake detection tools.',
    priority: '1', control_type: 'technical' },
  { control_id: 'THW.PR-02', title: 'AI-Resistant Authentication and Identity Verification',
    description: 'Multi-factor authentication and identity verification processes are hardened against AI-enabled attacks including voice cloning, synthetic video, and AI-driven credential stuffing.',
    priority: '1', control_type: 'technical' },
  { control_id: 'THW.PR-03', title: 'Accelerated Patch and Vulnerability Management',
    description: 'Vulnerability management processes are accelerated to reduce exposure windows against AI-assisted exploitation, prioritizing rapid patch deployment for high-severity vulnerabilities.',
    priority: '1', control_type: 'technical' },
  { control_id: 'THW.PR-04', title: 'AI-Aware Security Awareness Training',
    description: 'Security awareness programs educate users on recognizing AI-generated phishing, deepfakes, synthetic voice, and AI-crafted social engineering tactics.',
    priority: '1', control_type: 'organizational' },
  { control_id: 'THW.PR-05', title: 'AI-Enabled Malware and Code Defenses',
    description: 'Defenses address AI-generated malware, polymorphic code, and AI-assisted obfuscation techniques that evade traditional signature-based detection mechanisms.',
    priority: '1', control_type: 'technical' },
  { control_id: 'THW.PR-06', title: 'Automated Attack Mitigation Capabilities',
    description: 'Automated capabilities (rate limiting, bot mitigation, DDoS defenses) are maintained to counter AI-enabled large-scale, high-speed attack campaigns.',
    priority: '2', control_type: 'technical' },

  // DETECT: Detecting AI-Enabled Attacks
  { control_id: 'THW.DE-01', title: 'AI-Generated Content Detection',
    description: 'Tools and processes detect AI-generated content used in attacks, including synthetic emails, AI-crafted phishing lures, deepfake media, and AI-written malicious code.',
    priority: '1', control_type: 'technical' },
  { control_id: 'THW.DE-02', title: 'Automated and AI-Driven Attack Pattern Recognition',
    description: 'Security monitoring systems recognize attack patterns characteristic of AI-automated campaigns, including high-velocity scanning, AI-optimized payload variation, and coordinated multi-vector attacks.',
    priority: '1', control_type: 'technical' },
  { control_id: 'THW.DE-03', title: 'AI-Enabled Insider Threat Detection',
    description: 'Behavioral analytics detect anomalous insider behaviors that may indicate compromise by AI-assisted social engineering or AI-enabled coercion and manipulation.',
    priority: '2', control_type: 'technical' },

  // RESPOND: Responding to AI-Enabled Attacks
  { control_id: 'THW.RS-01', title: 'AI-Attack Specific Response Playbooks',
    description: 'Incident response playbooks address AI-specific attack scenarios including deepfake fraud, AI-generated phishing campaigns, AI-accelerated ransomware, and synthetic identity attacks.',
    priority: '1', control_type: 'organizational' },
  { control_id: 'THW.RS-02', title: 'Accelerated Response to AI-Enabled Threats',
    description: 'Incident response processes and automation are tuned to respond at the speed of AI-enabled attacks, including automated containment triggers and rapid escalation procedures.',
    priority: '1', control_type: 'organizational' },
  { control_id: 'THW.RS-03', title: 'AI-Attack Communications and Notifications',
    description: 'Communications procedures address AI-specific attack scenarios including internal notifications, regulatory reporting for AI-enabled fraud events, and customer communications for synthetic identity incidents.',
    priority: '2', control_type: 'organizational' },

  // RECOVER: Recovering from AI-Enabled Attacks
  { control_id: 'THW.RC-01', title: 'Recovery from AI-Enabled Attack Incidents',
    description: 'Recovery plans address restoration after AI-enabled attacks including deepfake fraud remediation, reputation recovery from synthetic media incidents, and systems recovery after AI-assisted breaches.',
    priority: '1', control_type: 'organizational' },
  { control_id: 'THW.RC-02', title: 'AI Threat-Informed Resilience Improvements',
    description: 'Post-incident reviews of AI-enabled attack events inform improvements to defenses, training programs, and organizational resilience against future AI-powered threats.',
    priority: '2', control_type: 'organizational' },
];

// ─── Crosswalk mappings to related frameworks ─────────────────────────────────

const SECURE_CROSSWALKS = [
  // SEC.GV controls -> NIST CSF 2.0 / NIST AI RMF
  { source: 'SEC.GV-01', target_framework: 'nist_csf_2.0',  target_id: 'GV.PO-01',   score: 90, type: 'equivalent' },
  { source: 'SEC.GV-01', target_framework: 'nist_ai_rmf',   target_id: 'GOVERN-1',   score: 85, type: 'related' },
  { source: 'SEC.GV-02', target_framework: 'nist_csf_2.0',  target_id: 'GV.RR-02',   score: 90, type: 'equivalent' },
  { source: 'SEC.GV-02', target_framework: 'nist_ai_rmf',   target_id: 'GOVERN-2',   score: 85, type: 'related' },
  { source: 'SEC.GV-03', target_framework: 'nist_csf_2.0',  target_id: 'GV.SC-01',   score: 90, type: 'equivalent' },
  { source: 'SEC.GV-03', target_framework: 'nist_ai_rmf',   target_id: 'GOVERN-5',   score: 80, type: 'related' },

  // SEC.ID controls -> NIST CSF 2.0 / NIST AI RMF / ISO 42001
  { source: 'SEC.ID-01', target_framework: 'nist_csf_2.0',  target_id: 'ID.AM-01',   score: 90, type: 'equivalent' },
  { source: 'SEC.ID-01', target_framework: 'nist_ai_rmf',   target_id: 'MAP-1',      score: 80, type: 'related' },
  { source: 'SEC.ID-02', target_framework: 'nist_csf_2.0',  target_id: 'ID.AM-03',   score: 88, type: 'related' },
  { source: 'SEC.ID-03', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-01',   score: 90, type: 'equivalent' },
  { source: 'SEC.ID-03', target_framework: 'nist_ai_rmf',   target_id: 'MEASURE-1',  score: 82, type: 'related' },
  { source: 'SEC.ID-04', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-02',   score: 85, type: 'related' },
  { source: 'SEC.ID-04', target_framework: 'nist_ai_rmf',   target_id: 'GOVERN-5',   score: 82, type: 'related' },
  { source: 'SEC.ID-05', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-04',   score: 88, type: 'related' },

  // SEC.PR controls -> NIST CSF 2.0 / NIST AI RMF / ISO 42001
  { source: 'SEC.PR-01', target_framework: 'nist_csf_2.0',  target_id: 'PR.AA-01',   score: 88, type: 'related' },
  { source: 'SEC.PR-02', target_framework: 'nist_csf_2.0',  target_id: 'PR.DS-01',   score: 90, type: 'equivalent' },
  { source: 'SEC.PR-02', target_framework: 'nist_ai_rmf',   target_id: 'MEASURE-2',  score: 82, type: 'related' },
  { source: 'SEC.PR-02', target_framework: 'iso_42001',     target_id: 'ISO42-8.4',  score: 80, type: 'related' },
  { source: 'SEC.PR-03', target_framework: 'nist_csf_2.0',  target_id: 'PR.DS-01',   score: 85, type: 'related' },
  { source: 'SEC.PR-03', target_framework: 'nist_ai_rmf',   target_id: 'MEASURE-2',  score: 80, type: 'related' },
  { source: 'SEC.PR-04', target_framework: 'nist_csf_2.0',  target_id: 'PR.AA-01',   score: 82, type: 'related' },
  { source: 'SEC.PR-05', target_framework: 'nist_ai_rmf',   target_id: 'MEASURE-2',  score: 85, type: 'related' },
  { source: 'SEC.PR-07', target_framework: 'nist_csf_2.0',  target_id: 'PR.DS-01',   score: 80, type: 'related' },

  // SEC.DE controls -> NIST CSF 2.0 / NIST AI RMF
  { source: 'SEC.DE-01', target_framework: 'nist_csf_2.0',  target_id: 'DE.CM-01',   score: 90, type: 'equivalent' },
  { source: 'SEC.DE-01', target_framework: 'nist_ai_rmf',   target_id: 'MEASURE-3',  score: 85, type: 'related' },
  { source: 'SEC.DE-02', target_framework: 'nist_csf_2.0',  target_id: 'DE.CM-01',   score: 85, type: 'related' },
  { source: 'SEC.DE-03', target_framework: 'nist_csf_2.0',  target_id: 'DE.CM-01',   score: 82, type: 'related' },
  { source: 'SEC.DE-04', target_framework: 'nist_ai_rmf',   target_id: 'MEASURE-3',  score: 88, type: 'related' },

  // SEC.RS controls -> NIST CSF 2.0
  { source: 'SEC.RS-01', target_framework: 'nist_csf_2.0',  target_id: 'RS.MA-01',   score: 90, type: 'equivalent' },
  { source: 'SEC.RS-02', target_framework: 'nist_csf_2.0',  target_id: 'RS.MA-01',   score: 85, type: 'related' },
  { source: 'SEC.RS-03', target_framework: 'nist_csf_2.0',  target_id: 'RS.MA-01',   score: 82, type: 'related' },

  // SEC.RC controls -> NIST CSF 2.0
  { source: 'SEC.RC-01', target_framework: 'nist_csf_2.0',  target_id: 'RC.RP-01',   score: 90, type: 'equivalent' },
  { source: 'SEC.RC-02', target_framework: 'nist_csf_2.0',  target_id: 'PR.DS-01',   score: 80, type: 'related' },
  { source: 'SEC.RC-03', target_framework: 'nist_csf_2.0',  target_id: 'ID.IM-01',   score: 88, type: 'related' },
  { source: 'SEC.RC-03', target_framework: 'nist_ai_rmf',   target_id: 'MANAGE-4',   score: 80, type: 'related' },
];

const DEFEND_CROSSWALKS = [
  // DEF.GV controls -> NIST CSF 2.0 / NIST AI RMF
  { source: 'DEF.GV-01', target_framework: 'nist_csf_2.0',  target_id: 'GV.PO-01',   score: 85, type: 'related' },
  { source: 'DEF.GV-01', target_framework: 'nist_ai_rmf',   target_id: 'GOVERN-1',   score: 80, type: 'related' },
  { source: 'DEF.GV-02', target_framework: 'nist_csf_2.0',  target_id: 'GV.RR-01',   score: 88, type: 'related' },
  { source: 'DEF.GV-02', target_framework: 'nist_ai_rmf',   target_id: 'GOVERN-4',   score: 80, type: 'related' },

  // DEF.ID controls -> NIST CSF 2.0
  { source: 'DEF.ID-01', target_framework: 'nist_csf_2.0',  target_id: 'ID.AM-01',   score: 80, type: 'related' },
  { source: 'DEF.ID-02', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-02',   score: 88, type: 'related' },
  { source: 'DEF.ID-03', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-04',   score: 85, type: 'related' },

  // DEF.PR controls -> NIST CSF 2.0
  { source: 'DEF.PR-01', target_framework: 'nist_csf_2.0',  target_id: 'PR.AA-01',   score: 82, type: 'related' },
  { source: 'DEF.PR-02', target_framework: 'nist_csf_2.0',  target_id: 'PR.AA-01',   score: 78, type: 'related' },
  { source: 'DEF.PR-03', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-01',   score: 80, type: 'related' },

  // DEF.DE controls -> NIST CSF 2.0
  { source: 'DEF.DE-01', target_framework: 'nist_csf_2.0',  target_id: 'DE.CM-01',   score: 90, type: 'equivalent' },
  { source: 'DEF.DE-02', target_framework: 'nist_csf_2.0',  target_id: 'DE.CM-01',   score: 88, type: 'related' },
  { source: 'DEF.DE-03', target_framework: 'nist_csf_2.0',  target_id: 'DE.CM-01',   score: 85, type: 'related' },
  { source: 'DEF.DE-04', target_framework: 'nist_ai_rmf',   target_id: 'MEASURE-3',  score: 82, type: 'related' },

  // DEF.RS controls -> NIST CSF 2.0
  { source: 'DEF.RS-01', target_framework: 'nist_csf_2.0',  target_id: 'RS.MA-01',   score: 85, type: 'related' },
  { source: 'DEF.RS-02', target_framework: 'nist_csf_2.0',  target_id: 'RS.MA-01',   score: 82, type: 'related' },
  { source: 'DEF.RS-03', target_framework: 'nist_csf_2.0',  target_id: 'RS.MA-01',   score: 80, type: 'related' },

  // DEF.RC controls -> NIST CSF 2.0
  { source: 'DEF.RC-01', target_framework: 'nist_csf_2.0',  target_id: 'RC.RP-01',   score: 82, type: 'related' },
  { source: 'DEF.RC-02', target_framework: 'nist_csf_2.0',  target_id: 'ID.IM-01',   score: 85, type: 'related' },
  { source: 'DEF.RC-02', target_framework: 'nist_ai_rmf',   target_id: 'MANAGE-4',   score: 78, type: 'related' },
];

const THWART_CROSSWALKS = [
  // THW.GV controls -> NIST CSF 2.0 / NIST AI RMF
  { source: 'THW.GV-01', target_framework: 'nist_csf_2.0',  target_id: 'GV.RM-01',   score: 85, type: 'related' },
  { source: 'THW.GV-01', target_framework: 'nist_ai_rmf',   target_id: 'GOVERN-1',   score: 78, type: 'related' },
  { source: 'THW.GV-02', target_framework: 'nist_csf_2.0',  target_id: 'GV.RM-02',   score: 85, type: 'related' },
  { source: 'THW.GV-02', target_framework: 'nist_ai_rmf',   target_id: 'MAP-5',      score: 80, type: 'related' },

  // THW.ID controls -> NIST CSF 2.0 / NIST AI RMF
  { source: 'THW.ID-01', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-02',   score: 88, type: 'related' },
  { source: 'THW.ID-02', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-03',   score: 85, type: 'related' },
  { source: 'THW.ID-03', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-01',   score: 85, type: 'related' },
  { source: 'THW.ID-04', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-03',   score: 82, type: 'related' },

  // THW.PR controls -> NIST CSF 2.0
  { source: 'THW.PR-01', target_framework: 'nist_csf_2.0',  target_id: 'PR.AA-01',   score: 80, type: 'related' },
  { source: 'THW.PR-02', target_framework: 'nist_csf_2.0',  target_id: 'PR.AA-01',   score: 90, type: 'equivalent' },
  { source: 'THW.PR-03', target_framework: 'nist_csf_2.0',  target_id: 'ID.RA-01',   score: 85, type: 'related' },
  { source: 'THW.PR-04', target_framework: 'nist_csf_2.0',  target_id: 'PR.AT-01',   score: 90, type: 'equivalent' },
  { source: 'THW.PR-05', target_framework: 'nist_csf_2.0',  target_id: 'DE.CM-01',   score: 78, type: 'related' },
  { source: 'THW.PR-06', target_framework: 'nist_csf_2.0',  target_id: 'PR.AA-01',   score: 75, type: 'related' },

  // THW.DE controls -> NIST CSF 2.0
  { source: 'THW.DE-01', target_framework: 'nist_csf_2.0',  target_id: 'DE.CM-01',   score: 88, type: 'related' },
  { source: 'THW.DE-02', target_framework: 'nist_csf_2.0',  target_id: 'DE.CM-01',   score: 88, type: 'related' },
  { source: 'THW.DE-03', target_framework: 'nist_csf_2.0',  target_id: 'DE.CM-01',   score: 80, type: 'related' },

  // THW.RS controls -> NIST CSF 2.0
  { source: 'THW.RS-01', target_framework: 'nist_csf_2.0',  target_id: 'RS.MA-01',   score: 88, type: 'related' },
  { source: 'THW.RS-02', target_framework: 'nist_csf_2.0',  target_id: 'RS.MA-01',   score: 85, type: 'related' },
  { source: 'THW.RS-03', target_framework: 'nist_csf_2.0',  target_id: 'RS.MA-01',   score: 82, type: 'related' },

  // THW.RC controls -> NIST CSF 2.0
  { source: 'THW.RC-01', target_framework: 'nist_csf_2.0',  target_id: 'RC.RP-01',   score: 85, type: 'related' },
  { source: 'THW.RC-02', target_framework: 'nist_csf_2.0',  target_id: 'ID.IM-01',   score: 85, type: 'related' },
  { source: 'THW.RC-02', target_framework: 'nist_ai_rmf',   target_id: 'MANAGE-4',   score: 78, type: 'related' },
];

// ─── Helper functions ─────────────────────────────────────────────────────────

async function upsertFramework(client, code, name, version, description, category, tierRequired, frameworkGroup) {
  const existing = await client.query('SELECT id FROM frameworks WHERE code = $1 LIMIT 1', [code]);
  if (existing.rows.length > 0) {
    if (frameworkGroup) {
      await client.query(
        'UPDATE frameworks SET framework_group = $1 WHERE code = $2 AND framework_group IS DISTINCT FROM $1',
        [frameworkGroup, code]
      );
    }
    console.log(`  Framework '${code}' already exists — ensuring framework_group is set.`);
    return existing.rows[0].id;
  }
  const result = await client.query(
    `INSERT INTO frameworks (code, name, version, description, category, tier_required, framework_group, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING id`,
    [code, name, version, description, category, tierRequired, frameworkGroup || null]
  );
  console.log(`  Inserted framework '${code}' (id=${result.rows[0].id})`);
  return result.rows[0].id;
}

async function upsertControls(client, frameworkId, controls) {
  // Prefetch all existing control_ids for this framework in a single query
  const existing = await client.query(
    'SELECT control_id FROM framework_controls WHERE framework_id = $1',
    [frameworkId]
  );
  const existingIds = new Set(existing.rows.map(r => r.control_id));
  const toInsert = controls.filter(c => !existingIds.has(c.control_id));

  if (toInsert.length === 0) {
    console.log(`  Controls: 0 inserted, ${controls.length} already existed.`);
    return;
  }

  // Bulk insert all new controls in a single query
  const placeholders = toInsert.map((_, i) => {
    const b = i * 6;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
  }).join(', ');
  const params = toInsert.flatMap(ctrl => [
    frameworkId, ctrl.control_id, ctrl.title, ctrl.description, ctrl.priority, ctrl.control_type,
  ]);
  await client.query(
    `INSERT INTO framework_controls (framework_id, control_id, title, description, priority, control_type)
     VALUES ${placeholders}`,
    params
  );
  console.log(`  Controls: ${toInsert.length} inserted, ${controls.length - toInsert.length} already existed.`);
}

async function insertCrosswalks(client, sourceFrameworkId, crosswalks) {
  let inserted = 0;
  let skipped = 0;
  for (const cw of crosswalks) {
    const srcCtrl = await client.query(
      'SELECT id FROM framework_controls WHERE framework_id = $1 AND control_id = $2 LIMIT 1',
      [sourceFrameworkId, cw.source]
    );
    if (srcCtrl.rows.length === 0) { skipped++; continue; }

    const tgtFw = await client.query(
      'SELECT id FROM frameworks WHERE code = $1 LIMIT 1',
      [cw.target_framework]
    );
    if (tgtFw.rows.length === 0) { skipped++; continue; }

    const tgtCtrl = await client.query(
      'SELECT id FROM framework_controls WHERE framework_id = $1 AND control_id = $2 LIMIT 1',
      [tgtFw.rows[0].id, cw.target_id]
    );
    if (tgtCtrl.rows.length === 0) { skipped++; continue; }

    const existing = await client.query(
      'SELECT id FROM control_mappings WHERE source_control_id = $1 AND target_control_id = $2 LIMIT 1',
      [srcCtrl.rows[0].id, tgtCtrl.rows[0].id]
    );
    if (existing.rows.length > 0) { skipped++; continue; }

    await client.query(
      `INSERT INTO control_mappings (source_control_id, target_control_id, similarity_score, mapping_type)
       VALUES ($1, $2, $3, $4)`,
      [srcCtrl.rows[0].id, tgtCtrl.rows[0].id, cw.score, cw.type]
    );
    inserted++;
  }
  console.log(`  Crosswalks: ${inserted} inserted, ${skipped} skipped/not found.`);
}

// ─── Main seeding function ────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('\n=== Seeding NIST IR 8596 – Cyber AI Profile: SEC (Securing AI System Components) ===');
    const secFwId = await upsertFramework(client,
      'nist_ir_8596_sec',
      'NIST IR 8596 Cyber AI Profile – Secure AI System Components',
      '2025 Preliminary Draft',
      'NIST IR 8596 Cyber AI Profile focus area for securing AI system components: protecting models, datasets, training pipelines, and inference infrastructure against cybersecurity threats throughout the AI lifecycle.',
      'AI Cybersecurity', 'enterprise', 'csf_2_profiles'
    );
    await upsertControls(client, secFwId, CYBER_AI_SECURE_CONTROLS);

    console.log('\n=== Seeding NIST IR 8596 – Cyber AI Profile: DEF (AI-Enabled Cyber Defense) ===');
    const defFwId = await upsertFramework(client,
      'nist_ir_8596_def',
      'NIST IR 8596 Cyber AI Profile – AI-Enabled Cyber Defense',
      '2025 Preliminary Draft',
      'NIST IR 8596 Cyber AI Profile focus area for conducting AI-enabled cyber defense: leveraging AI to enhance threat detection, behavioral analytics, automated response, and SOC capabilities.',
      'AI Cybersecurity', 'enterprise', 'csf_2_profiles'
    );
    await upsertControls(client, defFwId, CYBER_AI_DEFEND_CONTROLS);

    console.log('\n=== Seeding NIST IR 8596 – Cyber AI Profile: THW (Thwarting AI-Enabled Attacks) ===');
    const thwFwId = await upsertFramework(client,
      'nist_ir_8596_thw',
      'NIST IR 8596 Cyber AI Profile – Thwart AI-Enabled Attacks',
      '2025 Preliminary Draft',
      'NIST IR 8596 Cyber AI Profile focus area for thwarting AI-enabled cyber attacks: defending against threat actors who use AI to enhance the speed, scale, and sophistication of phishing, deepfakes, and automated exploits.',
      'AI Cybersecurity', 'enterprise', 'csf_2_profiles'
    );
    await upsertControls(client, thwFwId, CYBER_AI_THWART_CONTROLS);

    console.log('\n=== Crosswalks: SEC -> NIST CSF 2.0 / NIST AI RMF / ISO 42001 ===');
    await insertCrosswalks(client, secFwId, SECURE_CROSSWALKS);

    console.log('\n=== Crosswalks: DEF -> NIST CSF 2.0 / NIST AI RMF ===');
    await insertCrosswalks(client, defFwId, DEFEND_CROSSWALKS);

    console.log('\n=== Crosswalks: THW -> NIST CSF 2.0 / NIST AI RMF ===');
    await insertCrosswalks(client, thwFwId, THWART_CROSSWALKS);

    await client.query('COMMIT');
    console.log('\nDone. NIST IR 8596 Cyber AI Profile seeded successfully.');
    console.log('  Frameworks: nist_ir_8596_sec, nist_ir_8596_def, nist_ir_8596_thw');
    console.log(`  Controls: ${CYBER_AI_SECURE_CONTROLS.length} SEC + ${CYBER_AI_DEFEND_CONTROLS.length} DEF + ${CYBER_AI_THWART_CONTROLS.length} THW = ${CYBER_AI_SECURE_CONTROLS.length + CYBER_AI_DEFEND_CONTROLS.length + CYBER_AI_THWART_CONTROLS.length} total`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

main();
