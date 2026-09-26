-- Migration 156: complete NIST SP 800-171 Rev 3 requirement set
--
-- The nist_800_171 framework shipped 24 of the 97 security requirements in
-- SP 800-171 Rev 3, so a CUI assessment covered about a quarter of what a
-- contracting officer or C3PAO expects. This migration loads all 97 active
-- requirements (withdrawn Rev 3 identifiers are omitted) with the official
-- requirement text, generated from NIST's OSCAL catalog:
--   usnistgov/oscal-content nist.gov/SP800-171/rev3/json/NIST_SP800-171_rev3_catalog.json
-- Organization-defined parameters appear as [Assignment: ...] / [Selection: ...].
--
-- Idempotent: existing rows keep their id (so implementations, evidence links
-- and crosswalks are untouched) and only their title and text are refreshed.

DO $$
DECLARE
  fw_id UUID;
BEGIN
  SELECT id INTO fw_id FROM frameworks WHERE code = 'nist_800_171';
  IF fw_id IS NULL THEN
    RAISE NOTICE 'nist_800_171 framework not present; skipping 800-171 Rev 3 content load';
    RETURN;
  END IF;

  INSERT INTO framework_controls (framework_id, control_id, title, description, control_type, priority)
  VALUES
    (fw_id, '03.01.01', $cw$Account Management$cw$, $cw$a. Define the types of system accounts allowed and prohibited.
b. Create, enable, modify, disable, and remove system accounts in accordance with policy, procedures, prerequisites, and criteria.
c. Specify:
  1. Authorized users of the system,
  2. Group and role membership, and
  3. Access authorizations (i.e., privileges) for each account.
d. Authorize access to the system based on:
  1. A valid access authorization and
  2. Intended system usage.
e. Monitor the use of system accounts.
f. Disable system accounts when:
  1. The accounts have expired,
  2. The accounts have been inactive for [Assignment: organization-defined time period],
  3. The accounts are no longer associated with a user or individual,
  4. The accounts are in violation of organizational policy, or
  5. Significant risks associated with individuals are discovered.
g. Notify account managers and designated personnel or roles within:
  1. [Assignment: organization-defined time period] when accounts are no longer required.
  2. [Assignment: organization-defined time period] when users are terminated or transferred.
  3. [Assignment: organization-defined time period] when system usage or the need-to-know changes for an individual.
h. Require that users log out of the system after [Assignment: organization-defined time period] of expected inactivity or when [Assignment: organization-defined circumstances].$cw$, 'technical', '1'),
    (fw_id, '03.01.02', $cw$Access Enforcement$cw$, $cw$Enforce approved authorizations for logical access to CUI and system resources in accordance with applicable access control policies.$cw$, 'technical', '1'),
    (fw_id, '03.01.03', $cw$Information Flow Enforcement$cw$, $cw$Enforce approved authorizations for controlling the flow of CUI within the system and between connected systems.$cw$, 'technical', '1'),
    (fw_id, '03.01.04', $cw$Separation of Duties$cw$, $cw$a. Identify the duties of individuals requiring separation.
b. Define system access authorizations to support separation of duties.$cw$, 'technical', '1'),
    (fw_id, '03.01.05', $cw$Least Privilege$cw$, $cw$a. Allow only authorized system access for users (or processes acting on behalf of users) that is necessary to accomplish assigned organizational tasks.
b. Authorize access to [Assignment: organization-defined security functions] and [Assignment: organization-defined security-relevant information].
c. Review the privileges assigned to roles or classes of users [Assignment: organization-defined frequency] to validate the need for such privileges.
d. Reassign or remove privileges, as necessary.$cw$, 'technical', '1'),
    (fw_id, '03.01.06', $cw$Least Privilege – Privileged Accounts$cw$, $cw$a. Restrict privileged accounts on the system to [Assignment: organization-defined personnel or roles]..
b. Require that users (or roles) with privileged accounts use non-privileged accounts when accessing non-security functions or non-security information.$cw$, 'technical', '1'),
    (fw_id, '03.01.07', $cw$Least Privilege – Privileged Functions$cw$, $cw$a. Prevent non-privileged users from executing privileged functions.
b. Log the execution of privileged functions.$cw$, 'technical', '1'),
    (fw_id, '03.01.08', $cw$Unsuccessful Logon Attempts$cw$, $cw$a. Enforce a limit of [Assignment: organization-defined number] consecutive invalid logon attempts by a user during a [Assignment: organization-defined time period].
b. Automatically [Selection (one or more): lock the account or node for an [Assignment: organization-defined time period]; lock the account or node until released by an administrator; delay next logon prompt; notify system administrator; take other action] when the maximum number of unsuccessful attempts is exceeded.$cw$, 'technical', '1'),
    (fw_id, '03.01.09', $cw$System Use Notification$cw$, $cw$Display a system use notification message with privacy and security notices consistent with applicable CUI rules before granting access to the system.$cw$, 'technical', '1'),
    (fw_id, '03.01.10', $cw$Device Lock$cw$, $cw$a. Prevent access to the system by [Selection (one or more): initiating a device lock after [Assignment: organization-defined time period] of inactivity; requiring the user to initiate a device lock before leaving the system unattended].
b. Retain the device lock until the user reestablishes access using established identification and authentication procedures.
c. Conceal, via the device lock, information previously visible on the display with a publicly viewable image.$cw$, 'technical', '1'),
    (fw_id, '03.01.11', $cw$Session Termination$cw$, $cw$Terminate a user session automatically after [Assignment: organization-defined conditions or trigger events requiring session disconnect].$cw$, 'technical', '1'),
    (fw_id, '03.01.12', $cw$Remote Access$cw$, $cw$a. Establish usage restrictions, configuration requirements, and connection requirements for each type of allowable remote system access.
b. Authorize each type of remote system access prior to establishing such connections.
c. Route remote access to the system through authorized and managed access control points.
d. Authorize the remote execution of privileged commands and remote access to security-relevant information.$cw$, 'technical', '1'),
    (fw_id, '03.01.16', $cw$Wireless Access$cw$, $cw$a. Establish usage restrictions, configuration requirements, and connection requirements for each type of wireless access to the system.
b. Authorize each type of wireless access to the system prior to establishing such connections.
c. Disable, when not intended for use, wireless networking capabilities prior to issuance and deployment.
d. Protect wireless access to the system using authentication and encryption.$cw$, 'technical', '1'),
    (fw_id, '03.01.18', $cw$Access Control for Mobile Devices$cw$, $cw$a. Establish usage restrictions, configuration requirements, and connection requirements for mobile devices.
b. Authorize the connection of mobile devices to the system.
c. Implement full-device or container-based encryption to protect the confidentiality of CUI on mobile devices.$cw$, 'technical', '1'),
    (fw_id, '03.01.20', $cw$Use of External Systems$cw$, $cw$a. Prohibit the use of external systems unless the systems are specifically authorized.
b. Establish the following security requirements to be satisfied on external systems prior to allowing use of or access to those systems by authorized individuals: [Assignment: organization-defined security requirements].
c. Permit authorized individuals to use external systems to access the organizational system or to process, store, or transmit CUI only after:
  1. Verifying that the security requirements on the external systems as specified in the organization’s system security plans have been satisfied and
  2. Retaining approved system connection or processing agreements with the organizational entities hosting the external systems.
d. Restrict the use of organization-controlled portable storage devices by authorized individuals on external systems.$cw$, 'technical', '1'),
    (fw_id, '03.01.22', $cw$Publicly Accessible Content$cw$, $cw$a. Train authorized individuals to ensure that publicly accessible information does not contain CUI.
b. Review the content on publicly accessible systems for CUI and remove such information, if discovered.$cw$, 'technical', '1'),
    (fw_id, '03.02.01', $cw$Literacy Training and Awareness$cw$, $cw$a. Provide security literacy training to system users:
  1. As part of initial training for new users and [Assignment: organization-defined frequency] thereafter,
  2. When required by system changes or following [Assignment: organization-defined events], and
  3. On recognizing and reporting indicators of insider threat, social engineering, and social mining.
b. Update security literacy training content [Assignment: organization-defined frequency] and following [Assignment: organization-defined events].$cw$, 'organizational', '2'),
    (fw_id, '03.02.02', $cw$Role-Based Training$cw$, $cw$a. Provide role-based security training to organizational personnel:
  1. Before authorizing access to the system or CUI, before performing assigned duties, and [Assignment: organization-defined frequency] thereafter
  2. When required by system changes or following [Assignment: organization-defined events].
b. Update role-based training content [Assignment: organization-defined frequency] and following [Assignment: organization-defined events].$cw$, 'organizational', '2'),
    (fw_id, '03.03.01', $cw$Event Logging$cw$, $cw$a. Specify the following event types selected for logging within the system: [Assignment: organization-defined event types].
b. Review and update the event types selected for logging [Assignment: organization-defined frequency].$cw$, 'technical', '1'),
    (fw_id, '03.03.02', $cw$Audit Record Content$cw$, $cw$a. Include the following content in audit records:
  1. What type of event occurred
  2. When the event occurred
  3. Where the event occurred
  4. Source of the event
  5. Outcome of the event
  6. Identity of the individuals, subjects, objects, or entities associated with the event
b. Provide additional information for audit records as needed.$cw$, 'technical', '1'),
    (fw_id, '03.03.03', $cw$Audit Record Generation$cw$, $cw$a. Generate audit records for the selected event types and audit record content specified in 03.03.01 and 03.03.02.
b. Retain audit records for a time period consistent with the records retention policy.$cw$, 'technical', '1'),
    (fw_id, '03.03.04', $cw$Response to Audit Logging Process Failures$cw$, $cw$a. Alert organizational personnel or roles within [Assignment: organization-defined time period] in the event of an audit logging process failure.
b. Take the following additional actions: [Assignment: organization-defined additional actions].$cw$, 'technical', '1'),
    (fw_id, '03.03.05', $cw$Audit Record Review, Analysis, and Reporting$cw$, $cw$a. Review and analyze system audit records [Assignment: organization-defined frequency] for indications and the potential impact of inappropriate or unusual activity.
b. Report findings to organizational personnel or roles.
c. Analyze and correlate audit records across different repositories to gain organization-wide situational awareness.$cw$, 'technical', '1'),
    (fw_id, '03.03.06', $cw$Audit Record Reduction and Report Generation$cw$, $cw$a. Implement an audit record reduction and report generation capability that supports audit record review, analysis, reporting requirements, and after-the-fact investigations of incidents.
b. Preserve the original content and time ordering of audit records.$cw$, 'technical', '1'),
    (fw_id, '03.03.07', $cw$Time Stamps$cw$, $cw$a. Use internal system clocks to generate time stamps for audit records.
b. Record time stamps for audit records that meet [Assignment: organization-defined granularity of time measurement] and that use Coordinated Universal Time (UTC), have a fixed local time offset from UTC, or include the local time offset as part of the time stamp.$cw$, 'technical', '1'),
    (fw_id, '03.03.08', $cw$Protection of Audit Information$cw$, $cw$a. Protect audit information and audit logging tools from unauthorized access, modification, and deletion.
b. Authorize access to management of audit logging functionality to only a subset of privileged users or roles.$cw$, 'technical', '1'),
    (fw_id, '03.04.01', $cw$Baseline Configuration$cw$, $cw$a. Develop and maintain under configuration control, a current baseline configuration of the system.
b. Review and update the baseline configuration of the system [Assignment: organization-defined frequency] and when system components are installed or modified.$cw$, 'technical', '2'),
    (fw_id, '03.04.02', $cw$Configuration Settings$cw$, $cw$a. Establish, document, and implement the following configuration settings for the system that reflect the most restrictive mode consistent with operational requirements: [Assignment: organization-defined configuration settings] .
b. Identify, document, and approve any deviations from established configuration settings.$cw$, 'technical', '2'),
    (fw_id, '03.04.03', $cw$Configuration Change Control$cw$, $cw$a. Define the types of changes to the system that are configuration-controlled.
b. Review proposed configuration-controlled changes to the system, and approve or disapprove such changes with explicit consideration for security impacts.
c. Implement and document approved configuration-controlled changes to the system.
d. Monitor and review activities associated with configuration-controlled changes to the system.$cw$, 'technical', '2'),
    (fw_id, '03.04.04', $cw$Impact Analyses$cw$, $cw$a. Analyze changes to the system to determine potential security impacts prior to change implementation.
b. Verify that the security requirements for the system continue to be satisfied after the system changes have been implemented.$cw$, 'technical', '2'),
    (fw_id, '03.04.05', $cw$Access Restrictions for Change$cw$, $cw$Define, document, approve, and enforce physical and logical access restrictions associated with changes to the system.$cw$, 'technical', '2'),
    (fw_id, '03.04.06', $cw$Least Functionality$cw$, $cw$a. Configure the system to provide only mission-essential capabilities.
b. Prohibit or restrict use of the following functions, ports, protocols, connections, and services: [Assignment: organization-defined functions, ports, protocols, connections, and services] .
c. Review the system [Assignment: organization-defined frequency] to identify unnecessary or nonsecure functions, ports, protocols, connections, and services.
d. Disable or remove functions, ports, protocols, connections, and services that are unnecessary or nonsecure.$cw$, 'technical', '2'),
    (fw_id, '03.04.08', $cw$Authorized Software – Allow by Exception$cw$, $cw$a. Identify software programs authorized to execute on the system.
b. Implement a deny-all, allow-by-exception policy for the execution of authorized software programs on the system.
c. Review and update the list of authorized software programs [Assignment: organization-defined frequency].$cw$, 'technical', '2'),
    (fw_id, '03.04.10', $cw$System Component Inventory$cw$, $cw$a. Develop and document an inventory of system components.
b. Review and update the system component inventory [Assignment: organization-defined frequency].
c. Update the system component inventory as part of installations, removals, and system updates.$cw$, 'technical', '2'),
    (fw_id, '03.04.11', $cw$Information Location$cw$, $cw$a. Identify and document the location of CUI and the system components on which the information is processed and stored.
b. Document changes to the system or system component location where CUI is processed and stored.$cw$, 'technical', '2'),
    (fw_id, '03.04.12', $cw$System and Component Configuration for High-Risk Areas$cw$, $cw$a. Issue systems or system components with the following configurations to individuals traveling to high-risk locations: [Assignment: organization-defined system configurations].
b. Apply the following security requirements to the systems or components when the individuals return from travel: [Assignment: organization-defined security requirements].$cw$, 'technical', '2'),
    (fw_id, '03.05.01', $cw$User Identification and Authentication$cw$, $cw$a. Uniquely identify and authenticate system users, and associate that unique identification with processes acting on behalf of those users.
b. Re-authenticate users when [Assignment: organization-defined circumstances or situations requiring re-authentication] .$cw$, 'technical', '1'),
    (fw_id, '03.05.02', $cw$Device Identification and Authentication$cw$, $cw$Uniquely identify and authenticate [Assignment: organization-defined devices or types of devices] before establishing a system connection.$cw$, 'technical', '1'),
    (fw_id, '03.05.03', $cw$Multi-Factor Authentication$cw$, $cw$Implement multi-factor authentication for access to privileged and non-privileged accounts.$cw$, 'technical', '1'),
    (fw_id, '03.05.04', $cw$Replay-Resistant Authentication$cw$, $cw$Implement replay-resistant authentication mechanisms for access to privileged and non-privileged accounts.$cw$, 'technical', '1'),
    (fw_id, '03.05.05', $cw$Identifier Management$cw$, $cw$a. Receive authorization from organizational personnel or roles to assign an individual, group, role, service, or device identifier.
b. Select and assign an identifier that identifies an individual, group, role, service, or device.
c. Prevent the reuse of identifiers for [Assignment: organization-defined time period].
d. Manage individual identifiers by uniquely identifying each individual as [Assignment: organization-defined characteristic identifying individual status].$cw$, 'technical', '1'),
    (fw_id, '03.05.07', $cw$Password Management$cw$, $cw$a. Maintain a list of commonly-used, expected, or compromised passwords, and update the list [Assignment: organization-defined frequency] and when organizational passwords are suspected to have been compromised.
b. Verify that passwords are not found on the list of commonly used, expected, or compromised passwords when users create or update passwords.
c. Transmit passwords only over cryptographically protected channels.
d. Store passwords in a cryptographically protected form.
e. Select a new password upon first use after account recovery.
f. Enforce the following composition and complexity rules for passwords: [Assignment: organization-defined composition and complexity rules].$cw$, 'technical', '1'),
    (fw_id, '03.05.11', $cw$Authentication Feedback$cw$, $cw$Obscure feedback of authentication information during the authentication process.$cw$, 'technical', '1'),
    (fw_id, '03.05.12', $cw$Authenticator Management$cw$, $cw$a. Verify the identity of the individual, group, role, service, or device receiving the authenticator as part of the initial authenticator distribution.
b. Establish initial authenticator content for any authenticators issued by the organization.
c. Establish and implement administrative procedures for initial authenticator distribution; for lost, compromised, or damaged authenticators; and for revoking authenticators.
d. Change default authenticators at first use.
e. Change or refresh authenticators [Assignment: organization-defined frequency] or when the following events occur: [Assignment: organization-defined events].
f. Protect authenticator content from unauthorized disclosure and modification.$cw$, 'technical', '1'),
    (fw_id, '03.06.01', $cw$Incident Handling$cw$, $cw$Implement an incident-handling capability that is consistent with the incident response plan and includes preparation, detection and analysis, containment, eradication, and recovery.$cw$, 'organizational', '1'),
    (fw_id, '03.06.02', $cw$Incident Monitoring, Reporting, and Response Assistance$cw$, $cw$a. Track and document system security incidents.
b. Report suspected incidents to the organizational incident response capability within [Assignment: organization-defined time period].
c. Report incident information to [Assignment: organization-defined authorities].
d. Provide an incident response support resource that offers advice and assistance to system users on handling and reporting incidents.$cw$, 'organizational', '1'),
    (fw_id, '03.06.03', $cw$Incident Response Testing$cw$, $cw$Test the effectiveness of the incident response capability [Assignment: organization-defined frequency].$cw$, 'organizational', '1'),
    (fw_id, '03.06.04', $cw$Incident Response Training$cw$, $cw$a. Provide incident response training to system users consistent with assigned roles and responsibilities:
  1. Within [Assignment: organization-defined time period] of assuming an incident response role or responsibility or acquiring system access,
  2. When required by system changes, and
  3. [Assignment: organization-defined frequency] thereafter.
b. Review and update incident response training content [Assignment: organization-defined frequency] and following [Assignment: organization-defined events].$cw$, 'organizational', '1'),
    (fw_id, '03.06.05', $cw$Incident Response Plan$cw$, $cw$a. Develop an incident response plan that:
  1. Provides the organization with a roadmap for implementing its incident response capability,
  2. Describes the structure and organization of the incident response capability,
  3. Provides a high-level approach for how the incident response capability fits into the overall organization,
  4. Defines reportable incidents,
  5. Addresses the sharing of incident information, and
  6. Designates responsibilities to organizational entities, personnel, or roles.
b. Distribute copies of the incident response plan to designated incident response personnel (identified by name and/or by role) and organizational elements.
c. Update the incident response plan to address system and organizational changes or problems encountered during plan implementation, execution, or testing.
d. Protect the incident response plan from unauthorized disclosure.$cw$, 'organizational', '1'),
    (fw_id, '03.07.04', $cw$Maintenance Tools$cw$, $cw$a. Approve, control, and monitor the use of system maintenance tools.
b. Check media with diagnostic and test programs for malicious code before it is used in the system.
c. Prevent the removal of system maintenance equipment containing CUI by verifying that there is no CUI on the equipment, sanitizing or destroying the equipment, or retaining the equipment within the facility.$cw$, 'organizational', '2'),
    (fw_id, '03.07.05', $cw$Nonlocal Maintenance$cw$, $cw$a. Approve and monitor nonlocal maintenance and diagnostic activities.
b. Implement multi-factor authentication and replay resistance in the establishment of nonlocal maintenance and diagnostic sessions.
c. Terminate session and network connections when nonlocal maintenance is completed.$cw$, 'organizational', '2'),
    (fw_id, '03.07.06', $cw$Maintenance Personnel$cw$, $cw$a. Establish a process for maintenance personnel authorization.
b. Maintain a list of authorized maintenance organizations or personnel.
c. Verify that non-escorted personnel who perform maintenance on the system possess the required access authorizations.
d. Designate organizational personnel with required access authorizations and technical competence to supervise the maintenance activities of personnel who do not possess the required access authorizations.$cw$, 'organizational', '2'),
    (fw_id, '03.08.01', $cw$Media Storage$cw$, $cw$Physically control and securely store system media that contain CUI.$cw$, 'physical', '2'),
    (fw_id, '03.08.02', $cw$Media Access$cw$, $cw$Restrict access to CUI on system media to authorized personnel or roles.$cw$, 'physical', '2'),
    (fw_id, '03.08.03', $cw$Media Sanitization$cw$, $cw$Sanitize system media that contain CUI prior to disposal, release out of organizational control, or release for reuse.$cw$, 'physical', '2'),
    (fw_id, '03.08.04', $cw$Media Marking$cw$, $cw$Mark system media that contain CUI to indicate distribution limitations, handling caveats, and applicable CUI markings.$cw$, 'physical', '2'),
    (fw_id, '03.08.05', $cw$Media Transport$cw$, $cw$a. Protect and control system media that contain CUI during transport outside of controlled areas.
b. Maintain accountability of system media that contain CUI during transport outside of controlled areas.
c. Document activities associated with the transport of system media that contain CUI.$cw$, 'physical', '2'),
    (fw_id, '03.08.07', $cw$Media Use$cw$, $cw$a. Restrict or prohibit the use of [Assignment: organization-defined types of system media].
b. Prohibit the use of removable system media without an identifiable owner.$cw$, 'physical', '2'),
    (fw_id, '03.08.09', $cw$System Backup – Cryptographic Protection$cw$, $cw$a. Protect the confidentiality of backup information.
b. Implement cryptographic mechanisms to prevent the unauthorized disclosure of CUI at backup storage locations.$cw$, 'physical', '2'),
    (fw_id, '03.09.01', $cw$Personnel Screening$cw$, $cw$a. Screen individuals prior to authorizing access to the system.
b. Rescreen individuals in accordance with [Assignment: organization-defined conditions requiring rescreening].$cw$, 'organizational', '2'),
    (fw_id, '03.09.02', $cw$Personnel Termination and Transfer$cw$, $cw$a. When individual employment is terminated:
  1. Disable system access within [Assignment: organization-defined time period],
  2. Terminate or revoke authenticators and credentials associated with the individual, and
  3. Retrieve security-related system property.
b. When individuals are reassigned or transferred to other positions in the organization:
  1. Review and confirm the ongoing operational need for current logical and physical access authorizations to the system and facility, and
  2. Modify access authorization to correspond with any changes in operational need.$cw$, 'organizational', '2'),
    (fw_id, '03.10.01', $cw$Physical Access Authorizations$cw$, $cw$a. Develop, approve, and maintain a list of individuals with authorized access to the facility where the system resides.
b. Issue authorization credentials for facility access.
c. Review the facility access list [Assignment: organization-defined frequency].
d. Remove individuals from the facility access list when access is no longer required.$cw$, 'physical', '2'),
    (fw_id, '03.10.02', $cw$Monitoring Physical Access$cw$, $cw$a. Monitor physical access to the facility where the system resides to detect and respond to physical security incidents.
b. Review physical access logs [Assignment: organization-defined frequency] and upon occurrence of [Assignment: organization-defined events or potential indications of events].$cw$, 'physical', '2'),
    (fw_id, '03.10.06', $cw$Alternate Work Site$cw$, $cw$a. Determine alternate work sites allowed for use by employees.
b. Employ the following security requirements at alternate work sites: [Assignment: organization-defined security requirements].$cw$, 'physical', '2'),
    (fw_id, '03.10.07', $cw$Physical Access Control$cw$, $cw$a. Enforce physical access authorizations at entry and exit points to the facility where the system resides by:
  1. Verifying individual physical access authorizations before granting access to the facility and
  2. Controlling ingress and egress with physical access control systems, devices, or guards.
b. Maintain physical access audit logs for entry or exit points.
c. Escort visitors, and control visitor activity.
d. Secure keys, combinations, and other physical access devices.
e. Control physical access to output devices to prevent unauthorized individuals from obtaining access to CUI.$cw$, 'physical', '2'),
    (fw_id, '03.10.08', $cw$Access Control for Transmission$cw$, $cw$Control physical access to system distribution and transmission lines within organizational facilities.$cw$, 'physical', '2'),
    (fw_id, '03.11.01', $cw$Risk Assessment$cw$, $cw$a. Assess the risk (including supply chain risk) of unauthorized disclosure resulting from the processing, storage, or transmission of CUI.
b. Update risk assessments [Assignment: organization-defined frequency].$cw$, 'strategic', '1'),
    (fw_id, '03.11.02', $cw$Vulnerability Monitoring and Scanning$cw$, $cw$a. Monitor and scan the system for vulnerabilities [Assignment: organization-defined frequency] and when new vulnerabilities affecting the system are identified.
b. Remediate system vulnerabilities within [Assignment: organization-defined response times].
c. Update system vulnerabilities to be scanned [Assignment: organization-defined frequency] and when new vulnerabilities are identified and reported.$cw$, 'strategic', '1'),
    (fw_id, '03.11.04', $cw$Risk Response$cw$, $cw$Respond to findings from security assessments, monitoring, and audits.$cw$, 'strategic', '1'),
    (fw_id, '03.12.01', $cw$Security Assessment$cw$, $cw$Assess the security requirements for the system and its environment of operation [Assignment: organization-defined frequency] to determine if the requirements have been satisfied.$cw$, 'organizational', '2'),
    (fw_id, '03.12.02', $cw$Plan of Action and Milestones$cw$, $cw$a. Develop a plan of action and milestones for the system:
  1. To document the planned remediation actions to correct weaknesses or deficiencies noted during security assessments and
  2. To reduce or eliminate known system vulnerabilities.
b. Update the existing plan of action and milestones based on the findings from:
  1. Security assessments,
  2. Audits or reviews, and
  3. Continuous monitoring activities.$cw$, 'organizational', '2'),
    (fw_id, '03.12.03', $cw$Continuous Monitoring$cw$, $cw$Develop and implement a system-level continuous monitoring strategy that includes ongoing monitoring and security assessments.$cw$, 'organizational', '2'),
    (fw_id, '03.12.05', $cw$Information Exchange$cw$, $cw$a. Approve and manage the exchange of CUI between the system and other systems using [Selection (one or more): interconnection security agreements; information exchange security agreements; memoranda of understanding or agreement; service-level agreements; user agreements; non-disclosure agreements; other types of agreements].
b. Document interface characteristics, security requirements, and responsibilities for each system as part of the exchange agreements.
c. Review and update the exchange agreements [Assignment: organization-defined frequency].$cw$, 'organizational', '2'),
    (fw_id, '03.13.01', $cw$Boundary Protection$cw$, $cw$a. Monitor and control communications at external managed interfaces to the system and key internal managed interfaces within the system.
b. Implement subnetworks for publicly accessible system components that are physically or logically separated from internal networks.
c. Connect to external systems only through managed interfaces that consist of boundary protection devices arranged in accordance with an organizational security architecture.$cw$, 'technical', '1'),
    (fw_id, '03.13.04', $cw$Information in Shared System Resources$cw$, $cw$Prevent unauthorized and unintended information transfer via shared system resources.$cw$, 'technical', '1'),
    (fw_id, '03.13.06', $cw$Network Communications – Deny by Default – Allow by Exception$cw$, $cw$Deny network communications traffic by default, and allow network communications traffic by exception.$cw$, 'technical', '1'),
    (fw_id, '03.13.08', $cw$Transmission and Storage Confidentiality$cw$, $cw$Implement cryptographic mechanisms to prevent the unauthorized disclosure of CUI during transmission and while in storage.$cw$, 'technical', '1'),
    (fw_id, '03.13.09', $cw$Network Disconnect$cw$, $cw$Terminate the network connection associated with a communications session at the end of the session or after [Assignment: organization-defined time period] of inactivity.$cw$, 'technical', '1'),
    (fw_id, '03.13.10', $cw$Cryptographic Key Establishment and Management$cw$, $cw$Establish and manage cryptographic keys in the system in accordance with the following key management requirements: [Assignment: organization-defined requirements for key generation, distribution, storage, access, and destruction].$cw$, 'technical', '1'),
    (fw_id, '03.13.11', $cw$Cryptographic Protection$cw$, $cw$Implement the following types of cryptography to protect the confidentiality of CUI: [Assignment: organization-defined types of cryptography].$cw$, 'technical', '1'),
    (fw_id, '03.13.12', $cw$Collaborative Computing Devices and Applications$cw$, $cw$a. Prohibit the remote activation of collaborative computing devices and applications with the following exceptions: [Assignment: organization-defined exceptions where remote activation is to be allowed].
b. Provide an explicit indication of use to users physically present at the devices.$cw$, 'technical', '1'),
    (fw_id, '03.13.13', $cw$Mobile Code$cw$, $cw$a. Define acceptable mobile code and mobile code technologies.
b. Authorize, monitor, and control the use of mobile code.$cw$, 'technical', '1'),
    (fw_id, '03.13.15', $cw$Session Authenticity$cw$, $cw$Protect the authenticity of communications sessions.$cw$, 'technical', '1'),
    (fw_id, '03.14.01', $cw$Flaw Remediation$cw$, $cw$a. Identify, report, and correct system flaws.
b. Install security-relevant software and firmware updates within [Assignment: organization-defined time period] of the release of the updates.$cw$, 'technical', '1'),
    (fw_id, '03.14.02', $cw$Malicious Code Protection$cw$, $cw$a. Implement malicious code protection mechanisms at system entry and exit points to detect and eradicate malicious code.
b. Update malicious code protection mechanisms as new releases are available in accordance with configuration management policies and procedures.
c. Configure malicious code protection mechanisms to:
  1. Perform scans of the system [Assignment: organization-defined frequency] and real-time scans of files from external sources at endpoints or system entry and exit points as the files are downloaded, opened, or executed; and
  2. Block malicious code, quarantine malicious code, or take other mitigation actions in response to malicious code detection.$cw$, 'technical', '1'),
    (fw_id, '03.14.03', $cw$Security Alerts, Advisories, and Directives$cw$, $cw$a. Receive system security alerts, advisories, and directives from external organizations on an ongoing basis.
b. Generate and disseminate internal system security alerts, advisories, and directives, as necessary.$cw$, 'technical', '1'),
    (fw_id, '03.14.06', $cw$System Monitoring$cw$, $cw$a. Monitor the system to detect:
  1. Attacks and indicators of potential attacks and
  2. Unauthorized connections.
b. Identify unauthorized use of the system.
c. Monitor inbound and outbound communications traffic to detect unusual or unauthorized activities or conditions.$cw$, 'technical', '1'),
    (fw_id, '03.14.08', $cw$Information Management and Retention$cw$, $cw$Manage and retain CUI within the system and CUI output from the system in accordance with applicable laws, Executive Orders, directives, regulations, policies, standards, guidelines, and operational requirements.$cw$, 'technical', '1'),
    (fw_id, '03.15.01', $cw$Policy and Procedures$cw$, $cw$a. Develop, document, and disseminate to organizational personnel or roles the policies and procedures needed to satisfy the security requirements for the protection of CUI.
b. Review and update policies and procedures [Assignment: organization-defined frequency].$cw$, 'policy', '2'),
    (fw_id, '03.15.02', $cw$System Security Plan$cw$, $cw$a. Develop a system security plan that:
  1. Defines the constituent system components;
  2. Identifies the information types processed, stored, and transmitted by the system;
  3. Describes specific threats to the system that are of concern to the organization;
  4. Describes the operational environment for the system and any dependencies on or connections to other systems or system components;
  5. Provides an overview of the security requirements for the system;
  6. Describes the safeguards in place or planned for meeting the security requirements;
  7. Identifies individuals that fulfill system roles and responsibilities; and
  8. Includes other relevant information necessary for the protection of CUI.
b. Review and update the system security plan [Assignment: organization-defined frequency].
c. Protect the system security plan from unauthorized disclosure.$cw$, 'policy', '2'),
    (fw_id, '03.15.03', $cw$Rules of Behavior$cw$, $cw$a. Establish rules that describe the responsibilities and expected behavior for system usage and protecting CUI.
b. Provide rules to individuals who require access to the system.
c. Receive a documented acknowledgement from individuals indicating that they have read, understand, and agree to abide by the rules of behavior before authorizing access to CUI and the system.
d. Review and update the rules of behavior [Assignment: organization-defined frequency].$cw$, 'policy', '2'),
    (fw_id, '03.16.01', $cw$Security Engineering Principles$cw$, $cw$Apply the following systems security engineering principles to the development or modification of the system and system components: [Assignment: organization-defined systems security engineering principles].$cw$, 'organizational', '2'),
    (fw_id, '03.16.02', $cw$Unsupported System Components$cw$, $cw$a. Replace system components when support for the components is no longer available from the developer, vendor, or manufacturer.
b. Provide options for risk mitigation or alternative sources for continued support for unsupported components that cannot be replaced.$cw$, 'organizational', '2'),
    (fw_id, '03.16.03', $cw$External System Services$cw$, $cw$a. Require the providers of external system services used for the processing, storage, or transmission of CUI to comply with the following security requirements: [Assignment: organization-defined security requirements].
b. Define and document user roles and responsibilities with regard to external system services, including shared responsibilities with external service providers.
c. Implement processes, methods, and techniques to monitor security requirement compliance by external service providers on an ongoing basis.$cw$, 'organizational', '2'),
    (fw_id, '03.17.01', $cw$Supply Chain Risk Management Plan$cw$, $cw$a. Develop a plan for managing supply chain risks associated with the research and development, design, manufacturing, acquisition, delivery, integration, operations, maintenance, and disposal of the system, system components, or system services.
b. Review and update the supply chain risk management plan [Assignment: organization-defined frequency].
c. Protect the supply chain risk management plan from unauthorized disclosure.$cw$, 'organizational', '2'),
    (fw_id, '03.17.02', $cw$Acquisition Strategies, Tools, and Methods$cw$, $cw$Develop and implement acquisition strategies, contract tools, and procurement methods to identify, protect against, and mitigate supply chain risks.$cw$, 'organizational', '2'),
    (fw_id, '03.17.03', $cw$Supply Chain Requirements and Processes$cw$, $cw$a. Establish a process for identifying and addressing weaknesses or deficiencies in the supply chain elements and processes.
b. Enforce the following security requirements to protect against supply chain risks to the system, system components, or system services and to limit the harm or consequences from supply chain-related events: [Assignment: organization-defined security requirements].$cw$, 'organizational', '2')
  ON CONFLICT (framework_id, control_id) DO UPDATE
    SET title = EXCLUDED.title,
        description = EXCLUDED.description;

  UPDATE frameworks
     SET description = 'Protecting Controlled Unclassified Information (CUI) in nonfederal systems and organizations: all 97 security requirements across 17 families.'
   WHERE id = fw_id;
END$$;
