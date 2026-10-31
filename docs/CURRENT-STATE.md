# Staff social approval

`staff/social-plan.html` extends the existing staff navigation with one review queue for the weekly plan. The page uses the existing staff login and the products-api `/weekly-plan/review` endpoints.

Jon can inspect the preserved media, caption, link, product and publishing time; save changes; approve the saved version; or reject it. Unsaved edits disable approval. Editing an approved post removes approval. Filters show awaiting review, approved, published or all items. Uncertain deliveries are visibly held and cannot be retried through this page.

Times are displayed in the browser's timezone. Facebook links are first comments, Pinterest links are destinations, and Instagram's reference link is not added to its caption. The API remains authoritative for authentication, revision checks and publishing permission.

Deploy this page and the matching task-154 products-api change through the existing hooks. Before the backend cutover is verified, approval actions and publishing remain held. No page action directly calls a social platform.

The backend implementation and operational recovery instructions live in `craftsbyjon-vps-app/docs/CURRENT-STATE.md`. Source-level sales/funnel measurement remains unchanged.

# Gelato intake

`staff/gelato-intake.html` (nav: Gelato Intake) attaches Jon's real print masters to the existing Gelato products and records which master each variant prints from. It never creates products (use `staff/pod-intake.html` for a new design) and never sends anything to Gelato.

Files are matched to a design and a slot from their names: `Anchor.png` (mug), `Anchor_T-Shirt Dark.png` / `Light.png`, `Anchor_Poster-with-text.png` / `no-text.png`. Older spellings (`Castle`, `STG`) are still recognised. Mugs must be 2410 x 1182 px, t-shirts 3600 x 4800 px, posters square, checked in the browser before upload. Uploads go one at a time to products-api `POST /print-files` and are stored privately, see `craftsbyjon-vps-app/docs/CURRENT-STATE.md`. A file that would replace a stored one is skipped unless the replace box is ticked.

The mapping section saves colour rules for t-shirts (Navy and Rs Sport Grey to Dark, White, Natural and Sand to Light, pre-filled, editable) and a single key for mugs. Posters are deliberately not mappable until the print Text option exists. `STAFF_UPLOAD_LIMIT_MB` in the page only controls the warning shown, it must match the nginx limit on the exact `/n8n-proxy/products-api/print-files` location (200 MB since 28 Sep 2026; the rest of the staff products-api block stays at 20 MB).


# Draft previews and staff product paths (13 Oct 2026)

The public product list (`/n8n-proxy/products-api/products`) no longer contains drafts, and the public `/products` and `/collections` paths are read-only from outside. So:

- `store/shop.js`: a `?preview=<id>` link for a product that is not in the public list reads the staff-protected `/n8n-proxy/products-api/products/` with the browser's staff cookie and opens the draft with a banner saying it cannot be checked out. Without a staff login (log in at `/staff-login` on the same device) it shows a notice instead. A preview link for a live product works as before, with no staff call. Checkout refuses drafts on the server for everyone, staff included.
- Staff pages that read the full list or create products/collections use the trailing-slash staff paths: `listings`, `staff-index`, `new-product`, `pod-intake`, `orders`, `print-images` (`/products/`) and `collections` (`POST /collections/`).
- Test: `node tests/browser/draft-preview.cjs` (20 checks at phone size). Server side and nginx: `craftsbyjon-vps-app/docs/CURRENT-STATE.md` ("Draft products cannot be bought").

# Photo print size and birthday mug popup (13 Oct 2026)

- `store/photo-personaliser.js`: `targetPx` (the spec's `recommend_px`, 1180 for the birthday mug), `maxZoomFor`, `quality`; `initialView` takes the target and caps the zoom so the crop keeps that many genuine photo pixels (photos already smaller cannot be zoomed). `options` sorts by number, then by row id, so Rainbow comes before Champagne.
- `store/shop.js`: slider `max` set from the cap (disabled when there is nothing to zoom), a live print-quality line under the crop (`#photoQuality`: warning below the target, a note at the cap). Photo popup wording without any dispatch or delivery time.
- `staff/orders.html`: genuine-pixel crop size against `PHOTO_PRINT_PX` (1180); no name row for photo-only products.
- Tests: `tests/photo-personaliser.test.cjs` (12), `tests/browser/photo-quality.cjs` (56, phone and desktop), `tests/browser/staff-photo-lines.cjs` (5). Server side: `craftsbyjon-vps-app/docs/CURRENT-STATE.md` ("Photo print size 1180 px").

# Staff orders: Pack view (31 Oct 2026)

- `staff/orders.html`: each order card has a "Pack view" button, and clicking the order ref or the items line opens the same popup. It shows a picture of every item in the order with a large quantity badge (red when more than one), the product id, gift, personalisation, custom and shipping notes, and the address to send to. Escape or clicking outside closes it.
- Pictures come from the product list the page already loads (staff path `/n8n-proxy/products-api/products/`, no new route or backend call, so Rule 23 is not affected). An item is matched to its product by `stripe_price_id`, then by the order's `stock_items` title, then by exact title. The image URL follows the same rule as `store/shop.js` `buildImageUrl` (bare filename becomes `https://images.craftsbyjon.co.uk/products/<name>.jpg`). An item that cannot be matched shows "No image found for this item".
- Not included: the customer's photo and print file for personalised photo lines still show only on the order card, not in the popup.
- Test: `node --test tests/staff-orders-pack-view.test.cjs` (4 checks, using the real CBJ-0037 and CBJ-0036 items and a copy of the live product list in `tests/fixtures/products-list-2026-10-31.json`).
