# Google Tag Manager Setup

How to configure GTM for Gorur Gari. The app-side work is already done — this covers
only what you click in the GTM interface.

**GTM is the single owner of every marketing tag.** There is no pixel code in
`client/index.html`. If you add a tag here that the app also fires, you double-count it.

---

## Before you start

You need a Facebook Business account with a pixel (this project's pixel id is
`928286963351095`) and a Google account for GTM.

What the app already does — you do not need to change any of this:

| Concern | Where |
| --- | --- |
| Loads the GTM container | [`client/src/utils/analytics.js`](../client/src/utils/analytics.js) |
| Pushes ecommerce events | Same file, called from ProductDetails / Checkout / SearchResults |
| Allows tag hosts through CSP | [`server/app.js`](../server/app.js) |

---

## Part 1 — Create the container

1. Go to [tagmanager.google.com](https://tagmanager.google.com) → **Create Account**.
2. **Account Name**: `Gorur Gari`. Set your country.
3. **Container Name**: your domain (e.g. `gorurgari.com`). **Target platform: Web**.
4. Accept the Terms of Service.
5. GTM shows you two code snippets in a popup. **Ignore them and close the popup** — this
   app loads the container itself. You only need the id at the top: `GTM-XXXXXXX`.

Then connect it:

```bash
# in .env at the repo root — this project's container:
VITE_GTM_ID=GTM-PC4Q72SG
```

```bash
npm run build      # the id is read at BUILD time — a rebuild is required
npm start          # restart so the server serves the new build
```

> **This is the step people forget.** Changing `VITE_GTM_ID` without rebuilding does
> nothing at all. The variable is compiled into the JS bundle, not read at runtime.

Confirm it worked: load your site, open DevTools → Network, filter `gtm.js`. You should
see a request to `googletagmanager.com`. If not, the build didn't pick up the id.

---

## Part 2 — Create the Data Layer Variables

GTM can't read the app's data until you declare each field you want. Go to
**Variables → User-Defined Variables → New → Data Layer Variable** and create these.

The name is yours to choose; the **Data Layer Variable Name** must match exactly.

| Name it | Data Layer Variable Name |
| --- | --- |
| `DLV - meta.content_ids` | `meta.content_ids` |
| `DLV - meta.contents` | `meta.contents` |
| `DLV - meta.value` | `meta.value` |
| `DLV - meta.num_items` | `meta.num_items` |
| `DLV - meta.order_id` | `meta.order_id` |
| `DLV - search_term` | `search_term` |

Leave **Data Layer Version** at **Version 2** (the default) — it's what allows the
dotted `meta.value` path to resolve.

### Why `meta.*` and not `ecommerce.*`

Each event carries the same numbers twice: `ecommerce` in Google's GA4 format, and `meta`
pre-formatted for Facebook. Facebook wants `content_ids` and `contents`; GA4 wants an
`items` array. Converting between them inside GTM is the classic place this setup breaks —
a wrong `value` gives you ROAS numbers that look plausible and are false. Use `meta.*` for
Facebook tags and let GA4 read `ecommerce` automatically.

---

## Part 3 — Create the triggers

**Triggers → New → Trigger Configuration → Custom Event.** Create six. The **Event name**
must match exactly (they're case-sensitive), and each fires on **All Custom Events**.

| Trigger name | Event name |
| --- | --- |
| `CE - page_view` | `page_view` |
| `CE - view_item` | `view_item` |
| `CE - add_to_cart` | `add_to_cart` |
| `CE - begin_checkout` | `begin_checkout` |
| `CE - purchase` | `purchase` |
| `CE - search` | `search` |

> Don't use GTM's built-in **All Pages** trigger for pageviews. This is a single-page app:
> the browser only loads a document once, so All Pages fires once no matter how many
> products the shopper browses. `CE - page_view` fires on every route change.

---

## Part 4 — The Meta Pixel base tag

This loads the pixel library. It must run before any event tag.

**Tags → New → Custom HTML.** Name it `Meta Pixel - Base`.

```html
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '928286963351095');
</script>
```

**Trigger: Initialization - All Pages.** (Choose *Initialization*, not *All Pages* — it's
guaranteed to run before other events are processed.)

> **Note what is missing: there is no `fbq('track', 'PageView')` here.** That is
> deliberate. PageView is fired by its own tag in Part 5 so it also fires on in-app
> navigation. Leaving it in this tag as well double-counts every landing pageview.

---

## Part 5 — The Meta Pixel event tags

Six Custom HTML tags, one per trigger. Each is a `fbq('track', ...)` call.

**The one syntax rule:** strings need quotes around the variable, numbers and arrays must
not have them. `value: {{DLV - meta.value}}` is correct; `value: '{{DLV - meta.value}}'`
sends Facebook a string and breaks revenue reporting.

### `Meta Pixel - PageView` → trigger `CE - page_view`

```html
<script>
  fbq('track', 'PageView');
</script>
```

### `Meta Pixel - ViewContent` → trigger `CE - view_item`

```html
<script>
  fbq('track', 'ViewContent', {
    content_type: 'product',
    content_ids: {{DLV - meta.content_ids}},
    contents: {{DLV - meta.contents}},
    currency: 'BDT',
    value: {{DLV - meta.value}}
  });
</script>
```

### `Meta Pixel - AddToCart` → trigger `CE - add_to_cart`

Same body as ViewContent, with `'AddToCart'` as the event name.

### `Meta Pixel - InitiateCheckout` → trigger `CE - begin_checkout`

```html
<script>
  fbq('track', 'InitiateCheckout', {
    content_type: 'product',
    content_ids: {{DLV - meta.content_ids}},
    contents: {{DLV - meta.contents}},
    currency: 'BDT',
    value: {{DLV - meta.value}},
    num_items: {{DLV - meta.num_items}}
  });
</script>
```

### `Meta Pixel - Purchase` → trigger `CE - purchase`

```html
<script>
  fbq('track', 'Purchase', {
    content_type: 'product',
    content_ids: {{DLV - meta.content_ids}},
    contents: {{DLV - meta.contents}},
    currency: 'BDT',
    value: {{DLV - meta.value}}
  }, {
    eventID: '{{DLV - meta.order_id}}'
  });
</script>
```

`eventID` is the order number. It lets Facebook discard duplicates if a buyer refreshes
the confirmation screen, and it's what a future server-side Conversions API integration
would match on.

### `Meta Pixel - Search` → trigger `CE - search`

```html
<script>
  fbq('track', 'Search', {
    search_string: '{{DLV - search_term}}'
  });
</script>
```

Quoted, because a search term is a string.

---

## Part 6 — GA4 (optional but recommended)

Facebook tells you which ad someone clicked. GA4 tells you what they did afterwards —
which categories get browsed but never bought, where the checkout loses people, what your
actual conversion rate is. You can run ads without it, but you'll be optimising blind.

Five tags total. Fewer than Meta needed, because GA4 reads the `ecommerce` object directly
instead of needing each parameter mapped by hand.

### 6.1 — Create the property

1. [analytics.google.com](https://analytics.google.com) → **Admin** (gear, bottom left) →
   **Create** → **Property**.
2. **Property name**: `Gorur Gari`.
3. **Reporting time zone**: `Bangladesh (GMT+6)`.
4. **Currency**: **Bangladeshi Taka (BDT)**.
5. Fill in the business details, then **Create**.
6. Choose platform **Web**. **Website URL**: `https://gorurgari.com`, stream name
   `Gorur Gari Web`.
7. Copy the **Measurement ID** — `G-XXXXXXXXXX`.

> **Set the currency to BDT now.** The app sends `currency: "BDT"` with every event. If the
> property is left on USD, GA4 converts every amount at the daily exchange rate, and a
> ৳5,280 order shows as roughly $43 in revenue reports. Currency and time zone apply from
> the moment you change them — they do not fix data already collected.

### 6.2 — Extend data retention

**Admin → Data collection and modification → Data retention.** Change event data retention
from **2 months** (the default) to **14 months**.

Do this before you collect anything. It is not retroactive, and two months is not enough to
compare this Eid against last year's.

### 6.3 — Store the Measurement ID as a variable

You'll reference it in five tags, so declare it once.

**Variables → User-Defined → New → Constant.** Name it `GA4 Measurement ID`, value
`G-XXXXXXXXXX`.

Now a typo can only happen in one place, and switching properties later is a single edit.

### 6.4 — The Google Tag

This loads GA4. It is the equivalent of the Meta Pixel base tag.

**Tags → New → Google Tag.**

| Field | Value |
| --- | --- |
| Tag ID | `{{GA4 Measurement ID}}` |
| Trigger | **Initialization - All Pages** |

Name it `GA4 - Google Tag`. Nothing else needs changing.

### 6.5 — Four GA4 Event tags

**Tags → New → Google Analytics: GA4 Event**, once per event:

| Tag name | Event Name | Trigger |
| --- | --- | --- |
| `GA4 - view_item` | `view_item` | `CE - view_item` |
| `GA4 - add_to_cart` | `add_to_cart` | `CE - add_to_cart` |
| `GA4 - begin_checkout` | `begin_checkout` | `CE - begin_checkout` |
| `GA4 - purchase` | `purchase` | `CE - purchase` |

For every one of them:

- **Measurement ID**: `{{GA4 Measurement ID}}`
- **Event Name**: exactly as in the table (GA4's ecommerce reports only recognise these
  reserved names — `View Item` or `viewItem` will be treated as a meaningless custom event)
- Expand **More Settings → Ecommerce** → tick **Send Ecommerce data**, with
  **Data source: Data Layer**

That last checkbox is the whole point of the `ecommerce` object the app pushes. With it
ticked, GA4 reads `items`, `value`, `currency`, `transaction_id` and the rest by itself —
no parameter mapping, none of the quoting rules that Part 5 needed.

### 6.6 — Do not create these two tags

This is where GA4 setups get double-counted, and the symptom is inflated traffic that looks
like good news.

**No GA4 tag for `page_view`.** GA4's Enhanced Measurement already detects browser history
changes and records a page view on every React Router navigation. Add a tag on
`CE - page_view` as well and every pageview counts twice. Leave Enhanced Measurement on and
let it do the job. (The Meta PageView tag from Part 5 stays — that's a different platform
with no automatic detection.)

**No GA4 tag for `search`.** Enhanced Measurement's site-search detection looks for a `q`
parameter, and this app's search URL is `/search?q=...`, so GA4 already logs it as
`view_search_results` on its own.

### 6.7 — Verify with DebugView

GA4 has a better debugger than GTM's, and GTM Preview switches it on automatically.

With GTM Preview running, open **GA4 → Admin → DebugView**. Your session appears within
about 30 seconds and events stream in as you browse.

Click a `purchase` event and check the parameters:

| Parameter | Expect |
| --- | --- |
| `currency` | `BDT` |
| `value` | the real order total as a **number** |
| `transaction_id` | your order number |
| `items` | one entry per line item, with `item_name` and `quantity` |

If `items` is empty, **Send Ecommerce data** is unticked on that tag. That's the one
mistake worth checking first, and it's silent otherwise — the event arrives, just with no
products attached.

Then confirm revenue lands in reports: **Reports → Monetisation → Ecommerce purchases**.
Allow up to 24 hours for the standard reports, though **Reports → Realtime** shows activity
immediately.

### One known gap

The app sends `discount` at the event level on `purchase`. GA4's schema defines `discount`
per *item*, not per event, so it arrives as an unrecognised parameter and won't appear in
any standard report. Everything else — `value`, `shipping`, `coupon`, `transaction_id` —
maps to a built-in GA4 dimension.

If you want to report on voucher discounts, register a custom dimension:
**Admin → Custom definitions → Create custom dimension**, event-scoped, parameter name
`discount`. Coupon *code* already works without this, via `coupon`.

---

## Part 7 — Test before publishing

Click **Preview** (top right) and enter your site URL. A debug panel opens alongside it.

Walk the funnel and check each event appears in the left-hand event list with its tag
fired:

| Do this | Expect |
| --- | --- |
| Land on the homepage | `Initialization` → `Meta Pixel - Base` fired |
| Navigate to any other page | `page_view` → `Meta Pixel - PageView` fired |
| Open a product | `view_item` → `Meta Pixel - ViewContent` fired |
| Add to cart | `add_to_cart` fired |
| Go to checkout | `begin_checkout` fired |
| Place a real test order | `purchase` fired |

For each fired tag, click it and check the parameters. **`value` must be a number and
`content_ids` must be an array of id strings.** If you see `[object Object]` or a quoted
number, re-read the syntax rule in Part 5.

> GTM Preview loads your site inside a `tagassistant.google.com` frame. That's already
> allowed by the `frame-ancestors` directive in `server/app.js`. A blank preview means
> something changed there.

---

## Part 8 — Confirm Facebook is receiving events

GTM Preview proves the tag fired. It does not prove Facebook accepted it.

Go to **Events Manager → your pixel → Test Events**, then repeat the funnel. Events
should appear within seconds. Check that Purchase shows the right currency and value.

Your pixel history from before this setup is most likely intact — see the note on
production CSP below. Compare the new Purchase numbers against a real order total by hand
anyway, since the events themselves are new even if the pixel is not.

---

## Part 9 — Publish

**Submit → Publish**. Give the version a name like `Meta Pixel + GA4 initial setup`.

Nothing is live until you publish. Preview mode only affects your own browser.

---

## Adding another ad network later

Adding a TikTok, Snapchat, or Google Ads tag takes two steps, and the second one is easy
to miss:

1. Create the tag in GTM off the existing triggers — no code deploy needed.
2. **Add its script and beacon hosts to the CSP** in
   [`server/app.js`](../server/app.js) (`TAG_SCRIPT_HOSTS` and `TAG_CONNECT_HOSTS`),
   then redeploy the server.

Without step 2 the browser silently blocks the new tag. GTM will report it as fired and
you will see nothing in the ad platform. If a newly added tag reports zero events, check
the browser console for a Content-Security-Policy violation first.

### Production currently discards the CSP (verified 2026-07-30)

The Express app sends the full policy, but the hosting layer in front of it overwrites the
header with `upgrade-insecure-requests` and pads the rest with spaces, so **no script
restrictions are actually enforced on gorurgari.com**. Checked with:

```bash
curl -sD - -o /dev/null https://gorurgari.com/ | grep -i content-security-policy
```

Two consequences:

- A blocked-tag problem will show up on **localhost, not production**, because the local
  server enforces the real policy. Don't conclude a tag works from testing prod alone.
- The security hardening helmet appears to provide is not in effect in production. Worth
  raising with the host separately; it does not affect tagging.

Still make the `server/app.js` edit when adding a network. It's correct, it's what local
and any other deployment enforce, and the host's behaviour could change without notice.

---

## Troubleshooting

**`fbq is not defined` in the console.** An event tag ran before the base tag. Open the
event tag → **Advanced Settings → Tag Sequencing** → tick *Fire a tag before this tag
fires* and select `Meta Pixel - Base`.

**Every conversion counted twice.** Either `fbq('track', 'PageView')` is still in the base
tag, or a pixel snippet was re-added to `client/index.html`. There must be exactly one
source for each event.

**`value` arrives as `0`.** Product prices are stored as text (`"1,460 BDT"`). The app
parses them, but a malformed price in the admin panel parses to `0`. Check the product.

**No events at all, and no `gtm.js` in the Network tab.** `VITE_GTM_ID` is unset or the
build is stale. Re-run `npm run build`.

**Events fire in Preview but not in Events Manager.** Usually an ad blocker on your own
browser. Test in a private window with extensions disabled.

---

## Reference: the dataLayer contract

What the app pushes. Change these names only alongside the GTM triggers that consume them.

| Event | `ecommerce` fields | `meta` fields | Fired from |
| --- | --- | --- | --- |
| `page_view` | — (`page_path`, `page_location`, `page_title` at top level) | — | every route change |
| `view_item` | `currency`, `value`, `items[]` | `content_type`, `content_ids`, `contents`, `currency`, `value` | product page load |
| `add_to_cart` | same | same | Add to Cart *and* Order Now |
| `begin_checkout` | same | same + `num_items` | checkout page, once per visit |
| `purchase` | + `transaction_id`, `shipping`, `discount`, `coupon` | same + `order_id` | order confirmed |
| `search` | — (`search_term` at top level) | — | search results page |

`purchase.value` is the amount actually charged: products, minus any voucher discount,
plus delivery. That is deliberate — it's what the ad platforms optimise against.
