---
name: BudgetTracker
description: A shared household budget for two phones, in Hebrew and right to left.
colors:
  paper: "#ffffff"
  page: "#f4f4f2"
  ink: "#121211"
  ink-blue: "#1d3f9b"
  ledger-green: "#1f6447"
  danger: "#a52222"
  stone-200: "#f0f0ee"
  stone-300: "#e0e0dc"
  stone-400: "#c2c2bc"
  stone-500: "#7a7a73"
  stone-600: "#63635b"
  stone-700: "#4e4e48"
  stone-800: "#33332e"
  stone-900: "#1f1f1c"
  cat-income: "#277754"
  cat-fixed: "#5a6a86"
  cat-leisure: "#a8475a"
  cat-fund: "#6b53a8"
  cat-unplanned: "#8a6b1f"
  sec-food-1: "#845922"
  sec-food-2: "#ac7f49"
  sec-food-3: "#c99b65"
  sec-move-1: "#386695"
  sec-move-2: "#5e8dbe"
  sec-move-3: "#79a9db"
  sec-body-1: "#945262"
  sec-body-2: "#ce8797"
  sec-life-1: "#3f774d"
  sec-life-2: "#75ae81"
  sec-play-1: "#9777af"
  dark-page: "#111214"
  dark-paper: "#1b1c1e"
  dark-ink: "#f3f6f8"
  dark-ink-blue: "#8fb0ef"
  dark-hairline: "#303338"
  dark-muted: "#a3a9b0"
typography:
  display:
    fontFamily: "IBM Plex Sans, Heebo, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-1.6px"
  headline:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: "-0.4px"
  title:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: "-0.4px"
  body:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  numeric:
    fontFamily: "IBM Plex Sans, Heebo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    fontFeature: "tnum"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.85em"
    fontWeight: 400
rounded:
  card: "14px"
  inner: "10px"
  pill: "8px"
  circle: "50%"
spacing:
  screen: "20px"
  card: "20px"
  stack: "18px"
components:
  button-primary:
    backgroundColor: "{colors.stone-900}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "54px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.stone-800}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.stone-800}"
    padding: "6px 2px"
    height: "32px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.inner}"
    padding: "22px 20px"
  chip-category:
    backgroundColor: "transparent"
    textColor: "{colors.stone-700}"
    rounded: "{rounded.pill}"
    padding: "9px 6px"
    height: "40px"
  chip-category-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  chip-group:
    backgroundColor: "{colors.stone-200}"
    textColor: "{colors.stone-700}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    height: "34px"
  chip-group-selected:
    backgroundColor: "{colors.stone-900}"
    textColor: "{colors.paper}"
  fab:
    backgroundColor: "{colors.stone-900}"
    textColor: "{colors.paper}"
    rounded: "18px"
    size: "58px"
  nav-bottom:
    backgroundColor: "{colors.stone-200}"
    textColor: "{colors.stone-700}"
    rounded: "{rounded.pill}"
    padding: "4px"
  sheet:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "14px 14px 0 0"
    padding: "12px 20px 30px"
---

# Design System: BudgetTracker

## Overview

**Creative North Star: "נייר ודיו" (Paper and Ink)**

A measuring instrument, not a lifestyle app. The screen opens so that someone
standing in a shop, one handed, in daylight, can read one number and put the
phone away. Everything here is in service of that five-second reading.

Paper means a real surface: a white card on a light page, with enough tonal step
to be seen (1.1:1) and a hairline that draws the edge. Ink means that the
interface itself is achromatic. The only colour on a screen is information:
five category hues at matched weight, and a single ink blue reserved for
interaction. Nothing is coloured because colour would be nice there.

The system replaces "Organic", a warm cream and terracotta world that read as
childish. Three traits carried that reading and all three are gone: 28px corners
on a 335px card, a cream page where no surface could separate from another, and
`font-weight: 700` on everything from a 32px heading to a 13px chip. Corners are
now 14px and 8px, the page is near-neutral, and weight is a three-step scale that
means something. The discipline that was already right carried over unchanged:
category colour in three places only, tabular figures everywhere, one Hebrew
typeface, logical properties throughout.

