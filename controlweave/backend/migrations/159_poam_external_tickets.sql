-- Migration 159: link POA&M items to external remediation tickets
--
-- Remediation work usually happens in the engineering team's ticketing system
-- (Jira), not in the GRC tool. These columns record the ticket a POA&M item
-- was pushed to and the ticket's last known status, refreshed on each Jira
-- connector sync, so auditors see remediation progress next to the POA&M.

ALTER TABLE poam_items
  ADD COLUMN IF NOT EXISTS external_ticket_system TEXT,
  ADD COLUMN IF NOT EXISTS external_ticket_key TEXT,
  ADD COLUMN IF NOT EXISTS external_ticket_url TEXT,
  ADD COLUMN IF NOT EXISTS external_ticket_status TEXT,
  ADD COLUMN IF NOT EXISTS external_ticket_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_ticket_connector_id UUID REFERENCES integration_connectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_poam_items_external_ticket
  ON poam_items (organization_id, external_ticket_connector_id)
  WHERE external_ticket_key IS NOT NULL;
