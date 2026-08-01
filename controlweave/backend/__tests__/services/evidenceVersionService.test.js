const mockQuery = jest.fn();
const mockClient = { query: mockQuery, release: jest.fn() };

jest.mock('../../src/config/database', () => ({
  connect: jest.fn(() => Promise.resolve(mockClient)),
  query: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  log: jest.fn(),
  serializeError: jest.fn((error) => ({ message: error?.message }))
}));

const pool = require('../../src/config/database');
const service = require('../../src/services/evidenceVersionService');

const SNAPSHOT_INSERT = 'INSERT INTO evidence_versions';

function primeClient(handlers) {
  mockQuery.mockReset();
  mockQuery.mockImplementation((sql) => {
    const text = String(sql);
    for (const [fragment, response] of handlers) {
      if (text.includes(fragment)) return Promise.resolve(response);
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

function callsMatching(fragment) {
  return mockQuery.mock.calls.filter(([sql]) => String(sql).includes(fragment));
}

const CURRENT_ROW = {
  evidence_version: 3,
  file_name: 'soc2-report.pdf',
  file_path: '/uploads/abc-123.pdf',
  file_size: 4096,
  mime_type: 'application/pdf',
  integrity_hash_sha256: 'deadbeef',
  description: 'FY25 SOC 2 report',
  tags: ['soc2'],
  evidence_type: 'attestation',
  pii_classification: 'low',
  pii_types: ['name'],
  data_sensitivity: 'confidential'
};

describe('evidenceVersionService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockClient.release.mockReset();
    pool.connect.mockClear();
    pool.query.mockReset();
  });

  describe('snapshotCurrentVersion', () => {
    it('archives the row exactly as it stands, including the PII classification', async () => {
      primeClient([['FOR UPDATE', { rows: [CURRENT_ROW] }], [SNAPSHOT_INSERT, { rowCount: 1 }]]);

      const version = await service.snapshotCurrentVersion(mockClient, {
        evidenceId: 'ev-1', organizationId: 'org-1', actorUserId: 'user-1', changeNote: 'replaced with signed copy'
      });

      expect(version).toBe(3);
      const [, params] = callsMatching(SNAPSHOT_INSERT)[0];
      // The whole point of the table: the superseded file's hash and the
      // classification it carried while being relied on must both survive.
      expect(params).toEqual(expect.arrayContaining([
        'ev-1', 'org-1', 3, 'soc2-report.pdf', '/uploads/abc-123.pdf',
        'deadbeef', 'low', 'confidential', 'replaced with signed copy'
      ]));
    });

    it('locks the row so a concurrent update cannot archive the same version twice', async () => {
      primeClient([['FOR UPDATE', { rows: [CURRENT_ROW] }]]);
      await service.snapshotCurrentVersion(mockClient, { evidenceId: 'ev-1', organizationId: 'org-1' });
      expect(callsMatching('FOR UPDATE')).toHaveLength(1);
    });

    it('scopes the read to the organization', async () => {
      primeClient([['FOR UPDATE', { rows: [CURRENT_ROW] }]]);
      await service.snapshotCurrentVersion(mockClient, { evidenceId: 'ev-1', organizationId: 'org-1' });
      const [sql, params] = callsMatching('FOR UPDATE')[0];
      expect(sql).toContain('organization_id = $2');
      expect(params).toEqual(['ev-1', 'org-1']);
    });

    it('returns null when the evidence does not belong to the organization', async () => {
      primeClient([['FOR UPDATE', { rows: [] }]]);
      const version = await service.snapshotCurrentVersion(mockClient, {
        evidenceId: 'ev-1', organizationId: 'other-org'
      });
      expect(version).toBeNull();
      expect(callsMatching(SNAPSHOT_INSERT)).toHaveLength(0);
    });

    it('treats a missing version counter as version 1', async () => {
      primeClient([['FOR UPDATE', { rows: [{ ...CURRENT_ROW, evidence_version: null }] }]]);
      const version = await service.snapshotCurrentVersion(mockClient, {
        evidenceId: 'ev-1', organizationId: 'org-1'
      });
      expect(version).toBe(1);
    });
  });

  describe('withSnapshot', () => {
    it('commits the snapshot and the update together', async () => {
      primeClient([
        ['FOR UPDATE', { rows: [CURRENT_ROW] }],
        [SNAPSHOT_INSERT, { rowCount: 1 }],
        ['UPDATE evidence', { rows: [{ id: 'ev-1', evidence_version: 4 }] }]
      ]);

      const outcome = await service.withSnapshot(
        { evidenceId: 'ev-1', organizationId: 'org-1', actorUserId: 'user-1' },
        (client) => client.query('UPDATE evidence SET description = $1', ['new'])
      );

      expect(outcome.snapshotVersion).toBe(3);
      expect(outcome.result.rows[0].evidence_version).toBe(4);
      expect(callsMatching('COMMIT')).toHaveLength(1);
      expect(callsMatching('ROLLBACK')).toHaveLength(0);
    });

    it('rolls back and reports notFound without running the update', async () => {
      primeClient([['FOR UPDATE', { rows: [] }]]);
      const applyUpdate = jest.fn();

      const outcome = await service.withSnapshot(
        { evidenceId: 'ev-1', organizationId: 'other-org' }, applyUpdate
      );

      expect(outcome).toEqual({ notFound: true });
      expect(applyUpdate).not.toHaveBeenCalled();
      expect(callsMatching('ROLLBACK')).toHaveLength(1);
    });

    it('rolls back the snapshot when the update fails, so history cannot drift from the row', async () => {
      primeClient([['FOR UPDATE', { rows: [CURRENT_ROW] }], [SNAPSHOT_INSERT, { rowCount: 1 }]]);

      await expect(service.withSnapshot(
        { evidenceId: 'ev-1', organizationId: 'org-1' },
        () => Promise.reject(new Error('update exploded'))
      )).rejects.toThrow('update exploded');

      expect(callsMatching('COMMIT')).toHaveLength(0);
      expect(callsMatching('ROLLBACK')).toHaveLength(1);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('reads', () => {
    it('lists versions newest first, scoped to the organization', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ version_number: 3 }, { version_number: 2 }] });
      const rows = await service.listVersions('org-1', 'ev-1');
      expect(rows).toHaveLength(2);
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('ev.organization_id = $1');
      expect(sql).toContain('ORDER BY ev.version_number DESC');
      expect(params).toEqual(['org-1', 'ev-1']);
    });

    it('scopes a single version read to the organization', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ version_number: 2, file_path: '/uploads/x.pdf' }] });
      const row = await service.getVersion('org-1', 'ev-1', 2);
      expect(row.version_number).toBe(2);
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('organization_id = $1');
      expect(params).toEqual(['org-1', 'ev-1', 2]);
    });

    it('returns null for a version another organization owns', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      expect(await service.getVersion('other-org', 'ev-1', 2)).toBeNull();
    });
  });
});
