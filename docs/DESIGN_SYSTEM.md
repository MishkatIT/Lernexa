# DESIGN_SYSTEM.md — Lernexa

Merges branding, design tokens, component rules, and screen specs. One document, because
splitting design intent across two files guarantees they drift.

## The anti-brief

What we are **not** building, because it is what AI-generated UI looks like:

- Purple/indigo gradients, glassmorphism, blurred blobs
- A hero section with a giant centred headline and two CTAs
- A dashboard that is a 2×4 grid of stat cards with icons in tinted circles
- Rounded-2xl cards with shadows on everything
- Decorative illustrations that carry no information
- Framer-motion entrance animations on page load
- Inter

Every visual decision below has a stated reason. If the implementation proposes something not
justified here, that's the signal to push back.

## Brand

**Lernexa** — from *learn* + *nexus*. Positioning: **progress, not catalogue.**
Competitors lead with a course grid. Lernexa leads with where you are.

### Mark
A square containing **three stacked horizontal bars**: the top two filled, the bottom
one outlined. Literally 2-of-3 complete — the logo *is* a progress indicator.

- Reduces cleanly to a 16px favicon (three bars remain legible)
- Monochrome-safe, works on ink or paper
- ~15 minutes of hand-written SVG. Not a Lucide icon in a coloured circle.

### Wordmark
"Lernexa" in IBM Plex Sans SemiBold, tracking `-0.02em`. Mark to the left, gap = half
the mark's height. Lockup for the header; mark alone for the favicon and app icon.

### Assets (Next.js file conventions)
```
frontend/src/app/
  icon.svg              → favicon, auto-wired
  apple-icon.png        → 180×180
  opengraph-image.tsx   → generated via ImageResponse
frontend/public/
  logo-mark.svg
  logo-lockup.svg
```
Using Next's file conventions rather than manual `<link>` tags is itself a small
"knows the framework" signal.

### Metadata
Root layout: `title.template = '%s · Lernexa'`, `title.default = 'Lernexa'`, a real
description, and OG tags. Every page sets its own title. A browser tab reading
"Create Next App" is a visible tell.

## Colour

Three families. That's all.

```css
/* Ink — text, borders, surfaces. Slightly blue-black, never pure #000. */
--ink-900: #14161A;   /* body text, headings */
--ink-700: #3A3F47;   /* secondary text */
--ink-500: #6B7280;   /* tertiary, meta */
--ink-200: #D8D6D1;   /* borders */
--ink-100: #ECEAE5;   /* hover surfaces */

/* Paper — warm off-white. Not #FFF. Reduces glare in long-form reading. */
--paper:     #FAF8F4;
--paper-raised: #FFFFFF;   /* cards lift by being *whiter*, not by shadow */

/* Marigold — the single accent. Actions, focus, brand. */
--accent-600: #C9821A;
--accent-500: #E09A28;
--accent-100: #FBEFD9;
```

Semantic, used **only** for state:
```css
--success: #2F7D4F;   /* completion. NEVER used for branding. */
--warning: #B3801A;
--danger:  #A3352C;
```

### Two rules that make this coherent
1. **Green means completed. Nothing else.** Not "primary", not "success toast on save".
   Because completion is the product, its colour must be unambiguous everywhere.
2. **The accent is never green.** So the eye learns instantly: marigold = do something,
   green = done.

**No dark mode.** Deliberate: a half-finished dark mode looks worse than none, and the
paper-warm palette is the identity. Say this if asked — it's a decision, not an omission.

## Typography

**IBM Plex superfamily. One family, three jobs.**

| Face | Used for | Why |
|---|---|---|
| Plex Sans | UI, navigation, tables, buttons | Distinctive without being decorative. Not Inter. |
| **Plex Serif** | **lesson body content, blog post body** | Long-form reading deserves a serif. Almost nobody does this — it immediately signals a considered decision. |
| Plex Mono | IDs, timestamps, audit metadata, code | Tabular figures align in tables. |

Load via `next/font/google` with `display: 'swap'` and subset to latin.

