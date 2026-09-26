'use client';

import { useEffect, useState } from 'react';
import { billingAPI } from '@/lib/api';

export interface AddonState {
  loading: boolean;
  /** True when the add-on is licensed, or when commercial mode is off. */
  licensed: boolean;
  commercialMode: boolean;
  label: string;
  description: string;
}

interface EntitlementsPayload {
  commercialMode?: boolean;
  addons?: string[];
  addonCatalog?: { id: string; label: string; description: string }[];
}

/**
 * Whether the organization holds a separately licensed add-on module. Fails
 * open while loading or if entitlements cannot be read: the API enforces the
 * wall, this only decides what the UI offers.
 */
export function useAddon(addon: string): AddonState {
  const [state, setState] = useState<AddonState>({ loading: true, licensed: true, commercialMode: false, label: '', description: '' });

  useEffect(() => {
    let active = true;
    billingAPI.getEntitlements()
      .then((res) => {
        const data = (res.data?.data || {}) as EntitlementsPayload;
        const entry = (data.addonCatalog || []).find((a) => a.id === addon);
        const commercialMode = Boolean(data.commercialMode);
        if (active) {
          setState({
            loading: false,
            commercialMode,
            licensed: !commercialMode || (data.addons || []).includes(addon),
            label: entry?.label || addon,
            description: entry?.description || '',
          });
        }
      })
      .catch(() => { if (active) setState((s) => ({ ...s, loading: false })); });
    return () => { active = false; };
  }, [addon]);

  return state;
}
