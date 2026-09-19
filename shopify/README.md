# Storefront affiliate tracking

`lumera-affiliate-tracking.liquid` lets the store pass an affiliate's referral through to the
order, so link-only sales are credited even when the discount code isn't used.

## Why it's needed

`/ref/<slug>` records the click on the affiliate app and sends the shopper to the store with
`?ref=<affiliate id>&cid=<click id>&d=<cookie days>` (and applies the affiliate's discount code
on the way). The app can't set cookies on the store's domain, so this snippet, which runs on the
store, keeps those values and writes them onto the cart. Shopify includes cart attributes on the
order (`note_attributes`), and the `orders/paid` webhook reads `affiliate_ref` and
`affiliate_click_id` from there.

## Install safely (about 5 minutes)

Do this on a **copy** of the theme first, so the live store is never at risk.

1. Shopify admin: **Online Store > Themes**. On the live theme click **... > Duplicate**.
2. On the copy: **... > Edit code**.
3. **Snippets > Add a new snippet**, name it `lumera-affiliate-tracking`, paste the contents of
   `lumera-affiliate-tracking.liquid`, save.
4. Open **Layout > theme.liquid**. Just above `</body>` add:

   ```liquid
   {% render 'lumera-affiliate-tracking' %}
   ```

   Save.
5. **Test on the copy** (click **... > Preview** on it):
   1. Open the preview URL with an affiliate link's values added, for example
      `<preview url>&ref=TEST1234&cid=TEST5678`.
   2. Open the browser console and run
      `fetch('/cart.js').then(r => r.json()).then(c => console.log(c.attributes))`.
      You should see `affiliate_ref` and `affiliate_click_id`.
   3. Browse to another page and add a product to the cart, and check that the attributes are
      still there and the page looks and behaves normally.
6. When it looks right, **Publish** the copy (or repeat steps 3 to 4 on the live theme).

## Rolling back

Remove the `{% render ... %}` line from `theme.liquid`. Nothing else depends on it. Or publish
the previous theme again from **Online Store > Themes**.

## What it touches

Only two cart attributes, `affiliate_ref` and `affiliate_click_id`, plus one `localStorage` key
on the store's domain (`lumera_affiliate`). It never reads or changes prices, discounts, cart
contents or checkout.
