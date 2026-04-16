# Hero landing — placeholder art & image-generation playbook

**Audience:** Draw or Die maintainers and designers only.  
**Not for:** End users, marketing copy, or public README.  
**Code reference:** `lib/hero-landing.ts` (`HERO_MOCK_VISUALS`) and `components/HeroStep.tsx`.

**Shipped raster files (repo):** `public/1.png` (studio desk scene), `public/2.png` (jury panel), `public/3.png` (mentor / night studio). Titles and captions for the landing grid live in `hero-landing.ts`, not in this file.

This document holds **detailed** image-generation prompts, negative prompts, and production notes. The public app intentionally does **not** surface these strings; the UI shows marketing titles, captions, and localized `alt` text.

---

## Global production targets

| Item | Guidance |
|------|----------|
| **Slot size (UI)** | Roughly **5:3** aspect in the grid (`aspect-[5/3]`). Source art **≥ 1200×720** (or 1600×960) so it stays sharp on retina. |
| **Safe zone** | Keep critical subject and contrast in the **central ~85%**; edges may crop slightly on small viewports. |
| **Brand palette** | Backgrounds: deep charcoal `#0A0F1A`, slate navy `#0F172A`, indigo `#1E1B4B`. Accent: **neon red** `#FF0033` (primary CTA). Secondary accents: cyan `#38BDF8`, amber `#FBBF24` — use sparingly. |
| **Typography in images** | **Avoid readable UI text, logos, or watermarks** in finals unless marketing approves copy. Placeholders may say “Studio Desk” etc.; production art should be mostly non-textual or abstract. |
| **Export** | Prefer **WebP** or **AVIF** for production; keep a **PNG** master. Optimize before dropping into `public/` if you replace remote placeholders. |
| **Accessibility** | When replacing `src`, update `altTr` / `altEn` in `hero-landing.ts` to describe the **new** image (not “placeholder”). |

---

## Asset 1 — `studio-desk`

**Role on page:** First column — communicates “upload / Studio Desk / analysis flow.”  
**Current placeholder:** `placehold.co` — dark frame with red label.

### Alt text (shipped in code)

- **TR:** Studio Desk — pafta yükleme ve analiz akışı (yer tutucu)  
- **EN:** Studio Desk — upload and analysis flow (placeholder)

### Creative brief

Dark, premium product-style shot of a **student architecture workflow**: desk, drawing board or tablet, loose blueprints, subtle UI glow suggesting “tool” not a real screenshot. Should feel **cinematic** and **minimal**, not cluttered stock office.

### Detailed prompt — English

```
Ultra-wide cinematic product photograph of an architecture student studio desk at night.
Deep charcoal environment (#0A0F1A) with a single strong neon red accent (#FF0033) on a slim
desk lamp edge or a matte equipment trim — not a flat red fill. A tilted drawing board or
large tablet shows a faint abstract plan graphic (no legible labels). Rolled blueprint tubes,
a metal parallel bar, graphite pencils, one warm practical light source. Shallow depth of field,
soft volumetric haze, subtle reflections on a dark desk surface. Shot like a high-end tech
brand hero: moody, precise, aspirational. No logos, no readable UI text, no watermarks,
no human face in focus. 16:9 composition, professional color grading, high dynamic range.
```

### Detailed prompt — Turkish (same scene; for TR-first tools)

```
Gece vakti mimarlık öğrencisi çalışma masasının ultra geniş sinematik ürün fotoğrafı.
Ortam kömür tonlarında, tek güçlü neon kırmızı vurgu ince masa lambası
kenarında veya ekipman çerçevesinde — düz kırmızı alan yok. Eğik çizim tahtası veya büyük
tablette okunabilir etiket içermeyen soyut plan grafiği. Blueprint tüpleri, metal cetvel,
kurşun kalemler, tek sıcak pratik ışık. Sığ alan derinliği, hafif volumetrik sis, koyu masa
yüzeyinde yansımalar. Üst düzey teknoloji markası hero çekimi: kasvetli, keskin, ilham verici.
Logo, okunabilir arayüz metni, filigran, net yüz yok. 16:9, profesyonel renk düzeni, yüksek
dinamik aralık.
```

### Negative prompts (optional; append in your tool)

```
readable text, subtitles, watermark, logo, brand name, distorted hands, extra fingers,
cluttered desk, cartoon, low resolution, oversaturated, flat lighting, stock photo cliché
```

### Notes

- If the team later adds a **real product screenshot**, crop to the same mood (dark + red accent) for consistency.
- Replace `src` in `hero-landing.ts` with `/hero/studio-desk.webp` (example path) when ready.

---

## Asset 2 — `jury-panel`

**Role on page:** Second column — “multi-persona AI jury / scores / critique panel.”  
**Current placeholder:** slate + cyan “AI Jury” tile.

### Alt text (shipped in code)

