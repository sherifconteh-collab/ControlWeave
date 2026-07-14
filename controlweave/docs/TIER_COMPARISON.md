# Tier Comparison Guide

**ControlWeaver is fully open source.** As of v4.0, all tier gating was removed — every feature listed in this product is available to every authenticated user, with no subscription, upgrade prompt, or paid plan required. `requireTier()`/`requireProEdition()` middleware in the backend are no-ops that always allow the request through; see `.claude/rules/tier-system.md` for the implementation details.

The `organizations.tier` database column still exists for backward compatibility (all organizations were set to `enterprise`/`comped` in migration 106), but it is informational only — nothing in the application enforces it.

## License

ControlWeaver is dual-licensed:
- **AGPL v3** — free, open source. Self-host it, modify it, and if you run a modified version as a network service you must publish your modifications under the same license.
- **Commercial license** — for organizations that need different terms (e.g. proprietary modifications without AGPL's network-copyleft requirement).

See [LICENSE](../../LICENSE) for the full text, or contact contehconsulting@gmail.com for commercial licensing questions.

## If you're looking for a feature-by-feature breakdown

See the per-feature guides in `docs/guides/` — each one describes what the feature does and how to use it, without any tier qualifier, since none applies. `docs/USER_GUIDE.md` is the top-level index.