**Key Characteristics:**

- White cards on a near-neutral page, separated by a hairline rather than a shadow
- An achromatic interface; colour is reserved for category and for one accent
- 14px cards, 8px controls, and the only circle left is an avatar
- Three weights that mean something: 400 body, 500 chip, 600 heading
- Numerals in their own typeface, tabular, so money reads as measurement
- One palette file drives both light and dark; the neutral ramp inverts, it does
  not swap
- Right to left throughout, phone first, AA contrast as a product requirement

## Colors

Ink on paper, and five hues that are the only colour in the room.

### Primary
- **Ink Blue** (`#1d3f9b`, dark `#8fb0ef`): the single accent, with exactly one
  job: interaction. Links, the focus ring, the billing range under the month
  name, the shared-budget badge, text selection. It is deliberately outside the
  category set, and the one category nearest it in hue, `cat-fixed`, is
  desaturated so the two never compete.

### Secondary
- **Ledger Green** (`#1f6447`, dark `#6cbd95`): "good". A target reached, a
  deposit, income. Never decorative.

### Neutral
- **Paper** (`#ffffff`, dark `#1b1c1e`): every card. `--color-neutral-100`.
- **Page** (`#f4f4f2`, dark `#111214`): the page, and the ground of a bottom
  sheet so a sheet reads as the page rising.
- **Stone 200** (`#f0f0ee`, dark `#24262a`): group chips at rest, the navigation
  bar, the empty track of a progress bar.
- **Stone 300** (`#e0e0dc`, dark `#303338`): the hairline. This is the colour
  that draws every card edge.
- **Stone 500** (`#7a7a73`, dark `#7b8188`): placeholders and the fallback dot.
- **Stone 600** (`#63635b`, dark `#a3a9b0`): all secondary text and captions.
  5.5:1 on the page and 6.1:1 on a card. The previous system used `#82796a` here
  at 3.6:1, failing AA in 25 places.
- **Stone 900** (`#1f1f1c`, dark `#f3f6f8`): primary buttons, the FAB, the
  selected group chip. The system's "ink".
- **Ink** (`#121211`, dark `#f3f6f8`): body text, 17:1 on the page.

### Category
Five hues at matched visual weight, every one of them passing AA as text and not
only as a dot: income `#277754`, fixed `#5a6a86`, variable `#a8475a`, deposits
`#6b53a8`, remainder `#8a6b1f`. In dark they lighten to
`#6cbd95 · #9aa8c4 · #e58fa0 · #b49bf0 · #d9b85c`, all above 7:1.

Fixed charges are deliberately the least saturated of the five. They are half the
budget and the thing nobody chooses; the hues go to the money you can still
influence.

### Sector
A second, separate set, used on one surface only: the breakdown of a past month.
Eleven sectors are not eleven hues, because eleven colours at one lightness
cannot be told apart by eye, and under colour blindness they collapse entirely.
So there are **five families**, one hue each, and the sectors inside a family
differ in lightness: food `#845922 · #ac7f49 · #c99b65`, transport
`#386695 · #5e8dbe · #79a9db`, clothing and grooming `#945262 · #ce8797`,
health and home `#3f774d · #75ae81`, leisure `#9777af`. A slice with no sector, which is a name
someone typed, takes a colour from the same eleven by a hash of that name, so
it is the same colour every month; when two would land on the same one, the
second moves to the next free colour, because two large slices in one hue are
exactly what the ring exists to prevent. Only "other" and the collapsed tail
are `--color-neutral-500`, a grey that does not pretend to be a sector.

Grouping is also the truer reading: eating out and the supermarket should look
related. The colour is fixed per sector and never derived from its rank, so the
same sector is the same colour in every month. Identity always sits in the list
under the ring, with a name and a figure, so colour supplements it and never
carries it alone.

### Named Rules
**The Three Places Rule.** A category colour appears in exactly three places: the
dot beside the category name, the progress bar, and the segment in the summary
bar. Never a background, never a tag, never body text. Carried over from the
previous system, which was right about this.

