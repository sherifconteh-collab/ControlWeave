# Phase 4: Frontend Dashboards - Implementation Plan

## Overview

This phase focuses on building frontend UI components for the AI governance features implemented in the backend. The goal is to provide intuitive, real-time dashboards for continuous monitoring, data sovereignty management, and vendor risk assessment.

## Scope

### 1. AI Continuous Monitoring Dashboard

#### Components to Build

**Monitoring Overview Dashboard** (`/dashboard/ai-monitoring`)
- **Summary Cards**:
  - Total AI systems under monitoring
  - Active monitoring rules count
  - Open events (last 24h, 7d, 30d)
  - Critical/high severity events count
  
- **Real-time Event Stream**:
  - Live feed of monitoring events
  - Color-coded by severity (critical=red, high=orange, medium=yellow, low=blue)
  - Quick action buttons: Review, Resolve, Dismiss
  - Filtering by severity, status, AI agent, rule type
  
- **Monitoring Rules Table**:
  - List all rules with status indicators
  - Enable/disable toggle per rule
  - Edit/delete actions
  - "Last triggered" timestamp
  - "Trigger count" metric

**Rule Creation/Edit Form** (`/dashboard/ai-monitoring/rules/new`)
- **Rule Configuration**:
  - Rule name and description
  - Rule type dropdown: threshold, pattern, anomaly, policy_violation
  - AI agent selector (or "All agents")
  - Metric name input (with suggestions: confidence_score, processing_time, error_rate, bias_score)
  - Threshold configuration (value, operator: gt/lt/gte/lte/eq)
  - Pattern regex input (for pattern type)
  - Evaluation window (seconds)
  
- **Actions Configuration**:
  - Alert severity: low/medium/high/critical
  - Block on violation checkbox
  - Require human review checkbox
  - Notification targets (multi-select users/emails)
  
- **Preview/Test**:
  - Test rule against sample data
  - Show estimated trigger frequency

**Event Details Modal**
- Event timeline and context
- Related AI decision log entry
- Rule that triggered the event
- AI agent details
- Review form with decision buttons
- Resolution notes textarea
- Audit trail of actions

**Anomaly Baseline Management** (`/dashboard/ai-monitoring/baselines`)
- **Baseline Configuration**:
  - AI agent selector
  - Metric selector
  - Days back slider (7-90 days)
  - Sensitivity selector: low/medium/high
  
- **Baseline Visualization**:
  - Statistical charts: mean, std deviation, percentiles
  - Historical data graph with confidence bands
  - Anomaly detection zones (color-coded)
  - Z-score threshold indicator
  
- **Baseline History**:
  - Table of past baseline calculations
  - Comparison view (before/after)
  - Recalculate button

**AI System Monitoring Configuration** (`/dashboard/ai-monitoring/systems`)
- List of all AI systems (AIBOM entries)
- Monitoring status toggle per system
- Frequency configuration
- Last check timestamp
- Health indicator (green/yellow/red)

### 2. Data Sovereignty Compliance Dashboard

#### Components to Build

**Sovereignty Overview** (`/dashboard/data-sovereignty`)
- **Compliance Status Cards**:
  - Jurisdictions count (total/active)
  - Compliant vs non-compliant count
  - Overdue assessments count
  - Pending regulatory changes count
  
- **Jurisdiction Map**:
  - Interactive world map
  - Color-coded by compliance status
  - Click to view jurisdiction details
  - Filter by presence type

**Jurisdiction Management** (`/dashboard/data-sovereignty/jurisdictions`)
- **Jurisdiction List/Grid**:
  - Jurisdiction name, code, flag icon
  - Presence type badges
  - Compliance status indicator
  - Last assessment date
  - Next assessment due date
  - Quick actions: View details, Update status, Remove
  
- **Add Jurisdiction Modal**:
  - Jurisdiction selector (searchable dropdown)
  - Presence type radio buttons
  - Operational since date picker
  - Compliance required checkbox
  - Applicable frameworks multi-select
  - Notes textarea

**Jurisdiction Details Page** (`/dashboard/data-sovereignty/jurisdictions/:id`)
- **Overview Section**:
  - Jurisdiction information
  - Primary laws and regulations
  - Data residency requirements
  - Transfer mechanisms
  
- **Compliance Timeline**:
  - Historical assessment dates
  - Status changes over time
  - Upcoming assessment schedule
  
- **Applicable Frameworks**:
  - List of frameworks for this jurisdiction
  - Activation status per framework
  - Coverage percentage
  
- **Recommended Frameworks** (for onboarding):
  - Display frameworks recommended for this jurisdiction
  - Activate button per framework
  - Tier badges (free/starter/professional)

