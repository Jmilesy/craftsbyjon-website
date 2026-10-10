# Storefront redesign: audit and proposal (Stages A and B)

Written 10 Oct 2026. Nothing in this document has been built. It is for Jon to approve, change or reject before any Stage C work starts.

What was checked, and how:

- This repo (`craftsbyjon-website`), every storefront and staff file named below.
- products-api source and `products.db` schema on the VPS (`/home/craftsbyjon/products-api`, repo `craftsbyjon-vps-app`), read only.
- The live public catalogue (`/n8n-proxy/products-api/products` and `/collections`), fetched on the VPS on 10 Oct 2026.
- nginx config for `craftsbyjon.co.uk` and `images.craftsbyjon.co.uk`, the `shop-redirect` service and the deploy hook.
- Handbook: `00-overview.md`, `03-website/frontend.md`, `backend.md`, `analytics.md`, `order-to-delivery.md` (delivery wording only).
- The first-party funnel report (last 30 days) and product sales (last 120 days).

Not checked: the live site in a real phone browser (this cloud container is blocked from craftsbyjon.co.uk), Lighthouse/Core Web Vitals scores, Google Search Console, the CBJ Manage Android app, n8n workflows, orders-api source.

---

## Stage A: audit

### 1. What the stack is

| Layer | What it is |
|---|---|
| Frontend | Plain HTML, CSS and JavaScript. No framework, no build step. `store/index.html` is one 4,500-line, 206 KB file (about 1,450 lines of it inline CSS) plus `print-picker.js`, `tote-picker.js`, `photo-personaliser.js`. |
| Hosting | nginx on the VPS, document root `/var/www/craftsbyjon` (a git checkout of this repo). The deploy hook only deploys pushes to `main`. |
| Catalogue API | products-api (Express + better-sqlite3, `products.db`). Public routes are whitelisted one by one in nginx; everything else under `/n8n-proxy/products-api/` is behind staff basic auth. |
| Orders | orders-api (`orders.db`), fed by Stripe webhook via n8n. |
| Payments | Stripe Checkout Sessions created by `POST /create-checkout-session`. Since 10 Oct every line is re-priced server-side (`line-pricing.js`); the browser's prices are display only. |
| Images | `images.craftsbyjon.co.uk`, served straight from disk with a 1-year cache. No resizing. |
| Product SEO pages | `/products/{id}` is server-rendered by products-api `GET /product-page/:id` (title, meta, canonical, OG, Product JSON-LD, related links). It is a summary page with a "View & buy in the shop" link, not a purchase page. |
| Tracked links | `shop-redirect`: `/src/{source}/{product}` → `/products/{id}?src=…`, `/src/{source}/collection/{name}` → `/store/?collection={name}&src=…`. |

### 2. The catalogue as it is today

96 products in the database: 94 marked Ready to Go.

| Field | What is in it |
|---|---|
| `product_type` | Mug 13, Keyring 13, Tote Bag 8, Bookmark 8, Print 8, T-Shirt 8, Coaster Set 2, **blank 36**. The store guesses Bookmark/Keyring from the ID prefix for the blank ones. |
| `collection_id` | **One collection per product.** Retro Deal 44, Teacher Appreciation 14, Bee 14, Summer Vibes 9, Pride 8, Easter 6. |
| `collections` table | 6 rows: id, name, status (live/available/archived), sort_order, banner_image, banner_image_mobile, valid_months. Only Retro Deal and Summer Vibes are `live`. |
| `application_method` | UV DTF 53, Print on Demand 39, UV DTF + Cut Vinyl 4. **This already tells handmade from POD.** |
| `material` | Acrylic 61, Cotton 16, Ceramic 9, Paper 8, Cork 2. |
| Personalisation | `personalised` = 1 on 10 products; `personalisation_available` = Yes on 6. |
| `design_key` | Set on 32 products (8 Deal designs × mug/print/tee/tote). Drives "Also available as". |
| `search_tags` | Filled in, comma-separated keywords. Not used by the storefront search. |
| `sort_order` | Mostly 0; a few manual values. |
| `theme` | bee 14, easter 6, rest blank. |
| Featured / new / bestseller flags | **None exist.** `generated_at` exists but is a content-generation timestamp, not a "listed on" date. |

