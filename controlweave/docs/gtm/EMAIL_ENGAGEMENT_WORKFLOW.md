# Email Engagement Workflow for Sales (ControlWeave)

## Purpose
Provide a repeatable workflow to respond to inbound interest, deliver demo access, and move prospects toward a purchase decision.

## SLA Targets
- First response: within 30 minutes during business hours
- Demo account delivery: same day
- Follow-up cadence: 24h, 72h, 7d

## 1) Initial Reply (Qualification)
Use a short response that confirms their context and asks 2 questions:
- Which frameworks are highest priority?
- Current bottleneck (evidence, crosswalks, reporting, audit prep)?

## 2) Demo Account Delivery
Send the tier-matched credentials and 3 tasks to complete in first session:
- Review framework coverage relevant to their use case
- Validate control/evidence workflow with one internal owner
- Check vulnerability/risk workflow relevance to current process

Use backend template function: `sendDemoAccountDeliveryEmail(...)`.

## 3) Follow-Up Email (Value Reinforcement)
At +24h, send one insight + one CTA:
- Insight example: "Teams like yours usually reduce manual evidence-chasing by centralizing ownership + audit logs."
- CTA example: "Want a 20-minute guided walkthrough using your framework mix?"

Use backend template function: `sendSalesFollowUpEmail(...)`.

## 4) Objection Handling Snippets
- **Price:** "We can start with the tier that matches your current maturity and expand only when usage justifies it."
- **Implementation effort:** "We can scope a focused pilot around one framework family first."
- **Internal buy-in:** "We can run a stakeholder walkthrough with compliance + engineering together."

## 5) Conversion Trigger Criteria
Move to commercial proposal when prospect confirms at least two:
- Clear pain point ownership
- Demo usage by intended users
- Agreement on target framework scope
- Timeline for rollout/pilot

## Suggested Email Sequence
- **Email 1:** qualification + context request
- **Email 2:** demo credentials + first-session checklist
- **Email 3:** follow-up with one measurable outcome
- **Email 4:** pilot/proposal CTA

## Internal Notes to Capture Per Thread
- Target tier and rationale
- Decision-maker(s) and influencer(s)
- Blocking objections
- Next meeting date
- Expected close window
