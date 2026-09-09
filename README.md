# Personal homepage

This repository contains the generated static files for the personal homepage.

## Local preview

Use the project-managed `uv` environment:

```bash
uv sync
uv run python tools/preview.py
```

Then open http://127.0.0.1:8000. Stop the preview with `Ctrl+C`.

## Visual customization

The shared visual design lives in `css/aurora.css`. The lightweight particle
background and homepage embellishments live in `js/aurora.js`.

The dark homepage lazily loads `js/home-silk.js`, a dependency-free WebGL
adaptation of React Bits Silk. It does not follow the pointer or page scroll.
The homepage light theme keeps its existing background. Rendering pauses
while hidden, behind the welcome screen, or when reduced motion is requested;
unsupported WebGL falls back to the static graphite background.
See `licenses/react-bits.md` for the source and license notice.

Run the background lifecycle checks with `uv run node tools/test_home_silk.mjs`
(requires Node.js on the local PATH).

The homepage also loads `js/home-polish.js`: a one-time soft-focus name entrance,
staggered Friends/Mentors reveals, and subtle mouse-only button attraction.
These native enhancements wait for Welcome/page transitions, respect reduced motion,
and leave content and keyboard navigation usable without animation dependencies.
Run their behavior checks with `uv run node tools/test_home_polish.mjs`.

The site now uses the native pointer only: no smoke, glass lens or full-screen
cursor trail is loaded. `js/splash-cursor.js` and its test are retained as inactive
source history, not requested or initialized by any page.

About, Research, CV and Contact share compact profile-page headers and typography.
About uses a responsive two-column photo layout and unboxed rotating identity text;
CV enhances the original lists
without changing their text or anchor destinations. Chinese and English pages use
the same shared styles and scripts.

Subpages load `js/profile-rays.js` (legacy filename), a native WebGL adaptation of
the same React Bits Silk pattern used by the homepage: visible satin folds over
pearl-white (day) or neutral black (night), with the highlights toward the margins.
The folds flow independently of scrolling and pointer movement, with a quieter
reading column, no grain, no colored fog and no additional stars. One canvas serves
both themes, without layering translucent effects over each other.
It caps rendering at 30 fps (20 on narrow screens), limits the framebuffer to about
1.1 million pixels, pauses for overlays, navigation and hidden tabs, and supplies
still-frame/reduced-motion and CSS/WebGL fallback treatments.
About, Research and CV titles use a single Shiny Text-style light pass; Contact
keeps its existing particle heading. No React, OGL or Motion runtime was added.
Run `uv run node tools/test_profile_rays.mjs` for lifecycle checks.
Research presents its four peer interests as a single, plain bulleted list in both
languages, without card borders, heading-sized labels or navigation affordances.
The shared background is unchanged. The former Ferrofluid card renderer
is retained as an inactive source file and is no longer loaded.
Navigation, typography and the Contact loop share neutral surface/color tokens;
the homepage retains its avatar, one-row Friends, Mentors, always-lit Contact button,
layout switching and audio controls. Contact's particle heading is monochrome.

The header wordmark is Yichun Lu (陆倚淳 in Chinese). Appearance controls live in a
keyboard-accessible header disclosure; the homepage's Switch layout action delegates
to the original layout button/PixelSwap handler instead of occupying the hero.
Contact's Email pill contains separate mail and copy controls, fixed-width Copied/已复制
feedback, a polite status announcement and a clipboard fallback. Pointer clicks resume
the marquee; keyboard focus pauses it. No additional contact row is added.
`img/yichun-home-portrait.jpg` is the user's unchanged original photo, used by all
three avatar-bearing homepage layouts in both languages. CSS frames it in the existing
round spotlight; About's formal portrait, mentors and friends are unchanged.
Run `uv run node tools/test_site_controls.mjs` for the copy/state/avatar checks.

The homepage portrait has a static bronze frame, without glow or pointer movement.
Mobile Menu keeps its staggered entrance using champagne/cream day and bronze/warm-black
night layers; these accents appear briefly before the unchanged neutral panel arrives. Keyboard focus
remains visible. Run `uv run node tools/test_mobile_menu.mjs` for palette checks.
Day/night switching uses a 1.6-second CSS snapshot reveal with a gradual finish;
snapshot-relative geometry prevents cropped masks at different display scales.
Contact assembles its particle heading by elapsed time rather than frame count,
and resizing preserves the completed title. Run
`uv run node tools/test_visual_transitions.mjs` for these regression checks.

Same-origin page navigation uses native cross-document View Transitions when
available: stable navigation, a continuous background crossfade and separate content
fades. Homepage/subpage silk shares its fold geometry and a session-only phase
handoff, including back/forward restoration; theme-specific brightness is preserved.
It does not intercept links or wait for a cover animation. Older browsers and
the homepage Switch layout action retain a shorter PixelSwap; reduced motion
disables both effects. Theme-switch transitions remain independent.
Run `uv run node tools/test_page_navigation.mjs` for navigation behavior checks.