- **TR:** Çoklu jüri ve skor paneli (yer tutucu)  
- **EN:** Multi-persona jury score panel (placeholder)

### Creative brief

**Abstract / futuristic** jury interface: multiple “personas” as **silhouettes or glyphs**, not real jurors. Holographic or glass-morphism panel, **cool cyan** (`#38BDF8`) on **dark navy** (`#0F172A`). Feels like a HUD, not a Windows app screenshot.

### Detailed prompt — English

```
Futuristic architecture jury interface as a wide holographic glass panel floating in a dark
navy void (#0F172A). Five abstract critic personas suggested by distinct geometric silhouettes
or minimal avatar glyphs — no faces, no names, no readable labels. Thin cyan light trails
(#38BDF8) connect persona nodes to a central score ring or radar chart made of soft glowing
lines (numbers abstract / blurred, not legible). Minimal UI chrome, frosted glass layers,
subtle grid perspective. Cinematic sci-fi, restrained and premium. No text blocks, no logos,
no stock icons, no photograph of a real monitor bezel. 16:9, high contrast on dark background.
```

### Detailed prompt — Turkish

```
Koyu lacivert boşlukta süzülen geniş holografik cam panel şeklinde fütüristik
mimarlık jürisi arayüzü. Beş soyut eleştirmen, geometrik silüetler veya minimal avatar
glifleriyle — yüz, isim, okunabilir etiket yok. İnce camgöbeği ışık izleri  persona
düğümlerini merkezi, bulanık sayılardan arındırılmış skor halkasına veya radar grafiğine
bağlar. Minimal arayüz, buzlu cam katmanları, hafif perspektif ızgara. Sinematik bilimkurgu,
ölçülü ve premium. Metin blokları, logo, stok ikon, gerçek monitör çerçevesi fotoğrafı yok.
16:9, koyu zeminde yüksek kontrast.
```

### Negative prompts

```
legible numbers, subtitles, app screenshot, Windows taskbar, browser chrome, cartoon jury,
real human faces, watermark, QR code
```

---

## Asset 3 — `mentor`

**Role on page:** Third column — “AI Mentor / chat / guidance beside studio work.”  
**Current placeholder:** indigo + amber “AI Mentor” tile.

### Alt text (shipped in code)

- **TR:** AI Mentor sohbet (yer tutucu)  
- **EN:** AI Mentor chat (placeholder)

### Creative brief

**Editorial illustration** (not photorealistic crowd shot): student + laptop, **soft amber** (`#FBBF24`) as warmth vs **deep indigo** (`#1E1B4B`) background. Blueprints on wall as **silhouette**. Friendly, calm, **mentor-as-light** metaphor — avoid creepy robot or generic “AI brain” clipart.

### Detailed prompt — English

```
Editorial illustration, wide format: architecture student seen from three-quarter back at a
laptop in a small night studio. Deep indigo and violet shadows (#1E1B4B) with a soft amber
rim light (#FBBF24) on the figure and desk edge — warm, human, focused. Wall behind shows
abstract blueprint outlines as graphic shapes (no readable text). A subtle secondary glow
suggests an AI companion as abstract particles or a gentle light bloom beside the screen —
not a robot character, not a logo. Cohesive brush or vector-flat hybrid, magazine quality,
muted palette, calm mood. No logos, no app UI text, no watermarks.
```

### Detailed prompt — Turkish

```
Editoryal illüstrasyon, geniş format: küçük gece stüdyosunda dizüstü bilgisayar başında
üç çeyrek arka açıdan mimarlık öğrencisi. Derin indigo ve menekşe gölgeler, figür
ve masa kenarında yumuşak amber rim ışık — sıcak, insani, odaklı. Arkadaki duvarda
grafik şekiller olarak soyut blueprint çizgileri. Ekranın yanında
AI refakatçisini soyut parçacıklar veya nazik ışık patlaması olarak öneren ikincil bir parıltı —
robot karakter, logo yok. Uyumlu fırça veya vektör-flat hibrit, dergi kalitesi, sıkı palet,
sakin ton. Logo, uygulama arayüzü metni, filigran yok.
```

### Negative prompts

```
robot head mascot, glowing brain clipart, stock photo laptop screen with text, harsh neon,
anime, distorted anatomy, watermark, readable chat bubbles
```

---

## Checklist before merging new art

1. [ ] Dimensions ≥ recommended; file size reasonable after compression.  
2. [ ] No unintended text/logos; brand colors roughly aligned.  
3. [ ] `altTr` / `altEn` updated in `lib/hero-landing.ts`.  
4. [ ] `src` points to `public/` or CDN; **no secrets in URLs**.  
5. [ ] Optional: add entry to changelog or design handoff if marketing uses the same assets elsewhere.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-12 | Initial internal playbook; prompts removed from client bundle, detailed specs live here only. |
