# AGENTS_DESIGN.md — Draw or Die Design System

**Authoritative UI/UX contract for all AI agents.** Read this file **before any change that touches the visual layer** (components, layouts, styles, copy, icons, motion, navigation, marketing pages). This is the single source of truth for visual decisions; do not invent new tokens, paddings, or color usages outside what is defined here.

> Source-of-truth artifacts (visual reference, do not edit, never ship to prod):
> - `docs/internal/Draw or Die Design System (1).html` — token/component/pattern catalog (DSGN spec)
> - `docs/internal/Draw or Die Redesign (1).html` — interactive screen reference (Header / Hero / Studio Desk / Profile)
>
> If the HTML reference and a live `.tsx` component disagree, the **HTML reference wins** unless this `.md` explicitly overrides it.

---

## 0. When to read this file

Read **AGENTS_DESIGN.md** before doing any of the following:

- Creating or modifying any file under `components/`, `app/**/page.tsx`, `app/layout.tsx`, `app/globals.css`.
- Adding a new screen / step / route to `StepRouter.tsx`.
- Adding new buttons, cards, chips, badges, modals, toasts, tooltips, empty states, error states, loading states.
- Touching navigation (Header, mobile menu, dropdowns).
- Adding marketing copy, CTA text, placeholder text, error messages.
- Picking colors, fonts, font weights, paddings, border radii, shadows, animations.
- Implementing tier gating UI (Free / Registered / Premium).
- Implementing Rapido cost indicators.

If you are only changing pure server logic, lib helpers, AI prompts, or non-visual config, you can skip this file.

---

## 1. Design Personality

**"High-stakes architectural blueprint."** Snappy, decisive, professional, never playful. Every visual decision should reinforce that the user is about to be judged by a serious jury.

- **Mood:** dark blueprint paper + neon red destructive energy.
- **Voice:** imperative, present tense, direct. (`Face the Jury`, not `Submit for analysis`.)
- **Forbidden:** rounded "fluffy" cards, gradient confetti, pastel buttons, drop shadows on text, springy/bouncy motion, emoji as primary iconography.

---

## 2. Color Tokens (THE ONLY palette)

Defined in `app/globals.css`. **Never introduce a new hex value.** If you need a tint, use `rgba(...)` of a token below.

### Background scale
| Token | Hex | Use |
|---|---|---|
| `--bg-0` (`bg-blueprint`) | `#0A0F1A` | Page base — always visible behind cards |
| `--bg-1` | `#0D1525` | Panels, sidebars, sticky CTA footer |
| `--bg-2` | `#101A2F` | Cards, inputs, raised surfaces |
| `--bg-3` | `#152034` | Active tab background, segmented-control selected |

### Accent + semantic (6 colors only)
| Token | Hex | Exclusive role |
|---|---|---|
| `--neon-red` | `#FF0033` | Brand, primary CTA, Rapido cost, focus ring, errors-as-emphasis |
| `--cyan` | `#22D3EE` | Information, AI auto-fill, processing state |
| `--amber` | `#F59E0B` | Premium / upgrade upsell only |
| `--green` | `#10B981` | Success, score, Hall of Fame |
| `--purple` | `#7C3AED` | Multi-Jury (multi-persona) mode only |
| `--sky` | `#0EA5E9` | Concept analysis action only |

### Text scale
| Token | Hex | Use |
|---|---|---|
| `--text` | `#E2E8F0` | Primary content |
| `--text-muted` | `#94A3B8` | Secondary text, labels |
| `--text-dim` | `#4A5568` | Disabled, placeholders, mono small caps |

### Borders
| Token | Value | Use |
|---|---|---|
| `--border` | `rgba(255,255,255,0.08)` | Default card / panel border |
| `--border-md` | `rgba(255,255,255,0.13)` | Hover / active border |
| `--border-lg` | `rgba(255,255,255,0.18)` | Strong divider, sticky footers |
| `--border-red` | `rgba(255,0,51,0.4)` | Focus state, active upload zone |