**The One Job Rule.** The accent means "you can act on this". If a thing is not
interactive, it is not ink blue.

**The Inverting Ramp Rule.** Dark mode redefines colour tokens and nothing else.
`--color-neutral-100` is always "the surface" and `--color-neutral-900` is always
"the ink", in both schemes, so a component written once is correct in both. The
one exception needing its own token is the active navigation segment, which is
lighter than its bar in light and darker in dark: `--nav-active`.

## Typography

**Hebrew:** Heebo (with `system-ui, sans-serif`), weights 300 to 700
**Numerals:** IBM Plex Sans (with `Heebo` as the fallback), weights 400 and 600
**Mono:** `ui-monospace, SFMono-Regular, Menlo, monospace`, for `<code>` and
invite codes only

**Character:** One Hebrew sans doing every job, and a second face that exists
only for figures. The old rule, one typeface, was argued from Hebrew: two faces
read as two languages on one screen. That argument does not reach digits, and
money is half of every screen here, so the figures get a face with the clarity of
an instrument. The shekel sign is not in the Plex subset and falls back to Heebo,
which is intended.

### Hierarchy
- **Display** (Plex, 600, 46px, 1.05, -1.6px): the month balance, and only that.
  The reason the screen opens.
- **Amount input** (Plex, 600, 52px, -1.8px): the number field in the entry
  sheet, centred. The largest type in the app.
- **Headline** (Heebo, 600, 32px, 1.14, -0.4px): screen titles, the month name.
- **Title** (Heebo, 600, 22px): sheet and card headings.
- **Body** (Heebo, 400, 15px, 1.55): row names and field text.
- **Chip** (Heebo, 500, 13 to 14px): chips, the navigation, tags, counts.
- **Label** (Heebo, 400, 13px, `stone-600`): captions above numbers, meta text.

### Named Rules
**The Three Weights Rule.** 400 is body, 500 is a chip or a tag, 600 is a
heading or an emphasised number. 700 does not appear anywhere. The previous
system set 700 on 40 rules, including 13px chips, so nothing read as emphasised
and small bold Hebrew turned into a black smudge.

**The Tabular Rule.** `font-variant-numeric: tabular-nums` on `:root` and again
on `.num`, which also carries the numeral face. An amount column never shifts
while a number is typed.

## Layout

A single column, phone first. `max-width: 480px` for a sheet,
`min(440px, 100% - 40px)` for the floating navigation, centred on wider screens.
There is no desktop layout: a wide window shows the phone column centred.

One horizontal measure, `--screen-pad: 20px`, matched by `--card-pad: 20px`, so
content aligns whether or not it sits in a card. An 18px stack gap inside a card.

Right to left throughout, with logical properties only. Heights use `100svh`, not
`100vh`, so the iOS address bar does not push content out of view, and the body
sets `overscroll-behavior-y: none` so a drag inside a sheet does not scroll the
page behind it. Two fixed elements float over the column: the add button at
`bottom: 92px + safe-area` and the navigation at `bottom: max(20px, safe-area)`.

## Elevation & Depth

Hairline first, shadow only for what genuinely floats. Every card carries a 1px
ring in `stone-300` and no shadow at all. Depth is reserved for the three things
that are above the page: the navigation, a sheet, a dialog.

### Shadow Vocabulary
- **Hairline** (`0 0 0 1px var(--color-neutral-300)`): every card at rest. A
  drawn edge, not a lift.
- **Floating** (hairline plus `0 4px 14px` at 7%; in dark `0 6px 20px` at 45%):
  the navigation bar.
- **Lifted** (hairline plus `0 18px 48px` at 18%; in dark `0 24px 60px` at 65%):
  sheets and dialogs over a scrim.

The scrim is `color-mix(in srgb, #000 55%, transparent)`, black in both schemes,
because a scrim darkens whatever is under it.

### Named Rules
**The Hairline Rule.** A card is drawn, not lifted. If something has a shadow, it
is because it is physically above the page and can be dismissed.

## Shapes

