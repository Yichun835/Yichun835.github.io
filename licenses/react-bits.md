# React Bits — effects attribution

`js/home-silk.js` adapts the Silk shader for this personal website.
Source: https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/Silk/Silk.jsx
Retrieved: 2026-09-08. Changes: native WebGL integration, graphite color treatment,
reading-area attenuation, responsive resolution limit, animation lifecycle and fallbacks.

`js/home-polish.js` implements lightweight native adaptations inspired by
[BlurText](https://github.com/DavidHDev/react-bits/blob/main/src/content/TextAnimations/BlurText/BlurText.jsx),
[AnimatedContent](https://github.com/DavidHDev/react-bits/blob/main/src/content/Animations/AnimatedContent/AnimatedContent.jsx), and
[Magnet](https://github.com/DavidHDev/react-bits/blob/main/src/content/Animations/Magnet/Magnet.jsx).
Retrieved: 2026-09-08. Changes: smaller distances, native Web Animations/IntersectionObserver,
one-shot entrances coordinated with Welcome and page transitions, local pointer-only
attraction, keyboard/reduced-motion fallbacks; no React, Motion or GSAP runtime added.

The inactive source archive `js/splash-cursor.js` adapts
[SplashCursor](https://github.com/DavidHDev/react-bits/blob/main/src/content/Animations/SplashCursor/SplashCursor.jsx).
Retrieved: 2026-09-08; palette revised 2026-09-09. Changes: native WebGL integration, daytime blue mist / pure-white nighttime palette,
narrower radius and faster decay, theme-aware shading with low-density haze removal,
bounded resolution, mouse-only input,
idle/background/reduced-motion pausing, render-target cleanup, context-loss and
unsupported-device fallbacks. No React runtime or external CDN dependency.
Disabled on 2026-09-09 at the user's request; no live page loads this renderer.

`js/profile-rays.js` retains its legacy filename, but now adapts the same
[Silk](https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/Silk/Silk.jsx)
pattern as `js/home-silk.js`, replacing the previous Light Rays pattern on 2026-09-09.
Changes: left reading-area attenuation, bounded highlights, pearl light/black night
palette, no mouse following or noise, native WebGL lifecycle and resolution caps.
The profile heading treatment in `css/aurora.css` adapts
[Shiny Text](https://github.com/DavidHDev/react-bits/blob/main/src/content/TextAnimations/ShinyText/ShinyText.jsx)
with one CSS gradient pass, readable resting colors and reduced-motion support.
Neither adaptation adds React, OGL or Motion dependencies.

Upstream license: https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md

---

MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