**Regulatory Changes Dashboard** (`/dashboard/data-sovereignty/changes`)
- **Changes Feed**:
  - Timeline view of regulatory changes
  - Filter by jurisdiction, impact level, status
  - Change type badges (new_law, amendment, guidance, etc.)
  - Effective date countdown
  
- **Change Details Card**:
  - Full description
  - Impact assessment
  - Affected frameworks and controls
  - Action plan status
  - Create POA&M button

**Compliance Gap Analysis** (`/dashboard/data-sovereignty/gaps`)
- **Gap Summary Dashboard**:
  - Jurisdiction-by-jurisdiction breakdown
  - Compliance status indicators
  - Pending changes per jurisdiction
  - Critical gaps highlighted
  
- **Gap Detail Table**:
  - Jurisdiction name
  - Required frameworks
  - Current status
  - Missing controls count
  - Recommended actions
  - Priority score

**Data Residency Configuration** (`/dashboard/settings/data-sovereignty`)
- **Configuration Form**:
  - Primary data region selector (AWS/Azure/GCP regions)
  - Cross-border transfer toggle
  - Approved transfer regions multi-select
  - Data localization policy textarea
  
- **Attestation Section**:
  - Last attestation date and by whom
  - Re-attest button
  - Audit trail

### 3. Vendor Risk Assessment Dashboard

#### Components to Build

**Vendor Risk Overview** (`/dashboard/vendor-risk`)
- **Summary Metrics**:
  - Total vendors assessed
  - Critical/high risk vendor count
  - Overdue assessments count
  - Incidents (last 30/90 days)
  
- **Risk Heatmap**:
  - Grid view: vendors × risk dimensions
  - Color intensity = risk level
  - Click to drill down
  
- **Vendor List**:
  - Sortable/filterable table
  - Vendor name, type, overall risk score
  - Last assessment date
  - SLA compliance indicator
  - Quick actions

**Vendor Assessment Form** (`/dashboard/vendor-risk/assessments/new`)
- **Vendor Information**:
  - Vendor name, type, website, contact
  - Assessment type: initial/periodic/change_triggered
  
- **Risk Scoring**:
  - Overall risk score slider (0-100)
  - Dimension scores:
    - Security risk (0-100)
    - Privacy risk (0-100)
    - Compliance risk (0-100)
    - Operational risk (0-100)
    - Financial risk (0-100)
  - Risk level auto-calculated: low/medium/high/critical
  
- **AI-Specific Factors**:
  - Model transparency dropdown
  - Bias testing evidence checkbox
  - Explainability capability dropdown
  - Adversarial robustness dropdown
  - Data provenance clarity dropdown
  
- **Compliance Attributes**:
  - Certifications multi-select (SOC 2, ISO 27001, etc.)
  - Compliant frameworks tags
  - Data residency options multi-select
  - Subprocessors list input
  
- **Contract Details**:
  - Start/end date pickers
  - Annual contract value input
  - SLA uptime guarantee (%)
  - Data retention days
  
- **Business Context**:
  - Business criticality dropdown
  - Data sensitivity dropdown
  - Usage volume dropdown
  - Affected systems multi-select
  
- **Risk Treatment**:
  - Acceptance status dropdown
  - Mitigation plan textarea
  - Follow-up actions list

**Vendor Details Page** (`/dashboard/vendor-risk/vendors/:id`)
- **Vendor Profile**:
  - Basic information
  - Latest assessment summary
  - Risk trend chart (over time)
  
- **Supply Chain Components**:
  - List of components from this vendor
  - Component type, version, approval status
  - Known vulnerabilities count
  - Add component button
  
- **Incident History**:
  - Timeline of incidents
  - Severity distribution chart
  - Open vs resolved count
  - Add incident button
  
- **Performance Metrics**:
  - SLA compliance chart
  - Uptime graph
  - Response time trends
  - Error rate over time
  
- **Assessment History**:
  - Table of past assessments
  - Risk score trends
  - Compare assessments button

**Supply Chain Tracking** (`/dashboard/vendor-risk/supply-chain`)
- **Component Inventory**:
  - Hierarchical view (parent/child dependencies)
  - Component type filter
  - Approval status filter
  - Vulnerability count per component
  
- **Component Details Modal**:
  - Component information
  - Source vendor link
  - Used by assets/AIBOMs
  - Provenance verification status
  - Checksum/signature info
  
- **Vulnerability View**:
  - Components with known vulnerabilities
  - CVE links and details
  - Remediation status
  - Risk priority

**Incident Management** (`/dashboard/vendor-risk/incidents`)
- **Incident List**:
  - Filter by vendor, type, severity, status
  - Incident summary cards
  - Status workflow indicators
  