### Scale (1.25 ratio, rounded)
```
display  32/40  600    page titles
h1       24/32  600
h2       20/28  600
h3       16/24  600
body     15/24  400    UI default
reading  18/30  400    Plex Serif — lesson & blog body only
small    13/20  400    meta, captions
mono     13/20  400
```

**Measure:** lesson and blog body clamp to `68ch`. Full-width reading text is the most
common self-inflicted readability failure.

## Spacing, radius, elevation

- **4px base.** Only 4, 8, 12, 16, 24, 32, 48, 64. No arbitrary values.
- **Radius: 4px on everything.** One value. Buttons, inputs, cards. Not `rounded-2xl`.
  Restrained radius reads as considered; heavy radius reads as template.
- **Elevation: borders, not shadows.** Cards are `--paper-raised` with a
  `1px solid --ink-200` border. Exactly one shadow exists in the system, for modals and
  dropdowns. Shadows on static cards are the AI-dashboard tell.

## The progress primitive

Progress is the product, so it gets a real component family — three scales, one visual
language.

| Variant | Where | Form |
|---|---|---|
| `ProgressBar` | course lists, My Courses | 4px track, ink-100 bg, `--success` fill, `%` label right |
| `ProgressRing` | dashboard resume card | 48px SVG ring, number centred |
| **`ProgressTrack`** | **lesson viewer** | **one segment per lesson**, filled = complete, ring = current |

`ProgressTrack` is the distinctive one. It's honest to the data model — it shows
*which* lessons, not just a percentage — and it doubles as navigation. This is the
screenshot that makes the project look designed rather than assembled.

All three take `{ completed, total }` and derive the percentage. Never a `percent` prop:
the component shouldn't be able to display a number the data doesn't support.

## Components

Build these and only these. Tailwind + hand-written components; a UI kit is optional
but if used, restyle to these tokens rather than shipping its defaults.

| Component | Rules |
|---|---|
| `Button` | Variants: primary (marigold), secondary (ink border), ghost, danger. One size + `sm`. Loading state disables and swaps the label — never a spinner beside live text. |
| `Input` / `Select` / `Textarea` | 1px ink-200 border, 2px marigold focus ring, error text below in `--danger`. Label always visible — no placeholder-as-label. |
| `Card` | paper-raised + border. No shadow. |
| `Table` | Header in `--ink-500` small caps. Zebra via `--paper`. Mono for ids/dates. Row actions right-aligned. Horizontal scroll on mobile, never a card-stack fallback (breaks scanning). |
| `Badge` | Role badges: ink outline, not coloured pills. Status badges use semantic colour. |
| `Modal` | Only for destructive confirmation. Requires typing nothing — but the confirm button is `danger` and states the consequence: "Block Sara Ahmed" not "Confirm". |
| `Toast` | Bottom-right, 4s, one at a time. Success is neutral ink, not green — green is reserved. |
| `Alert` | Inline, bordered-left 3px in semantic colour. Used for banner + form-level errors. |
| `EmptyState` | Icon-free. A sentence explaining what would be here + the primary action. Never "No data found." |
| `Skeleton` | Matches the real layout's dimensions. Prevents layout shift. |

### Required states for every data surface
loading · empty · error · **forbidden** · not-found · success

The **forbidden** state is the one people skip. `/forbidden` should say *which role is
required and which role you have* — that's honest, it's good UX, and it demonstrates
that you thought about the case rather than letting a blank page render.

## Layout

- **Public/student:** top nav, centred content, max `1200px`
- **Manage/admin:** fixed left sidebar 240px, content fluid with 24px gutters
- **Lesson viewer:** two-column — 280px `ProgressTrack` sidebar + `68ch` reading column.
  Sidebar collapses to a horizontal track above the content on mobile.
- **Breakpoints:** `sm 640 / md 768 / lg 1024 / xl 1280`. Sidebar becomes a drawer below `lg`.

## Role-differentiated dashboards

**The difference is the query, not the CSS.** Shared components, four different
questions. This is cheap to build and reads as real product thinking.

