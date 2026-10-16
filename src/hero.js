import * as THREE from "three";
import Lenis from "lenis";

/* ============================================================
   IMAGES  (paths are relative to src/index.html)
   The first file that loads is used, so a missing one won't break the hero.
   ============================================================ */
const HUMAN_FILES = ["../images/black.png"];
const MONSTER_FILES = ["../images/red.png"];

/* ============================================================
   HELPERS
   ============================================================ */
history.scrollRestoration = "manual";
scrollTo(0, 0);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const fail = (msg) => {
  const box = $("#err");
  if (!box) return;
  box.style.display = "block";
  box.textContent += msg + "  ";
};

const reduceMotion = matchMedia("(prefers-reduced-motion:reduce)").matches;

// scale the layout up on very wide (landscape) screens
const setRootSize = () => {
  if (innerWidth > 1920 && innerWidth > innerHeight) {
    document.documentElement.style.fontSize = (16 * innerWidth) / 1920 + "px";
  } else {
    document.documentElement.style.removeProperty("font-size");
  }
};
setRootSize();
addEventListener("resize", setRootSize);

/* ============================================================
   SHARED TICKER  (one requestAnimationFrame loop for everything)
   sub(callback, getMinIntervalMs) -> unsubscribe
   ============================================================ */
const subs = new Set();
let rafId = 0;

const tick = (t) => {
  subs.forEach((s) => {
    if (t - s.last > s.interval()) {
      s.last = t;
      s.cb(t);
    }
  });
  rafId = requestAnimationFrame(tick);
};

const sub = (cb, interval = () => 0) => {
  const s = { cb, interval, last: 0 };
  subs.add(s);
  if (!rafId) rafId = requestAnimationFrame(tick);
  return () => subs.delete(s);
};

/* ============================================================
   SMOOTH SCROLL (Lenis)
   ============================================================ */
if (!reduceMotion) {
  const lenis = new Lenis({ smoothWheel: true, wheelMultiplier: 1.6, lerp: 0.12 });
  sub((t) => lenis.raf(t));
}

/* ============================================================
   HERO TEXT ENTRANCE
   ============================================================ */
