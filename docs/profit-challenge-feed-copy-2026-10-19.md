# £100 Profit Challenge: proposed copy for products.db (19 Oct 2026, revised)

**Status: proposal only, nothing published.** Jon decided on 19 Oct that products.db is the source of truth, so approved changes update the product page and the Google feed together. Prices are not touched.

How the changes work:
- **Titles** are replaced in full.
- **Descriptions** (`full_description`) keep the existing text and add one factual opening paragraph. Google gives the first ~160 characters the most weight.
- **Short descriptions and bullets** stay as they are, except where the current text is wrong (mug-002).
- Every fact used is confirmed in the handbook or products.db: sizes, materials, colour count, set contents, and "postage included" for print on demand.

---

## 1. coaster-001, Coaster Set A (~£4.40 per sale, best seller)

**Title**
- Before: Deal Landmarks Coaster Set A, Cork-Backed, Set of 4
- After: Deal Kent Coaster Set of 4, Cork-Backed 96mm, Castle, Pier, Timeball Tower & St George's

**Description: new opening paragraph**
> Set of four 96 x 96 mm cork-backed coasters, each with a different Deal landmark: Deal Castle, Deal Pier, the Timeball Tower and St George's Church.

The existing text follows unchanged ("Four Deal landmarks, one coaster each…").

## 2. coaster-002, Coaster Set B (~£4.40)

**Title**
- Before: Deal Landmarks Coaster Set B, Cork-Backed, Set of 4
- After: Deal Kent Coaster Set of 4, Cork-Backed 96mm, Anchor, Middle Street, Regent & Seafront

**Description: new opening paragraph**
> Set of four 96 x 96 mm cork-backed coasters, each with a different Deal landmark: the Anchor, Middle Street, the Regent cinema and the seafront.

The existing text follows unchanged ("Four coasters, four corners of Deal…").

## 3. mug-birthday-photo (£5.82)

**Title**
- Before: Personalised Birthday Photo Mug, 16th, 18th, 21st or 40th
- After: Personalised Birthday Photo Mug, 11oz Ceramic, 16th, 18th, 21st or 40th Gift

**Description:** no change. It already states 11oz white ceramic and explains the photo process.

## 4. totebag003, Pier tote (~£5.50)

**Title**
- Before: Pier Tote Bag
- After: Deal Pier Tote Bag, Cotton, Retro Kent Art Design, 5 Colours

**Description: new opening paragraph**
> Cotton tote bag in five colours, with or without DEAL • KENT text, printed with my Deal Pier design. Printed to order, postage included.

The existing text follows unchanged ("A pier stretching out over the water…").

## 5. totebag002, Deal Castle tote (~£5.50; Google is currently rejecting its image)

**Title**
- Before: Deal Castle Tote Bag
- After: Deal Castle Tote Bag, Cotton, Retro Kent Art Design, 5 Colours

**Description: new opening paragraph**
> Cotton tote bag in five colours, with or without DEAL • KENT text, printed with my Deal Castle design. Printed to order, postage included.

The existing text follows unchanged ("Deal Castle is one of the most recognisable…").

Following the tote design rules, no tote copy uses the word "souvenir".

## 6. pod-print-pier (£4.93 to £7.69)

**Title**
- Before: Pier Art Print by Crafts by Jon
- After: Deal Pier Art Print, Square Retro Kent Poster, 25cm to 70cm, Framed or Unframed

**Description: new opening paragraph**
> Square art print of Deal Pier on 170gsm silk-finish paper, in seven sizes from 25 x 25 cm to 70 x 70 cm, unframed or framed. Printed to order, postage included.

**Voice fix in the existing text**
- Before: "Jon designed this one, and it's printed to order…"
- After: "I designed this one, and it's printed to order…"

## 7. pod-print-deal-castle (£4.93 to £7.69)

**Title**
- Before: Deal Castle Art Print
- After: Deal Castle Art Print, Square Retro Kent Poster, 25cm to 70cm, Framed or Unframed

