# Documentation Map

Use this file as the starting point for documentation in this repository.

## Where documentation lives

| Location | Purpose | Start here |
|---|---|---|
| [`/README.md`](../README.md) | Repository overview, platform summary, CI/CD checks, and top-level navigation | Main repo landing page |
| [`/docs/`](./) | Repository-level strategy, architecture, framework coverage, licensing, and business/context docs | This directory |
| [`/controlweave/README.md`](../controlweave/README.md) | Product/application overview, setup, and developer-oriented platform reference | Full product README |
| [`/controlweave/docs/`](../controlweave/docs/) | User guides, admin guides, integrations, release notes, deployment docs, and product reference | [`USER_GUIDE.md`](../controlweave/docs/USER_GUIDE.md) |
| [`/controlweave/docs/wiki/`](../controlweave/docs/wiki/) | Source files for the GitHub Wiki mirror and wiki-only templates/navigation | [`README.md`](../controlweave/docs/wiki/README.md) |

## Placement rules

When adding or moving documentation, use these rules:

1. **Product usage or admin workflows** → put it in [`/controlweave/docs/`](../controlweave/docs/)
   - Examples: setup, integrations, feature guides, release notes, self-hosting
2. **Repository/business/architecture context** → put it in [`/docs/`](./)
   - Examples: framework coverage, crosswalk explanations, database architecture, business model
3. **Wiki publishing source** → put it in [`/controlweave/docs/wiki/`](../controlweave/docs/wiki/)
   - Only for content that is intended to sync to the GitHub Wiki
4. **Top-level root markdown files** → reserve for repo-wide summaries or operational artifacts
   - Examples: release summaries, deployment notes, implementation status, audit/security summaries

## Recommended starting points by audience

- **New contributor**: [`../README.md`](../README.md)
- **Product user or admin**: [`../controlweave/docs/USER_GUIDE.md`](../controlweave/docs/USER_GUIDE.md)
- **Developer setting up the product**: [`../controlweave/README.md`](../controlweave/README.md)
- **Wiki maintainer**: [`../controlweave/docs/wiki/README.md`](../controlweave/docs/wiki/README.md)
- **Business / framework / positioning reader**: [`OPEN_SOURCE_BUSINESS_MODEL.md`](./OPEN_SOURCE_BUSINESS_MODEL.md), [`FRAMEWORK_COVERAGE.md`](./FRAMEWORK_COVERAGE.md), [`CROSSWALK_GUIDE.md`](./CROSSWALK_GUIDE.md)

## High-value documentation in this directory

- [`OPEN_SOURCE_BUSINESS_MODEL.md`](./OPEN_SOURCE_BUSINESS_MODEL.md)
- [`FRAMEWORK_COVERAGE.md`](./FRAMEWORK_COVERAGE.md)
- [`CROSSWALK_GUIDE.md`](./CROSSWALK_GUIDE.md)
- [`HOW_CROSSWALKS_WORK.md`](./HOW_CROSSWALKS_WORK.md)
- [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md)
- [`PERPETUAL_LICENSE_GUIDE.md`](./PERPETUAL_LICENSE_GUIDE.md)
