import { expect, test, type Page, type Route } from '@playwright/test';

type UserFixture = {
  id?: string;
  email?: string;
  full_name?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  is_platform_admin?: boolean;
  organization?: {
    id?: string;
    name?: string;
    tier?: string;
    effective_tier?: string;
    billing_status?: string;
    trial_status?: string;
    trial_ends_at?: string | null;
    onboarding_completed?: boolean;
    feature_overrides?: Record<string, unknown>;
    global_feature_flags?: Record<string, boolean>;
    framework_codes?: string[];
  };
};

function jsonResponse(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function gotoWithRedirectTolerance(page: Page, path: string) {
  try {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('ERR_ABORTED')) {
      throw error;
    }
  }
}

function buildUserFixture(overrides: UserFixture = {}) {
  return {
    id: overrides.id || 'user-1',
    email: overrides.email || 'playwright@example.com',
    full_name: overrides.full_name || 'Playwright User',
    role: overrides.role || 'admin',
    roles: overrides.roles || ['admin'],
    permissions: overrides.permissions || ['*'],
    is_platform_admin: overrides.is_platform_admin || false,
    organization: {
      id: overrides.organization?.id || 'org-1',
      name: overrides.organization?.name || 'Playwright Org',
      tier: overrides.organization?.tier || 'pro',
      effective_tier: overrides.organization?.effective_tier || overrides.organization?.tier || 'pro',
      billing_status: overrides.organization?.billing_status || 'active_paid',
      trial_status: overrides.organization?.trial_status || 'none',
      trial_ends_at: overrides.organization?.trial_ends_at || null,
      onboarding_completed: overrides.organization?.onboarding_completed ?? true,
      feature_overrides: overrides.organization?.feature_overrides || {},
      global_feature_flags: overrides.organization?.global_feature_flags || {},
      framework_codes: overrides.organization?.framework_codes || [],
    },
  };
}

async function stubAuthenticatedBrowserState(page: Page, options: { pendingPlan?: string | null; user?: UserFixture } = {}) {
  const user = buildUserFixture(options.user);
  const pendingPlan = options.pendingPlan;

  await page.addInitScript(({ nextPendingPlan }) => {
    window.localStorage.setItem('refreshToken', 'playwright-refresh-token');
    if (typeof nextPendingPlan === 'string') {
      window.localStorage.setItem('pendingPlan', nextPendingPlan);
    } else {
      window.localStorage.removeItem('pendingPlan');
    }
  }, { nextPendingPlan: pendingPlan ?? null });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (pathname === '/api/v1/auth/refresh' && request.method() === 'POST') {
      return jsonResponse(route, { success: true, data: { accessToken: 'playwright.access.token' } });
    }

    if (pathname === '/api/v1/auth/me' && request.method() === 'GET') {
      return jsonResponse(route, { success: true, data: user });
    }

    if (pathname === '/api/v1/dashboard/stats') {
      return jsonResponse(route, {
        success: true,
        data: {
          overall: { totalControls: 0, compliancePercentage: 0 },
          frameworks: [],
        },
      });
    }

    if (pathname === '/api/v1/dashboard/priority-actions') {
      return jsonResponse(route, { success: true, data: [] });
    }

    if (pathname === '/api/v1/dashboard/recent-activity') {
      return jsonResponse(route, { success: true, data: [] });
    }

    if (pathname === '/api/v1/billing/create-checkout-session' && request.method() === 'POST') {
      return jsonResponse(route, { success: true, data: {} });
    }

    return jsonResponse(route, { success: true, data: [] });
  });
}

test('home redirect ignores invalid pending plan values and self-heals localStorage', async ({ page }) => {
  await stubAuthenticatedBrowserState(page, {
    pendingPlan: 'stale-invalid-plan',
    user: {
      organization: {
        tier: 'pro',
        effective_tier: 'pro',
        billing_status: 'active_paid',
      },
    },
  });

  await gotoWithRedirectTolerance(page, '/');
  await page.waitForURL('**/dashboard');

  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem('pendingPlan'))).toBeNull();
});

test('billing resolve falls back to a valid checkout plan when pendingPlan is invalid', async ({ page }) => {
  await stubAuthenticatedBrowserState(page, {
    pendingPlan: 'definitely-not-a-real-plan',
    user: {
      organization: {
        tier: 'pro',
        effective_tier: 'pro',
        billing_status: 'past_due',
      },
    },
  });

  await gotoWithRedirectTolerance(page, '/billing/resolve');
  await expect(page.getByRole('heading', { name: 'Subscription Required' })).toBeVisible();

  await page.getByRole('button', { name: 'Complete Payment for Pro' }).click();
  await page.waitForURL('**/billing/checkout?plan=pro_monthly');
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem('pendingPlan'))).toBeNull();
});

test('billing resolve uses effectiveTier for enterprise messaging and contact-sales routing', async ({ page }) => {
  await stubAuthenticatedBrowserState(page, {
    user: {
      organization: {
        tier: 'community',
        effective_tier: 'enterprise',
        billing_status: 'past_due',
      },
    },
  });

  await gotoWithRedirectTolerance(page, '/billing/resolve');

  await expect(page.getByText(/Your ControlWeave organization is on the/i)).toContainText('Enterprise');
  await expect(page.getByRole('button', { name: 'Contact Sales for Enterprise' })).toBeVisible();

  await page.getByRole('button', { name: 'Contact Sales for Enterprise' }).click();
  await page.waitForURL('**/contact');
});