# ERP Transaction Monitoring

**Where:** Compliance → Financial & ERP → ERP Transaction Monitoring (`/dashboard/erp-monitoring`)
**Permissions:** `erp.read` to view, `erp.manage` to import, run, configure and work exceptions.
**License:** part of the separately licensed ERP Governance add-on (see [Commercial Licensing](../COMMERCIAL_LICENSING.md#add-on-modules)). Without it, existing exceptions stay readable and exportable, but nothing can be imported, run or changed.

Instead of sampling, the monitoring rules test every imported payment, invoice, journal entry, vendor master change, purchase order and goods receipt, and every monitored configuration setting. Runs can be started here or scheduled per system under **ERP Access Governance → Connection and schedule**.

## Importing transactions

Choose a system (added under [ERP Access Governance](./ERP_ACCESS_GOVERNANCE.md)), then **Import transactions**. Columns:

```
txn_type,external_id,document_number,reference,vendor_id,vendor_name,amount,quantity,currency,txn_date,posted_at,created_by,approved_by,change_field
```

- `txn_type` is `payment`, `invoice`, `journal_entry`, `vendor_change`, `purchase_order` or `goods_receipt`.
- For a payment, `reference` is the invoice number it pays.
- For an invoice or a goods receipt against a purchase order, `reference` is the purchase order number (the order's `document_number`). A goods receipt needs the reference and an amount or quantity.
- For a vendor change, `change_field` names what changed (for example `bank_account`).
- Rows are matched on `txn_type` plus `external_id`, so re-importing an extract updates it.
- Amounts may include thousands separators.

## Rules

| Code | Finds | Severity | Settings |
|---|---|---|---|
| CCM-AP-01 | Payments to the same vendor for the same amount against the same invoice reference | High | |
| CCM-AP-02 | Pairs of payments to the same vendor for the same amount within a window, with different or missing references | Medium | window (7 days), minimum amount (1,000) |
| CCM-AP-03 | Invoices from the same vendor whose numbers match once case, spacing and punctuation are ignored | High | |
| CCM-AP-04 | A payment to a vendor within days after its bank details changed | Critical | window (14 days) |
| CCM-AP-05 | The person who changed a vendor also entered or approved a payment to it (a segregation of duties conflict that was exercised) | Critical | window (90 days) |
| CCM-AP-06 | The person who entered an invoice approved the payment that settled it | High | |
| CCM-GL-01 | Journal entries at or above a threshold | Medium | threshold (1,000,000) |
| CCM-GL-02 | Journal entries approved by their creator | High | |
| CCM-GL-03 | Journal entries posted outside business hours or at weekends | Low | time zone, start and end hour, weekends |
| CCM-GL-04 | Large journal entries in round amounts | Low | minimum amount, rounding unit |
| CCM-GL-05 | Journal entries without an approver | High | minimum amount |
| CCM-P2P-01 | Invoices against a purchase order that add up to more than the order | High | tolerance (5%), minimum variance (100) |
| CCM-P2P-02 | Three-way match: invoices against an order with no goods receipt, or for more than was received (by value, or by quantity when receipts carry quantities only) | High | tolerance (5%), minimum variance (100) |
| CCM-P2P-03 | Invoices at or above a threshold that reference no purchase order (runs once orders have been imported) | Medium | minimum amount (5,000) |
| CCM-P2P-04 | A purchase order dated after the first invoice against it | Medium | |
| CCM-P2P-05 | Purchase orders approved by their creator | High | |
| CCM-P2P-06 | Goods received by the person who created the purchase order | Medium | |
| CCM-CFG-01 | A monitored setting outside its baseline, or not reported by the latest extract | From the baseline | |
| CCM-CFG-02 | Each change to a monitored setting, to match against change records | Medium | window (90 days) |

**Configuring rules.** Under **Rules** you can switch each rule on or off and change its settings. Settings are type- and range-checked before they are used.

**Tying a rule to a control.** You can tie a rule to a [risk-control matrix](./FINANCIAL_AUDIT.md) entry. Every run then records a completed full-population operating effectiveness test for that control. The conclusion is:
- *effective* when the rule has found nothing
- *effective with exceptions* when everything it found has been resolved or marked a false positive
- *ineffective* while exceptions are still open

## Configuration monitoring

The **Configuration** tab tracks settings such as SAP profile parameters, Oracle EBS profile options, tolerances and approval limits.

1. **Import settings** with `config_key,value,category,description,changed_by,changed_at`. When a later import has a different value, the change is recorded with the old and new value; a full snapshot also records settings that disappeared.
2. **Set baselines.** A baseline says what a setting should be: equals, does not equal, one of a list, at least, at most, or between (`1..5`). Numeric rules fail for a value that is not a number, so a blank "unlimited" setting does not pass a maximum. Each baseline has a severity and a reason.
3. **Add recommended baselines** copies ControlWeave's recommended settings for SAP (for example `login/min_password_lng` at least 8, `login/fails_to_user_lock` 1 to 5, `rdisp/gui_auto_logout` 60 to 900 seconds, `login/no_automatic_user_sapstar` = 1, `rsau/enable` = 1) or Oracle EBS (for example `SIGNON_PASSWORD_LENGTH` at least 8, `SIGNON_PASSWORD_FAILURE_LIMIT` 1 to 5, `ICX_SESSION_TIMEOUT` 1 to 30 minutes, `AUDITTRAIL:ACTIVATE` = Y). Existing baselines are kept, and every recommended value can be edited.

The tab lists each setting with its baseline and whether it complies, then the change history. CCM-CFG-01 and CCM-CFG-02 turn failures and changes into exceptions.

## Exceptions

- Runs are idempotent. Each exception has a fingerprint, so re-running updates it instead of duplicating it.
- Exceptions move through open → investigating → resolved or false positive.
- Closing one requires investigation notes, and a closed exception stays closed on later runs.
- Exceptions are sorted by severity and amount and can be exported to CSV.
- Run history shows the population and the findings of every rule.

## API

All endpoints are under `/api/v1/erp/monitoring`: `summary`, `rules`, `rules/:code`, `systems/:id/run`, `runs`, `exceptions`, `exceptions/export`, `exceptions/:id`, `systems/:id/config`, `systems/:id/config/changes`, `systems/:id/baselines`, `systems/:id/baselines/:baselineId`, `systems/:id/baselines/adopt-library`, `baseline-library`.

Transactions and settings are imported through `POST /api/v1/erp/systems/:id/import` with `kind: "transactions"` or `kind: "config"`.

## Limits

Transactions and settings come from extracts (CSV import), not from the direct connectors, which read identities and roles. Scheduled runs re-run the rules over the latest imported data.