None of these collections exist yet: Personalised Gifts, T-Shirts & Clothing, Handmade Gifts, Birthday Gifts, Christmas & Seasonal. Recipient, occasion, interest and budget data do not exist either.

### 3. What the storefront does today (keep all of this)

- **Browse:** collection pills, product-type row, price range slider, sort, text search (title/description, in the browser), mobile drawer with the same controls, collection hero banners, the Christmas gifts view (`?collection=gifts`, 1 Oct to 25 Dec).
- **Product modal:** image gallery and lightbox, mug 4-image set, POD colour/size picker, print Frame/Size/Wording picker, tote Colour/Text picker, acrylic text personalisation with live price, mug name/message/colour, photo upload with crop (personalised photo mugs), "Love this design? Also available as", "You might also like", random testimonial, design-remaining count.
- **Basket:** slide-out panel, 3-for-£10 acrylic bundle and mug tiers shown live, free-shipping progress (£10), promo code box, gift option and message (hidden for all-POD baskets), new-product email opt-in, Stripe redirect. Basket is saved in `localStorage` (via `CBJPhoto.save`), so it already survives moving between pages.
- **Delivery wording in the code** (this is what customers see now): handmade "Ships within 1–2 business days", printed to order "Ships within 3–4 working days", photo products "3–5 working days". Shipping: 2nd Class £1.55, 1st Class £3.30, free 2nd Class over £10, flat "Printed to Order" for all-POD baskets.
- **Trust:** four real testimonials, hand-coded in four places; "Who is Jon?" About modal.
- **SEO:** store `<title>`/meta/OG; crawlable "Browse all products" link list and card title links; per-product pages; sitemap with `lastmod` (manual regeneration).

### 4. Analytics and attribution (must not break)

| Thing | Where | Notes |
|---|---|---|
| Source capture | `?src=` → `sessionStorage.cbj_src`, default `direct` | Used by every event and by checkout promo auto-apply. |
| First-party funnel | `POST /event`: `collection_view`, `product_card_click`, `product_view`, `add_to_basket`, `checkout_started` (with `cart:` path), `related_click`, `design_link_click`, `gifts_strip_click`, `modal_close`, `image_switch` | Feeds `/funnel-report`, `/checkout-diagnostics`, `/feature-events`. No visitor ID by design. |
| GA4 `G-299D45HZTC` | store: consent-gated; events `view_item`, `add_to_cart`, `begin_checkout`, `collection_view` | GA4 only ever sees the page `/store/`. |
| Clarity `xjwf8ndu7r` | consent-gated, `consentv2`, events and tags as per handbook | |
| Pinterest tag | consent-gated, page views only | |
| **Meta pixel** | **Not found anywhere in this repo.** | I don't know whether Meta tracking exists somewhere else (e.g. set up in Meta Commerce, or on a page outside this repo). Needs Jon to confirm. |

### 5. Admin that already exists

- `staff/collections.html`: create, rename, reorder (drag), status live/available/archived, desktop and mobile banner upload, `valid_months`, delete.
- `staff/listings.html`: edit every product field including the single collection dropdown, `design_key`, Ready to Go, sort order.
- `staff/new-product.html`, `pod-intake.html`, `gelato-intake.html`: product creation flows.
- `staff/promo-codes.html`: promo codes, including source-matched auto-apply.
- `staff/stock.html`: design and blank stock.

So collection management and ordering already exist. What's missing is many-to-many assignment, homepage control, featured/new flags and dated promotions.

### 6. Problems found

**Discovery and structure**

1. **One collection per product.** A Deal Castle mug can't be in Retro Deal *and* Mugs *and* Christmas. This is the main thing stopping "shop by interest/occasion".
2. **Collections are mostly seasonal campaign groupings** (Bee, Easter, Pride, Summer Vibes, Teacher). They don't map onto the ranges in the brief, and "available" vs "live" status leaks into the customer UI as faded pills.
3. **The "All" view is one long scroll** of every product grouped by collection. Fine at 94 products, unusable at 500.
4. **36 products have no `product_type`.** The type filter works by guessing from the ID.
5. **Search ignores `search_tags`** and only searches what's already loaded.

