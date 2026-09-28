# Staff social approval

`staff/social-plan.html` extends the existing staff navigation with one review queue for the weekly plan. The page uses the existing staff login and the products-api `/weekly-plan/review` endpoints.

Jon can inspect the preserved media, caption, link, product and publishing time; save changes; approve the saved version; or reject it. Unsaved edits disable approval. Editing an approved post removes approval. Filters show awaiting review, approved, published or all items. Uncertain deliveries are visibly held and cannot be retried through this page.

Times are displayed in the browser's timezone. Facebook links are first comments, Pinterest links are destinations, and Instagram's reference link is not added to its caption. The API remains authoritative for authentication, revision checks and publishing permission.

Deploy this page and the matching task-154 products-api change through the existing hooks. Before the backend cutover is verified, approval actions and publishing remain held. No page action directly calls a social platform.

The backend implementation and operational recovery instructions live in `craftsbyjon-vps-app/docs/CURRENT-STATE.md`. Source-level sales/funnel measurement remains unchanged.

# Gelato intake

`staff/gelato-intake.html` (nav: Gelato Intake) attaches Jon's real print masters to the existing Gelato products and records which master each variant prints from. It never creates products (use `staff/pod-intake.html` for a new design) and never sends anything to Gelato.

Files are matched to a design and a slot from their names: `Anchor.png` (mug), `Anchor_T-Shirt Dark.png` / `Light.png`, `Anchor_Poster-with-text.png` / `no-text.png`. Older spellings (`Castle`, `STG`) are still recognised. Mugs must be 2410 x 1182 px, t-shirts 3600 x 4800 px, posters square, checked in the browser before upload. Uploads go one at a time to products-api `POST /print-files` and are stored privately, see `craftsbyjon-vps-app/docs/CURRENT-STATE.md`. A file that would replace a stored one is skipped unless the replace box is ticked.

The mapping section saves colour rules for t-shirts (Navy and Rs Sport Grey to Dark, White, Natural and Sand to Light, pre-filled, editable) and a single key for mugs. Posters are deliberately not mappable until the print Text option exists. `STAFF_UPLOAD_LIMIT_MB` in the page only controls the warning shown, it must match the nginx limit on the staff products-api location (20 MB at the time of writing).

