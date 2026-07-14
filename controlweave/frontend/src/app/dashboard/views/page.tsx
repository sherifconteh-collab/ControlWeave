// @tier: community
'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { dashboardBuilderAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

const WIDGET_TYPES = ['metric', 'chart', 'list', 'text'] as const;
type WidgetType = (typeof WIDGET_TYPES)[number];

interface DashboardWidget {
  id: string;
  dashboard_view_id: string;
  widget_type: string;
  title: string;
  widget_config: Record<string, unknown> | null;
  position_row: number;
  position_col: number;
  width: number;
  height: number;
}

interface DashboardView {
  id: string;
  organization_id: string;
  user_id: string;
  created_by: string;
  name: string;
  description: string | null;
  is_shared: boolean;
  is_default: boolean;
  widgets: DashboardWidget[];
}

interface ViewFormState {
  name: string;
  description: string;
  is_shared: boolean;
  is_default: boolean;
}

interface WidgetFormState {
  widget_type: WidgetType;
  title: string;
  widget_configInput: string;
  position_row: number;
  position_col: number;
  width: number;
  height: number;
}

const EMPTY_VIEW_FORM: ViewFormState = { name: '', description: '', is_shared: false, is_default: false };
const EMPTY_WIDGET_FORM: WidgetFormState = {
  widget_type: 'metric',
  title: '',
  widget_configInput: '',
  position_row: 0,
  position_col: 0,
  width: 1,
  height: 1,
};

function errorMessage(err: unknown, fallback: string): string {
  const responseError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return responseError || fallback;
}

