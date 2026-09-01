<!--
  OPERATOR-MANUAL.md - the manual Gem actually reads.
  This text also lives, byte-identical from the first heading down, in
  src/components/admin/help/operatorManualContent.js (the in-app Help tab).
  If you change one, change both. Keep it free of backtick and dollar-brace
  sequences, and never use markdown pipe tables (the in-app renderer cannot
  draw them).
-->

# You Remembered, by Gem — Operator Manual

Written for Gem. Last updated: end of round 3. If anything on screen does not
match this manual, tell Megan — the manual is wrong until proven otherwise.

## 1. How a gift list happens (the one-minute version)

1. A member (subscriber) joins and adds the people they buy gifts for —
   birthdays, budgets, interests, things to avoid.
2. The moment a person is added, the app builds a draft gift list for them
   automatically. Drafts also appear when you press Generate Gift List
   yourself, or when a member asks for fresh ideas.
3. Every draft lands in your **Approvals** tab. Nothing reaches a member
   until you approve it. You are the taste filter — the app only shortlists.
4. When you approve, the member can see the list and one email goes out to
   them straight away — that is the only email approving sends. Separately,
   the app emails them about six weeks before the date, asking them to check
   the person's profile is still right, and again two days after the date,
   asking how the gift landed. Those two are the entire automatic schedule;
   there is no 30/14/7-day countdown of reminders.
5. Members react to gifts (loved it / not right / bought it). The app learns
   from that for next time; you can see it all in **Insights**.

The app can only ever suggest products that are **Active** in your catalogue.
Everything below is really about one question: which products deserve to be
Active, and how do they get there?

## 2. Your tabs at a glance

In the order they appear along the top:

- **Dashboard** — today's numbers and shortcuts. Nothing here changes data.
- **Approvals** — draft gift lists waiting for your yes. Your main job.
- **Subscribers** — your members, their people, and their lists. Invite new
  people from here too.
- **Retailers** — every shop the catalogue knows, with health badges,
  per-shop Scrape and Enrich buttons, and an Advanced section at the bottom.
- **Products** — the whole catalogue: add, edit, import, review, and the
  bigger maintenance buttons.
- **Calendar** — birthdays coming in the next 60 days, most urgent first.
- **Sent** — a log of every email the app has sent, with sent/failed marks.
- **Insights** — what members loved, bought, and rejected, plus trends.
- **Audit** — a read-only health check on the whole catalogue. Section 9.
- **Users** — login accounts and who has admin access. Handle with care.
- **Help** — this manual, always in reach.

## 3. Where products come from, and the Source column

Every product in the catalogue arrived one of three ways:

- **Gem's Pick** — you chose it yourself: added by hand, imported from your
  curated spreadsheet, or swapped into a list by you. This is your curation,
  and the app treats it as precious.
- **Catalogue upload** — the app discovered it by reading a retailer's
  website or product feed. Useful filler, but nobody has vouched for it
  until you review it.
- **Legacy** — old stock from before the app tracked sources.

You can see the source in the Source column of the Products tab, and change
it when you edit a product — for example, relabelling a Legacy item you
recognise as your own pick. When you edit, the two flavours of Catalogue
upload are spelled out ("site scan" vs "Shopify feed") so you can tell how
it was found; everywhere else they both just read "Catalogue upload".

Gem's Picks get a gold badge with a sparkle wherever they appear, so you can
always see your own hand in a draft.

**Filtering and sorting by source.** Next to the Status and Retailer filters
there is now a **Source** dropdown, reading "All sources (N)", "Gem's Pick",
"Catalogue upload" and "Legacy", each with a live count. The same dropdown
appears again in its own row above the By Retailer view, and it is the same
choice — pick a source in one view and it is still applied when you switch to
the other. Two things worth knowing:

- The counts are of your whole catalogue, not of what is currently on screen,
  so they do not jump around as you filter.
- While a specific source is selected, the By Retailer view hides shops that
  have nothing left to show. Switch back to "All sources" to see them again.

The **Source column heading is also a button**. Press it and the table groups
by provenance with your Gem's Picks first; press it again to go back. It only
changes the order — it never hides anything.