One tight form language. `--radius-card: 14px` on cards and the top of a sheet,
`--radius-inner` and `--radius-card-2: 10px` on nested panels and summary blocks,
`--radius-pill: 8px` on every button, chip and the navigation bar. The add button
is a 58px square with an 18px radius. The only true circles left are the avatar
and the month arrows, where a circle is the shape of the thing itself.

Borders beyond the hairline are rare: the divider between rows
(`color-mix(in srgb, #121211 12%, transparent)`), a dashed outline on the "new
budget" affordance, and a 3px `border-inline-start` marking an unusual charge,
which is a state marker and the only side accent in the system.

## Components

### Buttons
- **Shape:** 8px.
- **Primary:** `stone-900` ground, paper text, 54px tall, `0 24px`, 16px/600.
- **Hover / Active:** ground steps to `stone-800`, then `stone-700`.
- **Text button:** no ground, `stone-800` text, 32px tall, 70% opacity on hover.
- **Focus:** a 2px ink blue outline at 2px offset, global through
  `:focus-visible`; plain `:focus` is suppressed.

### Chips
- **Category pill:** transparent with `stone-700` text at rest; selected takes a
  paper ground, ink text, the hairline, and reveals a 7px category dot that sits
  at 0 opacity when unselected. 40px tall, equal flex widths, weight 500.
- **Group chip:** `stone-200` ground, 34px tall; selected inverts to `stone-900`
  with paper text. Wraps to multiple rows.

### Cards / Containers
- **Corner:** 10px for summary and nested panels, 14px for large cards.
- **Background:** paper over the page.
- **Shadow:** the hairline, always; no hover elevation.
- **Padding:** 22px vertical, 20px horizontal, 18px internal stack.

### Inputs / Fields
- **Amount field:** borderless and transparent, Plex 52px/600, centred,
  `direction: rtl`, caret in `stone-900`, spinners removed. The hero of the entry
  sheet, not a field in a form.
- **Text field:** a labelled stack with a 6px gap.
- **Placeholder:** `stone-500`.

### Navigation
- **Bottom bar:** a floating 8px bar, `stone-200`, 4px padding, the floating
  shadow, fixed above the safe area. Three equal segments; the active one takes
  `--nav-active` plus the hairline, which is lighter than the bar in light and
  darker in dark, so "selected" always reads as the raised one.
- **Month header:** the month name as a 32px headline between two circular arrow
  buttons, the billing range beneath it in ink blue, and the budget name and
  sharing state below that in `stone-600`.

### Signature component: the summary card
A 13px caption, then the balance in Plex at 46px/600, then a segmented bar
carrying the category colours, then three equal columns of caption over number.
The three columns are explicitly not cards inside a card: they are data, not
surfaces, so they have no ground and no radius. The balance turns `danger` when
negative, and the base amount carries a dashed underline marking it editable.

## Do's and Don'ts

### Do:
- **Do** keep category colour to the dot, the progress bar and the summary
  segment.
- **Do** put every figure in `.num`, which carries both the numeral face and
  tabular figures.
- **Do** define colour only in `src/index.css`, in both the `:root` block and the
  `prefers-color-scheme: dark` block. A literal colour in `App.css` is a bug in
  dark mode by construction.
- **Do** use logical properties and never `left` or `right`.
- **Do** reach for the hairline to separate a surface, and a shadow only for
  something that floats and can be dismissed.
- **Do** keep touch targets at 54px for a primary action and no less than 34px
  for a chip.
- **Do** keep the balance the largest thing on the month screen.

### Don't:
- **Don't** use `font-weight: 700`. The scale is 400, 500, 600.
- **Don't** introduce a third accent. Ink blue is interaction, green is good.
- **Don't** put a category colour behind text or into a tag.
- **Don't** add a hover elevation to a card; the system has no hover-lift
  vocabulary.
- **Don't** return to a cream or beige page. It is what made the interface read
  as childish, and it is the one change that cannot be made per component.
- **Don't** hardcode a hex value in a component. Every colour is a token, because
  every colour has a dark counterpart.