- **Incident Form**:
  - Vendor selector
  - Incident date, type, severity
  - Description and impact
  - Vendor response tracking
  - Internal response notes
  - Notification requirements

## Technical Stack

### Frontend Technologies
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **UI Library**: React 18+
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui or Chakra UI
- **Charts**: Recharts or Chart.js
- **Tables**: TanStack Table (React Table v8)
- **Forms**: React Hook Form + Zod validation
- **State Management**: Zustand or React Query
- **Date Handling**: date-fns
- **Icons**: Lucide React or Heroicons

### Key Libraries
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "@tanstack/react-table": "^8.10.0",
    "@tanstack/react-query": "^5.0.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",
    "recharts": "^2.10.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.300.0",
    "axios": "^1.6.0"
  }
}
```

## API Integration

### HTTP Client Setup
```typescript
// lib/api-client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

### React Query Hooks
```typescript
// hooks/useMonitoringRules.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useMonitoringRules() {
  return useQuery({
    queryKey: ['monitoring-rules'],
    queryFn: async () => {
      const { data } = await apiClient.get('/ai/monitoring/rules');
      return data.data;
    },
  });
}

export function useCreateMonitoringRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ruleData) => {
      const { data } = await apiClient.post('/ai/monitoring/rules', ruleData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-rules'] });
    },
  });
}
```

## File Structure

```
controlweave/frontend/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── ai-monitoring/
│   │   │   │   ├── page.tsx                    # Main monitoring dashboard
│   │   │   │   ├── rules/
│   │   │   │   │   ├── page.tsx                # Rules list
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx            # Create rule form
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── edit/
│   │   │   │   │           └── page.tsx        # Edit rule form
│   │   │   │   ├── events/
│   │   │   │   │   └── page.tsx                # Events list
│   │   │   │   ├── baselines/
│   │   │   │   │   └── page.tsx                # Baseline management
│   │   │   │   └── systems/
│   │   │   │       └── page.tsx                # AI systems config
│   │   │   ├── data-sovereignty/
│   │   │   │   ├── page.tsx                    # Sovereignty overview
│   │   │   │   ├── jurisdictions/
│   │   │   │   │   ├── page.tsx                # Jurisdictions list
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx            # Jurisdiction details
│   │   │   │   ├── changes/
│   │   │   │   │   └── page.tsx                # Regulatory changes
│   │   │   │   └── gaps/
│   │   │   │       └── page.tsx                # Gap analysis
│   │   │   └── vendor-risk/
│   │   │       ├── page.tsx                    # Vendor risk overview
│   │   │       ├── assessments/
│   │   │       │   ├── page.tsx                # Assessments list
│   │   │       │   └── new/
│   │   │       │       └── page.tsx            # New assessment form
│   │   │       ├── vendors/
│   │   │       │   └── [id]/
│   │   │       │       └── page.tsx            # Vendor details
│   │   │       ├── supply-chain/
│   │   │       │   └── page.tsx                # Supply chain tracking
│   │   │       └── incidents/
│   │   │           └── page.tsx                # Incident management
│   │   └── settings/
│   │       └── data-sovereignty/
│   │           └── page.tsx                    # Sovereignty settings
│   ├── components/
│   │   ├── ai-monitoring/
│   │   │   ├── MonitoringDashboard.tsx
│   │   │   ├── RuleForm.tsx
│   │   │   ├── EventCard.tsx
│   │   │   ├── EventReviewModal.tsx
│   │   │   ├── BaselineChart.tsx
│   │   │   └── SystemMonitoringToggle.tsx
│   │   ├── data-sovereignty/
│   │   │   ├── JurisdictionMap.tsx
│   │   │   ├── JurisdictionCard.tsx
│   │   │   ├── RegulatoryChangeFeed.tsx
│   │   │   ├── ComplianceGapTable.tsx
│   │   │   └── ResidencyConfigForm.tsx
│   │   ├── vendor-risk/
│   │   │   ├── VendorRiskHeatmap.tsx
│   │   │   ├── VendorAssessmentForm.tsx
│   │   │   ├── RiskScoreGauge.tsx
│   │   │   ├── SupplyChainTree.tsx
│   │   │   ├── IncidentTimeline.tsx
│   │   │   └── PerformanceChart.tsx
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── table.tsx
│   │       ├── modal.tsx
│   │       ├── form.tsx
│   │       └── chart.tsx
│   ├── hooks/
│   │   ├── useMonitoringRules.ts
│   │   ├── useMonitoringEvents.ts
│   │   ├── useJurisdictions.ts
│   │   ├── useRegulatoryChanges.ts
│   │   ├── useVendorAssessments.ts
│   │   └── useSupplyChainComponents.ts
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── utils.ts
│   │   └── validation-schemas.ts
│   └── types/
│       ├── monitoring.ts
│       ├── sovereignty.ts
│       └── vendor-risk.ts
```

