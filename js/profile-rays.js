/* React Bits Silk, adapted for this static personal website.
 * Copyright (c) 2026 David Haz. MIT + Commons Clause; /licenses/react-bits.md.
 * Original: reactbits.dev/backgrounds/silk (also used by js/home-silk.js).
 * Flowing satin folds, a quiet reading area, no pointer tracking or noise.
 * The existing profile-rays filename/ID is retained for lifecycle compatibility.
 */
(() => {
  "use strict";
  const body = document.body;
  if (!body?.classList.contains("yc-profile-page") || document.getElementById("yc-profile-rays")) return;
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.createElement("canvas");
  canvas.id = "yc-profile-rays";
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.renderer = "fallback";
  canvas.dataset.motion = "paused";
  canvas.dataset.palette = "pearl-white";
  canvas.dataset.pattern = "silk";
  body.prepend(canvas);

  const vertexSource = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision highp float;
    varying vec2 vUv;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uDark;

    vec2 rotateUvs(vec2 uv, float angle) {
      float c = cos(angle);
      float s = sin(angle);
      return mat2(c, -s, s, c) * uv;
    }
    void main() {
      // Same folded-silk pattern as the homepage, framed for long-form pages.
      float aspect = uResolution.x / uResolution.y;
      vec2 framed = (vUv - 0.5) * vec2(max(1.0, aspect), max(1.0, 1.0 / aspect));
      vec2 tex = rotateUvs(framed * 0.78 + 0.5, -0.18);
      float tOffset = uTime * 0.48;
      tex.y += 0.03 * sin(8.0 * tex.x - tOffset);
      float pattern = 0.6 + 0.4 * sin(
        5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * tOffset)
        + sin(20.0 * (tex.x + tex.y - 0.1 * tOffset))
      );
      float fold = smoothstep(0.18, 1.0, pattern);
      float sheen = pow(fold, 3.0);
      // Visible throughout the viewport, quieter beneath the left reading column.
      float shoulder = mix(0.42, 1.0, smoothstep(0.18, 0.92, vUv.x));
      float vignette = 1.0 - smoothstep(0.38, 0.82, length(vUv - 0.5)) * 0.25;
      float energy = (0.68 * fold + 0.32 * sheen) * shoulder * vignette;
      // Peak night channel <= 0.235: secondary text remains readable at any phase.
      vec3 day = vec3(0.9804, 0.9765, 0.9686) - vec3(0.08, 0.077, 0.072) * energy;
      vec3 night = vec3(0.0235 + 0.2115 * energy);
      gl_FragColor = vec4(mix(day, night, uDark), 1.0);
    }
  `;

  let gl, program, buffer, uniforms;
  let frame = 0, previousTime = 0, lastDraw = 0, elapsed = globalThis.ycSilkState?.read() ?? 4, renderedFrames = 0;
  let suspended = false, lost = false, disposed = false;
  const releaseResources = () => {
    if (!gl || lost) return;
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    buffer = null;
    program = null;
  };
  const initialize = () => {
    try {
      gl ||= canvas.getContext("webgl", {
        alpha: false, antialias: false, depth: false, stencil: false,
        powerPreference: "low-power", preserveDrawingBuffer: false,
      });
      if (!gl) return false;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Shader allocation failed");
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          throw new Error("Profile Silk shader unavailable");
        }
        return shader;
      };
      let vertex, fragment;
      try {
        vertex = compile(gl.VERTEX_SHADER, vertexSource);
        fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
        program = gl.createProgram();
        if (!program) throw new Error("Program allocation failed");
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
      } finally {
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
      }
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Profile Silk program unavailable");
      gl.useProgram(program);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Buffer allocation failed");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      uniforms = Object.fromEntries(["uTime", "uResolution", "uDark"].map(name => [name, gl.getUniformLocation(program, name)]));
      canvas.dataset.renderer = "webgl";
      return true;
    } catch {
      releaseResources();
      canvas.dataset.renderer = "fallback";
      return false;
    }
  };
  const canAnimate = () => !disposed && !lost && !suspended && !document.hidden
    && !root.classList.contains("yc-theme-transitioning")
    && !reducedMotion.matches && !body.classList.contains("yc-opening-active")
    && !body.classList.contains("medium-zoom--opened") && !body.classList.contains("yc-mobile-menu-open")
    && (!body.dataset.pixelState || body.dataset.pixelState === "idle");
  const paint = () => {
    if (!program || lost || disposed) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.uDark, root.classList.contains("dark") ? 1 : 0);
    gl.uniform1f(uniforms.uTime, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (++renderedFrames === 1 || renderedFrames % 60 === 0) {
      canvas.dataset.frames = String(renderedFrames);
      canvas.dataset.phase = elapsed.toFixed(3);
    }
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    lastDraw = 0;
    canvas.dataset.motion = "paused";
  };
  const tick = now => {
    frame = 0;
    if (!canAnimate()) { stop(); return; }
    if (previousTime) elapsed += Math.min((now - previousTime) / 1000, 0.08);
    previousTime = now;
    const interval = innerWidth < 720 ? 1000 / 20 : 1000 / 30;
    if (!lastDraw || now - lastDraw >= interval - 0.5) { paint(); lastDraw = now; }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    if (!program || disposed || lost) return;
    if (!document.hidden && !suspended) paint(); // Theme changes also update a still frame.
    if (canAnimate()) {
      if (!frame) { canvas.dataset.motion = "flowing"; frame = requestAnimationFrame(tick); }
    } else stop();
  };
  const resize = () => {
    if (!program || disposed || lost) return;
    const w = root.clientWidth || innerWidth;
    const h = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(1100000 / (w * h)));
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    sync();
  };
  if (!initialize()) return; // The matching CSS gradient remains readable.
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
  observer.observe(body, { attributes: true, attributeFilter: ["class", "data-pixel-state"] });
  addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", sync);
  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault(); lost = true; stop(); canvas.dataset.renderer = "fallback";
  });
  canvas.addEventListener("webglcontextrestored", () => {
    if (disposed) return;
    lost = false; buffer = null; program = null;
    if (initialize()) resize();
  });
  addEventListener("pageswap", () => { globalThis.ycSilkState?.save(elapsed); stop(); });
  addEventListener("pagehide", event => {
    globalThis.ycSilkState?.save(elapsed);
    suspended = true; stop();
    if (!event.persisted) {
      disposed = true; observer.disconnect();
      removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      reducedMotion.removeEventListener("change", sync);
      releaseResources();
    }
  });
  addEventListener("pageshow", () => {
    if (!disposed) { elapsed = globalThis.ycSilkState?.read(elapsed) ?? elapsed; suspended = false; sync(); }
  });
  resize();
})();
