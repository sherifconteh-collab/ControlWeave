'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { assetsAPI, Asset, AssetCategory, Environment } from '@/lib/assetsApi';

function AssetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Pro edition modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');

  // In-page asset details panel
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [selectedDependencies, setSelectedDependencies] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedStatus, selectedEnvironment, searchQuery]);

  useEffect(() => {
    const assetIdFromQuery = searchParams.get('assetId');

    if (assetIdFromQuery && assetIdFromQuery !== selectedAssetId) {
      openAssetPanel(assetIdFromQuery, false);
      return;
    }

    if (!assetIdFromQuery && selectedAssetId) {
      closeAssetPanel(false);
    }
  }, [searchParams, selectedAssetId]);

  useEffect(() => {
    if (!selectedAssetId) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeAssetPanel();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedAssetId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [assetsRes, categoriesRes, environmentsRes, statsRes] = await Promise.all([
        assetsAPI.getAll({
          category: selectedCategory || undefined,
          status: selectedStatus || undefined,
          environment_id: selectedEnvironment || undefined,
          search: searchQuery || undefined,
        }),
        assetsAPI.getCategories(),
        assetsAPI.getEnvironments(),
        assetsAPI.getStats(),
      ]);

      setAssets(assetsRes.data.data.assets || []);
      setCategories(categoriesRes.data.data.categories || []);
      setEnvironments(environmentsRes.data.data.environments || []);
      setStats(statsRes.data.data);
    } catch (err: any) {
      console.error('Load assets error:', err);

      // Handle tier restriction errors
      if (err.response?.data?.upgradeRequired) {
        setUpgradeMessage(err.response.data.message);
        setShowUpgradeModal(true);
      } else {
        setError(err.response?.data?.error || 'Failed to load assets');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'deprecated': return 'bg-orange-100 text-orange-800';
      case 'decommissioned': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getCriticalityColor = (criticality?: string) => {
    switch (criticality) {
      case 'critical': return 'text-red-600 font-bold';
      case 'high': return 'text-orange-600 font-semibold';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-500';
    }
  };

  const getCategoryIcon = (code: string) => {
    switch (code) {
      case 'hardware': return '🖥️';
      case 'software': return '💿';
      case 'cloud': return '☁️';
      case 'network': return '🌐';
      case 'database': return '🗄️';
      case 'ai_agent': return '🤖';
      case 'service_account': return '🔑';
      default: return '📦';
    }
  };

  const closeAssetPanel = (syncUrl = true) => {
    setSelectedAssetId(null);
    setSelectedAsset(null);
    setSelectedDependencies([]);
    setDetailLoading(false);
    setDetailError('');

    if (syncUrl) {
      router.replace('/dashboard/assets', { scroll: false });
    }
  };

  const openAssetPanel = async (assetId: string, syncUrl = true) => {
    if (syncUrl) {
      router.replace(`/dashboard/assets?assetId=${encodeURIComponent(assetId)}`, { scroll: false });
    }

    setSelectedAssetId(assetId);
    setDetailLoading(true);
    setDetailError('');

    try {
      const response = await assetsAPI.getById(assetId);
      setSelectedAsset(response.data.data.asset || null);
      setSelectedDependencies(response.data.data.dependencies || []);
    } catch (err: any) {
      console.error('Load asset detail error:', err);
      setDetailError(err.response?.data?.error || 'Failed to load asset details');
      setSelectedAsset(null);
      setSelectedDependencies([]);
    } finally {
      setDetailLoading(false);
    }
  };

  if (showUpgradeModal) {
    const proUrl = process.env.NEXT_PUBLIC_PRO_URL || 'https://app.controlweave.io';
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-6xl mb-4">🔒</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Available in ControlWeave Pro</h2>
              <p className="text-gray-600 mb-6">
                CMDB and asset management are available in ControlWeave Pro — the full-featured hosted edition.
              </p>
              <div className="space-y-3">
                <a
                  href={proUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium text-center"
                >
                  Get ControlWeave Pro →
                </a>
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Assets</h1>
        <p className="text-gray-600">Configuration Management Database (CMDB)</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Assets</div>
            <div className="text-3xl font-bold text-gray-900">{stats.summary.total_assets}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Active</div>
            <div className="text-3xl font-bold text-green-600">{stats.summary.active_assets}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Categories</div>
            <div className="text-3xl font-bold text-blue-600">{stats.summary.categories_used}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Environments</div>
            <div className="text-3xl font-bold text-purple-600">{stats.summary.environments_used}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.code}>
                  {getCategoryIcon(cat.code)} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="deprecated">Deprecated</option>
              <option value="decommissioned">Decommissioned</option>
            </select>
          </div>

          {/* Environment Filter */}
          <div>
            <select
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Environments</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name} ({env.asset_count || 0})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Assets List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Environment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criticality
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP / Hostname
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No assets found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openAssetPanel(asset.id)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-2xl mr-3">{getCategoryIcon(asset.category_code || '')}</div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{asset.name}</div>
                          {asset.model && (
                            <div className="text-xs text-gray-500">{asset.model}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{asset.category_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{asset.environment_name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(asset.status)}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getCriticalityColor(asset.criticality)}`}>
                        {asset.criticality || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {asset.owner_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{asset.ip_address || asset.hostname || '-'}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        Showing {assets.length} of {stats?.summary.total_assets || 0} assets
      </div>

      {/* In-page detail panel */}
      {selectedAssetId && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close asset details"
            className="absolute inset-0 bg-black/30"
            onClick={() => closeAssetPanel()}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Asset Details</p>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedAsset?.name || 'Loading...'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => closeAssetPanel()}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
              ) : detailError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {detailError}
                </div>
              ) : selectedAsset ? (
                <>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedAsset.status)}`}>
                        {selectedAsset.status}
                      </span>
                      <span className="text-sm text-gray-700">
                        {selectedAsset.category_name || selectedAsset.category_code || '-'}
                      </span>
                      <span className={`text-sm ${getCriticalityColor(selectedAsset.criticality)}`}>
                        {selectedAsset.criticality ? `${selectedAsset.criticality} criticality` : 'No criticality set'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AssetDetailField label="Environment" value={selectedAsset.environment_name} />
                    <AssetDetailField label="Owner" value={selectedAsset.owner_name} />
                    <AssetDetailField label="Model" value={selectedAsset.model} />
                    <AssetDetailField label="Manufacturer" value={selectedAsset.manufacturer} />
                    <AssetDetailField label="IP Address" value={selectedAsset.ip_address} />
                    <AssetDetailField label="Hostname" value={selectedAsset.hostname} />
                    <AssetDetailField label="FQDN" value={selectedAsset.fqdn} />
                    <AssetDetailField label="Location" value={selectedAsset.location} />
                    <AssetDetailField label="Security Classification" value={selectedAsset.security_classification} />
                    <AssetDetailField label="Cloud Provider" value={selectedAsset.cloud_provider} />
                    <AssetDetailField label="Cloud Region" value={selectedAsset.cloud_region} />
                    <AssetDetailField label="Version" value={selectedAsset.version} />
                  </div>

                  {selectedDependencies.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Dependencies</h3>
                      <div className="space-y-2">
                        {selectedDependencies.map((dependency, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{dependency.asset_name}</p>
                              <p className="text-xs text-gray-500">{dependency.asset_category}</p>
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              {dependency.dependency_type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedAsset.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                        {selectedAsset.notes}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-gray-600 text-sm">Asset not found.</div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}

function AssetsPageFallback() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<AssetsPageFallback />}>
      <AssetsPageContent />
    </Suspense>
  );
}

function AssetDetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm text-gray-900 mt-1 break-words">{value || '-'}</div>
    </div>
  );
}
