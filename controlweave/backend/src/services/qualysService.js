// Qualys VMDR connector — queries vulnerability detections and normalizes them.
'use strict';

const { requestJson } = require('./connectors/http');

function severityFromQualys(severity) {
  const s = parseInt(severity, 10);
  if (s >= 5) return 'critical';
  if (s === 4) return 'high';
  if (s === 3) return 'medium';
  if (s <= 2) return 'low';
  return 'informational';
}

// Read through the shared connector client: SSRF guard on the tenant-supplied
// base URL, a timeout, and an error (never an empty result) for a non-2xx
// status or a body that is not JSON.
async function qualysRequest(config, path) {
  const base = String(config.baseUrl || '').trim().replace(/\/+$/, '');
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const { data } = await requestJson(`${base}${path}`, {
    headers: { Authorization: `Basic ${auth}`, 'X-Requested-With': 'ControlWeaver' },
    timeoutMs: 60000
  });
  if (!data || !data.HOST_LIST_VM_DETECTION_OUTPUT) throw new Error('Qualys returned an unexpected response');
  return data;
}

async function syncFindings(connectorConfig) {
  try {
    const tagFilter = connectorConfig.tagIds ? `&tag_id=${encodeURIComponent(String(connectorConfig.tagIds))}` : '';
    const data = await qualysRequest(
      connectorConfig,
      `/api/2.0/fo/asset/host/vm/detection/?action=list&output_format=JSON&status=Active${tagFilter}`
    );
    const hostList = data?.HOST_LIST_VM_DETECTION_OUTPUT?.RESPONSE?.HOST_LIST?.HOST || [];
    const hosts = Array.isArray(hostList) ? hostList : [hostList];
    const findings = [];
    for (const host of hosts) {
      const detections = host.DETECTION_LIST?.DETECTION || [];
      const dets = Array.isArray(detections) ? detections : [detections];
      for (const det of dets) {
        if (!det.QID) continue;
        findings.push({
          external_id: `${host.ID}-${det.QID}`,
          title: det.RESULTS || `QID ${det.QID}`,
          severity: severityFromQualys(det.SEVERITY),
          status: String(det.STATUS || '').toLowerCase() === 'fixed' ? 'resolved' : 'open',
          raw_data: { host_id: host.ID, qid: det.QID, ...det }
        });
      }
    }
    return { findings };
  } catch (error) {
    return { error: error.message, findings: [] };
  }
}

module.exports = { syncFindings };