### Opacity rule
Instead of new colors, **use opacity variants of the 6 semantic colors**: `rgba(255,0,51,0.15)` for tinted red bg, `rgba(245,158,11,0.12)` for premium tinted bg, etc. This keeps the palette coherent.

---

## 3. Typography (3 typefaces, strict roles)

| Token | Font | Role | NEVER use for |
|---|---|---|---|
| `font-display` | Space Grotesk 700 | Headings (H1–H3), section titles, big numbers (stat cards) | Body, buttons, nav |
| `font-sans` (body) | Inter 400/500/600 | Paragraph copy, descriptions, form labels | CTAs, navigation, status chips, costs |
| `font-mono` | JetBrains Mono 400/500/700 | All UI labels: nav, button labels, cost badges, status chips, section divider headers, metadata | Body copy, descriptions |

### Weight + size scale
- H1 hero: `font-display`, `clamp(52px, 8vw, 96px)`, `font-weight: 700`, `letter-spacing: -0.02em`, `line-height: 1.02`, `text-transform: uppercase`.
- H2 section: `font-display`, `28px`, `700`, `uppercase`, `letter-spacing: 0.04em`.
- H3 card title: `font-display`, `16–18px`, `600`, `uppercase`, `letter-spacing: 0.04em`.
- Body: `font-sans`, `14–16px`, `400`, `line-height: 1.6–1.7`, sentence case.
- Form label: `font-sans`, `13px`, `600`, sentence case.
- Mono label / nav / CTA: `font-mono`, `10–12px`, `600–700`, `text-transform: uppercase`, `letter-spacing: 0.08–0.12em`.
- Metadata (costs, IDs, status, timestamps): `font-mono`, `9–11px`, `400–500`, often uppercase + tracking.

### Hard rules
- **Never use Inter for nav links, button labels, status chips, cost indicators.** Always JetBrains Mono.
- **Never ALL-CAPS body text.** ALL-CAPS only for: nav, CTAs, cost badges, section divider headers, status chips.
- **Never gradient text.** The only "neon" effect is `text-shadow: 0 0 20px rgba(255,0,51,0.5)` on `.neon-text`.

---

## 4. Spacing (8px base grid)

Allowed values: `4, 8, 12, 16, 20, 24, 32, 48, 64, 80, 100`. Anything else is wrong.

| px | Use |
|---|---|
| 4 | Tight gaps inside chips |
| 8 | Icon ↔ label gap, inline spacing |
| 12 | Form field gap, small grid gap |
| 14 | Field-to-field inside a section group |
| 16 | Card horizontal padding, section gap |
| 20 | Card padding, section group gap |
| 24 | Panel padding, header padding, main grid gap |
| 32 | Page horizontal padding, header padding |
| 48 | Section dividers, hero internal padding |
| 64 | Page-level vertical rhythm, **header height** |
| 80–100 | Hero padding-top |

### Layout constants
- **Header height:** `64px` fixed (currently `80px` in `Header.tsx` → must align to **64**).
- **Sticky right form panel:** `420px` fixed width on `xl+`.
- **Page max-width:** `1100–1440px` depending on screen; hero/marketing `900–1100px`.
- **Body padding-top:** equal to header height (`64px`).

---

## 5. Borders, Radius, Effects

### Radius scale
| Radius | Use |
|---|---|
| `0` | **Primary CTA only.** Sharp = decisive. |
| `4px` | Tertiary action buttons, multi-jury inline button, cost badges |
| `8px` | Inputs, secondary buttons, small cards |
| `10px` | Segmented control container, small panels |
| `12px` | Standard cards, sticky right panel inner cards |
| `16px` | Modals, hero feature cards |
| `99px` | Chips, pills, nav status chips, avatars |

### Glow + shadow
- **Red glow shadow** (`box-shadow: 0 0 24px rgba(255,0,51,0.35)`) is **exclusive to the primary CTA button**. No other element gets red glow.
- **Neon text shadow** is exclusive to the `<span class="neon-text">` inside the H1 hero word.
- **Glassmorphism** (`backdrop-filter: blur(20px)` + `rgba(10,15,26,0.92)`) is exclusive to the fixed header.
- **No drop shadows** on cards, inputs, dropdowns aside from a `0 16px 48px rgba(0,0,0,0.6)` on header dropdowns.

