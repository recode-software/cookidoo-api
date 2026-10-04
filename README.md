# @recode-software/cookidoo-api

Unofficial TypeScript client for the Cookidoo **custom recipes API**
("Utworzone przepisy" / "Created recipes"). Build Thermomix-actionable
recipes programmatically: create (or copy) a recipe in your account, then PATCH
it with tappable `TTS` (time/temp/speed) buttons and `INGREDIENT` chips that
render natively on TM7 / TM6.

This is a ground-up rewrite in TypeScript — not a port of
[miaucl/cookidoo-api](https://github.com/miaucl/cookidoo-api). It fixes the
`recipeUrl` bug in that library's `add_custom_recipe_from` (which points at
`/recipes/recipe/{lang}/{id}` and 404s on community-authored recipes) by
always using the documented `cookidoo.{cc}/created-recipes/public/recipes/{lang}/{id}`
form.

> **Status:** unofficial, reverse-engineered. Vorwerk can change the API at
> any time. Use for your own account — don't hammer the service.

## Install

```sh
npm i @recode-software/cookidoo-api
```

Requires **Node 20+** (uses global `fetch`).

## Quick start

```ts
import { CookidooClient, parseStep, tts, ingredient, step } from "@recode-software/cookidoo-api";

const client = new CookidooClient({
  email: process.env.COOKIDOO_EMAIL!,
  password: process.env.COOKIDOO_PASSWORD!,
  country: "pl",    // host = https://cookidoo.pl
  language: "pl",   // URL path segment
});

// 1. Create a new blank recipe (or copyFromPublic an existing one)
const recipe = await client.recipes.create("T1 D1 Śniadanie · Gofry cynamonowe");

// 2. PATCH meta (name, ingredients, yield, times)
await client.recipes.patchMeta(recipe.recipeId, {
  name: "T1 D1 Śniadanie · Gofry cynamonowe",
  ingredients: [
    { type: "INGREDIENT", text: "50 g jabłka" },
    { type: "INGREDIENT", text: "5 g masła ekstra" },
  ],
  yield: { value: 1, unitText: "portion" },
  prepTime: 1800,
  totalTime: 1800,
});

// 3. PATCH instructions with TTS + INGREDIENT annotations.
//    `parseStep` autodetects "5 min/120°C/obr. 1", "obr. wsteczne", "Varoma" …
const stepA = parseStep(
  "Do naczynia włóż jabłko, praż 10 min/100°C/obr. 1. Przełóż.",
  [{ display: "50 g jabłka", stem: "jabłk", amount: 50, unit: "g" }],
);

// Build a step manually if the parser doesn't recognize your phrasing
const stepB = step("Ubij 3 min/obr. 3,5.", [
  tts({ offset: 5, length: 14, time: 180, speed: "3.5" }),
]);

await client.recipes.patchInstructions(recipe.recipeId, [stepA, stepB]);
```

## API

### `new CookidooClient(options)`

| Option     | Type                  | Default                                             |
|------------|-----------------------|-----------------------------------------------------|
| `email`    | `string`              | —                                                   |
| `password` | `string`              | —                                                   |
| `country`  | `string`              | —                                                   |
| `language` | `string`              | `country`                                           |
| `baseUrl`  | `string`              | `https://cookidoo.{country}`                        |
| `fetch`    | typeof `fetch`        | global `fetch` (lets you inject for tests)          |

The client logs in lazily on first API call via the **browser OAuth2/PKCE
flow** (GET login page → POST credentials to the CIAM login service), then
authenticates every request with the session cookies (`_oauth2_proxy`,
`v-authenticated`) held in an internal jar — there is no bearer token to
manage. On a `401` it re-authenticates once and retries. Some markets use a
multi-label TLD (e.g. UK → `cookidoo.co.uk`); pass `baseUrl` to override host
derivation.

### `client.recipes`