**Accuracy and trust**

6. **"Made by hand, by one person (me!) in Deal, not a factory" sits in the store header above every product**, including the 39 print-on-demand ones. The About modal says "Made by me, not a factory". The brief asks for exactly this to be fixed. `application_method` already has the data to do it per product.
7. **The homepage `<h1>` and store `<title>` still say "Bookmarks, Keyrings & Mugs"** and don't mention tees, prints, totes, coasters or personalised photo gifts.
8. **Handbook drift:** `frontend.md` still says mugs are "7-10 day"; the code (and `order-to-delivery.md`) say 3–4 working days. The code is right; the handbook line is stale.

**Performance**

9. **The public `/products` response is 471 KB** because it returns every column, including all the pre-written social copy (fb_teaser, ig_post, etc.), Stripe IDs and posting counters. The store downloads all of it before showing anything ("Loading products…").
10. **Product cards load the full-size original image.** Median product image is 313 KB, 90th percentile 729 KB, with no thumbnails. `loading="lazy"` is set, which helps, but a phone scrolling 40 cards can still pull 10–20 MB.
11. **Each card embeds the whole product JSON in its `onclick` attribute**, twice. Heavy DOM, and it grows with every field added.
12. **206 KB HTML that nginx marks `no-store`**, so it is re-downloaded on every visit.

**Housekeeping**

13. **The SUMMER10 popup** (ended 7 Sep) is still in the page. It doesn't show because of the date check, but it's dead weight and a template for the next promo that needs a code change.
14. **Homepage loads GA4 without asking for cookie consent** (`index.html` line 58). The store asks first. This is out of step with `privacy.html` and `analytics.md`. Not changed here; flagged for a decision because it touches consent.
15. **Testimonials live in four places** that must be kept in step by hand.

### 7. What the numbers say (context, not targets)

Last 30 days, first-party funnel: traffic is mostly Facebook group links, mobile is the biggest known device group, and orders are in single figures. The handbook already says to judge features by whether they're used, not by conversion-rate comparisons, and that still applies. Two things follow for the redesign:

- **"Bestsellers" can't honestly be claimed from the data yet.** Use "Jon's picks" (manual) until there is enough order history to rank.
- **Landing on a filtered collection matters more than the homepage.** Most visitors arrive on `/store/?collection=…` or `/products/{id}` from a tracked link, not on `/`.

---

## Stage B: proposal

### Guiding decisions

1. **No framework rewrite.** Stay on plain HTML/JS + products-api. One person maintains this, the deploy hook and staff pages are all plain HTML, and a framework migration would add risk to checkout for little customer benefit.
2. **Don't rewrite the basket, pickers or checkout.** Lift them out of `store/index.html` into their own files *unchanged* and reuse them. That's the code that talks to Stripe and Gelato; it should move, not change.
3. **Keep every existing URL working**: `/store/`, `/store/#id`, `/store/?collection=Name`, `/store/?collection=gifts`, `/store/?preview=`, `/products/{id}`, every `/src/...` link already posted on Facebook.
4. **Never use `/shop/`** for new pages. It belongs to `shop-redirect` and is blocked in robots.txt.
5. **Additive analytics only.** Same event names, same GA4 mapping, same consent gate. New events only where needed (listed below).

### B1. Information architecture

Two ways in, as the brief asks, on top of **one product list** (no duplicate rows):

```
Shop
├── By product          (automatic, from product_type)
│   Mugs · T-shirts · Prints · Tote bags · Coasters · Bookmarks · Keyrings
└── By theme / occasion (collections Jon assigns, many per product)
    Personalised gifts* · Handmade gifts* · Retro Deal · Christmas ·
    Birthdays · Teachers · Book lovers · Bees · Pride · …
                                           (* automatic, see below)
```

**Collection kinds** (new column on `collections`):