### Border styles
- Default card: `1px solid rgba(255,255,255,0.08)`.
- Hover/active: `1px solid rgba(255,255,255,0.13)`.
- Focus (input): `1px solid rgba(255,0,51,0.6)`.
- Drop zone idle: `2px dashed rgba(255,255,255,0.15)`.
- Drop zone dragging: `2px dashed rgba(255,0,51,1)` + `rgba(255,0,51,0.05)` background tint.

---

## 6. Motion

Purposeful, fast, snappy. **All durations 150–400ms.**

| Use | Spec |
|---|---|
| Hover (color, bg, border) | `transition: all 0.15s ease` |
| Screen entrance | `opacity 0→1, translateY 16px→0, 400ms ease` (Framer Motion `initial`/`animate`) |
| Step transitions | Same as screen entrance, also add `exit: opacity 0, y -20` |
| Loading pulse | `opacity 1→0.5→1, 2s infinite` |
| Loading spinner | `rotate(360deg), 0.8s linear infinite`, ring `2px solid rgba(255,255,255,0.1)` with `border-top-color: var(--cyan)` |
| Dropdown open | Instant (no transition, just appear) — never spring/scale |

**Never use:** `bounce`, `spring`, `cubic-bezier` longer than 400ms, infinite scale animations, parallax on scroll, fade-in on every paragraph.

---

## 7. Components — strict variants

### 7.1 Buttons (5 variants only)

| Variant | Class hint | Role | One per screen? |
|---|---|---|---|
| **Primary** | red bg, 0 radius, red glow shadow, `font-mono uppercase tracking-wider 700` | THE single most important action | ✅ exactly one per screen |
| **Outline** | transparent bg, `border-md`, 8px radius, mono | Secondary actions inside a section | many OK |
| **Amber** | `rgba(245,158,11,0.15)` bg, `rgba(245,158,11,0.4)` border, 8px radius, amber text | Upgrade / premium upsell ONLY | many OK but only for upsell |
| **Purple** | `rgba(124,58,237,0.1)` bg, `rgba(124,58,237,0.45)` border, 4px radius, `#C4B5FD` text | Multi-Jury action ONLY | many OK |
| **Ghost** | transparent, no border, muted text | Dismissal, low-priority | many OK |
| Disabled | `rgba(255,255,255,0.06)` bg, `rgba(255,255,255,0.25)` text, `cursor: not-allowed`, no glow | Locked primary | n/a |

### Sizes
- Small: `padding: 8px 16px; font-size: 10–11px`.
- Medium (default): `padding: 12px 24px; font-size: 12px`.
- Large: `padding: 16px 32px; font-size: 13px`.

### CTA-stack pattern (Studio Desk right panel)
4 layers, top-to-bottom:
1. **Primary** (red, 0 radius, full-width) — `Face the Jury (4 Rapido)`.
2. **Multi-Jury** (purple, 4 radius, full-width) — with `PROMO` chip if active.
3. **Secondary grid** (2-col): `Concept Analysis (sky)` + `Material Analysis (premium-locked)`.
4. **Privacy note** (mono 9px, opacity 0.2, centered).

Always show Rapido cost in the button label, e.g. `(4 Rapido)` in mono lighter weight.

### 7.2 Chips, tags, badges
- **Tag** (informational, non-interactive): `padding: 4px 12px, border-radius: 99px, font-mono 11px uppercase`, with semantic color border + `0.08–0.12 opacity bg + full-opacity text`. Examples: `⚡ AI-Powered`, `PROMO`, `Premium`, `Approved`.
- **Cost badge** (Rapido): `padding: 2px 8px, border-radius: 4px, bg rgba(255,0,51,0.12), border rgba(255,0,51,0.25), color var(--neon-red), font-mono 10px`.
- **Upgrade badge**: same shape but amber tokens.
- **Nav chip** (header status): `padding: 6px 12px, border-radius: 99px, font-mono 11px uppercase`. Rapido red, Score green, Upgrade amber.

