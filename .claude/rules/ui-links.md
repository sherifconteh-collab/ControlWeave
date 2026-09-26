# UI links and navigation

Every link that opens a specific record or action is built in
`controlweave/frontend/src/lib/deepLinks.ts` (`recordLinks`, `createLinks`,
`workItemAction`, `searchResultHref`). Do not hand-write `/dashboard/...`
strings for records elsewhere; add a builder there and use it.

## The contract (enforced in CI by TEVV-UI-59)

`npm run check:links` (in `controlweave/frontend`, script `scripts/check-ui-links.js`)
fails the build when an in-app link:

- points at a path with no page under `src/app`, or
- passes a query parameter (`?action=`, `?tab=`, `?new=`, `?open=`, ...) that the
  target page never reads with `searchParams.get('<name>')`, or a static value
  (`?action=upload-evidence`) the page never mentions.

So when a page gains a deep link, it must handle it: read the parameter, then
open the panel, select the tab, focus the field or highlight the row the link
names. Use `focusTarget(id)` from `lib/focusTarget.ts` for focus, because
client-side navigation moves focus after mount. Static pages that call
`useSearchParams()` need a `<Suspense>` wrapper around the component that reads it.

## Navigation map

- Sidebar, mobile menu and the Ctrl+K palette's page list all read
  `src/lib/navigation.ts`. Add pages there, with `keywords` for search.
- Settings sections, their URLs (`/dashboard/settings/<slug>`) and search
  keywords live in `src/lib/settingsSections.ts`.
- "+ New" entries live in `src/components/shell/createActions.ts`; each target
  page opens its create form on `?new=1`.
- Home (`/dashboard`) is My Work, fed by `GET /api/v1/my-work`. A new kind of
  assigned work needs a source in `backend/src/routes/myWork.js` (gated by the
  module's own read permission, filtered by `organization_id`) and a case in
  `workItemAction`.
- When merging or moving a page, keep the old path as a `redirect()` page so
  bookmarks and links in email still land in the right place.

## Click-through check

`tests/e2e/link-destinations.spec.ts` follows every My Work item, search
result, "+ New" entry, merged-page redirect and sidebar link against a live
stack and asserts the destination. It is opt-in (`E2E_LIVE=1`, see the file
header) because it needs seeded data.
