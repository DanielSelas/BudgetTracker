# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two people who share a household and its money: Daniel and his partner Ben Moyal.
Separate sign-ins, one shared dataset, two phones. Either may add a row, and a
change on one phone shows on the other immediately.

They are the real users today, but the product is built so that a couple who has
never met them can sign up and understand every screen on first run. No screen may
rely on knowing the two of them. There is a first-run walkthrough and an invite
flow, which exist for exactly that reason.

The confirmed usage scene: **the phone, several times a day, in the middle of
something else.** Not a desk, not a laptop, not a calm evening review. Often one
handed, often outdoors, often in daylight that washes out a screen. This is a
product fact and it binds contrast, hit-target size and information density.

## Product Purpose

A shared monthly budget built around the 50/30/20 rule. Income comes in, a base
amount is derived from it or set by hand, and the base is split into three
targets: fixed charges, variable spending, and deposits. The app answers, every
day, whether the month is going to hold.

Success is that both people know where the month stands without asking each other
and without opening a bank app.

**The first question on opening the month screen is "how much is left for me".**
One number, confirmed by the user as the thing they come for. Everything else on
that screen is secondary to it.

## Positioning

The mechanism a neighbouring budget app could not truthfully copy:

- **Entering an expense costs one sentence, from outside the app.** An iOS
  Shortcut or a double tap on the back of the phone: say "50 shufersal" and it
  lands in an inbox at the top of the month, waiting for one tap. The category is
  guessed from the merchant name through the same sector table the statement
  importer uses, and never from what this user classified before: history is empty
  for anyone who started yesterday, and it repeats every old mistake with growing
  confidence. Merchant knowledge belongs to the app, not to the user.
- **The billing cycle is the user's, not the calendar's.** A month opens on the
  2nd, the 10th or the 15th, and closes when the real cycle closes.
- **Trips and saving goals are a different shape of budget, not a preset.** Each
  keeps full detail of its own and rolls up into the household as a single locked
  summary row per month, so the same money is never counted twice.
- **The base amount is chosen, not derived from a good month.** Income above the
  base becomes a visible remainder with a prompt to deposit it, so a bonus does
  not quietly license more spending.

## Operating Context

- An installed PWA on the home screen. No app store, no native build. It opens and
  shows data offline, and writes sync when the connection returns.
- Hebrew and right to left throughout, phone width first. Hebrew text is the
  default reading direction of every screen, not a translation layer over an LTR
  design.
- Money is in shekels, formatted without agorot.
- Data lives in Firestore under a budget document, with security rules as the
  enforcement layer rather than the UI.
- Statements arrive as CSV or XLSX exports from an Israeli bank or credit company
  and are imported in place; they contain real account numbers and never enter the
  repository.

## Capabilities and Constraints

Confirmed functionality: several budgets per person; invite by eight-character
single-use code; recurring charges with an end date and a warning the month
before; a commitments screen listing every standing charge; statement import;
a dated timeline of what is about to be charged and the one figure that has to be
in the account; grouped rows, so a weekly grocery run collapses to one line; edit
in place; trips and saving goals; an end-of-month nudge on the billing date; one
profile name and colour per person across every budget.

Terminology, as it appears on screen and must stay:

| Key | On screen |
|---|---|
| `income` | הכנסות |
| `fixed` | קבועות |
| `leisure` | הוצאות משתנות, short: משתנות |
| `fund` | הפקדות |
| `unplanned` | יתרה, short: בלת״ם |

Technical constraints that bind design work:

- React 19 and Vite, hand-written CSS in `src/index.css` (tokens on `:root`) and
  `src/App.css`. No Tailwind, no component library, no CSS-in-JS. A token change
  reaches every screen at once.
- One typeface, Heebo, loaded for Hebrew.
- Around 430 unit tests and 129 security-rules tests must keep passing; some
  render tests exist specifically to catch a white screen.
- A service worker caches the app, so a visual change reaches a phone only after
  the worker updates.

## Brand Commitments

- The name is BudgetTracker. The icon is `docs/icon.png`.
- Interface copy is Hebrew. Code comments are Hebrew. Git commit messages are
  English only.
- No em dash anywhere, in interface copy or anywhere else.
- The visual system is "נייר ודיו" (Paper and Ink), recorded in DESIGN.md: an
  achromatic interface on paper, with colour reserved for category and for one
  ink-blue accent, and a dark scheme that follows the phone. It replaced a warm
  cream and terracotta system named "Organic" that the user found childish.

## Evidence on Hand

- A running production deployment with the two users' real data.
- `docs/screens/` holds captured screenshots of every screen, and `shots.html?s=<screen>`
  renders any screen with fixture data on the dev server.
- `docs/quick-capture.md` documents the capture path end to end.
- No testimonials, no customers, no press, no pricing, no benchmarks. None may be
  invented.

## Product Principles

1. **The number comes first.** "How much is left" is the reason the screen opens.
   Anything that competes with it for attention is a cost.
2. **Entering an expense must cost almost nothing.** The whole capture path exists
   because people are lazy about data entry, and a budget nobody feeds is worthless.
3. **The app owns merchant knowledge; the user owns their money.** Classification
   comes from a shared table, never from mining this user's past corrections.
4. **Daylight, one hand, five seconds.** Legibility in the real scene outranks
   atmosphere.
5. **A stranger must be able to start.** The two current users are not an excuse
   for a screen that only they can read.

## Accessibility & Inclusion

- WCAG AA contrast (4.5:1 body, 3:1 large text) is a product requirement here, not
  a nicety: the confirmed scene is a phone in daylight. The current palette fails
  it in 25 places and that counts as a defect.
- Right to left is the primary direction. Logical CSS properties, never left/right.
- Touch targets sized for one-handed use on a phone.
- Motion must respect `prefers-reduced-motion`.