**Description: new opening paragraph**
> Square art print of Deal Castle on 170gsm silk-finish paper, in seven sizes from 25 x 25 cm to 70 x 70 cm, unframed or framed. Printed to order, postage included.

**Voice fix in the existing text**
- Before: "Jon designed this one himself, working from the castle as it actually looks."
- After: "I designed this one myself, working from the castle as it actually looks."

## 8. mug-005, Deal Castle mug (£3.24 single, ~£7.50 for any 2)

**Title**
- Before: Retro Deal Castle Mug, Historic Deal Souvenir
- After: Deal Castle Mug, 11oz Ceramic, Retro Kent Travel Poster Design

**Description: new opening paragraph**
> 11oz white ceramic mug, printed to order, postage included.

The existing text follows unchanged ("Deal Castle has been sitting on the Kent coast…").

## 9. mug-007, Old Deal mug (£3.24)

**Title**
- Before: Old Deal Retro Mug, Historic Town Design
- After: Old Deal Mug, 11oz Ceramic, Middle Street Retro Design with Cobbett Quote

**Description: new opening paragraph**
> 11oz white ceramic mug, printed to order, postage included.

The existing text follows unchanged ("Deal in its retro glory…").

## 10. keyring-014, Deal Castle keyring (~£2.60 to £2.85)

**Title**
- Before: Deal Castle Acrylic Keyring, 1940s Railway Poster Design
- After: Deal Castle Keyring, Clear Acrylic, 1940s Railway Poster Design, Kent Gift

**Description:** no change. It already says clear acrylic and describes the design.

---

## Teacher mugs: mug-001 vs mug-002 (factual fix, not in the top 10)

The two mugs have the same title. Their text describes them the same way, but the artwork is different. I checked the wrap files (`mug-001-asset-4teacher.png` and `mug-002-asset-5teacher.png`):

| | mug-001 | mug-002 |
|---|---|---|
| Motifs | Stacked books, magnifying glasses, pencil pots, apples, small flowers and triangles | Open books, notebooks, globes, science flasks, pencils, rulers and stars |
| Colours | Teal, coral and mustard | Dark red, mustard and teal |
| Current copy matches the picture? | Yes | **No.** Its title, short description and first bullet list mug-001's motifs and colours |

Both mugs are confirmed 11oz ceramic (Jon, 19 Oct). Their text already says so and no longer mentions acrylic.

### mug-001

**Title**
- Before: Personalised KS2 Teacher Mug, Teal, Coral and Gold Design
- After: Personalised KS2 Teacher Mug, 11oz Ceramic, Books, Apples & Magnifying Glass Design

**Description:** no change. It matches the picture.

### mug-002

**Title**
- Before: Personalised KS2 Teacher Mug, Teal, Coral and Gold Design
- After: Personalised KS2 Teacher Mug, 11oz Ceramic, Globes, Science & Open Books Design

**Short description**
- Before: "A full-wrap 11oz ceramic mug in teal, coral and gold, decorated with books, magnifying glasses, apples and pencil cases. Personalised with your teacher's name and a message of your choice. A proper end-of-year gift that actually reflects what they do."
- After: "A full-wrap 11oz ceramic mug in dark red, mustard and teal, decorated with open books, notebooks, globes, science flasks and pencils. Personalised with your teacher's name and a message of your choice. A proper end-of-year gift that actually reflects what they do."

**Bullet 1**
- Before: "Full-wrap teal, coral and gold design with books, apples, magnifying glasses and pencil cases"
- After: "Full-wrap dark red, mustard and teal design with open books, globes, science flasks and pencils"

**Full description**, one phrase changes:
- Before: "…brings together teal, coral and gold in a design…"
- After: "…brings together dark red, mustard and teal in a design…"

Colour names are my reading of the artwork. Jon to correct them if he has his own names for these colours.

---

## Not changing

- **Prices:** untouched.
- **Google categories:** already correct for every product.
- **Short descriptions and bullets:** unchanged for everything except mug-002.

## Once approved

1. Back up products.db.
2. Update the approved fields only.
3. Check every changed product page and the feed match.
4. Google takes the new copy at its next 23:00 UTC fetch.