| Kind | How products get in | Examples |
|---|---|---|
| `manual` | Jon ticks products in admin (many per product) | Retro Deal, Christmas, Birthdays, Teachers, Bees |
| `auto` | A fixed rule, no tagging needed | Personalised (personalised = 1 or photo product), Handmade (not POD), New in (listed in last N days), Under £10 |

**Product type pages** are not collections; they come straight from `product_type` once the 36 blanks are filled in.

**Hidden when empty:** a collection with zero live products never appears anywhere (homepage, nav, filters, sitemap). Right now that means Birthday and Christmas would stay hidden until products are assigned. I'd rather say that up front than show empty tiles.

**Seasonal:** keep `valid_months`, add optional `starts_on` / `ends_on` dates so Christmas can switch itself on and off. The existing Christmas gifts view keeps working as it does.

### B2. Navigation

**Mobile (most visitors):**

```
┌───────────────────────────────┐
│ ☰   Crafts by Jon     🔍  🛒2 │  sticky, 56px
├───────────────────────────────┤
│ Free UK post over £10 · 3 for £10 bookmarks & keyrings │ one line
└───────────────────────────────┘

☰ opens a full-height sheet:
  Search box
  Shop by product   ▸ Mugs, T-shirts, Prints, Totes, Coasters, Bookmarks, Keyrings
  Shop by theme     ▸ Personalised, Retro Deal, Christmas, Handmade, …
  Gift finder
  New in
  About Jon · Custom orders · Delivery
```

**Desktop:** same header with two dropdowns ("Shop by product", "Shop by theme"), search box inline, basket on the right.

Search opens a full-screen overlay on mobile with instant results (thumbnail, title, price) and collection matches above product matches.

### B3. Homepage (`/`)

Replaces the current brand page at `/` and becomes the shop front. Sections, top to bottom:

```
MOBILE                                   DESKTOP (≥ 960px)
┌─────────────────────────┐              ┌──────────────────────────────────────────┐
│ HERO                    │              │ HERO: text left, product collage right    │
│ "Original gifts,        │              │                                          │
│  designed in Deal."     │              │                                          │
│ Handmade acrylic, plus  │              │                                          │
│ mugs, tees & prints     │              │                                          │
│ printed to order.       │              │                                          │
│ [Shop gifts] [Personalise]             │                                          │
│ real product photo      │              │                                          │
├─────────────────────────┤              ├──────────────────────────────────────────┤
│ SHOP BY COLLECTION      │              │ 6 tiles in a 3×2 grid                    │
│ 2-column tiles, photo + │              │                                          │
│ name + item count       │              │                                          │
├─────────────────────────┤              ├──────────────────────────────────────────┤
│ JON'S PICKS / NEW IN    │              │ two rows of 4 cards                      │
│ sideways-scroll rows    │              │                                          │
├─────────────────────────┤              ├──────────────────────────────────────────┤
│ GIFT FINDER             │              │ For whom · Occasion · Interest · Budget  │
│ chips: Under £5, Under  │              │                                          │
│ £15, For teachers, For  │              │                                          │
│ book lovers, Birthdays… │              │                                          │
├─────────────────────────┤              ├──────────────────────────────────────────┤
│ SEASONAL STRIP          │ (only when a seasonal collection is in date)            │
├─────────────────────────┤              ├──────────────────────────────────────────┤
│ HANDMADE vs PRINTED     │              │ two panels side by side                  │
│ "What's made where"     │              │                                          │
├─────────────────────────┤              ├──────────────────────────────────────────┤
│ ABOUT JON (photo, short │              │                                          │
│ chaos story, Deal)      │              │                                          │
├─────────────────────────┤              ├──────────────────────────────────────────┤
│ REVIEWS (the 4 real)    │              │                                          │
│ DELIVERY (real rates)   │              │                                          │
└─────────────────────────┘              └──────────────────────────────────────────┘
```

Notes:

