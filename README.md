# @recode-software/cookidoo-api

Unofficial TypeScript client for the Cookidoo **custom recipes API**
("Utworzone przepisy" / "Created recipes"). Build Thermomix-actionable
recipes programmatically: copy a public recipe into your account, then PATCH
it with structured `MODE` buttons and `INGREDIENT` chips that render natively
on TM7 / TM6.

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
import { CookidooClient, parseStep, mode, ingredient, step } from "@recode-software/cookidoo-api";

const client = new CookidooClient({
  email: process.env.COOKIDOO_EMAIL!,
  password: process.env.COOKIDOO_PASSWORD!,
  country: "pl",    // tmmobile subdomain
  language: "pl",   // URL path segment
});

// 1. Copy a public recipe into your account
const recipe = await client.recipes.copyFromPublic({
  publicId: "01KB04WSJP4SHNBKJK4H4FT0PZ",
  servingSize: 1,
});

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

// 3. PATCH instructions with MODE + INGREDIENT annotations.
//    `parseStep` autodetects "praż", "Varoma", "obr. X", "wsteczne" …
const stepA = parseStep(
  "Do naczynia włóż jabłko, praż 10 min/100°C/obr. 1. Przełóż.",
  [{ display: "50 g jabłka", stem: "jabłk", amount: 50, unit: "g" }],
);

// Build a step manually if the parser doesn't recognize your phrasing
const stepB = step("Ubij 3 min/obr. 3,5.", [
  mode.manual({ offset: 5, length: 14, time: 180, speed: "3.5" }),
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
| `baseUrl`  | `string`              | `https://{country}.tmmobile.vorwerk-digital.com`    |
| `fetch`    | typeof `fetch`        | global `fetch` (lets you inject for tests)          |

The client performs OAuth2 password grant lazily on first API call, caches
`access_token` + `refresh_token`, and refreshes once on a 401 response.

### `client.recipes`

| Method                         | Description                                   |
|--------------------------------|-----------------------------------------------|
| `list()`                       | List your custom recipes                      |
| `get(id)`                      | Fetch a recipe (full view, with annotations)  |
| `copyFromPublic({publicId, servingSize?, retry?})` | Copy a public recipe into your account |
| `patchMeta(id, meta)`          | Update name / ingredients / yield / times     |
| `patchInstructions(id, steps)` | Replace `instructions[]` with new `Step[]`    |
| `delete(id)`                   | Delete a custom recipe                        |

Always do **two PATCH calls** (meta + instructions) — sending both in one
request triggers `validationError`. This matches what the web UI does.

### Builders (`@recode-software/cookidoo-api/builders`)

Type-safe constructors for MODE / INGREDIENT annotations. Each takes the
`{offset, length}` of the substring in the step text to pin the chip/button.

```ts
import { mode, ingredient, step } from "@recode-software/cookidoo-api/builders";

mode.manual({ offset, length, time: 20, speed: "5" });            // ⚠ unsupported on custom recipes
mode.browning({ offset, length, time: 600, temperature: 140 });   // 140|145|150|155|160
mode.blend({ offset, length, time: 30, speed: "7" });             // 6|6.5|7|7.5|8
mode.steaming({ offset, length, time: 900, speed: "1" });         // accessory: Varoma (no temperature field)
mode.warmUp({ offset, length, temperature: 70, speed: "1" });     // soft|1|2
mode.turbo({ offset, length, time: 2, pulseCount: 1 });
mode.dough({ offset, length, time: 120 });
mode.riceCooker({ offset, length });

ingredient.simple({ offset, length, description: "50 g jabłka" });
ingredient.structured({
  offset, length,
  description: "50 g jabłka",
  amount: 50, unit: "g",
});
```

### Parser (`@recode-software/cookidoo-api/parser`)

Polish step-text parser (the only verified grammar). Detects:

- `N min/M°C/obr. X` → `MODE manual` with temperature
- `N min/Varoma/obr. X` → `MODE steaming`
- `praż N min/M°C/obr. X` → `MODE browning` (temperature clamped to 140–160 °C)
- `N min/obr. X` → `MODE manual` (no temperature)
- `wsteczne` suffix → `direction: "CCW"`
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

- **`name: "manual"` is silently unsupported on custom recipes.** The API
  saves it, but the Cookidoo web/TM7 UI renders the chip struck-through with
  `unsupported=true`. `parseStep` / `findModeAnnotations` therefore skip
  `manual`-producing patterns by default (use `{ emitManual: true }` only if
  you're generating data for a non-custom-recipe context). For step text
  like `20 s/obr. 5` that has no specific Tryb, leave it as plain text —
  users will type the values on the machine.
- **`steaming` has NO `temperature` field.** Only `time`, `speed`,
  `direction`, and `accessory`. Sending `temperature` returns
  `400 validationError`. The builder and parser both reflect this.
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
    // 401 on token endpoint
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