const rise = (el, delay) => {
  const anim = el.animate(
    [
      { opacity: 0, transform: "translateY(1.25rem)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 900, delay, easing: "cubic-bezier(.2,0,0,1)", fill: "both" }
  );
  // once finished, drop the animation: a lingering transform animation would make the
  // full-screen mobile menu (position: fixed) size itself to the header instead of the screen
  anim.finished.then(() => anim.cancel()).catch(() => {});
  return anim;
};

function entrance() {
  $$("[data-r]").forEach((el) => rise(el, +el.dataset.r));

  const title = $("#hname");
  if (!title) return;

  const lines = title.dataset.lines.split("|");
  title.innerHTML = "";
  let wordIndex = 0;

  lines.forEach((line) => {
    const row = document.createElement("div");
    row.className = "ln";

    line.split(" ").forEach((word) => {
      const span = document.createElement("span");
      span.textContent = word;
      row.append(span);
      span.animate(
        [
          { opacity: 0, transform: "translateY(.35em)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 800,
          delay: 180 + wordIndex++ * 110,
          easing: "cubic-bezier(.2,0,0,1)",
          fill: "both",
        }
      );
    });

    title.append(row);
  });
}

/* ============================================================
   STICKY STACK  (hero + about recede as the next layer covers them)
   ============================================================ */
const layers = $$("#stack>.layer");
const pinned = layers.slice(0, 2).map((layer, i) => ({
  inner: $(".inner", layer),
  shade: $(".shade", layer),
  next: layers[i + 1],
}));

const phone = matchMedia("(max-width:639px)");
let applyQueued = 0;

const applyStack = () => {
  applyQueued = 0;
  const vh = innerHeight || 1;
  const shrink = phone.matches ? 0 : 0.1;

  for (const { inner, shade, next } of pinned) {
    const p = Math.min(1, Math.max(0, 1 - next.getBoundingClientRect().top / vh));
    inner.style.transform = p > 0 && shrink > 0 ? `scale(${1 - shrink * p})` : "";
    shade.style.opacity = 0.55 * p;
    inner.style.visibility = p >= 1 ? "hidden" : "visible";
  }
};

addEventListener(
  "scroll",
  () => {
    if (!applyQueued) applyQueued = requestAnimationFrame(applyStack);
  },
  { passive: true }
);

/* ============================================================
   CHEQUERED DISSOLVE  (hero -> about)
   ============================================================ */
const dissolve = $("#dz");

if (dissolve) {
  const ctx = dissolve.getContext("2d");
  const CELL = 24;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const light = "#0e0f14"; // was #f7fafb: matches the dark racing hero

  // cheap deterministic hash -> 0..1
  const noise = (a, b) => {
    let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  const drawDissolve = () => {
    const w = dissolve.clientWidth;
    const h = dissolve.clientHeight;
    const dpr = Math.min(devicePixelRatio, 2);

    if (dissolve.width !== w * dpr) {
      dissolve.width = w * dpr;
      dissolve.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const top = dissolve.parentElement.getBoundingClientRect().top;
    const progress = Math.min(1, Math.max(0, 1 - top / innerHeight));
    const lift = progress * 2;
    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);

    for (let j = 0; j < rows; j++) {
      const d = j / Math.max(1, rows - 1) + lift;
      if (d > 1) break;

      const solid = d <= 0.16;
      const fade = Math.min(1, Math.max(0, 1 - (d - 0.16) / 0.84));
      if (!solid && fade <= 0) break;

      for (let i = 0; i < cols; i++) {
        if (!solid) {
          if ((i + j) % 2) continue; // checker pattern
          if (noise(i, j) > fade) continue; // random drop-out
        }
        ctx.fillStyle = !solid && noise(i + 101, j + 57) < 0.06 ? accent : light;
        ctx.fillRect(i * CELL, j * CELL, CELL, CELL);
      }
    }
  };

  sub(drawDissolve, () => 16);
}

/* ============================================================
   CONTOUR CANVASES  (animated marching squares)
   ============================================================ */
function contour(canvas, color) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const t0 = performance.now();
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  // scalar field
  const field = (x, y, t) =>
    (Math.sin(x + t * 0.6) * 0.5 +
      Math.sin(y * 0.85 - t * 0.45) * 0.45 +
      Math.sin((x + y) * 0.65 + t * 0.35) * 0.35 +
      Math.sin((x - y) * 0.95 - t * 0.55) * 0.25) *
      0.5 +
    0.5;

  sub((now) => {
    if (!visible) return;

    const dpr = Math.min(devicePixelRatio, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w) return;

    if (canvas.width !== w * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const t = ((now - t0) / 1000) * 1.66;
    const C = w >= h ? 96 : Math.max(8, Math.round((96 * w) / h));
    const R = Math.max(8, Math.round((C * h) / w));
    const sx = w / C;
    const sy = h / R;
    const aspect = w / h;
    const V = new Float32Array((C + 1) * (R + 1));

    for (let j = 0; j <= R; j++) {
      for (let i = 0; i <= C; i++) {
        const nx = ((i / C) * 2 - 1) * aspect * 3.8;
        const ny = ((j / R) * 2 - 1) * 3.8;
        V[j * (C + 1) + i] =
          field(nx + Math.sin(ny * 0.8 + t * 0.7) * 0.37, ny + Math.cos(nx * 0.7 - t * 0.6) * 0.37, t) * 2.5;
      }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();

    const seg = (p, q) => {
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    };

    for (let L = 0.5; L < 2.5; L++) {
      for (let j = 0; j < R; j++) {
        for (let i = 0; i < C; i++) {
          const a = V[j * (C + 1) + i];
          const b = V[j * (C + 1) + i + 1];
          const c = V[(j + 1) * (C + 1) + i + 1];
          const d = V[(j + 1) * (C + 1) + i];
          const k = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
          if (k === 0 || k === 15) continue;

          const x0 = i * sx;
          const y0 = j * sy;
          const Top = [x0 + sx * ((L - a) / (b - a)), y0];
          const Right = [x0 + sx, y0 + sy * ((L - b) / (c - b))];
          const Bottom = [x0 + sx * ((L - d) / (c - d)), y0 + sy];
          const Left = [x0, y0 + sy * ((L - a) / (d - a))];

          switch (k) {
            case 1: case 14: seg(Left, Bottom); break;
            case 2: case 13: seg(Bottom, Right); break;
            case 3: case 12: seg(Left, Right); break;
            case 4: case 11: seg(Top, Right); break;
            case 6: case 9: seg(Top, Bottom); break;
            case 7: case 8: seg(Left, Top); break;
            case 5: seg(Left, Top); seg(Bottom, Right); break;
            case 10: seg(Left, Bottom); seg(Top, Right); break;
          }
        }
      }
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }, () => 24);
}

contour($("#cc"), "rgb(9 10 11/.08)");
contour($("#fc"), "rgb(255 255 255/.1)");

/* ============================================================
   HERO WEBGL: human + monster cursor reveal
   ============================================================ */
const canvas = $("#scene");
let webglOk = true;
try {
  webglOk = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
} catch {
  webglOk = false;
}

if (!webglOk) {
  entrance();
} else {
  boot().catch((e) => {
    fail("Failed to load: " + ((e && e.message) || "hero images"));
    entrance();
  });
}

async function boot() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: innerWidth >= 1280,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  // transparent canvas: the racing photo comes from the CSS background on .hero
  renderer.setClearColor(new THREE.Color("#090a0b"), 0);
  renderer.debug.onShaderError = (gl, program, vs, fs) => {
    let msg = "";
    try {
      msg = (gl.getProgramInfoLog(program) || "") + (gl.getShaderInfoLog(fs) || "");
    } catch {}
    fail("SHADER ERROR: " + msg.replace(/\s+/g, " ").slice(0, 500));
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.1, 6.5);

  /* ---- textures (tries each file in order) ---- */
  const loader = new THREE.TextureLoader();
  const loadOne = (file) =>
    new Promise((resolve, reject) =>
      loader.load(
        file,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          resolve(t);
        },
        undefined,
        () => reject(new Error(file))
      )
    );
  const loadFirst = async (files) => {
    for (const f of files) {
      try {
        return await loadOne(f);
      } catch {}
    }
    throw new Error(files.join(" or "));
  };

  const [human, monster] = await Promise.all([loadFirst(HUMAN_FILES), loadFirst(MONSTER_FILES)]);

  /* ---- where is the person inside the image? (0..1 box of the non-white, non-transparent pixels) ---- */
  const measure = (img) => {
    try {
      const W = 160;
      const H = Math.max(1, Math.round((W * img.height) / img.width));
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data;
      const rows = new Array(H).fill(0);
      const cols = new Array(W).fill(0);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if (d[i + 3] > 40 && Math.min(d[i], d[i + 1], d[i + 2]) < 225) { rows[y]++; cols[x]++; }
        }
      }
      const first = (a) => a.findIndex((n) => n >= 2);
      const last = (a) => a.length - 1 - [...a].reverse().findIndex((n) => n >= 2);
      const y0 = first(rows), y1 = last(rows), x0 = first(cols), x1 = last(cols);
      if (y0 < 0 || x0 < 0) throw new Error("empty");
      return { x0: x0 / W, x1: (x1 + 1) / W, y0: y0 / H, y1: (y1 + 1) / H };
    } catch {
      return { x0: 0.2, x1: 0.8, y0: 0.05, y1: 0.98 }; // safe guess
    }
  };
  const body = measure(human.image);

  /* ---- noise texture ---- */
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.random() * 255;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const noiseTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.magFilter = noiseTex.minFilter = THREE.LinearFilter;
  noiseTex.needsUpdate = true;

  /* ---- shared uniforms ---- */
  const N = 40; // trail length
  const trail = Array.from({ length: N }, () => new THREE.Vector2(9, 9));
  const U = {
    uTrail: { value: trail },
    uAspect: { value: 1 },
    uPace: { value: 0 },
    uIntro: { value: 0 },
    uNoise: { value: noiseTex },
    uTime: { value: 0 },
    uBurn: { value: new THREE.Color("#02d2e3") },
  };

  /* ---- shader chunk: cursor trail mask ---- */
  const MASK = `
uniform vec2 uTrail[${N}];
uniform float uAspect, uPace, uIntro, uTime;
uniform sampler2D uNoise;

float seg(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0., 1.);
  return length(pa - ba * h);
}

float trailM(vec2 n){
  float g = smoothstep(.06, .21, uPace);
  if (g <= 0.) return 0.;
  vec2 p = vec2(n.x * uAspect, n.y);
  vec2 uv = n * .5 + .5;
  p += (vec2(
    texture2D(uNoise, uv * 2.9 + vec2(uTime * .07, uTime * .05)).r,
    texture2D(uNoise, uv * 4. - vec2(uTime * .06, uTime * .09)).r
  ) - .5) * 1.29 * .22;

  float rad = .46 * mix(.28, 1., uPace);
  float tp  = 1.9 * mix(1.6, 1.25, uPace);
  float sp  = .64 * float(${N - 1});
  float t = 0.;

  for (int i = 0; i < ${N - 1}; i++){
    if (float(i) >= sp) break;
    float w = pow(1. - float(i) / sp, tp);
    vec2 a = vec2(uTrail[i].x * uAspect, uTrail[i].y);
    vec2 b = vec2(uTrail[i + 1].x * uAspect, uTrail[i + 1].y);
    float rr = rad * w;
    t = max(t, w * (1. - smoothstep(rr * .35, rr, seg(p, a, b))));
  }
  return smoothstep(.075, .085, t) * g;
}`;

  /* ---- background plane: contour lines + trail tint ---- */
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      uniforms: {
        ...U,
        uBg: { value: new THREE.Color("#f7fafb") },
        uLn: { value: new THREE.Color("#dfe5e9") },
      },
      depthWrite: false,
      vertexShader: `
varying vec4 c;
void main(){
  c = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  gl_Position = c;
}`,
      fragmentShader: `
varying vec4 c;
uniform vec3 uBg, uLn;
${MASK}
float F(vec2 p, float t){
  float f = sin(p.x + t * .6) * .5 + sin(p.y * .85 - t * .45) * .45
          + sin((p.x + p.y) * .65 + t * .35) * .35 + sin((p.x - p.y) * .95 - t * .55) * .25;
  return f * .5 + .5;
}
void main(){
  vec2 n = c.xy / c.w;
  vec2 p = vec2(n.x * uAspect, n.y) * 3.8;
  float t = uTime * 1.66;
  vec2 q = p;
  q.x += sin(p.y * .8 + t * .7) * .37;
  q.y += cos(p.x * .7 - t * .6) * .37;
  float s = F(q, t) * 2.5;
  float w = max(fwidth(s) * 1.4, 1e-5);
  float l = 1. - smoothstep(0., w, abs(fract(s) - .5));
  vec3 col = mix(uBg, uLn, l * .85);
  float par = mod(floor(s + .5), 2.);
  col = mix(col, mix(vec3(.62), vec3(.44), par), trailM(n));
  gl_FragColor = vec4(col, 1.);
#include <colorspace_fragment>
}`,
    })
  );
  bg.position.z = -3;
  bg.renderOrder = -1;
  scene.add(bg);

  /* ---- subject group (human + monster) ---- */
  const subject = new THREE.Group();
  scene.add(subject);

  // fades the image edges so the cut-out blends into the background
  const FADE =
    "smoothstep(0.,.015,vMapUv.x)*smoothstep(1.,.985,vMapUv.x)*smoothstep(1.,.97,vMapUv.y)";
  const planeH = 4.3;

  // human: near-white keying makes a white background transparent
  const humanMat = new THREE.MeshBasicMaterial({
    map: human,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  humanMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <alphamap_fragment>",
      "#include <alphamap_fragment>\n" +
        "diffuseColor.a*=" +
        FADE +
        ";"
    );
  };
  const humanMesh = new THREE.Mesh(
    new THREE.PlaneGeometry((planeH * human.image.width) / human.image.height, planeH),
    humanMat
  );
  humanMesh.position.y = -0.45;
  subject.add(humanMesh);

  // monster: only visible where the cursor trail passes (and during the intro burn)
  const monsterMat = new THREE.MeshBasicMaterial({
    map: monster,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  monsterMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);

    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec4 vC;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvC=gl_Position;");

    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec4 vC;uniform vec3 uBurn;${MASK}`)
      .replace(
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>
vec2 nd = vC.xy / vC.w;
float fr = smoothstep(.14, 1., uIntro);
float nz = texture2D(uNoise, nd * .5 + .5).r;
float at = mix(1. - (nd.y * .5 + .5), nz, .45);
float it = smoothstep(fr - .02, fr + .02, at);
diffuseColor.a *= max(trailM(nd), it) * ${FADE};
diffuseColor.rgb += uBurn * it * (1. - it) * 16.;`
      );
  };
  // size + align the Red Bull photo so its body is the same size as the shinji.png body,
  // with the same horizontal center and the same bottom edge (works for any image size)
  const bodyM = measure(monster.image);
  const humanW = (planeH * human.image.width) / human.image.height;
  const monH = ((body.y1 - body.y0) * planeH) / (bodyM.y1 - bodyM.y0);
  const monW = (monH * monster.image.width) / monster.image.height;
  const humanCx = ((body.x0 + body.x1) / 2 - 0.5) * humanW;
  const humanBottom = -0.45 + (0.5 - body.y1) * planeH;
  const monsterMesh = new THREE.Mesh(new THREE.PlaneGeometry(monW, monH), monsterMat);
  monsterMesh.position.set(
    humanCx - ((bodyM.x0 + bodyM.x1) / 2 - 0.5) * monW,
    humanBottom - (0.5 - bodyM.y1) * monH,
    0.2
  );
  monsterMesh.renderOrder = 1;
  subject.add(monsterMesh);

  /* ---- warm up GPU ---- */
  [human, monster, noiseTex].forEach((t) => renderer.initTexture(t));
  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);

  /* ---- pointer state ---- */
  const hasPointer = !matchMedia("(hover:none) and (pointer:coarse)").matches;
  const ptr = { x: 0.3, y: 0.1 }; // raw pointer
  const smooth = { x: 0.3, y: 0.1 }; // eased pointer
  const last = { x: 0.3, y: 0.1 };
  let pace = 0;
  let seen = false;
  let startTime = null;
  let viewH = 1;
  let riseStart = null;
  let baseY = 0.42; // subject height; changes on tall (phone) screens
  let baseX = 0;

  if (hasPointer) {
    addEventListener("pointermove", (e) => {
      ptr.x = (e.clientX / innerWidth) * 2 - 1;
      ptr.y = (e.clientY / innerHeight) * 2 - 1;
      if (!seen) {
        seen = true;
        smooth.x = last.x = ptr.x;
        smooth.y = last.y = ptr.y;
      }
    });
  }

  /* ---- resize ---- */
  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    viewH = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    U.uAspect.value = w / h;
    const k = 2 * 9.5 * Math.tan((35 * Math.PI) / 360) * 1.06;
    bg.scale.set((k * w) / h, k, 1);

    // portrait screens (phones / tablets): shrink the subject to fit the width and stand it on the bottom edge
    const aspect = w / h;
    const visH = 2 * 6.5 * Math.tan((35 * Math.PI) / 360);
    const planeW = (planeH * human.image.width) / human.image.height;
    if (aspect < 1.15) {
      // phones / tablets: photo is centered in FRONT of the title (head at "WEB", feet near the info line)
      bg.visible = false;                                          // photo comes from CSS
      renderer.setClearColor(new THREE.Color("#090a0b"), 0);       // transparent canvas
      const cTop = canvas.getBoundingClientRect().top;
      const row2 = $("#hname .ln:nth-child(2)");
      const metaEl = $(".meta");
      const headPx = row2 ? row2.getBoundingClientRect().top - cTop + row2.offsetHeight * 0.08 : h * 0.3;
      const feetPx = metaEl ? metaEl.getBoundingClientRect().bottom - cTop : h * 0.68;
      const worldPerPx = visH / h;
      const bodyW = (body.x1 - body.x0) * planeW;
      const bodyH = (body.y1 - body.y0) * planeH;
      let s = ((feetPx - headPx) * worldPerPx) / bodyH;
      s = Math.max(0.25, Math.min(s, (visH * aspect * 0.8) / bodyW, 1.2));
      subject.scale.setScalar(s);
      baseX = -((body.x0 + body.x1) / 2 - 0.5) * planeW * s;
      baseY = 0.1 + visH / 2 - headPx * worldPerPx - s * (1.7 - body.y0 * planeH);
    } else {
      bg.visible = false;                                          // photo comes from CSS
      renderer.setClearColor(new THREE.Color("#090a0b"), 0);
      // desktop: show the person from head down to the WAIST, waist sitting on the bottom edge of the hero
      const WAIST = 0.74;    // where the waist is, as a share of the body height (head top = 0, bottom of photo = 1)
      const TOP_GAP = 0.24;  // empty space kept above the head, as a share of the hero height (bigger = smaller person)
      const bodyH = (body.y1 - body.y0) * planeH;
      const s = (visH * (1 - TOP_GAP)) / (WAIST * bodyH);
      const waistLocalY = -0.45 + (0.5 - body.y0) * planeH - WAIST * bodyH;
      subject.scale.setScalar(s);
      baseX = 0;
      baseY = 0.1 - visH / 2 - s * waistLocalY - 0.03;
    }
  };
  fit();
  new ResizeObserver(fit).observe(canvas);

  /* ---- only render while visible ---- */
  let heroVisible = true;
  new IntersectionObserver(([e]) => (heroVisible = e.isIntersecting)).observe(canvas);

  entrance();

  // the title is rebuilt by entrance() and fonts load late: re-fit once the text has its final size
  requestAnimationFrame(fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  const idn = $(".idn");
  if (idn) new ResizeObserver(fit).observe(idn);

  /* ---- render loop ---- */
  sub((now) => {
    if (!heroVisible || document.hidden || scrollY > innerHeight * 1.15) return;

    if (startTime === null) startTime = now;
    const t = (now - startTime) / 1000;

    U.uIntro.value = reduceMotion ? 1 : Math.min(1, t / 4);
    U.uTime.value = t * 1.25;

    // ease pointer
    smooth.x += (ptr.x - smooth.x) * 0.17;
    smooth.y += (ptr.y - smooth.y) * 0.17;

    // cursor speed -> pace (drives trail size)
    const step = Math.hypot(smooth.x - last.x, smooth.y - last.y);
    if (hasPointer) {
      const target = Math.min(1, step / 0.029);
      pace += (target - pace) * (target > pace ? 0.09 : 0.205);
      if (seen) pace = Math.max(pace, 0.3);
    }
    last.x = smooth.x;
    last.y = smooth.y;
    U.uPace.value = pace;

    // push newest point to the front of the trail
    const oldest = trail.pop();
    oldest.set(smooth.x, -smooth.y);
    trail.unshift(oldest);

    // subject rises in on load
    let rise_ = 0;
    if (!reduceMotion) {
      if (riseStart === null) riseStart = t;
      const u = Math.min(1, (t - riseStart) / 2);
      rise_ = (1 - u) * (1 - u) * 200 * ((2 * 6.5 * Math.tan((35 * Math.PI) / 360)) / viewH);
    }

    subject.position.set(baseX + smooth.x * 0.02, baseY - smooth.y * 0.02 - rise_, 0);
    renderer.render(scene, camera);
  });
}