- **Hero copy has to be accurate:** designed by Jon in Deal; acrylic made by hand by Jon; mugs, tees, prints, totes printed to order by a print partner. Exact wording to be agreed with Jon and checked against the banned-words list in the handbook.
- **Collection tiles come from admin** (show on homepage + homepage order). Initially there are probably only 3 tiles with real products behind them: Retro Deal, Personalised (auto), Handmade (auto). T-shirts appears via product type. Birthday and Christmas appear once products are assigned.
- **Gift finder chips only show when they'd return products.** Budget chips work from day one (price exists). Recipient/occasion/interest chips need collections assigned first.
- **"Jon's picks"**, not "Bestsellers", until there is enough order data (see Stage A, section 7).
- **Delivery block uses the real numbers** already in the code: £1.55 2nd Class, £3.30 1st Class, free over £10; handmade ships in 1–2 business days, printed in 3–4 working days. Pulled from one shared source, not typed again.
- The existing "What I Make" homepage feed (`/collections/homepage`) is replaced by the tiles.

### B4. Collection and product-type pages

New URL pattern: **`/collections/{slug}`** and **`/collections/{type}`** (e.g. `/collections/retro-deal`, `/collections/mugs`). Server-rendered by products-api the same way `/products/{id}` is today: real `<title>`, meta, canonical, intro text, and the first page of products as real links. Then the same browsing script takes over.

Layout:

```
┌────────────────────────────────┐
│ Banner (existing banner_image) │
│ Retro Deal                     │
│ 2–3 lines of intro from admin  │
│ [Mugs 4] [Prints 8] [Keyrings…]│ quick chips by type within the collection
├────────────────────────────────┤
│ 24 cards, 2 columns on mobile  │
│ [Show more]                    │
├────────────────────────────────┤
│ Sort ▾   Filter (n) ▸          │ secondary, opens a bottom sheet on mobile
└────────────────────────────────┘
```

**`/store/` stays.** It becomes "All products" with the same filters, and keeps honouring `?collection=`, `#product-id`, `?preview=` and `?src=`. `?collection=Retro%20Deal` from old Facebook posts keeps working. I would not redirect `/store/?collection=x` to `/collections/x` at first, so that the funnel's `collection_view` counts stay comparable.

**Filters** (secondary): product type, theme, price, handmade/printed, personalisable. **Sort:** Jon's order (default), newest, price low–high, price high–low.

**Empty states:** "Nothing matches that yet." with a reset button and three Jon's picks, never a blank page.

### B5. Product discovery and performance

| Need | Proposal | Why this and not something bigger |
|---|---|---|
| Lighter catalogue | New public `GET /storefront/catalogue`: only the fields the shop needs (id, title, short desc, price, type, collections, image, flags, design_key, sort keys). Expected well under 100 KB for today's catalogue. `GET /products` stays exactly as it is for staff, n8n and social tools. | Removes most of the 471 KB first load. Doesn't touch anything else that reads `/products`. |
| Full product data | Fetched per product when a product is opened (variants already work this way). | |
| Search | In the browser, over the lean catalogue, matching title, type, collection names and `search_tags`, with simple typo tolerance. | Fine up to a couple of thousand products. If the catalogue passes that, move to SQLite FTS5 in products-api (built into better-sqlite3, no new service). |
| Pagination | Render 24 cards, "Show more" button (plus automatic loading as you scroll near the end). | Keeps the DOM small; "Show more" is kinder on phones than endless scroll and keeps the footer reachable. |
| Images | Generate 400 px and 800 px WebP thumbnails per product image, served with `srcset`. Cards use the thumbnail; product page uses 800 px plus the original for zoom. | Biggest speed win. Method to be confirmed in Stage C: nginx appears to have the image-filter module compiled in (not confirmed loaded), and ImageMagick is not installed on the VPS. A Node script using `sharp` at upload time plus a one-off backfill is the likely route. Needs approval before adding the package. |
| Cards | Stop embedding product JSON in `onclick`; cards carry only the product id. | |
| Related products | Keep "Also available as" (design_key) and "You might also like"; make "You might also like" pick from shared collections first, then same type. | Already built; just better input. |
| New in | Needs a real "listed on" date. Add `listed_at` (backfilled from the date the product was first Ready to Go if that can be found, otherwise left blank and not shown). | No fake dates. |

