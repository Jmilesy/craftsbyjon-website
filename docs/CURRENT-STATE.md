# Staff social approval

`staff/social-plan.html` extends the existing staff navigation with one review queue for the weekly plan. The page uses the existing staff login and the products-api `/weekly-plan/review` endpoints.

Jon can inspect the preserved media, caption, link, product and publishing time; save changes; approve the saved version; or reject it. Unsaved edits disable approval. Editing an approved post removes approval. Filters show awaiting review, approved, published or all items. Uncertain deliveries are visibly held and cannot be retried through this page.

Times are displayed in the browser's timezone. Facebook links are first comments, Pinterest links are destinations, and Instagram's reference link is not added to its caption. The API remains authoritative for authentication, revision checks and publishing permission.

Deploy this page and the matching task-154 products-api change through the existing hooks. Before the backend cutover is verified, approval actions and publishing remain held. No page action directly calls a social platform.

The backend implementation and operational recovery instructions live in `craftsbyjon-vps-app/docs/CURRENT-STATE.md`. Source-level sales/funnel measurement remains unchanged.