### 7.3 Form inputs
- Base: `bg rgba(0,0,0,0.4), border rgba(255,255,255,0.08), border-radius: 8px, padding: 10px 14px, font-sans 14px`.
- Focus: `border-color: rgba(255,0,51,0.6)` (red focus ring; cyan only for verification code inputs).
- Label: `font-sans 13px 600, mb: 6px`. Optional small icon left, `var(--text-muted)`.
- Hint: `font-mono 11px, var(--text-dim)` underneath.
- Select: same base + `appearance: none + cursor: pointer`. Option `background: var(--bg-0)`.
- Range slider: `accent-color: var(--neon-red), height: 4px`.
- Segmented control: pill container `padding: 4, gap: 4, bg rgba(0,0,0,0.3), border subtle`. Active button: `bg-3 + border-md + font-weight 600`. Inactive: `transparent + muted`.

### 7.4 Cards
- Standard: `bg var(--bg-2), border subtle, border-radius: 12px, padding: 20px`.
- Stat card: same + `font-display 26–28px 700` value, `font-mono 9–10px uppercase muted` label.
- Hero feature card: `bg var(--bg-1), border subtle, border-radius: 16px, padding: 28px`. Hover: `border-color: rgba(255,0,51,0.3)`.
- "How it works" step card: same as feature card + giant ghost step number top-right (`font-mono 48px 700, color: rgba(255,255,255,0.03)`).

### 7.5 Section divider header (inside cards & form groups)
```
[geometric-icon] [MONO-UPPERCASE-LABEL]   ← bottom border 1px subtle, mb 16px
```
- Icon: geometric Unicode glyph (`◈ □ ◎ ◉ ★ ✦ ⬡ ◆ ✉ ⊕ ⊹ ☆`). Color `var(--text-muted)`.
- Label: `font-mono 10–11px, uppercase, letter-spacing: 0.12em, color var(--text-muted)`.

### 7.6 States
- **Empty**: dashed border, centered, big faded icon (`opacity: 0.2–0.3, font-size: 32px`), 14px muted description, optional 10–11px mono dim hint.
- **Loading**: spinner (see motion §6) + `font-mono 12px muted` label.
- **Error**: card with `bg rgba(255,107,107,0.08), border rgba(255,107,107,0.25), border-radius: 8px`, `font-mono 11px #FF6B6B uppercase` title + `font-sans 13px #FCA5A5` body. Always state cause + fix.
- **Processing (file upload)**: `bg rgba(34,211,238,0.06), border rgba(34,211,238,0.2)`, spinner + `font-mono 11px cyan` label.

### 7.7 Toasts
- Position: `fixed, bottom: 24px, left: 50%, translateX(-50%), max-width: 400px`.
- Style: `padding: 12px 18px, border-radius: 10px, font-mono 12px`.
- Variants:
  - Success: `bg rgba(16,185,129,0.9) #fff` — `✓ ...`
  - Error: `bg rgba(220,38,38,0.9) #fff` — `✕ ...` *(but errors prefer inline cards, see §10)*
  - Info: `bg rgba(59,130,246,0.9) #fff` — `ℹ ...`
  - Reward: `bg rgba(245,158,11,0.9) #000` — `★ ...` (badge unlocks only)
- Auto-dismiss in 4–7s. No manual close button.

### 7.8 Modals
- Avoid for the main analysis flow. Use only for: auth, payment confirmation, destructive delete confirmation, cookie consent.
- `border-radius: 16px, bg var(--bg-1), border-md, max-width: 480–560px`.
- Backdrop: `rgba(0,0,0,0.6) + backdrop-filter: blur(8px)`.

---

## 8. Navigation pattern

### Header zones (left → right)
```
[ Logo zone ] [ ──── Nav zone (flex 1, gap 28px) ──── ] [ User zone ]
   fixed                                                     fixed
```

