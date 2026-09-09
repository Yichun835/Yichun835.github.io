/*
 * Homepage-only adaptation of React Bits Silk, copyright (c) 2026 David Haz.
 * Original: https://reactbits.dev/backgrounds/silk
 * MIT + Commons Clause; full notice in /licenses/react-bits.md.
 * Keeps the original silk pattern; adds a graphite palette, reading scrim,
 * bounded resolution, and a visibility/theme/reduced-motion-aware lifecycle.
 * No React, Three.js, external assets, pointer input, or postprocessing needed.
 */
(() => {
  "use strict";

  const body = document.body;
  if (!body?.classList.contains("yc-home-page") || document.getElementById("yc-home-silk")) return;

  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.createElement("canvas");
  canvas.id = "yc-home-silk";
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.renderer = "fallback";
  canvas.dataset.motion = "paused";
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
    uniform float uTime;
    uniform vec2 uResolution;

    const float e = 2.71828182845904523536;
    float noise(vec2 texCoord) {
      vec2 r = e * sin(e * texCoord);
      return fract(r.x * r.y * (1.0 + texCoord.x));
    }
    vec2 rotateUvs(vec2 uv, float angle) {
      float c = cos(angle);
      float s = sin(angle);
      return mat2(c, -s, s, c) * uv;
    }
    void main() {
      // Preserve broad folds at every aspect ratio, including portrait phones.
      float aspect = uResolution.x / uResolution.y;
      vec2 framed = (vUv - 0.5) * vec2(max(1.0, aspect), max(1.0, 1.0 / aspect));
      vec2 tex = rotateUvs(framed * 0.78 + 0.5, -0.18);
      float tOffset = uTime * 0.48;
      tex.y += 0.03 * sin(8.0 * tex.x - tOffset);
      float pattern = 0.6 + 0.4 * sin(
        5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * tOffset)
        + sin(20.0 * (tex.x + tex.y - 0.1 * tOffset))
      );

      // A matte black body and cool graphite highlights, never a bright ribbon.
      float fold = smoothstep(0.22, 1.0, pattern);
      float sheen = pow(fold, 2.5);
      float shoulders = smoothstep(0.10, 0.48, abs(vUv.x - 0.5));
      float readingScrim = mix(0.33, 1.0, shoulders);
      float vignette = 1.0 - smoothstep(0.42, 0.85, length(vUv - 0.5)) * 0.45;
      vec3 black = vec3(0.021, 0.024, 0.029);
      vec3 graphite = vec3(0.095, 0.107, 0.121) * fold;
      vec3 silver = vec3(0.055, 0.063, 0.071) * sheen;
      float grain = (noise(gl_FragCoord.xy) - 0.5) * 0.003;
      vec3 color = black + (graphite + silver) * readingScrim * vignette + grain;
      gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
    }
  `;

  let gl;
  let program;
  let buffer;
  let timeLocation;
  let resolutionLocation;
  let frame = 0;
  let previousTime = 0;
  let lastDraw = 0;
  let elapsed = globalThis.ycSilkState?.read() ?? 4;
  let renderedFrames = 0;
  let suspended = false;
  let lost = false;
  let disposed = false;

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
          throw new Error("Silk shader unavailable");
        }
        return shader;
      };
      let vertex;
      let fragment;
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
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Silk program unavailable");
      gl.useProgram(program);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Buffer allocation failed");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      timeLocation = gl.getUniformLocation(program, "uTime");
      resolutionLocation = gl.getUniformLocation(program, "uResolution");
      canvas.dataset.renderer = "webgl";
      return true;
    } catch {
      releaseResources();
      canvas.dataset.renderer = "fallback";
      return false;
    }
  };
  const isDark = () => root.classList.contains("dark");
  const canAnimate = () => !disposed && !lost && !suspended && !document.hidden && isDark()
    && !root.classList.contains("yc-theme-transitioning")
    && !reducedMotion.matches && !body.classList.contains("yc-opening-active");
  const paint = () => {
    if (!program || lost) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    renderedFrames += 1;
    // Sparse diagnostic updates, rather than DOM writes on every animation frame.
    if (renderedFrames === 1 || renderedFrames % 60 === 0) {
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
  const tick = (now) => {
    frame = 0;
    if (!canAnimate()) { stop(); return; }
    if (previousTime) elapsed += Math.min((now - previousTime) / 1000, 0.08);
    previousTime = now;
    const interval = innerWidth < 720 ? 1000 / 24 : 1000 / 30;
    if (!lastDraw || now - lastDraw >= interval - 0.5) {
      paint();
      lastDraw = now;
    }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    if (!program || disposed || lost) return;
    if (canAnimate()) {
      if (!frame) {
        canvas.dataset.motion = "flowing";
        frame = requestAnimationFrame(tick);
      }
    } else {
      stop();
      if (isDark() && !document.hidden && !suspended) paint();
    }
  };
  const resize = () => {
    if (!program || disposed || lost) return;
    const w = document.documentElement.clientWidth || innerWidth;
    const h = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(1400000 / (w * h)));
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    if (isDark()) paint();
    sync();
  };

  if (!initialize()) return; // CSS supplies a quiet black fallback.
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
  observer.observe(body, { attributes: true, attributeFilter: ["class"] });
  addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", sync);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    stop();
    canvas.dataset.renderer = "fallback";
  });
  canvas.addEventListener("webglcontextrestored", () => {
    if (disposed) return;
    lost = false;
    buffer = null;
    program = null;
    if (initialize()) resize();
  });
  addEventListener("pageswap", () => { globalThis.ycSilkState?.save(elapsed); stop(); });
  addEventListener("pagehide", (event) => {
    globalThis.ycSilkState?.save(elapsed);
    suspended = true;
    stop();
    if (!event.persisted) {
      disposed = true;
      observer.disconnect();
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