### What the machines may and may not do to your products

This matters enough to spell out precisely, because "the app protects your
curation" is true in most places and not quite true in one.

- **Re-importing your spreadsheet only ever fills in blanks.** If a row
  matches a product already in the catalogue, the import fills fields that
  are currently empty and leaves everything else exactly as it is. It never
  overwrites a description, picture, category, tags or age bands you have
  already set, and it never touches the name, the price, the status or your
  notes. Import the same sheet twice and the second run writes nothing at all.
- **Enrichment tops up, never replaces, on Gem's Picks and Legacy items.**
  New tags are added alongside your existing ones. On Catalogue upload
  products (which nobody hand-wrote) enrichment does rebuild the tags from
  scratch — that is fine, they were machine-made in the first place.
- **A description you wrote is never replaced by any button in this manual.**
- **Scrapes are the one partial exception.** When a scrape re-finds a product
  that is already in the catalogue, it refreshes the **price** to whatever the
  shop is charging today — including on a Gem's Pick. It also fills in a
  description or a picture if that field was empty. It never touches the name,
  your tags, the source label, or an Active product's status. So: if you have
  deliberately typed a price that differs from the shop's, a later scrape of
  that shop will change it back.
- **One safety flag can be switched on but never off.** If the app becomes
  confident that a product is adults-only, it may mark it age-restricted, on
  any product including your own picks. It can never un-mark one. That is a
  deliberate one-way safety catch, not a clobber.

If you ever see one of your own edits reverted by something other than the
price refresh above, that is a bug: note which button you pressed and tell
Megan.

## 4. Importing your spreadsheet

Products tab → **Import from Sheet**. Two ways in:

- Upload a file (.xlsx or .csv), or
- Paste a Google Sheet link.

Either way there is an optional **Tab Name** box, and it behaves differently
depending on which route you took. This catches people out, so:

- **Uploading a file:** leave Tab Name blank and the app finds the right tab
  by itself — it looks for a tab called "Curated Product List" first, then
  falls back to the first tab whose headings it recognises. It also looks
  down the first five rows of a tab, so a title or banner line above your
  headings is fine. Multi-sheet workbooks are fine; you no longer need to
  export a single tab as CSV first. Files must be under 15 MB.
- **Pasting a Google Sheet link:** leave Tab Name blank and it simply uses
  **the first tab**, and your headings must be in the **very first row** of
  it. There is no searching and no banner-row tolerance on this route. If
  your curated tab is not the first one, type its name into Tab Name.

If it says the sheet is missing required columns, it tells you which headings
it did find — that is usually enough to spot that it read the wrong tab.

**The template.** In the import panel there is a **Download template (.csv)**
link. It saves a file called curated-import-template.csv with the exact
column headings the app expects, in order:

1. Item Name — required
2. Retailer — required
3. Product URL — required
4. Image URL
5. Price (£) — required
6. Description
7. Interest Category
8. Gender
9. Age
10. Interest Tags
11. Gift Type Tags
12. Personality Tags

Note that the four required columns are 1, 2, 3 and 5 — Image URL sits in the
middle of them, so "the first four" is not the rule. Start new sheets from the
template rather than from memory. **The template ships with one example
product in it; delete that row before you import**, or you will create a
made-up retailer called Oak & Ember.

Your existing sheets still work as they are — the app recognises the usual
headings and the extra columns you keep for yourself. Occasion and Comments
are ignored on purpose, so keep planning in them freely.

**What happens when you press Start Import:**

