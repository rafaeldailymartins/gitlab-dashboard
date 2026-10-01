# Browser matrix

## Covered automatically

Every CI acceptance run covers all three, on every scenario; a local run is chromium alone (`--project=webkit` when you want another):

| Project         | Engine | Playwright device | Viewport | Why it is here                                                                               |
| --------------- | ------ | ----------------- | -------- | -------------------------------------------------------------------------------------------- |
| `chromium`      | Blink  | Desktop Chrome    | 1280×720 | The engine most readers will use, and the one the dev tooling assumes                        |
| `webkit`        | WebKit | Desktop Safari    | 1280×720 | The engine that disagrees. Every timing and layout bug this suite found showed up here first |
| `mobile-chrome` | Blink  | Pixel 7           | 412×839  | Touch, a narrow viewport and a mobile user agent                                             |

The `use-every-screen.feature` outlines add a 375-pixel viewport on top of those,
because 375 is narrower than the Pixel 7 and is where the layout actually breaks.

WebKit is not decoration. It caught the axe run measuring an empty document
before a client-rendered app had painted, a `route.fulfill` that cannot serve a
302, and the navigation race where signing in returned before the router had
landed. Dropping it would have shipped all three.

## Checked by hand

| Browser                     | When                                 | Why it is not automated                                                                                               |
| --------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Safari on a real iPhone     | Before a release                     | Playwright's WebKit is not Safari: it lacks the real Safari's storage prompts and its treatment of a backgrounded tab |
| Firefox on the desktop      | Before a release                     | A third engine in CI costs more than it has ever caught here; the manual pass is the trade                            |
| Chrome with a screen reader | When the interface structure changes | `accessibility-audit.md` holds the procedure                                                                          |

## Not supported

- **Anything without `crypto.subtle`.** PKCE needs SHA-256 in the browser. That
  rules out plain-HTTP origins, which is fine: the app is served over HTTPS.
- **Anything without IndexedDB.** The app still works — the cache degrades to
  nothing and every visit is a cold one — but the paint-from-cache promise does
  not hold.
- **Internet Explorer, and any browser without ES2023.** The build targets
  ES2023 and does not ship polyfills.