### B6. Product pages

**Recommendation: make `/products/{id}` the real product page** (buy from it directly), and keep the grid modal as a fast "quick view" that links to it.

Today `/products/{id}` is a summary that sends people to `/store/#id`, and tracked Facebook links land there. That's an extra hop on the most common entry route.

Layout (mobile):

```
┌───────────────────────────────┐
│ Breadcrumb: Retro Deal › Mugs │
│ Image gallery (swipe, dots)   │
│ Title                         │
│ £11.99   ● Printed to order   │  or ● Handmade by Jon in Deal
│ Option pickers (existing)     │
│ Personalisation (existing)    │
│ [ Add to basket – £11.99 ]    │  sticky bar at the bottom on scroll
│ Ships in 3–4 working days ·   │  from the same rules the basket uses
│ free UK post over £10         │
│ ▸ Description                 │
│ ▸ Details (material, size)    │
│ ▸ Delivery & returns          │
│ Also available as…            │
│ You might also like…          │
└───────────────────────────────┘
```

- **Same code paths for buying.** The picker scripts and `addToCart` move into shared files and are loaded by both pages. The basket already lives in `localStorage`, so it carries between pages.
- **Existing titles, descriptions, bullets, images and IDs are kept.** No copy is rewritten without Jon's say-so.
- **Handmade/printed badge per product** from `application_method`. Wording options to agree:
  - Handmade: "Handmade by Jon in Deal"
  - POD: "Designed by Jon · printed to order by our print partner"
- **SEO stays at least as good:** title, meta, canonical, OG, JSON-LD and related links stay server-rendered exactly as now.
- **Analytics:** product page fires `product_view` with the same name as the modal, so the funnel stays comparable. GA4 will start seeing real product page paths, which is a reporting change (see risks).

### B7. Visual direction

- **Personality:** Jon's voice and the "chaos" humour, but less clutter. Fewer banners, emojis and pills; more space; product photos do the work.
- **Type:** one characterful display face for headings and a clean sans for body, both free (Google Fonts, self-hosted). Two candidates to show in mockups, not decided.
- **Colour:** a small set of brand colours from what's already used, checked for WCAG AA contrast.
- **Photography:** square crops on cards (as now) with a consistent background for thumbnails; collection tiles use the existing banners where they exist and a product photo where they don't. Genuine CBJ imagery only; no stock photos.
- **Motion:** none beyond small hover and sheet transitions; respects `prefers-reduced-motion`.

I can make clickable mobile and desktop mockups (homepage, collection page, product page) as the next step, using real product photos, before any code goes near the live store.

### B8. Admin changes

Built into the staff pages Jon already uses. No new CMS.

| Change | Where | Backend |
|---|---|---|
| Collection kind (manual/auto), slug, intro text, SEO title/description, show on homepage, homepage order, start/end dates | `staff/collections.html` (extend) | New columns on `collections` |
| Products in many collections | `staff/listings.html`: tick-list of collections replaces the single dropdown; first ticked = "main" collection | New `product_collections` table; `collection_id` kept as the main collection |
| Bulk assign | Collections page: "Add products" picker with search and type filter | Same table |
| Featured ("Jon's picks"), order of picks | Listings: a star toggle; Collections page: drag to order | `featured_rank` column |
| Hide from shop | Already exists: Ready to Go | None |
| Homepage hero text, button links, seasonal strip | New small `staff/storefront.html` | `storefront_settings` key/value table |
| Dated promo banner/popup (replaces hard-coded SUMMER10) | `staff/storefront.html` | Same table; dates enforced server-side |
| Testimonials in one place | `staff/storefront.html` | Same table; all four places read from it |
| Fill in the 36 missing product types | One-off backfill script, checked by Jon before it's applied | Data only |

**Why keep `collection_id`:** the related-products block on `/products/{id}`, the Facebook groups rotation, Spark/social tools and staff links all read it today. Keeping it as the "main collection" means none of them change.

### B9. Development complexity

