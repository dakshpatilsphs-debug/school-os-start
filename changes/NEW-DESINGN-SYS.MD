I want to change whole desing to the neomormisim and remove the side bar and change to top bar 
see segricate the pages first top bar list - all types of enterys, transcitions - all types of trnactions are shown then attendence , reports - all types of reports to download and reports page , expense and the catagoy and by seleting the catagory i can see the expense. and then use motion package to add the animations to the whole website and make it more beautiful and in report there are many reports to be downloaded and make it more beautiful and in reports tab add all types of list like student list ect 
the discription about the neomorfism - "# Neumorphism: The Complete Guide to "Soft UI"

> *A precise, deep-dive reference on Neumorphism — its definition, history, anatomy, math, implementation, accessibility, and place in modern design.*

---

## Table of Contents

1. [What Is Neumorphism?](#1-what-is-neumorphism)
2. [Origin & History](#2-origin--history)
3. [Defining Characteristics](#3-defining-characteristics)
4. [The Anatomy of a Neumorphic Element](#4-the-anatomy-of-a-neumorphic-element)
5. [The Math & Color Theory](#5-the-math--color-theory)
6. [The Two Shadows Rule (Light & Dark)](#6-the-two-shadows-rule-light--dark)
7. [The Three Core States](#7-the-three-core-states)
8. [Implementation (CSS)](#8-implementation-css)
9. [Implementation (Figma & Other Tools)](#9-implementation-figma--other-tools)
10. [Neumorphism vs. Other Design Styles](#10-neumorphism-vs-other-design-styles)
11. [Strengths & Weaknesses](#11-strengths--weaknesses)
12. [Accessibility & Usability Concerns](#12-accessibility--usability-concerns)
13. [Best Practices & Rules of Thumb](#13-best-practices--rules-of-thumb)
14. [When to Use (and When NOT to Use)](#14-when-to-use-and-when-not-to-use)
15. [Tools, Generators & Resources](#15-tools-generators--resources)
16. [Gallery of Concepts & Inspirations](#16-gallery-of-concepts--inspirations)
17. [Glossary](#17-glossary)
18. [Quick Reference Cheat Sheet](#18-quick-reference-cheat-sheet)

---

## 1. What Is Neumorphism?

**Neumorphism** (a portmanteau of **"new"** + **"skeuomorphism"**) is a visual UI design style in which interface elements appear to be **extruded from, or pressed into, the same background surface** they sit on. It is also commonly called **"Soft UI"**.

The defining illusion is that controls are **made of the same material as the canvas** — they are not separate layers floating *above* the background (as in flat or material design), but rather **bulges and dents molded into a single, soft, uniform surface**.

### The Core Idea in One Sentence

> A neumorphic element is a region of the background that has been **pushed up** (raised) or **pushed in** (recessed) using two soft, low-contrast shadows.

### Key Visual Signature

- A **single, monochromatic background color** (usually light pastel or muted).
- Elements share the **exact same color** as the background.
- Each element carries **two drop-shadows**:
  - One **light** shadow (top-left) — simulates an external light source.
  - One **dark** shadow (bottom-right) — simulates the opposing shading.
- **Very low contrast** between the element and its background.
- **Soft, blurred, diffused** shadow edges (large blur radius).
- No harsh borders, gradients, or heavy textures.

---

## 2. Origin & History

| Year | Event |
|------|-------|
| **2007–2013** | **Skeuomorphism** dominates — iOS/Android UIs imitate physical objects (leather, stitching, glossy buttons, wood, paper). |
| **2013–2014** | **Flat Design** (Apple iOS 7, Google Material Design) rejects realism in favor of bold, flat colors and simple shapes. |
| **2014–2017** | **Material Design** refines flat design with layered "surfaces," elevation, and drop shadows. |
| **2019** | **Neumorphism** emerges as a trend on **Dribbble** and design blogs. The term is coined (most credit the design community, popularized by **Michal Malewicz** of *UX Collective*, who analyzed and debated it). |
| **2020** | Peak of the trend — countless Dribbble shots, CSS generators, and Figma tutorials appear. |
| **2020–present** | Settled into a **niche style** used selectively for dashboards, health/finance apps, and "soft" brand identities. |

**Key figure:** Michal Malewicz (UX designer) wrote extensively about neumorphism's **usability problems**, coining the critical view that it is *"beautiful but often inaccessible."*

> **Note on the name:** "Neumorphism" was chosen because it is a **new take on skeuomorphism** — but unlike skeuomorphism, it does **not** imitate real-world *objects*; it imitates the *physicality of a surface* (pressing a soft plastic or foam panel).

---

## 3. Defining Characteristics

A design must satisfy **most** of the following to be called neumorphic:

1. **Monochromatic background** — a single, flat, soft color fills the canvas.
2. **Same-color elements** — buttons, cards, and inputs share the background color exactly.
3. **Dual soft shadows** — every raised element has a light shadow on one side and a dark shadow on the opposite side.
4. **Low contrast** — the element's "elevation" is communicated *only* through shadow, never through a different fill color or outline.
5. **No borders** — edges are defined purely by shadow transitions.
6. **Rounded corners** — large border radii (typically 20–60% of the element's size) emphasize the "soft, inflated" look.
7. **Diffused shadows** — large blur radius (20–60 px or more) and low opacity.
8. **States shown by inversion** — a pressed button simply *inverts* its shadows (raised → recessed), rather than changing color.
9. **Consistent light source** — the "light" always appears to come from one direction (conventionally top-left).

---

## 4. The Anatomy of a Neumorphic Element

```
        LIGHT SHADOW (top-left)
             ┌──────────────────────┐
             │                      │   ← element fill = background color
             │     (rounded rect)   │
             │                      │
             └──────────────────────┘
            DARK SHADOW (bottom-right)
```

### The Four Building Blocks

| Component | Role |
|-----------|------|
| **Background surface** | The single-color canvas (e.g. `#E0E5EC`). |
| **Element fill** | Identical to the background color. |
| **Light shadow** | Offset **negative** (e.g. `-10px -10px`), color = a **lighter** tint of the background. |
| **Dark shadow** | Offset **positive** (e.g. `10px 10px`), color = a **darker** shade of the background. |

The **combination** of a light shadow on top/left and dark shadow on bottom/right makes the brain interpret the element as **convex** (popping out). Reversing the offsets makes it appear **concave** (pressed in).

---

## 5. The Math & Color Theory

Neumorphism relies on **very subtle luminance shifts** around a base color.

### 5.1 Choosing the Base Color

- Prefer **soft, desaturated** hues:
  - Pastel neutrals: `#E0E5EC`, `#ECF0F3`
  - Soft lavender: `#DDE1E7`
  - Mint/teal pastel: `#D6E4E5`
  - Warm sand: `#F0E9E2`
- Avoid **pure white / pure black** — they make the shadow illusion harsh.
- Dark-mode neumorphism uses a **dark base** (e.g. `#23272B`) with *even subtler* shadow differences.

### 5.2 Deriving the Two Shadow Colors

Given a base color `B` (in HSL/HSLuv), derive:

- **Light shadow** = `B` with **Lightness + 5–10%** (or mix with white 8–15%).
- **Dark shadow** = `B` with **Lightness − 5–15%** (or mix with black 8–20%).

**Example (light theme):**

```
Base:            #E0E5EC
Light shadow:    #FFFFFF   (white, for contrast)
Dark shadow:     #A3B1C6   (a blue-grey, ~25% darker)
```

**Example (dark theme):**

```
Base:            #23272B
Light shadow:    #2C3136   (slightly lighter)
Dark shadow:     #1A1D20   (slightly darker)
```

### 5.3 Shadow Parameters (Rule-of-Thumb Ranges)

| Parameter | Typical Light UI | Dark UI |
|-----------|------------------|---------|
| **Blur radius** | 20–60 px | 30–80 px |
| **Shadow distance (offset)** | 8–20 px | 10–25 px |
| **Light shadow opacity** | 60–100% | 20–40% |
| **Dark shadow opacity** | 20–40% | 40–80% |
| **Element corner radius** | 12–40 px | 12–40 px |

> Larger elements need **larger blur and distance** to look natural; tiny elements (small icons) need smaller values.

---

## 6. The Two Shadows Rule (Light & Dark)

This is the single most important principle. **One shadow is never enough.**

### 6.1 Raised (Convex / "Outer") Element

```css
box-shadow:
  -10px -10px 30px rgba(255, 255, 255, 0.8),   /* light, top-left */
  10px  10px 30px rgba(163, 177, 198, 0.6);    /* dark, bottom-right */
```

### 6.2 Recessed (Concave / "Inset" / "Pressed") Element

Inverted offset **and** the `inset` keyword:

```css
box-shadow:
  inset 10px 10px 30px rgba(163, 177, 198, 0.6),  /* dark inside, bottom-right */
  inset -10px -10px 30px rgba(255, 255, 255, 0.8); /* light inside, top-left */
```

### 6.3 Why Two Shadows?

- A single drop shadow reads as a **card floating above** the page (material design).
- The **opposing light + dark pair** reads as a **surface being molded** — which is the neumorphic signature.

---

## 7. The Three Core States

A good neumorphic control communicates state through **shadow inversion**, not color change.

| State | Appearance | CSS technique |
|-------|-----------|----------------|
| **Resting (raised)** | Convex bulge — light top-left, dark bottom-right | outer dual shadow |
| **Pressed / Active (recessed)** | Concave dent — shadows flipped and `inset` | inset dual shadow |
| **Disabled** | Flattened — shadows removed or heavily muted, reduced opacity | minimal/no shadow |

### Optional: "Selected" / "Toggle-On" State

A toggled switch, checkbox, or segmented control is typically shown **recessed** (pressed-in) to indicate "on," sometimes with a subtle **accent color** added for clarity (which, strictly, breaks pure neumorphism but dramatically improves usability).

---

## 8. Implementation (CSS)

### 8.1 Complete Light-Theme Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Neumorphic UI — Example</title>
<style>
  :root {
    --bg: #E0E5EC;
    --light: #FFFFFF;
    --dark: #A3B1C6;
    --accent: #7C9CFF;
    --text: #4A5568;
  }

  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 40px;
    background: var(--bg);
    font-family: "Segoe UI", system-ui, sans-serif;
    color: var(--text);
  }

  /* ── Raised element ─────────────────────────── */
  .neu-raised {
    background: var(--bg);
    border-radius: 24px;
    box-shadow:
      -12px -12px 30px var(--light),
       12px  12px 30px var(--dark);
    padding: 28px 36px;
  }

  /* ── Recessed element ───────────────────────── */
  .neu-recessed {
    background: var(--bg);
    border-radius: 24px;
    box-shadow:
      inset 12px 12px 30px var(--dark),
      inset -12px -12px 30px var(--light);
    padding: 28px 36px;
  }

  /* ── Button with press interaction ──────────── */
  .neu-button {
    background: var(--bg);
    border: none;
    border-radius: 20px;
    padding: 16px 40px;
    font-size: 16px;
    font-weight: 600;
    color: var(--accent);
    cursor: pointer;
    box-shadow:
      -8px -8px 20px var(--light),
       8px  8px 20px var(--dark);
    transition: box-shadow 0.15s ease, transform 0.05s ease;
  }

  .neu-button:active {
    box-shadow:
      inset 8px 8px 20px var(--dark),
      inset -8px -8px 20px var(--light);
    transform: scale(0.98);
  }
</style>
</head>
<body>
  <div class="neu-raised">Raised Card</div>
  <div class="neu-recessed">Recessed Well</div>
  <button class="neu-button">Press Me</button>
</body>
</html>
```

### 8.2 Dark-Theme Adjustments

```css
:root {
  --bg: #23272B;
  --light: #2C3136;   /* only ~10% lighter */
  --dark: #1A1D20;    /* only ~10% darker */
  --accent: #8AB4FF;
  --text: #D7DCE2;
}

.neu-raised {
  box-shadow:
    -12px -12px 30px var(--light),
     12px  12px 30px var(--dark);
}
```

> **Critical dark-mode note:** dark themes tolerate **much less** shadow contrast — keep the light/dark deltas tiny or the illusion breaks into "glowing blob."

### 8.3 Building a Neumorphic Input Field

```css
.neu-input {
  background: var(--bg);
  border: none;
  outline: none;
  border-radius: 16px;
  padding: 14px 20px;
  font-size: 16px;
  color: var(--text);
  box-shadow:
    inset 6px 6px 14px var(--dark),
    inset -6px -6px 14px var(--light);
  transition: box-shadow 0.2s ease;
}

.neu-input:focus {
  box-shadow:
    inset 6px 6px 14px var(--dark),
    inset -6px -6px 14px var(--light),
    0 0 0 3px rgba(124, 156, 255, 0.35);  /* accessibility focus ring */
}
```

### 8.4 A Neumorphic Toggle Switch

```css
.neu-toggle {
  width: 70px;
  height: 40px;
  border-radius: 40px;
  background: var(--bg);
  box-shadow:
    inset 6px 6px 14px var(--dark),
    inset -6px -6px 14px var(--light);
  position: relative;
  cursor: pointer;
  transition: box-shadow 0.2s ease;
}

.neu-toggle .knob {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--bg);
  position: absolute;
  top: 5px;
  left: 5px;
  box-shadow:
    -4px -4px 10px var(--light),
     4px  4px 10px var(--dark);
  transition: left 0.2s ease;
}

.neu-toggle.on {
  box-shadow:
    inset 6px 6px 14px var(--dark),
    inset -6px -6px 14px var(--light);
}
.neu-toggle.on .knob { left: 35px; }
```

---

## 9. Implementation (Figma & Other Tools)

### 9.1 Figma

1. Set canvas background to a soft color (e.g. `#E0E5EC`).
2. Draw a **rectangle** (or rounded rectangle) with the **same fill**.
3. Add **two Drop Shadow effects**:
   - Effect 1: `X = -10, Y = -10, Blur = 30, Color = #FFFFFF, Opacity = 80%`
   - Effect 2: `X = 10, Y = 10, Blur = 30, Color = #A3B1C6, Opacity = 60%`
4. For **recessed** elements, set both to **"Inner Shadow"** and invert X/Y.
5. Create **components** for buttons/toggles, and swap between "Raised" and "Pressed" **variants** using Figma's variant system.

### 9.2 Adobe XD / Sketch / Penpot

Same principle: one shape + two soft shadows (or inner shadows), background-matching fill, large radius.

### 9.3 CSS-in-JS / Tailwind

Tailwind utility (custom theme):

```css
/* tailwind.config */
shadow: {
  'neu-raise': '-12px -12px 30px #FFFFFF, 12px 12px 30px #A3B1C6',
  'neu-inset': 'inset 12px 12px 30px #A3B1C6, inset -12px -12px 30px #FFFFFF',
}
```

---

## 10. Neumorphism vs. Other Design Styles

| Feature | **Skeuomorphism** | **Flat Design** | **Material Design** | **Neumorphism** | **Glassmorphism** |
|---------|-------------------|-----------------|---------------------|-----------------|-------------------|
| **Mimics** | Real objects (leather, wood) | Nothing (pure abstraction) | Physical paper layers | Soft molded surface | Frosted glass |
| **Depth cue** | Texture + realism | None (or thin border) | Elevation + drop shadow | Dual soft shadows | Translucency + blur |
| **Fill vs. background** | Contrasting, textured | Contrasting, flat | Layered surfaces | **Same color** | Transparent/blurred |
| **Contrast** | High | High | Medium–High | **Very low** | Medium |
| **Shadows** | Realistic, dark | Usually none | One hard shadow | **Two soft shadows** | Soft, colored glow |
| **Era of peak** | 2007–2013 | 2013–2017 | 2014–2020 | 2019–2020 | 2020–present |

---

## 11. Strengths & Weaknesses

### ✅ Strengths

- **Visually soothing** — soft, calm, "pillowy" aesthetic ideal for wellness, meditation, health, finance, and baby/family products.
- **Minimalist** — a single color palette reduces visual noise.
- **Modern & distinctive** — stands out against flat/material interfaces.
- **Natural affordance metaphor** — raised = pressable, recessed = container, mimicking physical soft-touch panels.
- **Great for dashboards & widgets** — subtle cards that don't compete for attention.

### ❌ Weaknesses

- **Poor contrast** — elements blend into the background, harming scanability and accessibility.
- **Ambiguous affordance** — users can't easily tell what is clickable vs. static.
- **Hard to indicate state** — pressed/active/disabled are difficult to distinguish without breaking the aesthetic.
- **Not colorblind-safe** — relies entirely on luminance, not hue or text.
- **Fragile** — breaks on busy backgrounds, images, or when mixed with flat components.
- **Implementation inconsistency** — subtle values look different across monitors (cheap/calibrated screens).
- **Perceived as a fad** — many designers see it as a 2019–2020 trend, not a durable system.

---

## 12. Accessibility & Usability Concerns

This is the most-criticized aspect of neumorphism.

### 12.1 Contrast (WCAG)

- WCAG requires **4.5:1** contrast for normal text and **3:1** for large text/UI components.
- Neumorphic surfaces routinely fail this because the element fill ≈ background fill.
- **Fix:** pair the soft surface with a **high-contrast text color** and a **visible accent** for interactive elements.

### 12.2 Affordance (Usability Heuristics — Nielsen)

- "Recognition rather than recall" fails if users can't recognize a button as a button.
- **Fix:** add a subtle **accent color** to icons/labels on interactive elements, and use **consistent placement**.

### 12.3 Focus States

- Soft shadows are nearly invisible as a keyboard-focus indicator.
- **Fix:** add an explicit **focus ring** (see §8.3) — never rely on the shadow.

### 12.4 Colorblind Users

- Since neumorphism encodes information purely in **lightness**, users with low-vision or color-vision deficiencies lose most of the signal.
- **Fix:** supplement with **icons, text labels, and shape changes** — never color/shadow alone.

### 12.5 Dark Mode

- Subtle light/dark deltas are extremely hard to render correctly on OLED/LCD screens.
- **Fix:** test on real devices; increase the delta slightly and consider a faint border (`1px solid rgba(255,255,255,0.06)`).

> **Designer consensus:** Neumorphism is acceptable for **decorative or low-stakes UI**, but **critical actions** (submit, delete, buy) should use conventional, high-contrast styling.

---

## 13. Best Practices & Rules of Thumb

1. **One color family per screen.** Don't mix multiple background hues.
2. **Keep shadows soft** — large blur, low opacity.
3. **Always use both shadows** (light + dark). One shadow = material, not neumorphic.
4. **Match the element fill to the background exactly.**
5. **Round your corners generously.**
6. **Invert shadows for state, but ADD accent color for interactive clarity.**
7. **Never neumorph small, critical text.**
8. **Add an explicit focus ring** for keyboard users.
9. **Reserve neumorphism for secondary/tertiary UI**, not primary actions.
10. **Test on multiple screens** — the illusion depends on display calibration.
11. **Use it as an accent style**, not a whole application, unless the brand is intentionally "soft."
12. **Keep interactive elements large** — small neumorphic buttons are hard to see.

---

## 14. When to Use (and When NOT to Use)

### ✅ Good Use Cases

- **Health & wellness apps** (calm, soothing).
- **Meditation / sleep / mindfulness** products.
- **Finance dashboards** (subtle, non-distracting cards).
- **Smart-home / IoT control panels** (tactile "panel" metaphor).
- **Settings screens** and sliders.
- **Music players / volume sliders** (recessed "track" + raised "knob" works naturally).
- **Data cards and widgets** on a light dashboard.
- **Landing page hero sections** with one soft accent.

### ❌ Poor Use Cases

- **E-commerce checkout / buy buttons** (need max clarity).
- **Forms with many fields** (recessed inputs are hard to scan).
- **Data-heavy enterprise apps** (low contrast hurts).
- **Apps for elderly or low-vision users.**
- **Mobile apps with heavy photography backgrounds.**
- **Anywhere rapid comprehension is critical** (emergency, banking, medical alerts).
- **Complex tables and dense information.**

---

## 15. Tools, Generators & Resources

### Online Generators

- **Neumorphism.io** — interactive CSS generator (adjust color, radius, distance, blur, intensity; copy CSS).
- **CSS Neumorphism Generator** (various open-source sites).
- **Figma Community** — free neumorphism UI kits and component libraries.

### Design System Libraries

- **Soft UI Dashboard** (Creative Tim) — Bootstrap 5 neumorphic dashboard.
- **Neumor** (CSS framework).
- **Glass UI / Soft UI kits** on Figma, Sketch, and Canva.

### Code Resources

- **CodePen / CodeSandbox** — thousands of "Soft UI" examples and variations.
- **Tailwind CSS** — community plugins and custom shadow configs for neumorphism.

### Learning

- **UX Collective** — Michal Malewicz's articles on neumorphism's pros/cons.
- **Nielsen Norman Group** — usability critiques of the trend.
- **YouTube** — "Neumorphism in 10 minutes" tutorials (Figma + CSS).

---

## 16. Gallery of Concepts & Inspirations

Common neumorphic compositions to study or reproduce:

1. **Calculator app** — raised keys in a recessed pad; the classic Dribbble shot that launched the trend.
2. **Music player** — recessed progress track, raised circular play button, raised volume knob.
3. **Smart-home panel** — grid of soft toggles, each recessed when "on."
4. **Dashboard** — soft cards with raised stat tiles and recessed chart wells.
5. **Weather widget** — recessed card with a raised temperature display.
6. **Credit/debit card mock** — raised card with embossed number (inner shadow text).
7. **Segmented control** — recessed container with a raised sliding thumb.
8. **Timer / Pomodoro** — large recessed ring with a raised center.
9. **Profile screen** — raised avatar circle with a recessed status ring.
10. **Onboarding dots** — raised inactive dots, recessed active dot.

---

## 17. Glossary

| Term | Definition |
|------|-----------|
| **Neumorphism / Soft UI** | UI style using same-color elements with dual soft shadows to simulate molded surfaces. |
| **Skeuomorphism** | UI style imitating real-world objects and materials. |
| **Flat Design** | UI style with no depth, gradients, or realistic shadows. |
| **Glassmorphism** | UI style using translucent, blurred "frosted glass" panels. |
| **Elevation** | Perceived height of an element above its surface (material design). |
| **Convex / Raised** | Element appears to bulge outward. |
| **Concave / Recessed / Inset** | Element appears pressed inward. |
| **Drop Shadow** | Outer shadow cast by an element. |
| **Inner Shadow (inset)** | Shadow rendered inside the element's boundary. |
| **Affordance** | Visual cue indicating how an element can be interacted with. |
| **Blur Radius** | How soft/diffused a shadow's edges are. |
| **WCAG** | Web Content Accessibility Guidelines (contrast & usability standards). |

---

## 18. Quick Reference Cheat Sheet

```
┌─────────────────────────────────────────────────────────────┐
│                    NEUMORPHISM CHEAT SHEET                  │
├─────────────────────────────────────────────────────────────┤
│ BACKGROUND      One soft color, e.g. #E0E5EC                │
│ ELEMENT FILL    SAME as background                          │
│ LIGHT SHADOW    lighter tint, top-left (-x, -y)             │
│ DARK SHADOW     darker shade, bottom-right (+x, +y)         │
│ BLUR            20–60 px (larger element → larger blur)     │
│ OFFSET          8–20 px                                     │
│ RADIUS          12–40 px (rounded)                          │
│ RAISED          outer dual shadow                           │
│ PRESSED         inset dual shadow (flipped offsets)         │
│ FOCUS           explicit ring (never shadow alone)          │
│ TEXT            high contrast (WCAG 4.5:1)                  │
│ ACCENT          1 accent color for interactives             │
│ DARK MODE       keep light/dark deltas tiny                 │
└─────────────────────────────────────────────────────────────┘
```

### One-Line CSS Templates

```css
/* Raised */
box-shadow: -12px -12px 30px #fff, 12px 12px 30px #a3b1c6;

/* Recessed */
box-shadow: inset 12px 12px 30px #a3b1c6, inset -12px -12px 30px #fff;
```

---

## Conclusion

Neumorphism is a **visually elegant, tactile-feeling UI style** that evokes soft, molded physical surfaces. Its beauty lies in its **simplicity and restraint** — one color, two shadows, and a consistent light source.

Its weakness is equally clear: **low contrast and ambiguous affordance** make it risky for high-stakes, data-dense, or accessible-critical interfaces.

**The professional consensus:** use neumorphism **deliberately and sparingly** — as an accent, a dashboard skin, or a brand texture — while keeping interactive clarity and accessibility non-negotiable. When executed with an accent color, explicit focus states, and careful contrast management, it can be both **beautiful and usable**.

> *"Neumorphism is not a design system — it is a texture. Treat it as one."*
" 
make sure every thing is well structured and organized  and apply this with out any error.
also add an an emi section in the student add an option for emi selection and then in the fees section it should be in installments for each month or add selection in for how much month installment but shount exxced by the 11 month 