| Method                         | Description                                   |
|--------------------------------|-----------------------------------------------|
| `list()`                       | List your custom recipes                      |
| `get(id)`                      | Fetch a recipe (full view, with annotations)  |
| `create(name)`                 | Create a new blank recipe (no rate limit)     |
| `copyFromPublic({publicId, servingSize?, retry?})` | Copy a public recipe into your account |
| `patchMeta(id, meta)`          | Update name / ingredients / yield / times     |
| `patchInstructions(id, steps)` | Replace `instructions[]` with new `Step[]`    |
| `delete(id)`                   | Delete a custom recipe                        |

Always do **two PATCH calls** (meta + instructions) — sending both in one
request triggers `validationError`. This matches what the web UI does.

### Builders (`@recode-software/cookidoo-api/builders`)

Type-safe constructors for annotations. Each takes the `{offset, length}` of
the substring in the step text to pin the chip/button.

```ts
import { tts, ingredient, step } from "@recode-software/cookidoo-api/builders";

// TTS — the tappable time/temperature/speed button. This is the correct
// encoding for a generic "5 min/120°C/obr. 1" operation.
tts({ offset, length, time: 300, temperature: 120, speed: "1" });
tts({ offset, length, time: 7, speed: "5" });                       // no temperature
tts({ offset, length, time: 10, speed: "1", direction: "CCW" });    // obr. wsteczne (reverse)

ingredient.simple({ offset, length, description: "50 g jabłka" });
ingredient.structured({
  offset, length,
  description: "50 g jabłka",
  amount: 50, unit: "g",
});
```

`direction` is emitted only for reverse rotation (`"CCW"`); clockwise omits it.
`temperature` is omitted when not provided.

> **Deprecated: `mode.*` / `MODE` annotations.** The `mode` builder and
> `findModeAnnotations` are still exported for callers targeting the concrete
> named modes, but the generic `MODE`/`name:"manual"` encoding renders
> struck-through and untappable on custom recipes. Prefer `tts` /
> `findTtsAnnotations` (the default in `parseStep`).

### Parser (`@recode-software/cookidoo-api/parser`)

Polish step-text parser (the only verified grammar). `parseStep` emits `TTS`
operation buttons + `INGREDIENT` chips. Detects:

- `N min/M°C/obr. X` → `TTS` with temperature
- `N min/obr. X` → `TTS` (no temperature)
- `N min M s/…` → `TTS` with compound duration summed to seconds
- `N min/Varoma/obr. X` → `TTS` (Varoma matched; no `temperature` field emitted)
- `obr. wsteczne X` → `direction: "CCW"`
- ranges (`4–6 min`) collapse to the first number
- ingredient stems in the step → `INGREDIENT` with nested `VOLUME` annotation

```ts
import { parseStep } from "@recode-software/cookidoo-api/parser";

const s = parseStep("praż 10 min/100°C/obr. 1 jabłko", [
  { display: "50 g jabłka", stem: "jabłk", amount: 50, unit: "g" },
]);
```

Time conversion: `s`/`sek` → 1, `min` → 60, `h` → 3600. Ranges (`4–6 minut`)
collapse to the first number.

**`stem`** is a substring of the ingredient word that matches any inflected
form in the step text. Polish nouns decline ("jabłko", "jabłka", "jabłkiem"),
so the stem `"jabłk"` catches them all via `\bjabłk\w*`.

#### Other locales

The parser is grammar-driven. PL (`grammars.pl`) is the only built-in and the
only grammar verified against live Cookidoo payloads. To parse step text from
another market (e.g. DE), supply a custom `Grammar`:

```ts
import { parseStep, type Grammar } from "@recode-software/cookidoo-api";

const grammarDe: Grammar = {
  name: "de",
  timeUnits: { s: 1, sek: 1, min: 60, h: 3600, std: 3600 },
  timeUnitsPattern: "min|sek\\.?|std\\.?|s|h",
  speedLabel: "Stufe",
  reverseWord: "linkslauf|rückwärts",
  browningTrigger: "anbr(a|ä)t",
};

parseStep("Rühren 20 s/60°C/Stufe 2.", [], { grammar: grammarDe });
```

If you verify a grammar against a real account in your market, PRs welcome.

## Rate limits

