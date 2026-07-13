# Changelog

## 0.2.0

Two fixes that make the package functional again against the current Cookidoo
API. **Breaking** — auth and the default annotation type changed.

### Fixed

- **Login rewritten to the browser OAuth2/PKCE flow.** The old
  `grant_type=password` token request against
  `*.tmmobile.vorwerk-digital.com` now returns `unauthorized_client` (Vorwerk
  disabled that grant), so v0.1.x could not log in at all. The client now
  drives the same redirect chain as the web app: GET the login page, POST
  credentials to the CIAM login service, and authenticate subsequent requests
  with the session cookies (`_oauth2_proxy`, `v-authenticated`). Host default
  is now `https://cookidoo.{country}`.
- **Generic operations emit `TTS`, not `MODE`/`name:"manual"`.** The old
  `MODE manual` encoding is saved but rendered struck-through and untappable
  on custom recipes. `parseStep` and the new `findTtsAnnotations` now emit
  `TTS` (time/temperature/speed) annotations — verified accepted and rendered
  as tappable buttons against a live account.
- `RecipesApi.list()` now reads the real `{ items: [...] }` response shape
  (previously returned `[]`).

### Added

- `tts` builder and `findTtsAnnotations` parser; `TtsAnnotation` / `TtsData`
  types.
- `RecipesApi.create(name)` — create a blank recipe via `POST { recipeName }`;
  not rate-limited and works for sources that can't be copied.
- `parseDurationToSeconds` — sums compound durations like `"5 min 30 s"` (330).
- `browserLogin`, `extractRequestId`, `CIAM_LOGIN_SRV_URL`,
  `REQUIRED_AUTH_COOKIES` exports; `client.isLoggedIn()`.

### Removed / deprecated

- **Removed** `loginWithPassword`, `refreshToken`, `TokenSet`,
  `client.getTokens()` (bearer-token auth no longer exists).
- **Deprecated** `mode.*` builder and `findModeAnnotations` — still exported
  for concrete named modes, but prefer `tts` / `findTtsAnnotations`.

### Dependencies

- Added `fetch-cookie` and `tough-cookie` for cookie-jar session handling.