Rough sizes (one developer, working sessions, not calendar days):

| Piece | Size | Repo |
|---|---|---|
| Lean catalogue endpoint + nginx public route | S | vps-app + nginx |
| Collections schema, `product_collections`, backfill, admin UI | M | vps-app + website |
| Storefront settings table + staff page | M | vps-app + website |
| Image thumbnails (script + backfill + srcset) | M | vps-app |
| Split `store/index.html` into shared CSS/JS files with no behaviour change | M (risky, needs careful testing) | website |
| New header/nav/search | M | website |
| Homepage | M | website |
| Collection pages (server-rendered + client browse) | M–L | both |
| Full product page | L (most risk) | both |
| Sitemap generator: add collection pages | S | vps-app scripts |
| Testing pass, every product type through to Stripe test checkout | M | both |

### B10. Risks and dependencies

| Risk | How it's handled |
|---|---|
| Breaking checkout (wrong line items, lost personalisation, POD variant not passed) | Basket and checkout code moved, not rewritten. Before release, every product type (bookmark, keyring, personalised acrylic, mug, photo mug, POD tee, print, tote, coaster) goes through to a Stripe test checkout, and the `create-checkout-session` request body is compared with the current store's for the same basket. |
| Breaking Facebook links already posted | All existing URL forms stay working; a scripted check runs every URL pattern from `shop-redirect` before and after. |
| Analytics comparability | Same event names and GA4 mapping. **GA4 will start seeing real page paths** (`/`, `/collections/x`, `/products/x`) instead of only `/store/`. That changes page reports, not events. Funnel log unaffected. |
| Consent | Every new page uses the same consent loader as the store. The homepage's unconsented GA4 (Stage A, item 14) needs Jon's decision. |
| Meta tracking | Not found. Need to know if it exists before claiming it's preserved. |
| SEO | Product page URLs unchanged. New collection pages added to the sitemap. Titles/meta kept or improved, never removed. |
| products-api is shared with social tools, rotation, Spark | `GET /products` and `collection_id` untouched. New things are new endpoints/columns. |
| Thin content for new collections | Birthday/Christmas/recipient tiles stay hidden until products are assigned. This is a merchandising task for Jon, not code. |
| One huge file | Splitting `store/index.html` first, with no behaviour change, reduces risk for everything after. |
| New npm package (`sharp`) for thumbnails | Free, no service. Needs Jon's OK as a new dependency. |

### B11. Recommended order

Each step is shippable on its own, goes through the usual branch → review → merge → deploy hook, and can be rolled back by reverting its merge.

1. **Groundwork, no visible change.** Lean catalogue endpoint; image thumbnails; fill missing product types; split `store/index.html` into files with no behaviour change. Measure page weight before/after.
2. **Collections data + admin.** `product_collections`, collection kinds, homepage/featured fields, `storefront.html`. Jon assigns products while the old store keeps running.
3. **Preview storefront at `/store-next/`** (noindex, robots-blocked like `/store-test/`): new header, nav, search, collection pages, card grid with paging. Jon tests on his phone.
4. **Homepage** on the preview path, then live.
5. **Product page** upgrade of `/products/{id}`, with the full checkout test matrix.
6. **Switch `/store/` to the new browse experience.** Old file kept as `store/index-legacy.html` for instant rollback (one nginx line or one git revert).
7. **Tidy-up:** remove the SUMMER10 code, fix the handbook's stale mug lead time, update `frontend.md`, `analytics.md` and the sitemap generator.

### Decisions needed from Jon before Stage C

1. Approve the overall direction (plain JS, many-to-many collections, `/collections/{slug}` pages, `/products/{id}` as the real product page).
2. Is there a Meta pixel anywhere? If yes, where?
3. Handmade/printed wording on badges and the hero.
4. Homepage GA4 loading without consent: fix as part of this, or leave alone?
5. OK to add `sharp` (free npm package) for thumbnails?
6. Which collections to create first, and whether Jon will assign products to them (Birthday and Christmas will stay hidden until he does).
7. Mockups first (recommended), or straight to step 1 groundwork?