## Development Phases

### Phase 4A: AI Monitoring UI (Week 1-2)
- [ ] Set up Next.js project structure
- [ ] Create base layout and navigation
- [ ] Implement monitoring dashboard overview
- [ ] Build rule creation form
- [ ] Build rule list table
- [ ] Implement event list and filtering
- [ ] Create event review modal
- [ ] Build baseline management UI
- [ ] Add system monitoring toggle

### Phase 4B: Data Sovereignty UI (Week 3-4)
- [ ] Implement sovereignty overview dashboard
- [ ] Build jurisdiction list/grid
- [ ] Create jurisdiction details page
- [ ] Implement regulatory changes feed
- [ ] Build gap analysis dashboard
- [ ] Create residency configuration form
- [ ] Add jurisdiction map visualization
- [ ] Implement framework recommendations display

### Phase 4C: Vendor Risk UI (Week 5-6)
- [ ] Build vendor risk overview dashboard
- [ ] Create vendor assessment form
- [ ] Implement vendor details page
- [ ] Build supply chain component tracker
- [ ] Create incident management UI
- [ ] Add performance metrics charts
- [ ] Implement risk heatmap
- [ ] Build vendor comparison view

### Phase 4D: Polish & Testing (Week 7)
- [ ] Responsive design testing (mobile/tablet)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Performance optimization
- [ ] Error handling and loading states
- [ ] E2E testing with Playwright
- [ ] Component unit tests with Jest
- [ ] Documentation updates

## Testing Strategy

### Unit Tests
```typescript
// __tests__/components/RuleForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RuleForm } from '@/components/ai-monitoring/RuleForm';

describe('RuleForm', () => {
  it('validates required fields', async () => {
    render(<RuleForm onSubmit={jest.fn()} />);
    
    const submitButton = screen.getByRole('button', { name: /create rule/i });
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/rule name is required/i)).toBeInTheDocument();
  });
});
```

### E2E Tests
```typescript
// e2e/monitoring.spec.ts
import { test, expect } from '@playwright/test';

test('create monitoring rule', async ({ page }) => {
  await page.goto('/dashboard/ai-monitoring/rules/new');
  
  await page.fill('input[name="rule_name"]', 'Low Confidence Alert');
  await page.selectOption('select[name="rule_type"]', 'threshold');
  await page.fill('input[name="threshold_value"]', '0.7');
  
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL(/\/dashboard\/ai-monitoring\/rules/);
  await expect(page.locator('text=Low Confidence Alert')).toBeVisible();
});
```

## Acceptance Criteria

### AI Monitoring Dashboard
- [ ] Users can view real-time monitoring event stream
- [ ] Users can create/edit/delete monitoring rules
- [ ] Users can review and resolve events
- [ ] Users can calculate and view anomaly baselines
- [ ] Users can enable/disable monitoring per AI system
- [ ] Dashboard refreshes automatically (polling or WebSocket - Phase 5)

### Data Sovereignty Dashboard
- [ ] Users can view all jurisdictions and compliance status
- [ ] Users can add/remove jurisdictions
- [ ] Users can view regulatory changes filtered by jurisdiction
- [ ] Users can perform compliance gap analysis
- [ ] Users can configure data residency settings
- [ ] Users can see recommended frameworks per jurisdiction during onboarding

### Vendor Risk Dashboard
- [ ] Users can create and manage vendor assessments
- [ ] Users can view vendor risk scores and trends
- [ ] Users can track supply chain components
- [ ] Users can log and manage vendor incidents
- [ ] Users can view performance metrics and SLA compliance
- [ ] Users can compare vendors side-by-side

## Performance Targets

- Initial page load: < 2 seconds
- Time to interactive: < 3 seconds
- Dashboard refresh: < 500ms
- Form submission: < 1 second
- Lighthouse score: > 90 (Performance, Accessibility, Best Practices)

## Deployment

### Environment Variables
```env
NEXT_PUBLIC_API_URL=https://api.controlweave.com/api/v1
NEXT_PUBLIC_WS_URL=wss://api.controlweave.com (Phase 5)
```

### Build Commands
```bash
npm run build
npm run start
```

### Railway Deployment
- Auto-deploy on push to main
- Preview deployments for PRs
- Environment variables configured in Railway dashboard

---

**Ready for Development**: Yes
**Dependencies**: Backend APIs from Phases 1-3 must be deployed
**Estimated Timeline**: 7 weeks
**Team Size**: 1-2 frontend developers
