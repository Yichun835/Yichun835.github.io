(() => {
  "use strict";

  const stage = document.querySelector(".article-content");

  if (!stage || stage.classList.contains("yc-research-stage")) {
    return;
  }

  stage.classList.add("yc-research-stage");
  stage.dataset.background = "ferrofluid";

  const field = document.createElement("div");
  const canvas = document.createElement("canvas");
  field.className = "yc-research-ferrofluid";
  field.setAttribute("aria-hidden", "true");
  canvas.setAttribute("aria-hidden", "true");
  field.append(canvas);
  stage.prepend(field);

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    powerPreference: "low-power",
    premultipliedAlpha: true,
  });

  if (!gl) {
    field.dataset.fallback = "true";
    return;
  }

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

    uniform vec2 iResolution;
    uniform vec2 iMouse;
    uniform float iTime;
    uniform vec3 uColor0;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uOpacity;
    varying vec2 vUv;

    #define PI 3.14159265

    vec3 palette(float h) {
      if (h < 0.34) return uColor0;
      if (h < 0.67) return uColor1;
      return uColor2;
    }

    float hash(vec3 p3) {
      p3 = fract(p3 * 0.1031);
      p3 += dot(p3, p3.zyx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float smin(float a, float b, float k) {
      float r = exp2(-a / k) + exp2(-b / k);
      return -k * log2(r);
    }

    float sinlerp(float a, float b, float w) {
      return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
    }

    float vn(vec2 p, float s, float seed) {
      vec2 cell = floor(p / s);
      vec2 rel = mod(p, s) / s;
      float g1 = hash(vec3(cell, seed));
      float g2 = hash(vec3(cell.x + 1.0, cell.y, seed));
      float g3 = hash(vec3(cell.x + 1.0, cell.y + 1.0, seed));
      float g4 = hash(vec3(cell.x, cell.y + 1.0, seed));
      return sinlerp(sinlerp(g1, g2, rel.x), sinlerp(g4, g3, rel.x), rel.y);
    }

    float dbn(vec2 p, float s, float seed) {
      float base = vn(p, s, seed);
      float offset = vn(p + vec2(s * 0.5), s, seed + 0.27);
      return base * 0.62 + offset * 0.38;
    }

    void main() {
      float ref = 452.0;
      vec2 p = vUv * iResolution / iResolution.y * ref;
      float t = iTime * 27.0;
      vec2 dir = vec2(0.0, -1.0);
      vec2 perp = vec2(1.0, 0.0);

      float distort1 = vn(p + perp * t, 56.0, 10.0) * 38.0;
      float distort2 = vn(p - perp * t * 0.72, 108.0, 15.0) * 68.0;
      float peaks = dbn(p + distort1 + dir * t * 0.48, 38.0, 1.0);
      float peaks2 = dbn(p + distort2 - dir * t * 0.42, 42.0, 0.0);

      vec2 mouse = iMouse / iResolution.y * ref;
      float mouseDistance = length(p - mouse) / ref;
      float mouseField = exp(-mouseDistance * mouseDistance / 0.07) * 0.16;
      float merged = smin(peaks, peaks2, 0.11) + mouseField;
      float rim = (0.23 - abs((merged - 0.4) * 2.0)) * 5.0;
      float shimmer = vn(p + dir * t * 0.45, 62.0, 12.0) * 1.12;
      float light = pow(clamp(rim - shimmer, 0.0, 1.0), 2.5) * 1.9;
      float hue = clamp(0.5 + (peaks - peaks2) * 0.86, 0.0, 1.0);
      vec3 color = palette(hue) * light;
      float alpha = clamp(light * 0.74, 0.0, 1.0) * uOpacity;
      gl_FragColor = vec4(color, alpha);
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) {
    field.dataset.fallback = "true";
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    field.dataset.fallback = "true";
    return;
  }

  gl.useProgram(program);
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution: gl.getUniformLocation(program, "iResolution"),
    mouse: gl.getUniformLocation(program, "iMouse"),
    time: gl.getUniformLocation(program, "iTime"),
    color0: gl.getUniformLocation(program, "uColor0"),
    color1: gl.getUniformLocation(program, "uColor1"),
    color2: gl.getUniformLocation(program, "uColor2"),
    opacity: gl.getUniformLocation(program, "uOpacity"),
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let frame = 0;
  let visible = true;
  let width = 1;
  let height = 1;
  let ratio = 1;
  let lastTime = performance.now();

  const colorToRgb = (hex) => {
    const value = hex.replace("#", "");
    return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  };

  const updatePalette = () => {
    const dark = document.documentElement.classList.contains("dark");
    const palette = dark
      ? ["#69d4ff", "#57f0df", "#a08cff"]
      : ["#3b86a8", "#43aeb2", "#6975bf"];
    gl.useProgram(program);
    gl.uniform3fv(uniforms.color0, colorToRgb(palette[0]));
    gl.uniform3fv(uniforms.color1, colorToRgb(palette[1]));
    gl.uniform3fv(uniforms.color2, colorToRgb(palette[2]));
    gl.uniform1f(uniforms.opacity, dark ? 0.96 : 0.68);
  };

  const resize = () => {
    const bounds = stage.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    ratio = Math.min(window.devicePixelRatio || 1, width < 720 ? 0.9 : 1.25);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    pointer.x = pointer.targetX = canvas.width * 0.72;
    pointer.y = pointer.targetY = canvas.height * 0.5;
  };

  const render = (time) => {
    const delta = Math.min(0.05, Math.max(0.001, (time - lastTime) / 1000));
    lastTime = time;
    const damp = 1 - Math.exp(-delta / 0.14);
    pointer.x += (pointer.targetX - pointer.x) * damp;
    pointer.y += (pointer.targetY - pointer.y) * damp;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.mouse, pointer.x, pointer.y);
    gl.uniform1f(uniforms.time, time * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const animate = (time) => {
    frame = 0;
    render(time);

    if (visible && !document.hidden && !reducedMotion.matches) {
      frame = window.requestAnimationFrame(animate);
    }
  };

  const refresh = () => {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }

    if (visible && !document.hidden && !reducedMotion.matches) {
      lastTime = performance.now();
      frame = window.requestAnimationFrame(animate);
    } else {
      render(1350);
    }
  };

  stage.addEventListener(
    "pointermove",
    (event) => {
      const bounds = stage.getBoundingClientRect();
      pointer.targetX = (event.clientX - bounds.left) * ratio;
      pointer.targetY = (bounds.height - (event.clientY - bounds.top)) * ratio;
    },
    { passive: true },
  );
  stage.addEventListener("pointerleave", () => {
    pointer.targetX = canvas.width * 0.72;
    pointer.targetY = canvas.height * 0.5;
  });

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => {
      resize();
      refresh();
    }).observe(stage);
  } else {
    window.addEventListener(
      "resize",
      () => {
        resize();
        refresh();
      },
      { passive: true },
    );
  }

  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        refresh();
      },
      { rootMargin: "120px 0px" },
    ).observe(stage);
  }

  new MutationObserver(() => {
    updatePalette();
    render(performance.now());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  document.addEventListener("visibilitychange", refresh);
  reducedMotion.addEventListener("change", refresh);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    field.dataset.fallback = "true";

    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  });

  updatePalette();
  resize();
  refresh();
})();