| Role | Question it answers | Content |
|---|---|---|
| **Student** | *What do I learn next?* | One **resume card** — course, next lesson title, `ProgressRing`, one button. Below: My Courses with bars. Then recent quiz scores. **Discovery is a separate page**, not on the dashboard. |
| **Instructor** | *Which students are stuck?* | **Exceptions, not totals.** Students at 0% after 7 days. Courses with completion below 30%. Then a course list with enrolled counts. |
| **Content Manager** | *What content needs work?* | A **worklist**: courses with no lessons, courses with no quiz, drafts older than 7 days. Each row links straight to the fix. |
| **Admin** | *What needs my attention?* | Compact stats strip (one row, no card grid) + **attention queue**: recently blocked users, recent role changes from the audit log. |

None is a grid of stat cards. That's the point.

## The six screens that matter

Specified properly. Everything else follows the component rules above.

### 1. Lesson viewer — *the signature screen*
- **Purpose:** read/watch one lesson and move forward
- **Primary action:** Mark complete → auto-advance to next
- **Hierarchy:** `ProgressTrack` sidebar → lesson title → body (Plex Serif, 68ch) → prev/next
- **States:** completed (button becomes "Completed ✓ / Undo"); last lesson (next becomes "Take the quiz" if one exists, else "Back to course")
- **Mobile:** track collapses above content; prev/next become a sticky bottom bar
- **Detail worth building:** optimistic mark-complete with rollback on failure

### 2. Student dashboard
- **Purpose:** resume in one click
- **Primary action:** Continue
- **Empty state:** never enrolled → "You haven't enrolled in anything yet" + Browse courses
- **Edge:** enrolled but 0 lessons in the course → resume card shows "This course has no lessons yet"

### 3. Quiz taking + results
- One question per screen, `ProgressTrack`-style pips for question position
- Cannot submit with unanswered questions — inline error, not a disabled button with no explanation
- **Results:** score, then per-question review showing your answer and the correct one
- **Only after submission does correctness exist client-side.** Say this in the video.
- Past attempts listed with date + score

### 4. Instructor student-progress table
- Columns: student · enrolled · progress bar · lessons done · last activity · quiz score
- Sortable by progress; default sort **ascending** — the stuck students surface first
- Empty: "No students enrolled yet"
- **This screen is backed by the 2-query batched service.** Mention that on camera.

### 5. Admin users
- Search by name/email, filter by role and status, paginated (20)
- Row: name · email · role badge · status badge · actions
- Role change: inline select → confirm modal naming the change
- Block: modal requiring a reason (stored in `blockedReason`, shown to the user)
- **Self and last-admin rows have those actions disabled AND backend-guarded.** The
  disabled button is UX; the 400 is the rule.

### 6. Public course detail
- Title, instructor, description, lesson list (titles only, locked)
- Primary action: Enroll → becomes "Continue" once enrolled
- Logged out: Enroll → login with a return URL
- Already enrolled: shows current progress instead of the enroll button

## Global banner (Tier 3)

Rendered in the root layout above the header when `bannerEnabled`.

- Full-width, 3px left border in severity colour, ink text on a tinted background
- Optional link renders as a text link, not a button — it's an announcement, not a CTA
- **Dismissal in a cookie keyed by settings `updatedAt`**, not localStorage. A cookie is
  readable during SSR, so a dismissed banner never flashes on load. A new banner
  reappears because the key changed.
- Mobile: wraps to two lines, dismiss stays right-aligned and tappable at 44px

## Accessibility floor

Not comprehensive — a floor, achievable in the time, and visible to a reviewer who tabs
through:

- Visible 2px focus ring on every interactive element (do not remove the outline)
- Real `<label>` on every input
- `ProgressBar` carries `role="progressbar"` + `aria-valuenow`
- Modals trap focus and close on Escape
- Ink-on-paper body text passes AA
- Quiz options are real radio inputs, keyboard-navigable

## Ten-second self-check

Before shipping a screen, ask: *does this look like every AI dashboard?* If it has a
gradient, a blurred blob, or a grid of icon-in-circle stat cards — it does. Remove
until each element has a reason.
