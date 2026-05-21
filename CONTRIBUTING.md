# Contributing to ControlWeave

Thank you for your interest in contributing to ControlWeave!

## Getting Started

1. Fork the repository
2. Create a feature branch following our naming convention: `feat/CW-<number>/<short-description>`
3. Make your changes
4. Run `npm run check:syntax` (backend) and `npm run typecheck` (frontend)
5. Submit a pull request

## Branch Naming Convention

All branches must follow: `<type>/CW-<number>/<short-description>`

See `README.md` for the full branch naming table.

## Commit Messages

Format: `<type>(<scope>): <description>`

Examples:
- `feat(rmf): add RMF lifecycle dashboard`
- `fix(billing): resolve Stripe redirect after registration`

## Diagrams

Use [Mermaid](https://github.com/mermaid-js/mermaid) for diagrams in documentation. Mermaid renders natively on GitHub — no plugins needed. See `controlweave/docs/DOCUMENTATION_SYSTEM.md` for syntax, examples, and guidelines.

## Licensing

ControlWeave is dual-licensed under **AGPL v3** (open source) and a **Commercial License** (enterprise).

- Contributions to the open-source codebase are accepted under the AGPL v3 terms.
- For commercial licensing inquiries, contact contehconsulting@gmail.com.
