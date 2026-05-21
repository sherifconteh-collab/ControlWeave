// @tier: exclude
/**
 * Seed ISO/IEC AI Standards
 *
 * Adds the major ISO/IEC standards in AI compliance that complement the
 * existing ISO/IEC 42001:2023 already present in ControlWeave:
 *
 *  - ISO/IEC 23894:2023  — AI Risk Management
 *  - ISO/IEC 38507:2022  — Governance of AI (Corporate Governance)
 *  - ISO/IEC 22989:2022  — AI Concepts & Architecture
 *  - ISO/IEC 23053:2022  — ML System Framework (Framework for AI using ML)
 *  - ISO/IEC 5259 Series (2024) — Data Quality for AI
 *  - ISO/IEC TR 24027:2021 — Bias in AI
 *  - ISO/IEC TR 24028:2020 — Trustworthiness in AI
 *  - ISO/IEC TR 24368:2022 — Ethical & Societal Concerns in AI
 *
 * Non-destructive: uses upsert pattern — inserts only if not already present.
 * Safe to re-run.
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

// ─── Framework Definitions ────────────────────────────────────────────────────

const ISO_23894_CONTROLS = [
  { control_id: 'RM-1.1', title: 'AI Risk Management Context and Scope', description: 'Organizational context, scope, and criteria for AI risk management are established, including the internal and external factors that shape the AI risk landscape.', priority: '1', control_type: 'strategic' },
  { control_id: 'RM-1.2', title: 'Stakeholder Risk Appetite and Tolerance', description: 'Define and document stakeholder risk appetite and tolerance levels specific to AI systems, ensuring alignment with organizational objectives.', priority: '1', control_type: 'organizational' },
  { control_id: 'RM-2.1', title: 'AI Risk Identification', description: 'Systematically identify risks associated with AI systems across the entire lifecycle, including data, model, deployment, and operational risks.', priority: '1', control_type: 'strategic' },
  { control_id: 'RM-2.2', title: 'AI Risk Analysis', description: 'Analyze identified AI risks to determine their likelihood and potential impact, considering both technical and societal dimensions.', priority: '1', control_type: 'strategic' },
  { control_id: 'RM-2.3', title: 'AI Risk Evaluation', description: 'Evaluate analyzed AI risks against established criteria and risk appetite to prioritize treatment actions and resource allocation.', priority: '1', control_type: 'strategic' },
  { control_id: 'RM-3.1', title: 'AI Risk Treatment Planning', description: 'Develop risk treatment plans that specify controls, responsibilities, and timelines for mitigating identified AI risks to acceptable levels.', priority: '1', control_type: 'strategic' },
  { control_id: 'RM-3.2', title: 'AI Risk Treatment Implementation', description: 'Implement approved risk treatment plans and verify that selected controls effectively reduce AI risks as intended.', priority: '1', control_type: 'organizational' },
  { control_id: 'RM-4.1', title: 'Lifecycle-Stage Risk Monitoring', description: 'Continuously monitor AI risks at each lifecycle stage, from design through deployment and retirement, adjusting controls as the risk profile evolves.', priority: '1', control_type: 'technical' },
  { control_id: 'RM-4.2', title: 'Residual Risk Acceptance and Sign-Off', description: 'Formally document and obtain authorized sign-off on residual AI risks that remain after treatment, ensuring accountability for accepted risks.', priority: '2', control_type: 'organizational' },
  { control_id: 'RM-5.1', title: 'AI Risk Communication and Consultation', description: 'Establish communication channels to share AI risk information with relevant stakeholders and consult affected parties throughout the risk management process.', priority: '2', control_type: 'organizational' },
  { control_id: 'RM-5.2', title: 'Risk Documentation and Audit Trail', description: 'Maintain comprehensive documentation of all AI risk management activities, decisions, and outcomes to support audit and regulatory review.', priority: '2', control_type: 'technical' },
  { control_id: 'RM-6.1', title: 'Incident and Near-Miss Recording', description: 'Record and investigate AI-related incidents and near-misses to identify root causes and inform improvements to risk controls.', priority: '1', control_type: 'technical' },
  { control_id: 'RM-6.2', title: 'Continual Improvement of Risk Process', description: 'Regularly review and improve the AI risk management process based on lessons learned, incidents, and changes in the organizational or regulatory environment.', priority: '2', control_type: 'organizational' },
];

const ISO_38507_CONTROLS = [
  { control_id: 'GOV-1.1', title: 'Board-Level AI Governance Framework', description: 'Establish a board-level governance framework that defines oversight responsibilities, decision-making authority, and accountability for AI use across the organization.', priority: '1', control_type: 'strategic' },
  { control_id: 'GOV-1.2', title: 'Strategic AI Direction and Objectives', description: 'Define strategic direction and measurable objectives for AI adoption that align with overall business strategy and stakeholder expectations.', priority: '1', control_type: 'strategic' },
  { control_id: 'GOV-1.3', title: 'Organizational AI Accountability Structure', description: 'Assign clear accountability roles and reporting lines for AI governance, ensuring responsible individuals are identified at each organizational level.', priority: '1', control_type: 'organizational' },
  { control_id: 'GOV-2.1', title: 'AI Policy and Principles Approval', description: 'Develop and obtain board approval for AI policies and principles that govern the responsible development, deployment, and use of AI systems.', priority: '1', control_type: 'policy' },
  { control_id: 'GOV-2.2', title: 'AI Ethical Values Alignment', description: 'Ensure AI policies and practices are aligned with the organization\'s ethical values, cultural norms, and applicable human rights standards.', priority: '1', control_type: 'policy' },
  { control_id: 'GOV-3.1', title: 'Delegation and Oversight of AI Activities', description: 'Define delegation authorities for AI activities and establish oversight mechanisms to ensure delegated responsibilities are fulfilled appropriately.', priority: '1', control_type: 'organizational' },
  { control_id: 'GOV-3.2', title: 'Human Oversight and AI Decision Boundaries', description: 'Establish clear boundaries for AI-assisted and autonomous decision-making, including requirements for human review of high-impact AI decisions.', priority: '1', control_type: 'organizational' },
  { control_id: 'GOV-4.1', title: 'Performance Monitoring and Reporting to Board', description: 'Implement regular performance monitoring and reporting to the board on AI system outcomes, risks, and alignment with strategic objectives.', priority: '2', control_type: 'organizational' },
  { control_id: 'GOV-4.2', title: 'Regulatory and Compliance Landscape Monitoring', description: 'Continuously monitor the evolving regulatory and compliance landscape for AI to ensure the organization remains compliant with applicable laws and standards.', priority: '1', control_type: 'strategic' },
  { control_id: 'GOV-5.1', title: 'Strategic Alignment of AI Investments', description: 'Evaluate and prioritize AI investments to ensure they deliver strategic value and are consistent with the organization\'s risk appetite and governance framework.', priority: '2', control_type: 'strategic' },
  { control_id: 'GOV-5.2', title: 'Stakeholder Engagement on AI Governance', description: 'Engage internal and external stakeholders in AI governance discussions to incorporate diverse perspectives and build trust in AI practices.', priority: '2', control_type: 'organizational' },
];

const ISO_22989_CONTROLS = [
  { control_id: 'ARCH-1.1', title: 'AI System Conceptual Framework', description: 'Adopt a conceptual framework that defines the foundational concepts, relationships, and boundaries of AI systems within the organization.', priority: '1', control_type: 'strategic' },
  { control_id: 'ARCH-1.2', title: 'Common AI Vocabulary and Terminology', description: 'Establish and maintain a common vocabulary and terminology for AI concepts to ensure consistent communication across teams and stakeholders.', priority: '1', control_type: 'organizational' },
  { control_id: 'ARCH-2.1', title: 'AI System Classification and Taxonomy', description: 'Classify AI systems using a standardized taxonomy based on their capabilities, application domains, and risk levels.', priority: '1', control_type: 'strategic' },
  { control_id: 'ARCH-2.2', title: 'AI Application Domain Identification', description: 'Identify and document the application domains in which AI systems operate, including domain-specific requirements and constraints.', priority: '2', control_type: 'organizational' },
  { control_id: 'ARCH-3.1', title: 'Reference Architecture for AI Systems', description: 'Define a reference architecture for AI systems that specifies functional components, data flows, and integration points.', priority: '1', control_type: 'technical' },
  { control_id: 'ARCH-3.2', title: 'AI System Components and Interactions', description: 'Document the components of each AI system and their interactions, including data pipelines, models, and inference engines.', priority: '1', control_type: 'technical' },
  { control_id: 'ARCH-4.1', title: 'Data and Knowledge Representation', description: 'Define standards for data and knowledge representation used by AI systems to ensure interoperability and consistency.', priority: '1', control_type: 'technical' },
  { control_id: 'ARCH-4.2', title: 'AI Lifecycle Stages Definition', description: 'Define and document the lifecycle stages of AI systems from inception through retirement, with clear criteria for stage transitions.', priority: '1', control_type: 'strategic' },
  { control_id: 'ARCH-5.1', title: 'Human-AI Interaction Principles', description: 'Establish principles for human-AI interaction that ensure usability, transparency, and appropriate levels of user control over AI system behavior.', priority: '2', control_type: 'organizational' },
  { control_id: 'ARCH-5.2', title: 'AI System Properties and Characteristics', description: 'Define and measure key properties and characteristics of AI systems, such as accuracy, fairness, robustness, and interpretability.', priority: '2', control_type: 'strategic' },
];

const ISO_23053_CONTROLS = [
  { control_id: 'ML-1.1', title: 'ML System Scope and Problem Framing', description: 'Define the scope of the ML system, including the problem statement, success criteria, and constraints that guide model development.', priority: '1', control_type: 'strategic' },
  { control_id: 'ML-1.2', title: 'Data Collection and Preparation', description: 'Establish processes for collecting, cleaning, and preparing training data to ensure it is suitable for the intended ML task.', priority: '1', control_type: 'technical' },
  { control_id: 'ML-2.1', title: 'Feature Engineering and Selection', description: 'Apply systematic methods for feature engineering and selection to improve model performance and reduce unnecessary complexity.', priority: '1', control_type: 'technical' },
  { control_id: 'ML-2.2', title: 'Model Architecture and Algorithm Selection', description: 'Select appropriate model architectures and algorithms based on the problem type, data characteristics, and performance requirements.', priority: '1', control_type: 'technical' },
  { control_id: 'ML-3.1', title: 'Model Training and Optimization', description: 'Train ML models using documented procedures, including hyperparameter tuning and optimization strategies, with reproducible configurations.', priority: '1', control_type: 'technical' },
  { control_id: 'ML-3.2', title: 'Model Evaluation and Validation', description: 'Evaluate and validate ML models against defined performance metrics using appropriate test datasets and cross-validation techniques.', priority: '1', control_type: 'technical' },
  { control_id: 'ML-4.1', title: 'Model Deployment and Integration', description: 'Deploy ML models into production environments with defined integration procedures, rollback capabilities, and performance baselines.', priority: '1', control_type: 'technical' },
  { control_id: 'ML-4.2', title: 'Data-Model Interaction Management', description: 'Manage the interactions between data pipelines and ML models to ensure data quality and consistency throughout the inference process.', priority: '1', control_type: 'technical' },
  { control_id: 'ML-5.1', title: 'ML System Monitoring and Drift Detection', description: 'Monitor deployed ML systems for data drift, concept drift, and performance degradation, triggering retraining or intervention when thresholds are exceeded.', priority: '1', control_type: 'technical' },
  { control_id: 'ML-5.2', title: 'ML Lifecycle Documentation', description: 'Document all stages of the ML lifecycle, including data sources, model configurations, training procedures, and evaluation results.', priority: '2', control_type: 'organizational' },
  { control_id: 'ML-6.1', title: 'ML System Component Inventory', description: 'Maintain an inventory of all ML system components, including models, datasets, libraries, and infrastructure dependencies.', priority: '2', control_type: 'organizational' },
  { control_id: 'ML-6.2', title: 'Model Versioning and Reproducibility', description: 'Implement version control for ML models and ensure that training experiments and results are fully reproducible.', priority: '2', control_type: 'technical' },
];

const ISO_5259_CONTROLS = [
  { control_id: 'DQ-1.1', title: 'AI Dataset Governance Framework', description: 'Establish a governance framework for AI datasets that defines policies, roles, and processes for data management throughout the AI lifecycle.', priority: '1', control_type: 'strategic' },
  { control_id: 'DQ-1.2', title: 'Data Ownership and Stewardship', description: 'Assign data ownership and stewardship roles with clear responsibilities for data quality, access control, and lifecycle management.', priority: '1', control_type: 'organizational' },
  { control_id: 'DQ-2.1', title: 'Data Quality Dimensions Definition', description: 'Define data quality dimensions relevant to AI use cases, such as accuracy, completeness, timeliness, consistency, and relevance.', priority: '1', control_type: 'strategic' },
  { control_id: 'DQ-2.2', title: 'Data Quality Metrics and Measurement', description: 'Establish quantitative metrics and measurement procedures to assess data quality against defined dimensions and thresholds.', priority: '1', control_type: 'technical' },
  { control_id: 'DQ-3.1', title: 'Training Data Collection Controls', description: 'Implement controls for training data collection to ensure data is gathered ethically, legally, and in accordance with defined quality standards.', priority: '1', control_type: 'technical' },
  { control_id: 'DQ-3.2', title: 'Data Labelling and Annotation Quality', description: 'Ensure data labelling and annotation processes produce consistent, accurate results through quality controls, guidelines, and inter-annotator agreement checks.', priority: '1', control_type: 'technical' },
  { control_id: 'DQ-4.1', title: 'Bias-Aware Data Sampling Controls', description: 'Apply bias-aware sampling techniques to ensure training datasets are representative and do not introduce or amplify systematic biases.', priority: '1', control_type: 'technical' },
  { control_id: 'DQ-4.2', title: 'Representativeness and Coverage Assessment', description: 'Assess dataset representativeness and coverage to verify that training data adequately reflects the target population and use-case conditions.', priority: '1', control_type: 'technical' },
  { control_id: 'DQ-5.1', title: 'Data Provenance and Lineage Tracking', description: 'Track data provenance and lineage from source to consumption, documenting transformations, enrichments, and quality checks applied at each stage.', priority: '2', control_type: 'technical' },
  { control_id: 'DQ-5.2', title: 'Data Quality Monitoring in Production', description: 'Continuously monitor data quality in production AI systems to detect degradation, drift, or anomalies that could affect model performance.', priority: '2', control_type: 'technical' },
  { control_id: 'DQ-6.1', title: 'Dataset Documentation (Datasheets)', description: 'Create and maintain dataset documentation (datasheets) that describe the purpose, composition, collection process, and known limitations of each dataset.', priority: '2', control_type: 'organizational' },
  { control_id: 'DQ-6.2', title: 'Data Quality Assurance Process', description: 'Implement a formal data quality assurance process with defined review gates, validation checks, and remediation procedures before data is used for AI training.', priority: '1', control_type: 'organizational' },
];

const ISO_TR_24027_CONTROLS = [
  { control_id: 'BIAS-1.1', title: 'Bias Sources Identification in AI Systems', description: 'Systematically identify potential sources of bias across the AI system lifecycle, including data collection, model design, and deployment contexts.', priority: '1', control_type: 'strategic' },
  { control_id: 'BIAS-1.2', title: 'Cognitive Bias in AI Development Teams', description: 'Address cognitive biases within AI development teams through diverse team composition, structured decision-making, and bias-awareness training.', priority: '2', control_type: 'organizational' },
  { control_id: 'BIAS-2.1', title: 'Statistical Bias in Training Data', description: 'Detect and measure statistical biases in training data, including selection bias, measurement bias, and historical bias that could affect model outcomes.', priority: '1', control_type: 'technical' },
  { control_id: 'BIAS-2.2', title: 'Representation Bias Assessment', description: 'Assess whether datasets adequately represent all relevant population groups and identify underrepresentation that could lead to discriminatory outcomes.', priority: '1', control_type: 'technical' },
  { control_id: 'BIAS-3.1', title: 'Algorithmic Bias Detection Methods', description: 'Apply algorithmic bias detection methods to identify disparate impact, disparate treatment, and other forms of unfairness in model predictions.', priority: '1', control_type: 'technical' },
  { control_id: 'BIAS-3.2', title: 'Bias Measurement Metrics and Benchmarks', description: 'Define and apply bias measurement metrics and benchmarks, such as demographic parity, equalized odds, and calibration across protected groups.', priority: '1', control_type: 'technical' },
  { control_id: 'BIAS-4.1', title: 'Bias Mitigation Techniques', description: 'Implement bias mitigation techniques appropriate to the identified biases, selecting from pre-processing, in-processing, and post-processing approaches.', priority: '1', control_type: 'technical' },
  { control_id: 'BIAS-4.2', title: 'Pre/In/Post-Processing Bias Controls', description: 'Apply bias controls at multiple stages of the ML pipeline, including data rebalancing, fairness constraints during training, and output calibration.', priority: '1', control_type: 'technical' },
  { control_id: 'BIAS-5.1', title: 'Fairness-Aware Model Evaluation', description: 'Evaluate models using fairness-aware metrics in addition to standard performance measures, ensuring equitable outcomes across demographic groups.', priority: '1', control_type: 'technical' },
  { control_id: 'BIAS-5.2', title: 'Ongoing Bias Monitoring in Production', description: 'Continuously monitor deployed AI systems for emerging bias patterns, triggering alerts and remediation when fairness thresholds are breached.', priority: '1', control_type: 'technical' },
  { control_id: 'BIAS-6.1', title: 'Bias Incident Reporting and Remediation', description: 'Establish a process for reporting, investigating, and remediating bias-related incidents, including root cause analysis and corrective actions.', priority: '2', control_type: 'organizational' },
  { control_id: 'BIAS-6.2', title: 'Bias Considerations Documentation', description: 'Document all bias assessments, mitigation decisions, and residual bias considerations to support transparency and regulatory review.', priority: '2', control_type: 'organizational' },
];

const ISO_TR_24028_CONTROLS = [
  { control_id: 'TRUST-1.1', title: 'Trustworthiness Framework for AI Systems', description: 'Establish a comprehensive trustworthiness framework that addresses key dimensions including robustness, transparency, reliability, safety, privacy, and security.', priority: '1', control_type: 'strategic' },
  { control_id: 'TRUST-1.2', title: 'Stakeholder Trust Requirements Analysis', description: 'Analyze and document stakeholder trust requirements for AI systems, considering the expectations of users, affected parties, and regulators.', priority: '1', control_type: 'strategic' },
  { control_id: 'TRUST-2.1', title: 'AI System Robustness Controls', description: 'Implement robustness controls to ensure AI systems perform reliably under varying conditions, including noisy inputs and edge cases.', priority: '1', control_type: 'technical' },
  { control_id: 'TRUST-2.2', title: 'Adversarial Robustness and Resilience', description: 'Test and harden AI systems against adversarial attacks, including input perturbations, data poisoning, and model extraction attempts.', priority: '1', control_type: 'technical' },
  { control_id: 'TRUST-3.1', title: 'Explainability and Interpretability Mechanisms', description: 'Implement explainability and interpretability mechanisms that allow stakeholders to understand AI system decisions and their contributing factors.', priority: '1', control_type: 'technical' },
  { control_id: 'TRUST-3.2', title: 'Transparency Disclosures and Documentation', description: 'Provide transparency disclosures about AI system capabilities, limitations, and decision-making processes to relevant stakeholders.', priority: '1', control_type: 'organizational' },
  { control_id: 'TRUST-4.1', title: 'AI System Reliability and Availability', description: 'Ensure AI systems meet defined reliability and availability requirements through redundancy, failover mechanisms, and service-level agreements.', priority: '1', control_type: 'technical' },
  { control_id: 'TRUST-4.2', title: 'Accuracy and Performance Consistency', description: 'Monitor and maintain AI system accuracy and performance consistency over time, establishing baselines and acceptable degradation thresholds.', priority: '1', control_type: 'technical' },
  { control_id: 'TRUST-5.1', title: 'Safety Controls for High-Stakes AI Decisions', description: 'Implement safety controls for AI systems involved in high-stakes decisions, including fail-safe mechanisms and human escalation procedures.', priority: '1', control_type: 'technical' },
  { control_id: 'TRUST-5.2', title: 'Human Oversight in Trustworthy AI Systems', description: 'Ensure meaningful human oversight of AI systems, with defined intervention points and the ability to override or correct AI decisions.', priority: '1', control_type: 'organizational' },
  { control_id: 'TRUST-6.1', title: 'Privacy-Preserving AI Techniques', description: 'Apply privacy-preserving techniques such as differential privacy, federated learning, or anonymization to protect personal data in AI systems.', priority: '2', control_type: 'technical' },
  { control_id: 'TRUST-6.2', title: 'Security Controls for AI Systems', description: 'Implement security controls specific to AI systems, including model access controls, inference API protection, and supply chain security for ML components.', priority: '2', control_type: 'technical' },
  { control_id: 'TRUST-7.1', title: 'Trustworthiness Evaluation and Certification', description: 'Conduct formal trustworthiness evaluations of AI systems and pursue relevant certifications to demonstrate compliance with trust requirements.', priority: '2', control_type: 'organizational' },
];

const ISO_TR_24368_CONTROLS = [
  { control_id: 'ETHICS-1.1', title: 'AI Ethics Framework and Principles', description: 'Establish an organizational AI ethics framework with clearly defined principles covering fairness, accountability, transparency, and human dignity.', priority: '1', control_type: 'strategic' },
  { control_id: 'ETHICS-1.2', title: 'Ethical Risk Assessment for AI Systems', description: 'Conduct ethical risk assessments for AI systems to identify potential harms, unintended consequences, and ethical dilemmas prior to deployment.', priority: '1', control_type: 'strategic' },
  { control_id: 'ETHICS-2.1', title: 'Human Rights Impact Assessment', description: 'Perform human rights impact assessments to evaluate how AI systems may affect fundamental rights, including privacy, non-discrimination, and freedom of expression.', priority: '1', control_type: 'strategic' },
  { control_id: 'ETHICS-2.2', title: 'Societal Impact Analysis', description: 'Analyze the broader societal impacts of AI systems, including effects on employment, social equity, and community well-being.', priority: '1', control_type: 'strategic' },
  { control_id: 'ETHICS-3.1', title: 'Responsible AI Deployment Policies', description: 'Define and enforce responsible AI deployment policies that specify conditions, safeguards, and limitations for putting AI systems into production.', priority: '1', control_type: 'policy' },
  { control_id: 'ETHICS-3.2', title: 'AI for Social Good Considerations', description: 'Consider opportunities for AI systems to contribute positively to social good, while ensuring that commercial objectives do not override ethical obligations.', priority: '2', control_type: 'policy' },
  { control_id: 'ETHICS-4.1', title: 'Vulnerable Population Protection Measures', description: 'Implement specific protections for vulnerable populations who may be disproportionately affected by AI system decisions, including children, elderly, and marginalized groups.', priority: '1', control_type: 'organizational' },
  { control_id: 'ETHICS-4.2', title: 'Environmental Impact of AI Systems', description: 'Assess and mitigate the environmental impact of AI systems, including energy consumption, carbon footprint, and resource utilization of training and inference workloads.', priority: '2', control_type: 'strategic' },
  { control_id: 'ETHICS-5.1', title: 'AI Decision Contestability and Redress', description: 'Provide mechanisms for individuals to contest AI-driven decisions and seek redress, including clear escalation paths and human review processes.', priority: '1', control_type: 'organizational' },
  { control_id: 'ETHICS-5.2', title: 'AI Ethics Committee / Review Board', description: 'Establish an AI ethics committee or review board with authority to evaluate, approve, and monitor AI initiatives for ethical compliance.', priority: '1', control_type: 'organizational' },
  { control_id: 'ETHICS-6.1', title: 'Informed Consent for AI Interactions', description: 'Ensure individuals are informed when they are interacting with or subject to AI systems, and obtain appropriate consent where required.', priority: '2', control_type: 'policy' },
  { control_id: 'ETHICS-6.2', title: 'Ethical AI Incident Reporting', description: 'Establish a reporting mechanism for ethical concerns and incidents related to AI systems, with protections for whistleblowers and clear investigation procedures.', priority: '2', control_type: 'organizational' },
];

// ─── Crosswalk Mappings ───────────────────────────────────────────────────────

// ISO 23894 (AI Risk Mgmt) -> ISO 42001, NIST AI RMF, EU AI Act
const ISO_23894_CROSSWALKS = [
  { source: 'RM-2.1', target_framework: 'iso_42001',   target_id: 'ISO42-6.1',    score: 92, type: 'equivalent' },
  { source: 'RM-2.2', target_framework: 'iso_42001',   target_id: 'ISO42-8.2',    score: 95, type: 'equivalent' },
  { source: 'RM-3.1', target_framework: 'iso_42001',   target_id: 'ISO42-8.3',    score: 90, type: 'equivalent' },
  { source: 'RM-4.1', target_framework: 'iso_42001',   target_id: 'ISO42-9.1',    score: 88, type: 'related' },
  { source: 'RM-2.1', target_framework: 'nist_ai_rmf', target_id: 'MAP-1',        score: 90, type: 'equivalent' },
  { source: 'RM-2.2', target_framework: 'nist_ai_rmf', target_id: 'MEASURE-1',    score: 88, type: 'related' },
  { source: 'RM-3.1', target_framework: 'nist_ai_rmf', target_id: 'MANAGE-1',     score: 85, type: 'related' },
  { source: 'RM-4.1', target_framework: 'nist_ai_rmf', target_id: 'MANAGE-4',     score: 82, type: 'related' },
  { source: 'RM-2.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art9',     score: 88, type: 'related' },
  { source: 'RM-3.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art9',     score: 85, type: 'related' },
  { source: 'RM-5.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art13',    score: 80, type: 'related' },
];

// ISO 38507 (Governance of AI) -> ISO 42001, NIST AI RMF, EU AI Act
const ISO_38507_CROSSWALKS = [
  { source: 'GOV-1.1', target_framework: 'iso_42001',   target_id: 'ISO42-5.1',   score: 92, type: 'equivalent' },
  { source: 'GOV-2.1', target_framework: 'iso_42001',   target_id: 'ISO42-5.2',   score: 90, type: 'equivalent' },
  { source: 'GOV-3.1', target_framework: 'iso_42001',   target_id: 'ISO42-5.1',   score: 85, type: 'related' },
  { source: 'GOV-4.1', target_framework: 'iso_42001',   target_id: 'ISO42-9.2',   score: 88, type: 'related' },
  { source: 'GOV-1.1', target_framework: 'nist_ai_rmf', target_id: 'GOVERN-1',    score: 95, type: 'equivalent' },
  { source: 'GOV-2.1', target_framework: 'nist_ai_rmf', target_id: 'GOVERN-2',    score: 88, type: 'related' },
  { source: 'GOV-3.2', target_framework: 'nist_ai_rmf', target_id: 'GOVERN-5',    score: 85, type: 'related' },
  { source: 'GOV-1.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art9',    score: 82, type: 'related' },
  { source: 'GOV-4.2', target_framework: 'eu_ai_act',   target_id: 'AIA-Art72',   score: 78, type: 'related' },
];

// ISO 22989 (AI Concepts & Architecture) -> ISO 42001, NIST AI RMF
const ISO_22989_CROSSWALKS = [
  { source: 'ARCH-1.2', target_framework: 'iso_42001',   target_id: 'ISO42-4.1',  score: 80, type: 'related' },
  { source: 'ARCH-4.2', target_framework: 'iso_42001',   target_id: 'ISO42-8.1',  score: 82, type: 'related' },
  { source: 'ARCH-3.1', target_framework: 'nist_ai_rmf', target_id: 'MAP-1',      score: 78, type: 'related' },
  { source: 'ARCH-4.2', target_framework: 'nist_ai_rmf', target_id: 'MAP-2',      score: 75, type: 'related' },
  { source: 'ARCH-5.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art13',  score: 80, type: 'related' },
];

// ISO 23053 (ML System Framework) -> ISO 42001, NIST AI RMF, EU AI Act
const ISO_23053_CROSSWALKS = [
  { source: 'ML-1.2', target_framework: 'iso_42001',   target_id: 'ISO42-8.1',   score: 88, type: 'related' },
  { source: 'ML-3.2', target_framework: 'iso_42001',   target_id: 'ISO42-8.2',   score: 85, type: 'related' },
  { source: 'ML-5.1', target_framework: 'iso_42001',   target_id: 'ISO42-9.1',   score: 90, type: 'equivalent' },
  { source: 'ML-1.1', target_framework: 'nist_ai_rmf', target_id: 'MAP-1',       score: 88, type: 'related' },
  { source: 'ML-3.1', target_framework: 'nist_ai_rmf', target_id: 'MEASURE-2',   score: 85, type: 'related' },
  { source: 'ML-5.1', target_framework: 'nist_ai_rmf', target_id: 'MANAGE-4',    score: 88, type: 'related' },
  { source: 'ML-1.2', target_framework: 'eu_ai_act',   target_id: 'AIA-Art10',   score: 90, type: 'equivalent' },
  { source: 'ML-3.2', target_framework: 'eu_ai_act',   target_id: 'AIA-Art15',   score: 82, type: 'related' },
];

// ISO 5259 (Data Quality for AI) -> ISO 42001, NIST AI RMF, EU AI Act
const ISO_5259_CROSSWALKS = [
  { source: 'DQ-1.1', target_framework: 'iso_42001',   target_id: 'ISO42-8.1',   score: 88, type: 'related' },
  { source: 'DQ-4.1', target_framework: 'iso_42001',   target_id: 'ISO42-8.2',   score: 85, type: 'related' },
  { source: 'DQ-5.1', target_framework: 'iso_42001',   target_id: 'ISO42-8.3',   score: 80, type: 'related' },
  { source: 'DQ-1.1', target_framework: 'nist_ai_rmf', target_id: 'MAP-3',       score: 90, type: 'equivalent' },
  { source: 'DQ-3.1', target_framework: 'nist_ai_rmf', target_id: 'MEASURE-2',   score: 85, type: 'related' },
  { source: 'DQ-4.1', target_framework: 'nist_ai_rmf', target_id: 'MEASURE-2',   score: 88, type: 'related' },
  { source: 'DQ-3.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art10',   score: 95, type: 'equivalent' },
  { source: 'DQ-4.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art10',   score: 90, type: 'equivalent' },
  { source: 'DQ-6.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art11',   score: 85, type: 'related' },
];

// ISO TR 24027 (Bias in AI) -> ISO 42001, NIST AI RMF, EU AI Act
const ISO_TR_24027_CROSSWALKS = [
  { source: 'BIAS-2.1', target_framework: 'iso_42001',   target_id: 'ISO42-8.2',  score: 85, type: 'related' },
  { source: 'BIAS-4.1', target_framework: 'iso_42001',   target_id: 'ISO42-8.3',  score: 82, type: 'related' },
  { source: 'BIAS-5.2', target_framework: 'iso_42001',   target_id: 'ISO42-9.1',  score: 80, type: 'related' },
  { source: 'BIAS-2.1', target_framework: 'nist_ai_rmf', target_id: 'MEASURE-2',  score: 88, type: 'related' },
  { source: 'BIAS-3.1', target_framework: 'nist_ai_rmf', target_id: 'MEASURE-2',  score: 85, type: 'related' },
  { source: 'BIAS-4.1', target_framework: 'nist_ai_rmf', target_id: 'MANAGE-1',   score: 82, type: 'related' },
  { source: 'BIAS-5.1', target_framework: 'nist_ai_rmf', target_id: 'MEASURE-4',  score: 88, type: 'related' },
  { source: 'BIAS-2.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art10',  score: 90, type: 'equivalent' },
  { source: 'BIAS-4.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art15',  score: 85, type: 'related' },
  { source: 'BIAS-5.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art9',   score: 82, type: 'related' },
];

// ISO TR 24028 (Trustworthiness in AI) -> ISO 42001, NIST AI RMF, EU AI Act
const ISO_TR_24028_CROSSWALKS = [
  { source: 'TRUST-2.1', target_framework: 'iso_42001',   target_id: 'ISO42-8.2',  score: 85, type: 'related' },
  { source: 'TRUST-3.1', target_framework: 'iso_42001',   target_id: 'ISO42-8.4',  score: 88, type: 'related' },
  { source: 'TRUST-4.1', target_framework: 'iso_42001',   target_id: 'ISO42-9.1',  score: 85, type: 'related' },
  { source: 'TRUST-2.1', target_framework: 'nist_ai_rmf', target_id: 'MEASURE-2',  score: 90, type: 'equivalent' },
  { source: 'TRUST-3.1', target_framework: 'nist_ai_rmf', target_id: 'GOVERN-1',   score: 85, type: 'related' },
  { source: 'TRUST-4.1', target_framework: 'nist_ai_rmf', target_id: 'MEASURE-4',  score: 88, type: 'related' },
  { source: 'TRUST-5.1', target_framework: 'nist_ai_rmf', target_id: 'MANAGE-2',   score: 85, type: 'related' },
  { source: 'TRUST-3.2', target_framework: 'eu_ai_act',   target_id: 'AIA-Art13',  score: 92, type: 'equivalent' },
  { source: 'TRUST-5.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art9',   score: 88, type: 'related' },
  { source: 'TRUST-5.2', target_framework: 'eu_ai_act',   target_id: 'AIA-Art14',  score: 90, type: 'equivalent' },
  { source: 'TRUST-6.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art10',  score: 82, type: 'related' },
];

// ISO TR 24368 (Ethical & Societal Concerns) -> ISO 42001, NIST AI RMF, EU AI Act
const ISO_TR_24368_CROSSWALKS = [
  { source: 'ETHICS-1.1', target_framework: 'iso_42001',   target_id: 'ISO42-5.2',  score: 88, type: 'related' },
  { source: 'ETHICS-2.1', target_framework: 'iso_42001',   target_id: 'ISO42-8.4',  score: 90, type: 'equivalent' },
  { source: 'ETHICS-3.1', target_framework: 'iso_42001',   target_id: 'ISO42-5.2',  score: 85, type: 'related' },
  { source: 'ETHICS-1.1', target_framework: 'nist_ai_rmf', target_id: 'GOVERN-1',   score: 88, type: 'related' },
  { source: 'ETHICS-2.2', target_framework: 'nist_ai_rmf', target_id: 'MAP-5',      score: 85, type: 'related' },
  { source: 'ETHICS-4.1', target_framework: 'nist_ai_rmf', target_id: 'MAP-5',      score: 82, type: 'related' },
  { source: 'ETHICS-5.1', target_framework: 'nist_ai_rmf', target_id: 'GOVERN-6',   score: 85, type: 'related' },
  { source: 'ETHICS-2.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art9',   score: 88, type: 'related' },
  { source: 'ETHICS-3.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art9',   score: 85, type: 'related' },
  { source: 'ETHICS-4.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art9',   score: 80, type: 'related' },
  { source: 'ETHICS-5.1', target_framework: 'eu_ai_act',   target_id: 'AIA-Art13',  score: 85, type: 'related' },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function upsertFramework(client, code, name, version, description, category, tierRequired, frameworkGroup) {
  const existing = await client.query('SELECT id FROM frameworks WHERE code = $1 LIMIT 1', [code]);
  if (existing.rows.length > 0) {
    console.log(`  Framework '${code}' already exists — skipping.`);
    return existing.rows[0].id;
  }
  const result = await client.query(
    `INSERT INTO frameworks (code, name, version, description, category, tier_required, is_active, framework_group)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7) RETURNING id`,
    [code, name, version, description, category, tierRequired, frameworkGroup || null]
  );
  console.log(`  Inserted framework '${code}' (id=${result.rows[0].id})`);
  return result.rows[0].id;
}

async function upsertControls(client, frameworkId, controls) {
  // Prefetch all existing controls for this framework in a single query
  const existing = await client.query(
    'SELECT id, control_id, description FROM framework_controls WHERE framework_id = $1',
    [frameworkId]
  );
  const existingMap = new Map(existing.rows.map(r => [r.control_id, r]));

  // Separate into new inserts vs description backfills
  const toInsert = [];
  const toBackfill = [];
  for (const ctrl of controls) {
    const row = existingMap.get(ctrl.control_id);
    if (!row) {
      toInsert.push(ctrl);
    } else if (!row.description && ctrl.description) {
      toBackfill.push({ id: row.id, description: ctrl.description });
    }
  }

  // Bulk insert new controls
  if (toInsert.length > 0) {
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
  }

  // Bulk backfill descriptions using a single UPDATE with unnest
  if (toBackfill.length > 0) {
    const ids = toBackfill.map(r => r.id);
    const descs = toBackfill.map(r => r.description);
    await client.query(
      `UPDATE framework_controls AS fc SET description = v.desc
       FROM unnest($1::uuid[], $2::text[]) AS v(id, desc)
       WHERE fc.id = v.id`,
      [ids, descs]
    );
  }

  console.log(`  Controls: ${toInsert.length} inserted, ${toBackfill.length} updated, ${controls.length - toInsert.length - toBackfill.length} unchanged.`);
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('\n=== Seeding ISO/IEC 23894:2023 — AI Risk Management ===');
    const iso23894Id = await upsertFramework(client,
      'iso_23894', 'ISO/IEC 23894:2023', '2023',
      'Guidance on AI risk management aligned with ISO 31000. Covers risk identification, analysis, evaluation, treatment, and lifecycle monitoring for AI systems.',
      'AI Governance', 'enterprise', 'iso_ai'
    );
    await upsertControls(client, iso23894Id, ISO_23894_CONTROLS);
    await insertCrosswalks(client, iso23894Id, ISO_23894_CROSSWALKS);

    console.log('\n=== Seeding ISO/IEC 38507:2022 — Governance of AI ===');
    const iso38507Id = await upsertFramework(client,
      'iso_38507', 'ISO/IEC 38507:2022', '2022',
      'Corporate governance of AI: board-level oversight, strategic alignment, accountability structures, and ethical accountability for organizations deploying AI.',
      'AI Governance', 'enterprise', 'iso_ai'
    );
    await upsertControls(client, iso38507Id, ISO_38507_CONTROLS);
    await insertCrosswalks(client, iso38507Id, ISO_38507_CROSSWALKS);

    console.log('\n=== Seeding ISO/IEC 22989:2022 — AI Concepts & Architecture ===');
    const iso22989Id = await upsertFramework(client,
      'iso_22989', 'ISO/IEC 22989:2022', '2022',
      'Establishes common AI vocabulary, terminology, concepts, and a reference architecture for AI systems. Enables consistent communication across stakeholders.',
      'AI Governance', 'enterprise', 'iso_ai'
    );
    await upsertControls(client, iso22989Id, ISO_22989_CONTROLS);
    await insertCrosswalks(client, iso22989Id, ISO_22989_CROSSWALKS);

    console.log('\n=== Seeding ISO/IEC 23053:2022 — ML System Framework ===');
    const iso23053Id = await upsertFramework(client,
      'iso_23053', 'ISO/IEC 23053:2022', '2022',
      'Framework for AI systems using machine learning. Covers ML lifecycle stages, system components, data-model interactions, and evaluation methodology.',
      'AI Governance', 'enterprise', 'iso_ai'
    );
    await upsertControls(client, iso23053Id, ISO_23053_CONTROLS);
    await insertCrosswalks(client, iso23053Id, ISO_23053_CROSSWALKS);

    console.log('\n=== Seeding ISO/IEC 5259 Series (2024) — Data Quality for AI ===');
    const iso5259Id = await upsertFramework(client,
      'iso_5259', 'ISO/IEC 5259 Series (2024)', '2024',
      'Multi-part series on data quality for analytics and machine learning. Covers dataset governance, quality metrics, bias-aware sampling, labelling quality, and data provenance.',
      'AI Governance', 'enterprise', 'iso_ai'
    );
    await upsertControls(client, iso5259Id, ISO_5259_CONTROLS);
    await insertCrosswalks(client, iso5259Id, ISO_5259_CROSSWALKS);

    console.log('\n=== Seeding ISO/IEC TR 24027:2021 — Bias in AI ===');
    const isoTr24027Id = await upsertFramework(client,
      'iso_tr_24027', 'ISO/IEC TR 24027:2021', '2021',
      'Technical report on bias in AI and AI-assisted decision making. Covers sources of bias, detection methods, mitigation approaches, and measurement considerations.',
      'AI Governance', 'enterprise', 'iso_ai'
    );
    await upsertControls(client, isoTr24027Id, ISO_TR_24027_CONTROLS);
    await insertCrosswalks(client, isoTr24027Id, ISO_TR_24027_CROSSWALKS);

    console.log('\n=== Seeding ISO/IEC TR 24028:2020 — Trustworthiness in AI ===');
    const isoTr24028Id = await upsertFramework(client,
      'iso_tr_24028', 'ISO/IEC TR 24028:2020', '2020',
      'Technical report on trustworthiness of AI systems. Addresses robustness, transparency, explainability, reliability, safety, and privacy as key trust dimensions.',
      'AI Governance', 'enterprise', 'iso_ai'
    );
    await upsertControls(client, isoTr24028Id, ISO_TR_24028_CONTROLS);
    await insertCrosswalks(client, isoTr24028Id, ISO_TR_24028_CROSSWALKS);

    console.log('\n=== Seeding ISO/IEC TR 24368:2022 — Ethical & Societal Concerns in AI ===');
    const isoTr24368Id = await upsertFramework(client,
      'iso_tr_24368', 'ISO/IEC TR 24368:2022', '2022',
      'Technical report on ethical and societal concerns in AI. Covers human impact, societal risk assessment, responsible deployment, and governance of ethical AI.',
      'AI Governance', 'enterprise', 'iso_ai'
    );
    await upsertControls(client, isoTr24368Id, ISO_TR_24368_CONTROLS);
    await insertCrosswalks(client, isoTr24368Id, ISO_TR_24368_CROSSWALKS);

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('ISO/IEC AI Standards seeding complete!');
    console.log('Frameworks added:');
    console.log('  1. ISO/IEC 23894:2023  — AI Risk Management');
    console.log('  2. ISO/IEC 38507:2022  — Governance of AI');
    console.log('  3. ISO/IEC 22989:2022  — AI Concepts & Architecture');
    console.log('  4. ISO/IEC 23053:2022  — ML System Framework');
    console.log('  5. ISO/IEC 5259 (2024) — Data Quality for AI');
    console.log('  6. ISO/IEC TR 24027:2021 — Bias in AI');
    console.log('  7. ISO/IEC TR 24028:2020 — Trustworthiness in AI');
    console.log('  8. ISO/IEC TR 24368:2022 — Ethical & Societal Concerns');
    console.log('========================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
