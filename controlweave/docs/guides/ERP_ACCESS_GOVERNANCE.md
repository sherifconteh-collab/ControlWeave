# ERP Access Governance

**Where:** Compliance → Financial & ERP → ERP Access Governance (`/dashboard/erp-access`)
**Permissions:**
- `erp.read` to view. Admins, users and auditors have it.
- `erp.manage` to import, analyze and decide. Admins have it.
- A user named as a review's reviewer can decide that review's items with `erp.read` alone.

**License:** ERP Governance is a separately licensed add-on, not part of any plan (see [Commercial Licensing](../COMMERCIAL_LICENSING.md#add-on-modules)). When commercial mode is on, every change needs the add-on; without it the page explains the module and links to **Plan & Billing**. Viewing and exporting existing data is never gated. With commercial mode off (the open-source default) everything is available.

This module governs access inside your ERP (Oracle EBS, SAP, Workday, NetSuite, Dynamics 365 and others). It is separate from [Access Governance](./ACCESS_GOVERNANCE.md), which covers ControlWeave's own users.

## 1. Add a system and load entitlements

Add each ERP instance under **Systems & users**. Load its data with a direct connector, with SAP standard table extracts, or with CSV files. Every load is recorded in the import history.

### Direct connectors

**Connection and schedule** on a system sets up a read-only connector. Credentials are encrypted and never shown again; leave a secret as `********` to keep it.

| Connector | For | Settings | What it reads |
|---|---|---|---|
| Workday (Report-as-a-Service) | Workday | users report URL, optional assignments and permissions report URLs, integration system user and password | Custom reports exposed as web services, read as JSON. Name the users report columns `username`, `full_name`, `email`, `department`, `manager`, `status` and (multi-instance) `roles`; a permissions report has `role_name`, `permission` |
| SCIM 2.0 | Oracle Fusion Cloud ERP (`https://<host>/hcmRestApi/scim`), SAP Cloud Identity Services for S/4HANA Cloud and BTP (`https://<tenant>.accounts.ondemand.com/service/scim`) | base URL, and a bearer token or username and password | `/Users` (paged), each user's `roles` and `groups`; when users carry neither, the members of `/Roles` and `/Groups` |
| Oracle E-Business Suite (database) | Oracle EBS 12.x | host, port, service name, read-only account, schema (default `APPS`) | Users and their supervisors, responsibility assignments (direct and indirect), and the form functions each responsibility's menu grants less its function and menu exclusions |

- Each sync loads users, assignments and (where the connector provides them) role permissions as **full snapshots in one transaction**. Because a snapshot marks anyone missing from it as removed (and can verify a revocation), a sync is refused, with nothing changed, when:
  - the connector cannot prove it read everything: a SCIM server returned fewer users than the `totalResults` it reported, or a type exceeded 200,000 records, or an Oracle EBS query hit its 200,000-row limit;
  - it returned no users;
  - it returned users but no role assignments. If the system really has none, set `allowEmptyAssignments` to `true` in the connector settings.

  The refused run is recorded with the reason and the counts that were extracted.
- Connector hosts must be public unless the server sets `CONNECTOR_ALLOW_PRIVATE_HOSTS=true`, which self-hosted deployments reaching an on-premises EBS database or intranet host need.
- The Oracle EBS connector uses node-oracledb in thin mode, so no Oracle client libraries are needed. Grant the account SELECT on `FND_USER`, `FND_USER_RESP_GROUPS_ALL`, `FND_RESPONSIBILITY_VL`, `FND_COMPILED_MENU_FUNCTIONS`, `FND_FORM_FUNCTIONS`, `FND_RESP_FUNCTIONS` and `PER_ALL_ASSIGNMENTS_F`, and nothing else. The host must be a plain host name or IP address and the service name a plain service name; connect descriptors are rejected. Each query is stopped after `ERP_EBS_CALL_TIMEOUT_MS` (default 300000, five minutes) so a hung query cannot hold the system's sync lock.

**Schedules.** A system can run daily or weekly at a UTC hour. Each run syncs the connector (if there is one), then, if switched on, runs the SoD analysis and the [monitoring rules](./ERP_TRANSACTION_MONITORING.md), and refreshes revocation ticket statuses. A system with no connector can still be scheduled for analysis and monitoring over imported files. **Run now** does the same on demand. Run history keeps the counts and any error.
- Scheduled runs are checked every ten minutes by one server replica at a time; `ERP_SCHEDULER_ENABLED=false` turns them off.
- An organization whose add-on has lapsed is skipped until it is back.

### SAP standard tables

Download these tables from SE16 or SE16N with technical field names and save them as CSV:

| Import | Table | Columns used |
|---|---|---|
| SAP table USR02 | user master | `BNAME`, `USTYP`, `UFLAG` (anything but 0 is locked), `GLTGB` (valid to), `TRDAT` (last logon), `CLASS` |
| SAP table AGR_USERS | role assignments | `AGR_NAME`, `UNAME`, `FROM_DAT`, `TO_DAT` (99991231 means no end date) |
| SAP table AGR_1251 | role authorizations | `AGR_NAME`, `OBJECT`, `FIELD`, `LOW`, `HIGH`; only `S_TCODE` / `TCD` values |

Transaction code wildcards (`F*`, `ME2+N`, `*`) and ranges (`LOW`..`HIGH`) are expanded against the transaction codes in the SAP starter map. A role that holds `*` is flagged privileged.

### CSV files

| Data | Columns |
|---|---|
| Users | `username,full_name,email,department,manager,status,last_login_at,end_date` |
| Roles / responsibilities | `role_name,description,is_privileged` |
| User-role assignments | `username,role_name,granted_at,expires_at` |
| Role to business function | `role_name,function_code` |
| Role to permission | `role_name,permission` (transaction codes, menus, functions) |
| Permission to business function | `permission,function_code` |
| Emergency sessions | `username,emergency_id,started_at,ended_at,reason,activity_count,activity_summary` |

**Map roles to business functions** in one of three ways:
- directly, with role to function
- through the permissions the ERP uses, with role to permission plus your own permission to function map. For example, map a custom SAP transaction `ZFB60` to `AP_INVOICE_ENTRY`.
- through ControlWeave's **starter maps**, which are used automatically for SAP (ECC and S/4HANA) and Oracle E-Business Suite systems:
  - SAP: about 100 standard transaction codes, for example `FK01`/`XK01` and `BP` to vendor maintenance, `MIRO` and `FB60` to invoice entry, `F110` to payment runs, `ME21N` to purchase orders, `SU01` and `PFCG` to security administration
  - Oracle EBS: standard form functions, for example `AP_APXINWKB` (Invoices) and `PO_POXPOEPO` (Purchase Orders)

  A transaction code shows what a role can start, not every authorization value behind it, so the SAP map errs toward reporting a conflict. For example, `PA30` maps to employee, pay rate and employee bank maintenance, because without organizational restrictions it grants all three. Review the map (`GET /api/v1/erp/permission-library`) against how your roles are built. Your own mappings are added to it, and **Connection and schedule** can switch the starter map off for a system.

**Merge or full snapshot**
- **Merge** (default) upserts the rows in the file.
- **Full snapshot** treats the file as complete:
  - users and roles that are missing are marked as no longer present
  - assignments and mappings that are missing are removed
- A full snapshot is refused if any row is invalid, so a bad extract cannot wipe your data.

**Other import rules**
- Assignments that name unknown users or roles create them.
- Rows repeated in a file keep the last one.
- Imports of 1,000 rows or more refresh the database's planner statistics for the affected tables.

## 2. Separation of duties

**Business functions.** The library defines 39 functions across:
- procure to pay
- order to cash
- record to report
- fixed assets
- hire to retire
- treasury
- inventory
- IT administration

**Rules.** The library has 47 conflict rules between pairs of functions. For example:
- *maintain vendors* and *release payments*
- *enter* and *approve journal entries*
- *administer security* and *run payroll*

Each rule has a severity and describes the risk.

**Managing rules** (under **SoD rules**)
- Switch any library rule off for your organization.
- Add your own rules. Every edit increments the rule's version.

**Running the analysis.** **Run SoD analysis** evaluates every active rule:
- **Role level:** a single role grants both functions. That is a role design flaw that puts every holder in conflict.
- **User level:** a user holds both functions through any combination of active, unexpired roles.

**Between runs**
- A conflict that disappears (a role is removed, a rule is disabled) is marked **resolved**.
- A resolved conflict that reappears is reopened.
- Mitigated and accepted conflicts keep their decision while they persist.

Measured at 20,000 users and 60,000 assignments: import took about 2 seconds, and the analysis about 1.2 seconds.

**Deciding a conflict**
- **Mitigate:** pick a mitigating control, or create one. A mitigating control has a description, frequency and owner, and can link to a risk-control matrix entry so it is tested like any other control.
- **Accept:** a business justification is required; an expiry date is optional. The summary counts expired acceptances.
- **Reopen**

## 3. Access reviews

**Access reviews → Start review** snapshots every active user of a system: their roles (privileged roles are highlighted), business functions and open conflicts. The decision is recorded against what the reviewer saw.

**Routing.** Send every item to one reviewer, or to **each user's manager**. The manager is matched to a ControlWeave user by email: the ERP user's manager field is either an email address or the username of another user in the same system whose email is known. Items whose manager isn't a ControlWeave user, or where the manager is the reviewed user, go to the fallback reviewer. A manager decides their own items with `erp.read` alone and can filter the review to **Only items assigned to me**.

**Deciding items**
- Reviewers certify or revoke, choosing the roles to remove.
- Removing all access requires a note.

**Completing the review**
- Completion requires a decision on every user.
- It files an evidence record summarizing the result.
- The decisions can be exported to CSV.

**Revocation tickets.** Link the system to a Jira or ITSM connector (set up under Integrations) in **Connection and schedule**. Completing a review then opens one ticket per revoked user, naming the roles to remove and the reviewer's notes. The ticket key, link and status appear on the review item, and each scheduled run refreshes the status. A failed ticket is recorded on the item; **Open revocation tickets** retries; only one ticket run per review happens at a time, so a retry that overlaps the completion run cannot open duplicate tickets. For the ITSM connector, the table is `incident` unless the connector sets `revocationTableName`. Closing a ticket does not verify the revocation: the next import does.

**Revocation verification.** A revocation is not done when it is recorded; it is done when the access is gone. When a later assignments or users import no longer shows the revoked roles (or the user is gone or inactive), the item is marked **verified**. The summary shows how many revocations are still unverified.

## 4. Emergency access

Import firefighter or break-glass sessions from the ERP's log. Each session waits in **Emergency access** until someone records an after-the-fact review:
- **approved** (activity was appropriate) or **escalated**
- with notes on what was checked

## API

All endpoints are under `/api/v1/erp`:
- `summary`
- `systems`, `systems/:id/import`, `systems/:id/imports`, `systems/:id/users`, `systems/:id/users/:userId`, `systems/:id/analyze`
- `connectors`, `systems/:id/connector`, `systems/:id/schedule`, `systems/:id/sync`, `systems/:id/sync-runs`
- `permission-library`, `ticket-connectors`
- `functions`, `sod/rules`, `sod/conflicts`
- `mitigating-controls`
- `reviews` (with `routing: "manager"`), `reviews/:id` (`?mine=true`), `reviews/:id/items/:itemId`, `reviews/:id/complete`, `reviews/:id/tickets`, `reviews/:id/export`
- `emergency-sessions`

Every change is audit-logged. Connector settings are logged by name only; credential values never reach the log.

## Limits

- SAP systems on premises (ECC, S/4HANA) are loaded from table extracts: there is no RFC connector, because RFC needs SAP's proprietary client library. SAP Cloud Identity Services covers S/4HANA Cloud through SCIM.
- The starter maps cover standard SAP transactions and Oracle EBS form functions. Custom transactions, Workday domains and Oracle Fusion privileges map through your own permission-to-function file.
