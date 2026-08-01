# 🤖 Conversational AI Guide

How to ask ControlWeave questions in natural language, and where AI actually
lives in the product.

> **There is no in-app chat widget.** Earlier drafts of this guide described a
> purple "Ask AI" button in the bottom-right corner, a `Ctrl+K` shortcut, quick
> action buttons, and saved chat history. None of that shipped. The
> conversational capability is real, but you reach it through the **MCP server**
> or the **`/ai/query` API** — see [Two ways to ask](#two-ways-to-ask). The
> in-app AI is a set of purpose-built features, not a chatbot; those are listed
> under [AI inside the app](#ai-inside-the-app).

---

## Two ways to ask

### 1. MCP server (recommended)

ControlWeave ships a Model Context Protocol server, so you can point Claude
Desktop, Cursor, VS Code + GitHub Copilot, Continue.dev, Windsurf, or any
MCP-compatible client at your live compliance data and just talk to it. This is
the closest thing to the conversational assistant experience, and it is the path
that is actually built and tested.

```bash
cd controlweave/backend
npm run mcp:secure
```

Then ask your assistant things like:

- "What controls are failing in NIST 800-53?"
- "Which SOC 2 criteria have no evidence attached?"
- "Create a POA&M for the AC-2 gap with a 30-day due date."
- "Run a gap analysis and summarize the top five findings."

Full setup, the security model, and the complete tools reference are in the
[MCP Guide](../MCP_GUIDE.md). Read that before exposing the server to anything
beyond localhost.

### 2. The `/ai/query` API

A single-turn, organization-aware question endpoint:

```bash
curl -X POST https://your-host/api/v1/ai/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "Which of my controls have no evidence?"}'
```

It requires the `ai.use` permission and answers from your organization's own
frameworks, controls, and compliance posture. It is **single-turn** — there is
no server-side conversation memory, so include any context you need in the
question itself.

Inside the product this endpoint currently backs one screen: the Financial
Services workspace under CMDB. It is otherwise available to your own
integrations.

---

## AI inside the app

The in-app AI is a set of purpose-built features rather than a chat box. Each
one takes your real data and returns a structured, schema-validated result.

| Where | What it does |
|---|---|
| **Compliance → AI Insights** | Gap analysis, compliance forecast, risk heatmap, audit readiness, crosswalk optimization |
| **Assets & Security → Security Posture** | AI reading of your overall security posture |
| **Vulnerabilities** → open a finding | Per-finding AI remediation plan |
| **Access Governance → Import & AI** | Upload an RBAC / SoD document and get roles, duties, and conflicts extracted |
| **Controls** → open a control | Control analysis, suggested test procedures, suggested evidence |
| **Assessments** | PBC request drafts, workpaper drafts, finding drafts |
| **Governance → AI Laws** | AI regulation tracking (EU AI Act and friends) |
| **Assets & Security → AI Threat Library** | PLOT4ai threat cards |
| **Reports** | Executive report generation, policy generation |

These need the `ai.use` permission (a few need more — for example the Access
Governance import also needs `access_governance.read`).

For the structured, report-quality analyses in particular, see the
[AI Analysis guide](AI_ANALYSIS.md).

---

## Prerequisites

### Configure an LLM provider

Nothing above works until a provider is configured. ControlWeave is
bring-your-own-key.

1. Go to **Settings → LLM Configuration**
2. Choose a provider
3. Enter your API key
4. Test the connection
5. Save

| Provider | Cost | Speed | Best for |
|----------|------|-------|----------|
| **Google Gemini** | Free tier | Fast | Getting started, quick queries |
| **Groq** | Free tier | Very fast | High throughput |
| **Ollama** | Free (self-hosted) | Medium | Privacy, offline use |
| **Anthropic Claude** | Paid | Medium | Deep analysis, policy generation |
| **OpenAI GPT** | Paid | Fast | Versatile, comprehensive answers |
| **xAI Grok** | Paid | Fast | Fast, capable responses |

> **💡 Start with Google Gemini or Groq** — both have a usable free tier.

With no provider configured, AI panels read **"No AI analysis available."**
rather than failing. Everything non-AI in the platform works without a key.

See the [Settings guide](SETTINGS.md) for the configuration screen itself.

### Request limits

ControlWeave imposes no request cap of its own. Any limit you hit comes from
your configured provider's rate limit or quota — with BYOK you are managing that
quota directly.

Each MCP tool call, each `/ai/query` request, and each in-app AI feature run
counts against your provider. Reading a result you already generated does not.

---

## Writing better questions

The same advice applies whether you are asking over MCP or through the API.

**Be specific.** "Which of my NIST 800-53 AC-family controls are not
implemented?" beats "what are my gaps?" — the second one invites a generic
answer because it does not tell the model which slice of your data to look at.

**Reference things by ID.** Control IDs, framework names, and finding keys all
anchor the answer to real records.

**Ask one thing at a time.** Break "assess my readiness and draft the policies
and build a remediation plan" into three questions; you will get better answers
and be able to tell which part is wrong.

**Say what shape you want.** Asking for a table, a numbered list, or a summary
capped at five bullets generally works.

**Follow up.** Over MCP your client keeps the conversation, so you can refine.
Over `/ai/query` you cannot — restate the context each time.

### What to expect, and what not to

AI here **advises**; it does not act on your behalf. It will not change a
control's status, approve evidence, or close a finding. The MCP server can
perform mutations, but only because you explicitly asked your assistant to and
it called a tool to do it — nothing happens implicitly.

Do not use AI output as a final audit decision, and do not treat it as legal
advice. Verify anything that matters against the framework text itself. It is a
strong starting point, not an authority.

---

## Troubleshooting

### "No AI API key configured"

No provider is set up. Go to **Settings → LLM Configuration**, add a key, and
test the connection.

### Provider rate limit or quota reached

The limit is your provider's, not ControlWeave's. Wait for it to reset, switch
providers, or move to self-hosted Ollama, which has no external quota.

### Slow responses

Switch to a faster provider (Groq is the quickest of the hosted options), ask
narrower questions, or split a large request into smaller ones.

### Generic, non-specific answers

Usually one of three things: there is not much data in the system yet, the
question was too broad, or the question did not name the framework or controls
in scope. Be more specific and reference records by ID.

### Answers that are wrong

Verify against the official framework source, use the answer as a starting
point, and report persistent problems through **Report an Issue** in the
dashboard.

---

## Privacy and security

**What the AI sees:** your organization's controls, frameworks, evidence
metadata, assessment results, implementation notes, and asset inventory.

**What it does not see:** other organizations' data (every query is scoped to
your `organization_id`), credentials, or API keys.

**BYOK.** Your data goes to the provider you chose, under that provider's
privacy policy, on your own account. Review that policy — it, not ControlWeave,
governs what happens to prompt content.

**Ollama for maximum privacy.** Self-host the model and nothing leaves your
network: no API costs, no third-party processor. See the
[Ollama Integration Guide](../integrations/OLLAMA.md).

---

## Related

- [MCP Guide](../MCP_GUIDE.md) — the conversational path, in full
- [AI Analysis](AI_ANALYSIS.md) — structured, report-quality analyses
- [AI Usage best practices](../best-practices/AI_USAGE.md)
- [Settings](SETTINGS.md) — LLM configuration
- [Ollama integration](../integrations/OLLAMA.md) — self-hosted models