Only `POST /created-recipes/{lang}` (copy-from-public) is throttled. After
~6–8 successful POSTs in a minute the endpoint returns `429 Too Many Requests`
with `code: "importFailed"`. There's no `Retry-After` header.

The library exposes `CookidooRateLimitError` and `copyFromPublic` has
**built-in backoff enabled by default** (30 → 60 → 90 → 120 seconds):

```ts
// Default backoff
await client.recipes.copyFromPublic({ publicId });

// Custom delays + progress callback
await client.recipes.copyFromPublic({
  publicId,
  retry: {
    delaysMs: [30_000, 60_000, 90_000],
    onRateLimit: ({ attempt, delayMs }) =>
      console.log(`rate limited, waiting ${delayMs}ms (attempt ${attempt})`),
  },
});

// Opt out
await client.recipes.copyFromPublic({ publicId, retry: false });
```

`PATCH /created-recipes/{lang}/{id}` is not rate-limited — you can hammer it.

## Known quirks

- **Use `TTS`, not `MODE`/`manual`, for generic operations.** A `MODE`
  annotation with `name: "manual"` is saved but rendered struck-through and
  untappable on custom recipes; the correct encoding for a plain
  "time/temp/speed" run is a `TTS` annotation (verified against a live
  account). `parseStep` emits `TTS` by default.
- **`mode.dough()` works on custom recipes (TM6, verified on `cookidoo.pl`).**
  Only `name: "manual"` is unsupported. A dough-mode chip saved by the Cookidoo
  editor is `{ type: "MODE", name: "dough", data: { time: 180 } }`. Note that
  `mode.dough()` returns just the annotation: you must put the chip's label
  into the step text yourself and pass its `offset`/`length` (the editor
  inserts the Polish UI label, e.g. `Ciasto /3 min`; labels in other locales
  are unverified).
- **Varoma via `TTS` carries no `temperature`.** `parseStep` matches a
  `Varoma` step so the time/speed button still renders, but does not emit a
  `temperature` field (the exact Varoma-on-custom-recipe encoding is
  unverified). Steaming as a dedicated mode is out of scope.
- **Custom Lists and custom recipes don't mix.** `POST /organize/{lang}/api/custom-list/{id}`
  returns a fake `200 OK` when you try to add a custom recipe — the list
  stays empty. Use name prefixing (`T1 D1 Śniadanie · …`) or attach to the
  calendar via `POST /planning/{lang}/api/my-day` instead.
- **`tools` is read-only.** The server populates it based on which TM
  generations support your step modes.
- **`totalTime`/`prepTime` are seconds** on PATCH. The Schema.org GET view
  may return them as ISO-8601 durations (`"PT30M"`).

## Errors

```ts
import {
  CookidooError,
  CookidooAuthError,
  CookidooRateLimitError,
} from "@recode-software/cookidoo-api";

try {
  await client.recipes.copyFromPublic({ publicId });
} catch (err) {
  if (err instanceof CookidooRateLimitError) {
    // 429 — copy endpoint throttled
  } else if (err instanceof CookidooAuthError) {
    // login failed — bad credentials or auth cookies not set
  } else if (err instanceof CookidooError) {
    console.error(err.status, err.body);
  }
}
```

## Development

```sh
npm install
npm run typecheck
npm test                  # unit tests, no network
npm run test:integration  # real API — requires .env (see .env.example)
npm run build
```

Integration tests read credentials from `.env` (or `../.env`). They create
recipes with a `__test__` prefix and delete them in `afterEach`; an
`afterAll` sweep removes any leftovers. Required variables:

```
COOKIDOO_EMAIL=
COOKIDOO_PASSWORD=
COOKIDOO_COUNTRY=pl
COOKIDOO_LANGUAGE=pl
COOKIDOO_TEST_PUBLIC_RECIPE_ID=01KB04WSJP4SHNBKJK4H4FT0PZ   # optional
```

## Credits

Thanks to [miaucl/cookidoo-api](https://github.com/miaucl/cookidoo-api)
(Python) for paving the way.

## License

MIT
