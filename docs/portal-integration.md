# Customer portal integration

The documentation lives on a page in the site, so it can be shared as a link and never goes out of date:

- **Public docs for the portal's developers:** `/developers` (for example `https://lumeramd.biz/developers`). It holds no secrets and is hidden from search engines.
- **Managing access:** Lumera Ops › **API & webhooks** (`/lumera-ops/portal`). Create and revoke API keys, look up a member the way the portal sees them, and check the webhook status.

The page is `src/app/developers/page.tsx`. Behaviour is covered by `scripts/testPortalApi.ts`.

## Webhook configuration (set in Vercel, Production)

| Variable | Value |
| --- | --- |
| `PORTAL_WEBHOOK_URL` | The HTTPS address the portal gives us |
| `PORTAL_WEBHOOK_SECRET` | A long random string (`openssl rand -hex 32`). Give the same value to the portal's team |

With either one missing, no webhooks are sent or stored. API keys are not environment variables: they are created in the admin page and stored only as a hash.

`scripts/sendPortalTestEvent.ts` sends the portal a signed `test.ping` so their team can check their set-up before a real event.