1. The app reads the rows in batches (you'll see "Processed N rows…").
2. Each product's link is checked. Link works and the picture loads: the
   product is created **Active** immediately. Link works but the picture
   will not load: created as **Needs review** for you to check. Link is
   dead: the row is not imported at all — look for it under "Skipped
   rows" instead.
3. Rows the app could not use are listed at the end under "Skipped rows",
   each with a plain reason (missing price, dead link, and so on). Fix those
   rows in the sheet and import again.
4. Retailers it has never heard of are created automatically, switched on,
   and marked "Curated only" — meaning the scraper will leave them alone
   and they exist purely to hold your picks.

**The results card** shows:

- **Created active** and **Created needs review** — brand-new products.
- **Updated existing** — matched products that actually received a change.
- **Matched existing (no change needed)** — matched products that were
  already complete. Seeing a big number here on a re-run is the system
  working, not failing.
- **Fields filled on existing products** — how many individual blanks were
  topped up.
- **Skipped rows** — with reasons.

Two extra lines appear when they apply, and they are worth reading:

- "N unrecognised interest categor(y/ies) — imported exactly as written,
  nothing was dropped", followed by the actual values. Nothing is lost; the
  app simply does not have a rule for that word yet. Send the list to Megan
  and it can be taught.
- "N unrecognised gender(s) — treated as Unisex", followed by the values.
  Unisex is the safe choice: it means the product stays visible to everyone
  rather than being hidden from half your members.

**Re-running is always safe.** If an import stops halfway or you fix rows
and go again, already-imported products are recognised and refreshed, not
duplicated — and if nothing has changed, nothing is written at all. If you
see an error saying the file's row count changed mid-import, the reading step
got an inconsistent look at the file — just press Start Import again with the
same file.

Everything you import is stamped **Gem's Pick**.

**One small quirk to know about skipped rows.** If your sheet has a title or
banner line above the headings, the row numbers in the "Skipped rows" list can
be a line or two lower than the row you see in the spreadsheet. The names are
right; count from the first data row if a number looks off.

## 5. Needs review: the holding shelf

New products do not go straight into members' gift lists. Every product has
one of four statuses:

- **Active** — on the shelf; the gift picker may suggest it.
- **Needs review** — waiting for your eyes. Invisible to members and to the
  gift picker. Everything a scrape discovers lands here; so do imported
  rows the app could not verify.
- **Inactive** — retired. Usually the link died or the product vanished
  from the shop. Kept for the record, never suggested.
- **Reported broken** — a member clicked it and told us the link is broken.
  A gold banner at the top of the Products tab counts these; each needs you
  to fix the link (edit the product) or retire it.

### The Review queue (do this after any scrape or import)

The Products tab has three views: **Table**, **By Retailer**, and **Review**.
The Review button carries a count — "Review (42)" — so you can see at a glance
how much is waiting. That is the fastest route:

1. Products tab → **Review**.
2. Everything awaiting review is grouped **by shop**, with the number waiting
   in each group header. A line at the top also tells you how many of them
   have not been enriched yet, and suggests running Enrich on that retailer
   first so tags and quality flags are filled in before you judge them.
3. Tick individual products, or tick a **group header** to select that whole
   shop at once. Then press **Approve (n)** to make them Active, or
   **Discard (n)** to retire them.
4. Each row shows the picture, name, price, source label, an "Enriched" or
   "Not enriched" pill, a View link to the shop, and Edit.
5. Products the scraper itself thought were probably not products carry an
   amber **"flagged: junk_title"** or **"flagged: editorial_not_product"**
   tag. Group select-all deliberately skips these — you can still tick them
   one by one, but approving junk has to be a conscious act. If your
   selection contains any, an amber warning tells you how many.
6. When the queue is empty it says so plainly.

Approving and discarding here changes **only the status**. Your source
labels, tags and notes are not touched.

**The older route still works.** In the Table view you can set the status
filter to "Needs review", tick rows, and press **Mark as Active (n)**. That
button only counts rows that are genuinely Needs review — ticking anything
else does nothing, by design. Use whichever you prefer; the Review view is
just faster when a scrape has dropped hundreds of rows on you.

Rubbish products can also simply be left alone — Needs review items do no
harm sitting there, they are just invisible.

**Adding one product by hand:** Products tab → Add Product. The form only
saves it as Active if the picture actually loads in the preview in front of
you; otherwise it saves as Needs review. Hand-added products are stamped
Gem's Pick.

## 6. Retailers tab

Each row is a shop. What the badges mean:

- **Active / Inactive** — the master switch. An Inactive retailer's
  products are never suggested to members, even the Active products. Edit
  the retailer to flip this.
- **Curated only** — the scraper never touches this shop; it exists to
  hold products you imported or added yourself. These rows deliberately
  have no Scrape/Enrich buttons and no scrape-health badge.
- **Underfilled** — the shop is switched on, is a scraped shop, and has
  fewer than 10 Active products. It will barely feature in gift lists;
  either scrape it, review its pending products, or accept it as thin.
- **0 found / Stuck / No URL** — how the last scrape of this shop went, and
  these appear only when something went wrong. A scrape that worked shows no
  badge at all, so **no badge is the good outcome** — do not go looking for a
  success badge, there isn't one. "0 found" means the scrape ran but found
  nothing usable. "Stuck" means it errored (hover for the reason on desktop).
  "No URL" means the retailer record has no address to scrape — edit the
  retailer and add one.
- **Source: Shopify / Sitemap / Crawl** — how the app reads that shop.
  Shopify is the most reliable, Crawl the least.

**Per-shop buttons** (the sane way to scrape):

- **Scrape** — reads just that shop's site and pulls new products in as
  Needs review. Run it when a shop looks Underfilled or stale. While it is
  running the button becomes **Stop**, and a small line underneath counts
  the batches and what has been found so far. Pressing Stop lets the batch
  that is already in flight finish, saves the place, and then halts —
  nothing is lost and pressing Scrape again carries on from there.
- **Enrich** — see section 7.

**The Advanced section at the bottom** holds one control: **Full Catalogue
Scrape**. Section 10 explains it. It only appears once you have at least one
retailer.

**A display quirk worth knowing:** on a narrow window the retailer table
extends past the right edge — the status badges and the buttons live at
the far right. Scroll the table sideways; the buttons are not missing.

## 7. Enrichment — what it is

Enrichment fills in the invisible matching details on catalogue products —
tags for interests and gift types, search words, a quality score — so the
gift picker can find them for the right person. Scraped products arrive
bare; enrichment dresses them.

- Per shop: **Enrich** button on the retailer's row. This one covers that
  shop's Active **and** Needs review products, so it is the only button that
  reaches a review pile.
- Whole catalogue: **Enrich catalogue** in the Products tab header. It
  processes a chunk at a time and tells you how many products still need
  enrichment; press it again to continue. **It only ever touches products
  that are already Active**, though — it skips everything sitting in Needs
  review, so it is no use as a before-you-review step.

Enrichment is automatic tagging, not magic: it never changes names,
prices, pictures or status, and it never activates anything. On your Gem's
Picks and on Legacy items it adds to your tags rather than replacing them,
and it will not overwrite a description you wrote (section 3).

Enrich before you review, not after: a product with its tags filled in is
much easier to judge, and the Review queue nudges you about this. Use the
right button for it — the **Enrich** button on that shop's row in Retailers.
The whole-catalogue Enrich in the Products header will not touch a single
product that is waiting for your review.

## 8. Approving gift lists

**Approvals tab** lists every draft, most urgent birthday first. The cards
at the top are shortcuts to other tabs. Emails you receive about a new
draft link straight to the right list.

Open a list and you will see the **Top 5** (what the member will see) and
**Backup Ideas** (standbys the app can promote later). House rules the
buttons enforce:

- The Top 5 holds at most 5 gifts. You cannot demote below 3 while
  curating, and you cannot approve with fewer than 5 in the Top 5.
- If the backup bench is thin (fewer than 5), approving asks "Approve
  anyway?" — fine to accept, it just means fewer spare ideas if a link
  breaks later.

Two notices can appear above the person's profile:

- An **amber notice** saying the profile was updated after these gifts were
  generated. It means the member has edited that person since the draft was
  built, so the draft may be out of date — press Regenerate to rebuild it
  with the new details. No notice means the profile has not moved.
- A **subscriber's refresh note** in quotation marks, when the member said
  why they wanted fresh ideas. Read it before you curate; it is the
  member telling you what was wrong with the last list.

What each control does:

- **Promote / Move to backup** — swap gifts between Top 5 and the bench.
- **Remove** — takes a gift off the list and asks you why (wrong age, not
  their style, and so on, plus an optional note). Your reasons feed the
  Insights tab and teach the picker — always pick the honest reason.
  "Bad link or product data" is the odd one out, and it cuts both ways.
  For **this** person it is not treated as a taste signal at all, so once
  the link is repaired that product may be suggested to them again. But it
  does count against the product **everywhere else**: those marks are pooled
  app-wide with "too generic", "poor quality" and members' own "not right"
  verdicts, and once one product has collected three of them in total it
  stops being offered to anybody. A member pressing report-broken-link adds
  one of those marks too. So it is exactly the right reason for a broken
  link, and the wrong reason for a gift you simply did not like.
- **Swap in a gift** — replace with a product from the catalogue (a picker
  that blocks duplicates) or type one in by hand. Hand-typed swaps are
  stamped Gem's Pick.
- **Approve** — the member can now see the list; if this list replaced an
  older one, the old one is hidden automatically; the "your list is ready"
  email goes out. If the email fails to send, the approval still stands and
  you are told so — check the Sent tab, and it is safe to press Approve
  again later to re-send.
- **Regenerate with latest rules** — asks the picker for a brand-new draft
  using everything it has learned. The old draft stays put until the new
  one exists, so a failed regenerate loses nothing.
- **Reject** — bins the draft with a reason. Use Regenerate instead when
  you want a replacement. Be aware that a whole-list rejection reason is a
  dead end today: it is saved onto the list's record, but no screen in the
  app ever shows it back to you, and it is not fed into the picker either.
  Even the Insights tab's reason chart is built purely from per-gift Remove
  reasons. So when a whole list is wrong, removing the gifts one by one with
  honest reasons — or telling Megan — is worth far more than anything you
  type into the rejection box.

Cards may show an "AI fit" score out of 5 and an "AI flag" note — the app's
own second opinion on a gift. Low scores are a hint to look closer, not an
order.

**Fresh-ideas requests from members:** a member can ask for new suggestions
once a day per list. That creates a NEW draft in your queue; their current
list stays live until you approve the replacement.

**Be straight with members about this one:** the new draft deliberately
repeats **nothing** from their current list — and that includes gifts they
marked as loved. There is no way to carry a loved gift across a refresh at
the moment. What they loved is not wasted, because it teaches the picker
what kind of thing to look for, but the specific item will not come back on
the replacement list. If a member wants to keep something they loved, the
answer today is: don't refresh that list, or note the item and swap it back
in yourself before you approve. Megan knows about this and it is on the list
of decisions for Kate.

**A member can also arrive via their own profile edits.** When a member
changes something about a person that actually affects gift choice, the app
offers them a refresh there and then, and the reason arrives with you as
"Profile updated: ..." followed by what changed.

## 9. The rest of the tabs

**Dashboard** — five live counters (active subscribers, pending approvals,
birthdays this week, lists ready for birthdays more than 30 days out,
feedback items) and shortcut rows. Purely informational.

**Subscribers** — every member with status (Active, Trialling, Past due,
Cancelled), how many people and lists they have. **Invite Person** sends a
signup invitation by email — choose role User for a normal member (Admin
is for staff only). Open a member to see their people and every list's
status, generate a list for any of their people on demand, or — at the
very bottom — **Delete subscriber account**. Deletion removes the member,
all their people, and all their lists permanently. There is no undo.

**Users** — every login the app knows. The switch turns a login into an
admin — full access to everything in this manual. Never leave that switch
on for anyone who is not staff. (Deleting logins is not done here — ask
Megan.)

**Calendar** — birthdays in the next 60 days with urgency colours. Use it
on a Monday to see the week coming.

**Sent** — every email with its type and a sent/failed/pending mark. If a
member says "I never got the email", look here first. One naming trap: the
email an approval sends is logged as **30-Day Preview** (or 14-Day Reminder,
or 7-Day Final Call). Those names describe the KIND of list, not when the
email went out — and because every list the app currently builds is a curated
list, an approval email nearly always reads "30-Day Preview" whatever the
date. The only genuinely timed emails are 6-Week Reminder and Post-Occasion
Feedback, both from section 1.

**Insights** — purchased / loved / not-right counts, an AI quality score,
which shops win, your removal reasons, and community trends. The numbers
update when you press **Refresh trend stats** — they do not refresh
themselves, so press it after a busy feedback week (or before reading too
much into the charts).

**Audit** — a health check on the whole catalogue. Press **Run forensics
audit** and it sorts every product into four piles and grades every shop's
coverage. **It never changes your catalogue** — it only reads it. The one
thing it can write is the Google Sheet, and only if you tick that box
yourself. The piles are:

- **Healthy (active)** — nothing to do.
- **Correctly rejected** — junk the scraper was right to refuse.
- **Needs manual review** — the interesting pile. Products awaiting your
  review, products reported broken, retired products with no recorded
  reason, and — most importantly — any of **your** picks that trip the
  scraper's junk heuristics. Those last ones are never auto-retired, they
  are surfaced for you to look at, because the app will not condemn one of
  your choices on a guess.
- **Needs re-enrichment** — products with no tags yet or missing
  descriptions/pictures. Run Enrich on their shop, then run the audit again.

Underneath, a **Retailer coverage** table grades each shop: fine, needs a
re-scrape, has no source URL, is switched off, or is curated-only. Where a
number is unknown it shows a dash rather than a zero — a dash means "not
measured yet", not "none".

**"Also overwrite the Google Sheet"** starts unticked, so an audit reports on
screen and touches nothing else. Tick it and the audit also writes a
spreadsheet called **Scrape Forensics** with two tabs, so you can work
through it away from the screen. Careful: that clears and rewrites the whole
spreadsheet every run — it is a snapshot, not a history, so anything you type
into those tabs is lost on the next audit. If the sheet fails to write you
still get the full report on screen with an amber note; the audit itself has
not failed.

Use the Audit tab when the catalogue "feels wrong" and you want to know
where to spend an hour, or before a big scraping session.

## 10. The big buttons in the Products header, told apart

The Products tab header holds exactly five controls, left to right, gentle
to heavy:

- **Add Product** — one product, by hand. Safe.
- **Import from Sheet** — your spreadsheet, section 4. Safe to re-run.
- **Re-run Scrape** — despite the name, this is the LINK CHECKER. It walks
  the catalogue confirming products are still buyable and retires dead
  ones. It does big catalogues in instalments — if it says "press again to
  continue", do exactly that until it says complete. Run it monthly-ish or
  after members report broken links.
- **Enrich catalogue** — tagging pass, section 7. Safe; press again to
  continue.
- **Recover old catalogue** — sifts retired (Inactive) products and moves
  plausible ones back to Needs review. Activates nothing by itself.
  Useful after an overzealous link-check.

**Full Catalogue Scrape is no longer here.** It has been moved out of this
header on purpose, so it cannot be pressed out of habit. It now lives at the
bottom of the **Retailers** tab, under **Advanced**, on its own.

**Full Catalogue Scrape** reads EVERY enabled shop's entire site. It is the
heavy one: it can run for hours, it holds the scrape lock the whole time
(nothing else can scrape while it runs), and everything it finds still lands
in Needs review for you to sift. You almost never need it — the per-shop
Scrape button in Retailers does the same job one shop at a time. Use it only
on Megan's advice.

Because it is so heavy, it now asks you to **type SCRAPE ALL** into a box
before the Start button will work. That is exact and case-sensitive: capital
letters, one space, nothing else. The box is emptied every time the dialog
opens, so an old confirmation can never be reused by accident. The dialog
also tells you roughly how many shops it is about to walk ("about 14
retailers"), which is a good sanity check before you commit.

While it runs:

- The button becomes **Stop after this batch**. That is a cooperative stop:
  the chunk already in flight finishes and saves its place, and then the run
  halts. Nothing is lost and nothing is half-written.
- A line underneath shows which batch it is on and how many shops remain.
- If you stopped it, or it ran out of its allowance, the button afterwards
  reads **Full Catalogue Scrape (resume)** and the dialog tells you a
  previous run is part-finished. Press it again to carry on from where it
  stopped.

## 11. When things look stuck

**"A scrape is already running" / a scrape button refuses to start.**
Only one catalogue scrape may run at a time, app-wide. If a previous run
was cut off (closed laptop, crash), its claim expires by itself after 10
minutes. Wait ten minutes, try again. Still stuck after that: Megan.

**A scrape says paused, or you closed the tab mid-scrape.**
Progress is remembered in that browser, on that computer. Reopen the same
browser and press the same button to continue — the Full Catalogue Scrape
button will say "(resume)". If you press it on a different computer it
starts from the beginning instead; let it, because re-scraping never
duplicates products.

**A retailer shows Stuck or 0 found.**
Hover the badge (desktop) to read the error. Then: check the retailer's
website address in Edit, fix if wrong, and press Scrape again. A shop that
repeatedly returns 0 may simply have an unreadable site — tell Megan which
one.

**A product you know is in the catalogue never appears in gift lists.**
Check, in order: is the product Active (not Needs review)? Is its retailer
switched on? Does its price fit inside that member's budget for that
person? Does its age/gender labelling fit the person? And remember a list
carries at most 2 products from any one shop, and only 5 gifts are shown —
being skipped once means little. The quickest way to answer "is my catalogue
too thin for this?" is the Audit tab.

**A member says their gift list disappeared.**
Most likely a regenerate or refresh replaced it: the old list hides when
you approve the new one. Check their profile in Subscribers — the current
list and its status are listed there. If they ask where a gift they loved
went after a fresh-ideas request, that is expected: replacement drafts
never repeat gifts from the old list, loved ones included (section 8).

**A member wants fresh ideas but the app says no.**
Fresh-ideas requests are limited to one per day per list, and blocked while
a replacement draft is already waiting for you in Approvals, or while a
draft you recently rejected is still recent. Approve or reject the pending
draft first, and if they are still blocked, wait out the day.

**The approval email failed.**
Approving still worked — the member can see the list in the app. Check the
Sent tab; the app will have told you at the time. It is safe to press
Approve again later to re-send.

**Import complains or skips rows.**
Read the skipped-rows reasons — they are written in plain English (missing
price, dead link, no retailer). Fix the sheet, run again; no duplicates.
"Row count changed" means it misread the file once — run it again. If it
says the sheet has the right columns but no usable rows, or that columns are
missing, you are almost certainly on the wrong tab — see the Tab Name notes
in section 4, which work differently for uploads and for Google Sheet links.

**Insights look frozen.**
They are — until you press Refresh trend stats.

**Buttons or columns seem to be missing on the right of a table.**
Scroll the table sideways. The Retailers and Products tables are wider
than a narrow window.

**Everything looks fine but gift lists feel poor.**
Run the Audit tab, look at "Needs re-enrichment" and at the shops graded
"needs a re-scrape", and fix those first. Thin, untagged stock is the usual
cause.

## 12. Golden rules

1. Nothing reaches a member without your approval. When unsure, don't
   approve — regenerate or ask.
2. Prefer the per-shop Scrape button; leave Full Catalogue Scrape alone.
3. After any scrape or import, work the Review queue (section 5). Enrich
   first, then review — but enrich with the per-shop **Enrich** button in
   Retailers. The whole-catalogue Enrich skips the review pile entirely.
4. Pick honest removal reasons — they train the picker.
5. Do not toggle admin on in Users for anyone who is not staff.
6. Deleting a subscriber is forever.
7. Re-importing your sheet is always safe: it fills blanks and never
   overwrites what you typed.
8. If one of your own edits ever gets overwritten by a button — anything
   beyond the price refresh described in section 3 — that is a bug. Note the
   button and tell Megan.
9. Publishing, schemas, and anything not in this manual: Megan.

## 13. Word list

- **Active / Needs review / Inactive / Reported broken** — product shelf
  status, section 5.
- **Gem's Pick / Catalogue upload / Legacy** — where a product came from,
  section 3.
- **Curated only** — a shop the scraper leaves alone.
- **Underfilled** — a switched-on scraped shop with fewer than 10 active
  products.
- **Scrape** — the app reading a shop's website for products.
- **Enrich** — automatic tagging so the picker can match products.
- **Review queue** — the third view in Products, holding everything awaiting
  your yes or no.
- **Top 5 / Backup Ideas** — what the member sees / the spare bench.
- **Standby** — a backup gift that can be promoted if a link breaks.
- **Draft / pending approval** — a gift list waiting in Approvals.
- **Audit** — the read-only catalogue health check, section 9.