- **Logo:** `28×28` red rotated square + `DRAW<span red>OR</span>DIE` in `font-display 18px 700, letter-spacing 0.12em`.
- **Nav links:** `font-mono 11px uppercase, letter-spacing 0.1em, color var(--text-muted)`. Hover → white. Active → white + `2px red bottom underline`.
- **Color-coded nav:** `Community → cyan`, `AI Mentor → amber + ✦ prefix`, `ArchBuilder → amber`, `Gallery → muted (it's a dropdown)`. The rest stay muted.
- **Max 6 top-level nav items.** Group related ones into a dropdown:
  - **Gallery dropdown** = `Hall of Fame (green)` + `Wall of Death (red-ish #FF6B6B)`.
  - Keep `Studio Desk · ArchBuilder · Community · AI Mentor · Gallery ▾ · References` as the canonical 6. Move `Portfolio · Peer Review · Confessions` inside the **Profile dropdown** or the mobile menu.

### Right user zone
- Rapido chip (red), Score chip (green, hidden on `<lg`), Profile pill (avatar + name + ▾), Upgrade pill (amber, hidden if Premium).
- All pills: `padding: 6–7px 12–14px, border-radius: 99px, font-mono 11px`.

### Profile dropdown items (in this order)
1. `Profile & Settings` (text)
2. `Analysis History` (cyan)
3. `Rapido Shop` (red)
4. `Go Premium` (amber) *— hidden if user is Premium*
5. *(divider)*
6. `Portfolio · Peer Review · Confessions · References` *(secondary nav links here, not in main bar)*
7. *(divider)*
8. `Sign Out` (#FF6B6B)

### Mobile menu
- Below `xl:` breakpoint, collapse the entire nav into the Menu icon.
- Show grid of 2 cols, each item as a colored bordered tile that mirrors the desktop nav color.
- Always show user identity row at the top with Rapido balance.

---

## 9. Tier gating treatment

| Tier | Visual treatment of locked features |
|---|---|
| **Guest (anonymous)** | Form fully visible & active. Drop zone active. After 1 trial, primary CTA flips to **`Upgrade to continue`** (amber border + amber text), still 0 radius. |
| **Registered** | All Single-Jury features unlocked. Multi-Jury and Premium features visible but disabled with `UPGRADE` badge. |
| **Premium** | Everything unlocked. Premium tier shows `♛ Premium` chip in Rapido row (amber). |

### Hard rules
- **Never hide locked features.** Always show with `UPGRADE` badge → educates the user about what's behind premium.
- **Never modal-interrupt mid-flow.** Upgrade upsell goes inline (sticky CTA stack or amber bar above the CTA stack when balance < 15).
- **Disabled CTA must explain itself.** Always show secondary label: `Face the Jury — upload a file first` or `Face the Jury — top up Rapido`. Never gray button with no text.

---

## 10. Cost indicators (Rapido)

- **Always show cost on CTAs that consume Rapido.** Format: `Action Label (N Rapido)` where `(N Rapido)` is `font-mono 10px, opacity 0.6, font-weight 400`.
- **Rapido color is always `var(--neon-red)`.** The icon (✦), value text, balance pill, and cost badges are always red. This builds instant cost-awareness.
- **Low-balance bar:** when `rapido_pens < 15`, show a non-modal amber bar above the CTA stack with current balance and `Go Premium` link.
- **Source of truth for costs:** `lib/pricing.ts`. Never hardcode numbers in components — always import from pricing.

---

## 11. Voice & copy rules

| Element | Rule | Good | Bad |
|---|---|---|---|
| CTA | Imperative, present tense | `Face the Jury` | `Submit for Analysis` |
| Section header | Title case, no verbs | `Project Context` | `Enter Project Context` |
| Placeholder | Concrete realistic example | `e.g. Karaköy, Istanbul` | `Enter your site location` |
| Error | Cause + fix | `File exceeds the 35 MB limit. Reduce size and re-upload.` | `Error occurred.` |
| Disabled label | Why it's disabled | `Face the Jury — upload first` | `Face the Jury` (gray) |

### Localization
All user-facing strings go through `pickLocalized(language, tr, en)` from `lib/i18n.ts`. Both Turkish and English MUST be provided for every new string. Default UI language: **Turkish**. Default LLM/jury output language: **English** (always, regardless of UI locale).

---

## 12. Iconography

- **Geometric Unicode glyphs** for section dividers and inline labels: `◈ □ ◎ ◉ ★ ✦ ⬡ ◆ ✉ ⊕ ⊹ ☆ ↑ ↓ → ← ▾`.
- **`lucide-react`** for in-component icons (drop zone arrow, Crown, Sparkles, ChevronDown, etc.). Use `strokeWidth: 1.25–1.5`. Size: `12–18px` based on context.
- **No emoji** in primary UI. Emojis (`🏆 💀 🏅 🧠`) are tolerated only inside dropdown labels, gallery type indicators, and badge unlocks for personality.

---

## 13. Marketing / Hero screen template

The Hero screen (landing) follows this exact vertical rhythm:

1. **Top tag** (small red pill, `⚡ AI-Powered Architecture Jury`).
2. **H1 hero**: 2-line uppercase, `font-display`, the second line wrapped in `<span class="neon-text">`. Format: `Upload your board, / Face the jury` (en) or `Paftanı yükle, / jüriyle yüzleş` (tr).
3. **Sub-paragraph**: muted, max 560px, line-height 1.7.
4. **CTA row**: `[Open Studio Desk →]` (primary red, 0 radius) + `[Try ArchBuilder]` (amber outline). Center-aligned.
5. **Discover ↓**: small mono uppercase label `DISCOVER` + animated chevron-down.
6. **Feature cards row** (3 cards, 16px radius, hover red border).
7. **"How It Works"** section: H2 + 3 step cards with ghost step numbers (`STEP 01/02/03` in red mono, big translucent number top-right).
8. **Bottom CTA panel** (gradient bg from black to neon-red 4%, 20 radius, padding 48): muted paragraph + primary CTA `Start Analyzing →`.

---

## 14. Implementation checklist (run before declaring a UI task done)

Run through this list mentally before submitting any UI change:

- [ ] All colors come from the 6-color semantic palette (or `rgba()` of them).
- [ ] All spacings are multiples of 4px from the allowed scale.
- [ ] All button labels, nav items, costs, status chips use `font-mono`.
- [ ] All headings use `font-display`. All body text uses Inter.
- [ ] Primary CTA: exactly one per screen, red, 0 radius, red glow.
- [ ] Disabled buttons explain why they are disabled.
- [ ] Cost is shown on every CTA that consumes Rapido.
- [ ] Locked features are visible with `UPGRADE` badge, not hidden.
- [ ] Both `tr` and `en` strings provided via `pickLocalized`.
- [ ] No new hex value introduced. No new font-family. No new shadow.
- [ ] Motion stays within 150–400ms.
- [ ] Blueprint grid is visible behind the change (no full-bleed solid bg covering it).
- [ ] Header height is 64px and content respects `pt-[64px]`.
- [ ] Mobile breakpoints work — under `xl:` collapse to mobile menu.

---

## 15. Quick "do / avoid" cheat sheet

✅ **Do**
- Space Grotesk for headings · JetBrains Mono for UI labels · Inter for body
- Red for primary CTAs only · Amber for premium upsell only · Purple for Multi-Jury only
- 8px grid · 0 radius for primary CTA · Blueprint grid always visible
- One primary action per screen · Show Rapido cost on every CTA
- Imperative CTA copy · Concrete placeholder examples · Cause + fix in errors

❌ **Avoid**
- Two red buttons on the same screen
- Inter for nav / button labels · ALL-CAPS for body / descriptions
- Hiding locked features · Modal interrupts mid-analysis
- Toasts for error messages (use inline error cards)
- Gradient backgrounds on the body · New colors outside the palette
- Bouncy / springy motion · Drop shadows on text · Gradient text fills

---

## 16. References

- Visual spec: `docs/internal/Draw or Die Design System (1).html`
- Interactive prototype: `docs/internal/Draw or Die Redesign (1).html`
- Token implementation: `app/globals.css`
- Repo-wide AI rules: `AGENTS.md` (master)
- Other domain `AGENTS_*.md` files: see "Domain Rule Files" section in `AGENTS.md`
