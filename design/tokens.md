# Tokens

Single source of truth. Every component references tokens by name. Dark mode only — there is no light variant for Noah2.

## Color decisions

The brief specified `#FFC107` as accent-primary and `#FFE600` (EY Yellow) in the pasted hex set, alongside two EY brand logos. Two brand yellows next to each other create visible drift on logo lockups. Resolved as:

- `--color-accent-primary` = `#FFE600` (EY Yellow) — primary action, brand surfaces, focus rings on critical elements
- `--color-warning` = `#FFC107` (amber) — caution states, "needs attention" indicators
- `--color-info` = `#2196F3` (the brief's accent-secondary) — informational tags, links, jurisdiction markers

The extracted palette included six accent hues. For a tool reviewed by lawyers across jurisdictions, six accents is too noisy. Purple and cyan from the extracted palette are dropped from product surfaces and reserved only for admin's per-LLM cost tracking charts.

## Color tokens

```
/* Surface */
--color-canvas:           #0B0B0C   /* page background */
--color-surface:          #141416   /* card, panel */
--color-surface-raised:   #1C1C1F   /* hover, dropdown, sticky header */
--color-surface-sunken:   #08080A   /* code, input field */
--color-overlay:          rgba(0,0,0,0.72)  /* slide-over backdrop */

/* Border */
--color-border:           #2A2A2E   /* default 1px */
--color-border-strong:    #3A3A40   /* hovered, focused-within */
--color-border-subtle:    #1F1F22   /* table row dividers */

/* Text */
--color-text:             #F5F5F4   /* body, primary */
--color-text-muted:       #B8B8B5   /* secondary, hints */
--color-text-faint:       #7A7A77   /* tertiary, placeholder */
--color-text-on-yellow:   #0B0B0C   /* text sitting on EY yellow */

/* Brand & accent */
--color-accent-primary:   #FFE600   /* EY Yellow — primary action */
--color-accent-primary-hover: #FFEB33
--color-accent-primary-pressed: #E6CF00
--color-accent-secondary: #4696FF   /* informational blue */
--color-accent-secondary-hover: #6DAEFF

/* Semantic */
--color-info:             #4696FF
--color-info-surface:     #0F1E33
--color-success:          #4CAF50
--color-success-surface:  #0F2310
--color-warning:          #FFC107
--color-warning-surface:  #2A2207
--color-danger:           #FF5722
--color-danger-surface:   #2A0E07

/* Status pill backgrounds (review states) */
--color-status-draft:           #2A2A2E   /* gray */
--color-status-in-review:       #0F1E33   /* info blue surface */
--color-status-needs-input:     #2A2207   /* warning surface */
--color-status-approved:        #0F2310   /* success surface */
--color-status-rejected:        #2A0E07   /* danger surface */
--color-status-escalated:       #1F0F2A   /* purple surface — used here only */

/* Focus */
--color-focus-ring:       #FFE600
--focus-ring-offset:      #0B0B0C
```

## Typography

Brand fonts are Segoe UI and Arial, declared by the user as authoritative. Cascadia Code is the mono companion (Microsoft's mono partner to Segoe; ships with Windows; brand-coherent). Segoe UI is never used for tabular data — that fails the `monospace-as-technical` ban only when forced; it succeeds when mono is used for actual character-aligned data.

```
--font-display: "Segoe UI", "Segoe UI Variable Display", "Helvetica Neue", Arial, sans-serif
--font-body:    "Segoe UI", "Segoe UI Variable Text", "Helvetica Neue", Arial, sans-serif
--font-mono:    "Cascadia Code", "Cascadia Mono", "SF Mono", "Consolas", monospace

/* Scale — compact density, product register, no flat hierarchy */
--text-display-l: 36px / 1.15 / -0.01em / 600
--text-display-m: 28px / 1.2  / -0.005em / 600
--text-display-s: 22px / 1.25 / 0 / 600
--text-heading-l: 18px / 1.3  / 0 / 600
--text-heading-m: 16px / 1.35 / 0 / 600
--text-heading-s: 14px / 1.4  / 0.01em / 600
--text-body-l:    16px / 1.5  / 0 / 400
--text-body-m:    14px / 1.5  / 0 / 400   /* default body — at the 14px floor */
--text-body-s:    13px / 1.4  / 0.005em / 400  /* metadata, captions only */
--text-mono-m:    13px / 1.5  / 0 / 400
--text-mono-s:    12px / 1.4  / 0 / 400
--text-label:     12px / 1.3  / 0.04em / 600 / uppercase  /* form labels, status pill */
```

Body-s and mono-s sit below the 14px floor. They are permitted only for: timestamps, IDs, version hashes, and form-field metadata under inputs — never for sentence-level body content.

## Spacing — compact density

```
--space-0:  0
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px

--container-max:    1280px
--content-max-ch:   72ch       /* line-length cap, just under 75 floor */
--icon-rail-width:  56px       /* collapsed */
--icon-rail-width-expanded: 240px
--queue-pane-width: 360px
```

## Radius — rounded button shape, restrained elsewhere

```
--radius-sm: 4px    /* input, status pill */
--radius-md: 6px    /* card, panel, table cell highlight */
--radius-lg: 8px    /* button, dropdown */
--radius-pill: 999px /* status pill, tag */
--radius-full: 50%  /* icon-rail dot indicator only */
```

## Elevation — sharp shadow philosophy

Shadows are defined and offset, not soft and diffuse. Dark mode means shadows do less heavy lifting; we lean on borders and surface tints.

```
--shadow-0: none
--shadow-1: 0 1px 0 0 rgba(0,0,0,0.4)                       /* table sticky header */
--shadow-2: 0 4px 0 -2px rgba(0,0,0,0.6), 0 0 0 1px var(--color-border)  /* dropdown */
--shadow-3: 0 12px 0 -4px rgba(0,0,0,0.7), 0 0 0 1px var(--color-border-strong) /* slide-over */
--shadow-focus: 0 0 0 2px var(--focus-ring-offset), 0 0 0 4px var(--color-focus-ring)
```

## Motion — snappy, 120–180ms ease-out

Animate transform and opacity only. No width/height/padding/margin transitions.

```
--motion-instant: 0ms
--motion-fast:    120ms cubic-bezier(0.2, 0.8, 0.2, 1)
--motion-base:    160ms cubic-bezier(0.2, 0.8, 0.2, 1)
--motion-slow:    220ms cubic-bezier(0.2, 0.8, 0.2, 1)   /* slide-over only */
--motion-tooltip: 0ms                                    /* instant tooltip behaviour */
```

## Z-index

```
--z-base:        0
--z-sticky:      10
--z-icon-rail:   20
--z-dropdown:    30
--z-slide-over:  40
--z-toast:       50
--z-focus-trap:  60   /* destructive inline confirm */
```

## Density modes

Default is compact. Admin tables stay compact. Question canvases use comfortable inside the question card to give legal text room.

```
--density-compact-row:      32px
--density-comfortable-row:  44px
--density-compact-pad:      var(--space-3)
--density-comfortable-pad:  var(--space-4)
```