export default function DashboardViewsPage() {
  const { user } = useAuth();
  const { toast, toastType, showToast } = useToast();

  const [views, setViews] = useState<DashboardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showViewForm, setShowViewForm] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [viewForm, setViewForm] = useState<ViewFormState>(EMPTY_VIEW_FORM);
  const [savingView, setSavingView] = useState(false);
  const [viewFormError, setViewFormError] = useState('');

  const [openViewId, setOpenViewId] = useState<string | null>(null);
  const [showWidgetForm, setShowWidgetForm] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [widgetForm, setWidgetForm] = useState<WidgetFormState>(EMPTY_WIDGET_FORM);
  const [savingWidget, setSavingWidget] = useState(false);
  const [widgetFormError, setWidgetFormError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManageView = useCallback(
    (view: DashboardView) => user?.role === 'admin' || view.user_id === user?.id || view.created_by === user?.id,
    [user]
  );

  const loadViews = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setError('');
      const response = await dashboardBuilderAPI.getViews();
      if (!cancelledRef?.current) setViews(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch {
      if (!cancelledRef?.current) setError('Failed to load dashboard views.');
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadViews(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadViews]);

  const openCreateViewForm = () => {
    setEditingViewId(null);
    setViewForm(EMPTY_VIEW_FORM);
    setViewFormError('');
    setShowViewForm(true);
  };

  const openEditViewForm = (view: DashboardView) => {
    setEditingViewId(view.id);
    setViewForm({
      name: view.name,
      description: view.description || '',
      is_shared: view.is_shared,
      is_default: view.is_default,
    });
    setViewFormError('');
    setShowViewForm(true);
  };

  const submitViewForm = async () => {
    if (!viewForm.name.trim() || viewForm.name.trim().length < 2) {
      setViewFormError('Name is required (min 2 characters).');
      return;
    }
    setSavingView(true);
    setViewFormError('');
    try {
      const payload = {
        name: viewForm.name.trim(),
        description: viewForm.description.trim() || null,
        is_shared: viewForm.is_shared,
        is_default: viewForm.is_default,
      };
      if (editingViewId) {
        await dashboardBuilderAPI.updateView(editingViewId, payload);
      } else {
        await dashboardBuilderAPI.createView(payload);
      }
      setShowViewForm(false);
      setEditingViewId(null);
      setViewForm(EMPTY_VIEW_FORM);
      await loadViews();
    } catch (err) {
      setViewFormError(errorMessage(err, 'Failed to save dashboard view.'));
    } finally {
      setSavingView(false);
    }
  };

  const deleteView = async (id: string) => {
    if (!window.confirm('Delete this dashboard view? This also removes its widgets.')) return;
    setBusyId(id);
    try {
      await dashboardBuilderAPI.deleteView(id);
      if (openViewId === id) setOpenViewId(null);
      await loadViews();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to delete dashboard view.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openAddWidgetForm = () => {
    setEditingWidgetId(null);
    setWidgetForm(EMPTY_WIDGET_FORM);
    setWidgetFormError('');
    setShowWidgetForm(true);
  };

  const openEditWidgetForm = (widget: DashboardWidget) => {
    setEditingWidgetId(widget.id);
    setWidgetForm({
      widget_type: (WIDGET_TYPES as readonly string[]).includes(widget.widget_type)
        ? (widget.widget_type as WidgetType)
        : 'metric',
      title: widget.title,
      widget_configInput: widget.widget_config ? JSON.stringify(widget.widget_config, null, 2) : '',
      position_row: widget.position_row,
      position_col: widget.position_col,
      width: widget.width,
      height: widget.height,
    });
    setWidgetFormError('');
    setShowWidgetForm(true);
  };

  const submitWidgetForm = async () => {
    if (!openViewId || !widgetForm.title.trim()) {
      setWidgetFormError('Title is required.');
      return;
    }
    let parsedConfig: Record<string, unknown> = {};
    if (widgetForm.widget_configInput.trim()) {
      try {
        parsedConfig = JSON.parse(widgetForm.widget_configInput);
      } catch {
        setWidgetFormError('Widget config must be valid JSON.');
        return;
      }
    }
    setSavingWidget(true);
    setWidgetFormError('');
    try {
      const payload = {
        widget_type: widgetForm.widget_type,
        title: widgetForm.title.trim(),
        widget_config: parsedConfig,
        position_row: widgetForm.position_row,
        position_col: widgetForm.position_col,
        width: widgetForm.width,
        height: widgetForm.height,
      };
      if (editingWidgetId) {
        await dashboardBuilderAPI.updateWidget(editingWidgetId, payload);
      } else {
        await dashboardBuilderAPI.addWidget(openViewId, payload);
      }
      setShowWidgetForm(false);
      setEditingWidgetId(null);
      setWidgetForm(EMPTY_WIDGET_FORM);
      await loadViews();
    } catch (err) {
      setWidgetFormError(errorMessage(err, 'Failed to save widget.'));
    } finally {
      setSavingWidget(false);
    }
  };

  const removeWidget = async (id: string) => {
    if (!window.confirm('Remove this widget?')) return;
    setBusyId(id);
    try {
      await dashboardBuilderAPI.deleteWidget(id);
      await loadViews();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to remove widget.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {toast && (
          <div role="status" aria-live="polite" className={`fixed top-6 right-6 z-50 px-4 py-2 rounded-lg shadow text-white ${toastType === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
            {toast}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Views</h1>
            <p className="text-gray-600 mt-2">Build custom dashboard views composed of simple widgets.</p>
          </div>
          <button
            type="button"
            onClick={openCreateViewForm}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
          >
            + New View
          </button>
        </div>

        {showViewForm && (
          <div className="bg-white rounded-lg border border-purple-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">{editingViewId ? 'Edit View' : 'New View'}</h3>
            {viewFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">{viewFormError}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Name</span>
                <input
                  type="text"
                  value={viewForm.name}
                  onChange={(e) => setViewForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Description</span>
                <input
                  type="text"
                  value={viewForm.description}
                  onChange={(e) => setViewForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </label>
              <label className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  checked={viewForm.is_shared}
                  onChange={(e) => setViewForm((prev) => ({ ...prev, is_shared: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Shared with organization</span>
              </label>
              <label className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  checked={viewForm.is_default}
                  onChange={(e) => setViewForm((prev) => ({ ...prev, is_default: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Set as my default view</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowViewForm(false); setEditingViewId(null); setViewForm(EMPTY_VIEW_FORM); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitViewForm}
                disabled={savingView}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {savingView ? 'Saving...' : editingViewId ? 'Save Changes' : 'Create View'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-16 rounded bg-gray-100" />
            <div className="h-16 rounded bg-gray-100" />
          </div>
        ) : views.length === 0 ? (
          <p className="text-sm text-gray-500">No dashboard views yet. Create one to get started.</p>
        ) : (
          <ul className="space-y-3" role="list">
            {views.map((view) => (
              <li key={view.id} role="listitem" className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{view.name}</span>
                      {view.is_default && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800">Default</span>
                      )}
                      {view.is_shared && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800">Shared</span>
                      )}
                    </div>
                    {view.description && <p className="text-xs text-gray-500 mt-1">{view.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{view.widgets.length} widget{view.widgets.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenViewId((prev) => (prev === view.id ? null : view.id))}
                      className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded hover:bg-purple-200"
                    >
                      {openViewId === view.id ? 'Hide Widgets' : 'Open'}
                    </button>
                    {canManageView(view) && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditViewForm(view)}
                          className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteView(view.id)}
                          disabled={busyId === view.id}
                          className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {openViewId === view.id && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Widgets</h4>
                      {canManageView(view) && (
                        <button
                          type="button"
                          onClick={openAddWidgetForm}
                          className="px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700"
                        >
                          + Add Widget
                        </button>
                      )}
                    </div>

                    {showWidgetForm && canManageView(view) && (
                      <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
                        {widgetFormError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">{widgetFormError}</div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-medium text-gray-700">Widget Type</span>
                            <select
                              value={widgetForm.widget_type}
                              onChange={(e) => setWidgetForm((prev) => ({ ...prev, widget_type: e.target.value as WidgetType }))}
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                              {WIDGET_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium text-gray-700">Title</span>
                            <input
                              type="text"
                              value={widgetForm.title}
                              onChange={(e) => setWidgetForm((prev) => ({ ...prev, title: e.target.value }))}
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium text-gray-700">Row</span>
                            <input
                              type="number"
                              value={widgetForm.position_row}
                              onChange={(e) => setWidgetForm((prev) => ({ ...prev, position_row: Number(e.target.value) }))}
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium text-gray-700">Column</span>
                            <input
                              type="number"
                              value={widgetForm.position_col}
                              onChange={(e) => setWidgetForm((prev) => ({ ...prev, position_col: Number(e.target.value) }))}
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium text-gray-700">Width</span>
                            <input
                              type="number"
                              min={1}
                              value={widgetForm.width}
                              onChange={(e) => setWidgetForm((prev) => ({ ...prev, width: Math.max(1, Number(e.target.value)) }))}
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium text-gray-700">Height</span>
                            <input
                              type="number"
                              min={1}
                              value={widgetForm.height}
                              onChange={(e) => setWidgetForm((prev) => ({ ...prev, height: Math.max(1, Number(e.target.value)) }))}
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </label>
                          <label className="block md:col-span-2">
                            <span className="text-xs font-medium text-gray-700">Widget Config (optional JSON)</span>
                            <textarea
                              value={widgetForm.widget_configInput}
                              onChange={(e) => setWidgetForm((prev) => ({ ...prev, widget_configInput: e.target.value }))}
                              rows={4}
                              placeholder='{"metric": "compliance_percentage"}'
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </label>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => { setShowWidgetForm(false); setEditingWidgetId(null); setWidgetForm(EMPTY_WIDGET_FORM); }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={submitWidgetForm}
                            disabled={savingWidget}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
                          >
                            {savingWidget ? 'Saving...' : editingWidgetId ? 'Save Changes' : 'Add Widget'}
                          </button>
                        </div>
                      </div>
                    )}

                    {view.widgets.length === 0 ? (
                      <p className="text-sm text-gray-500">No widgets yet. Add one to get started.</p>
                    ) : (
                      <ul className="space-y-2" role="list">
                        {view.widgets.map((widget) => (
                          <li key={widget.id} role="listitem" className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 rounded px-3 py-2">
                            <div>
                              <span className="text-sm font-medium text-gray-900">{widget.title}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                {widget.widget_type} &middot; row {widget.position_row}, col {widget.position_col} &middot; {widget.width}x{widget.height}
                              </span>
                            </div>
                            {canManageView(view) && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditWidgetForm(widget)}
                                  className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeWidget(widget.id)}
                                  disabled={busyId === widget.id}
                                  className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
