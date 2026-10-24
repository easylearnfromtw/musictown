# CITYMUS Studio — Member API + Embed Player

The existing CITYMUS landing site is unchanged. This adds an authenticated **member studio**, editable playlists, individually revocable **publishable/read-only** API keys, and an embeddable player.

Repository: https://github.com/easylearnfromtw/musictown

## Architecture (no Railway)

- **Static frontend:** Existing CITYMUS website and `/studio/` admin UI.
- **Server/API runtime:** Vercel Node.js serverless functions under `/api/`.
- **Identity and database:** Supabase Auth (email magic link) + PostgreSQL.
- **Media:** User-supplied authorized/public HTTPS audio URLs, played directly by the end user's browser. No file upload or transcoding is implemented. Existing `/api/audio` remains unchanged.

The GitHub Pages site remains usable as before, **but GitHub Pages cannot execute serverless APIs**. The Studio must be opened from a Vercel deployment with API functions enabled. The current GitHub Pages hostname will not make `/api/` routes live.

## Setup

1. Create a Supabase project. In SQL Editor, apply `database/citymus_schema.sql`.
2. Add a Vercel project by importing `easylearnfromtw/musictown`. Deploy from repo root as a static/Other framework project (existing `vercel.json` config is retained).
3. Set the following **Vercel server-side environment variables**:
   - `SUPABASE_URL` — e.g. `https://<project>.supabase.co`
   - `SUPABASE_ANON_KEY` — Supabase publishable/anon client API key (this is intentionally sent to the browser).
   - `SUPABASE_SERVICE_ROLE_KEY` — service-role JWT secret, **server-only**.
   - `CITYMUS_KEY_PEPPER` — at least 32 random characters, **server-only**; keep unchanged after launch or all issued keys will stop working.
4. Supabase → Auth → URL Configuration: set Site URL to the production Vercel/custom-domain URL; add `https://<your-domain>/studio/` as an allowed redirect URL. Configure the email provider and delivery quotas.
5. Deploy. Test `GET /api/config`, log in at `/studio/`, add a playlist with publicly playable licensed audio, generate a key, and use the iframe or JSON endpoint.

Do not commit secrets to this repository, client-side HTML, or GitHub Pages. Use Vercel protected environment variables.

## Routes

| Route | Auth | Action |
| --- | --- | --- |
| `GET /api/config` | Public | Returns Supabase URL and *publishable* key only |
| `GET /api/playlists` | Supabase user Bearer JWT | List own playlists |
| `POST /api/playlists` | Supabase user Bearer JWT | Create playlist |
| `PATCH /api/playlists?id=<uuid>` | Supabase user Bearer JWT | Update own playlist |
| `DELETE /api/playlists?id=<uuid>` | Supabase user Bearer JWT | Delete own playlist and cascade revoke keys |
| `GET /api/keys` | Supabase user Bearer JWT | List own key metadata only |
| `POST /api/keys` | Supabase user Bearer JWT | Create read-only key, returned **once** |
| `DELETE /api/keys?id=<uuid>` | Supabase user Bearer JWT | Revoke own key |
| `GET /api/public-playlist?key=cm_pub_...` | Publishable key | Read JSON playlist |
| `GET /api/embed?key=cm_pub_...` | Publishable key | Embeddable player (CSP frame-ancestors for allowed origins) |

The key is a **browser-visible publishable token**, not a confidential machine-to-machine API secret. It permits reading only the linked playlist. It cannot authenticate to the member admin endpoints.

### Example: embed a CITYMUS player

```html
<iframe src="https://YOUR-DOMAIN/api/embed?key=cm_pub_YOUR_KEY"
  title="CITYMUS player" width="100%" height="320"
  loading="lazy" allow="autoplay"
  style="border:0;border-radius:18px"></iframe>
```

### Example: programmatic read-only access

```js
const response = await fetch('https://YOUR-DOMAIN/api/public-playlist?key=cm_pub_YOUR_KEY');
if (!response.ok) throw new Error('Playlist unavailable');
const playlist = await response.json();
```

### Security

- Never expose service-role credentials. The API checks each user's Supabase bearer token and scopes every admin DB request to their user ID.
- Embed keys use cryptographically random 32-byte material and HMAC-SHA256 at rest; revoked keys immediately fail, with no-store response headers.
- Raw tables explicitly revoke `anon` and `authenticated` Data API grants and have RLS enabled. The API server accesses them using the protected service role.
- Allowed origins restrict **iframe embedding** through the browser-enforced CSP `frame-ancestors` directive. They do **not** make the read-only data private or stop direct JSON access with a copied publishable key.
- Only direct public HTTPS audio files are accepted (maximum 40 tracks/playlist). The browser loads the audio from its origin; audio providers' cross-origin/CDN policies and licenses still apply.
- Add Vercel Firewall/API rate limiting before opening public registration at scale. Built-in per-user resource quotas are not request-rate limiting.
- Production readiness also depends on applying the SQL schema and setting credentials; the source code alone does not make live authentication or API calls work.
