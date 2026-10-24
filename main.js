// Neue Academy · Preloader prototype: "Nebula violet".
// A tunnel made of Niccolò's nebula, read through the waffle glyph (a colour tile with a dark rounded square punched
// in), in one violet family. You travel down it from the first frame; when the load is done you are pulled in faster
// and faster, and the page opens cell by cell. Every number below is live in the control panel (lil-gui).
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19.2/+esm';

// ---------------------------------------------------------------- defaults (= the version Niccolò and Josh picked)
const DEFAULTS = {
  // playback
  speed: 1, loop: true, loopPause: 1.2, paused: false, scrub: 0, showHud: true, showPage: true,
  // timing
  load: 3.0, exit: 2.3, v0: 0.42, vmax: 8,
  // performance
  fpsCap: 'Off', renderScale: Math.min(devicePixelRatio || 1, 2),
  // grid & glyph
  cell: 15, levels: 9, holeRound: 0.42, tileLift: 1.4, gammaMin: 0.15, gammaMax: 0.6, mouse: 0.5, breath: 0.08,
  // tunnel
  depth: 0.32, depthGain: 1.6, twistBase: 0.55, twistLoad: 0.35, twistExit: 3.2, twistAmt: 0.55, spin: 0.12, suck: 2.4, travel: 1.4,
  band: 0.4, bandAmp: 0.32, bandFreq: 0.55, fog: 0.06, nebGamma: 0.8, nebGain: 1.5,
  contrast: 1.3, brightness: 0.9, flicker: 0.08, eye: 0.2, perspective: 0.35, pressure: 0.35,
  streak: 0.045, streakSamples: 4,
  // near (parallax) layer
  nearOn: true, nearSize: 1.3, nearZoom: 1.9, nearThreshold: 0.7, nearAmount: 0.8, nearOpacity: 0.85,
  // colour
  c0: '#090510', c1: '#4a26bd', c2: '#c78cff', c3: '#fff7ff', stop1: 0.38, stop2: 0.74, rampScale: 0.7, rampCap: 0.72,
  hole: '#08040d', vignette: 0.3, grain: 0.02,
  // reveal
  revealStart: 0.62, revealSpread: 0.3, revealRagged: 0.35, landScale: 0.14, landRotate: -7,
};
// Niccolò's values (24 Oct): grid & glyph + colour
const NICCOLO = { cell: 22, levels: 9, holeRound: 0.33, tileLift: 1.77, gammaMin: 0.15, gammaMax: 0.6, mouse: 0.35, breath: 0.14,
  c0: '#736383', c1: '#6e5f7f', c2: '#716181', c3: '#37a056', stop1: 0.49, stop2: 0.74, rampScale: 0.59, rampCap: 0.72,
  hole: '#6f6080', vignette: 1, grain: 0 };
const VIOLET = Object.fromEntries(Object.keys(NICCOLO).map((k) => [k, DEFAULTS[k]]));
const P = structuredClone(DEFAULTS);
Object.assign(P, NICCOLO);
try { Object.assign(P, JSON.parse(decodeURIComponent(location.hash.slice(1)) || '{}')); } catch {}

// ---------------------------------------------------------------- shader
const FRAG = /* glsl */`#version 300 es
precision highp float;
#define PI 3.14159265
uniform vec2 uRes, uMouse; uniform float uTime, uLoad, uExit, uDpr, uDive, uSpin, uSpeed;
uniform sampler2D uTex;
uniform float uCell, uLevels, uHoleRound, uTileLift, uGMin, uGMax, uMouseAmt, uBreath;
uniform float uDepth, uTwistBase, uTwistLoad, uTwistExit, uTwistAmt, uSpinAmt, uTravel, uBand, uBandAmp, uBandFreq, uFog, uNebGamma, uNebGain;
uniform float uContrast, uBright, uFlicker, uEye, uPersp, uPressure, uStreak; uniform int uStreakN;
uniform float uNearOn, uNearSize, uNearZoom, uNearThr, uNearAmt, uNearOpacity;
uniform vec3 uC0, uC1, uC2, uC3, uHole; uniform float uStop1, uStop2, uRampScale, uRampCap, uVignette, uGrain;
uniform float uRevStart, uRevSpread, uRevRag;
out vec4 o;
float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float easeOut(float x){ return 1.-pow(1.-x,3.); }
float remap(float x, float a, float b){ return clamp((x-a)/(b-a), 0., 1.); }
vec3 ramp(float x){
  return x < uStop1 ? mix(uC0, uC1, x / uStop1) : x < uStop2 ? mix(uC1, uC2, (x - uStop1) / (uStop2 - uStop1)) : mix(uC2, uC3, (x - uStop2) / (1. - uStop2));
}
float tile(vec2 local, float size, float cellPx){
  float hs = .5 * size * .9;
  return (1. - smoothstep(-.6/cellPx, .6/cellPx, sdRound(local, vec2(hs), hs * .38))) * step(.02, size);
}
// Niccolò's waffle cell: the tile takes the colour, a dark rounded square is punched in; darker = bigger square
vec3 waffle(vec2 local, float lum, vec3 col, float cs, float g){
  float L = uLevels;
  float idx = clamp(floor(lum * L * g), 0., L - 1.);
  float hs = mix(.5, .07, idx / (L - 1.));
  vec3 tc = clamp((col - idx * .04 * 9. / L) * uTileLift, 0., 1.);
  float k = (1. - smoothstep(-.6/cs, .6/cs, sdRound(local, vec2(hs), hs * uHoleRound))) * step(.02, hs);
  return mix(tc, uHole, k);
}
// the tunnel: depth z = 1/r (centre = far end), the nebula wrapped round the walls and twisted with depth
float nebula(vec2 q, float twist){
  float r = length(q) + 1e-4, z = uDepth / r;
  float ang = atan(q.y, q.x) / PI + z * twist * uTwistAmt + uSpin * uSpinAmt;
  vec2 tuv = vec2(ang * .5 + .5, uBand + uBandAmp * (.5 + .5 * sin((z - uDive * uTravel) * uBandFreq)));
  float l = dot(texture(uTex, tuv).rgb, vec3(.2126, .7152, .0722));
  return pow(l, uNebGamma) * uNebGain * exp(-z * uFog);
}
void main(){
  vec2 frag = gl_FragCoord.xy;
  float ex = uExit;
  float cs = uCell * uDpr;
  vec2 cid = floor((frag - uRes*.5) / cs);
  vec2 cc = (cid + .5) * cs + uRes*.5;
  vec2 local = (frag - cc) / cs;
  float md = min(uRes.x, uRes.y);
  vec2 q = (cc - uRes*.5) / md;
  float r = length(q);
  // the twist winds up hard at the end: the pull-in wrings the tunnel like a drain
  float twist = uTwistBase + uTwistLoad * easeOut(uLoad) + uTwistExit * pow(clamp(ex / max(uRevStart, .05), 0., 1.), 2.) + .02 * sin(uTime * .5);
  float lum = 0., n = 0.;
  for (int k = 0; k < 8; k++) { if (k >= uStreakN) break; lum += nebula(q * (1. + float(k) * uStreak * uSpeed), twist); n += 1.; }
  lum /= max(n, 1.);
  lum = pow(lum, uContrast) * uBright * smoothstep(-.15, .8, uLoad) * (1. + uFlicker * sin(uTime * 1.3));
  lum *= mix(smoothstep(uEye * .2, uEye, r), 1., smoothstep(.0, .25, ex));
  lum *= mix(uPersp, 1., smoothstep(.0, .55, r));
  lum *= 1. + uSpeed * uPressure;
  float gm = clamp(uMouse.x * uMouseAmt + (1. - uMouseAmt) * .5 + uBreath * sin(uTime * .9), 0., 1.);
  float g = pow(mix(.2, 2.2, mix(uGMin, uGMax, gm)), 2.2);
  float order = r * .9 + hash(cid) * uRevRag;
  float open = smoothstep(0., .1, ex - uRevStart - order * uRevSpread);
  vec3 c = waffle(local, lum, ramp(clamp(lum * uRampScale, 0., uRampCap)), cs, g);
  if (uNearOn > .5) {
    float cs3 = cs * uNearSize;
    vec2 cid3 = floor((frag - uRes*.5) / cs3);
    vec2 cc3 = (cid3 + .5) * cs3 + uRes*.5;
    vec2 l3 = (frag - cc3) / cs3;
    vec2 q3 = (cc3 - uRes*.5) / md;
    float near = nebula(q3 * uNearZoom, twist);
    near = smoothstep(uNearThr, 1., near) * uNearAmt * smoothstep(.25, .7, length(q3)) * smoothstep(-.1, .8, uLoad) * (1. - open);
    c = mix(c, ramp(.5 + near * .2) * (1. + uSpeed * .2), tile(l3, near, cs3) * uNearOpacity);
  }
  c *= 1. - uVignette * smoothstep(.55, 1.25, length((frag - uRes*.5) / md));
  c += (hash(frag + fract(uTime) * 91.) - .5) * uGrain;
  o = vec4(c, (1. - step(.5, open)) * (1. - remap(ex, .97, 1.)));
}`;

// ---------------------------------------------------------------- GL
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: true });
const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.-1., 0, 1); }'));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
gl.linkProgram(prog); gl.useProgram(prog);
const loc = {}; const U = (n) => (loc[n] ??= gl.getUniformLocation(prog, n));
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

let texReady = false;
const img = new Image(); img.src = 'assets/nebula.png';
img.onload = () => {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.uniform1i(U('uTex'), 0);
  texReady = true; replay();
};

let dpr = P.renderScale;
const fit = () => { dpr = P.renderScale; canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr); gl.viewport(0, 0, canvas.width, canvas.height); };
fit(); addEventListener('resize', fit);
const mouse = [.5, .5], m = [.5, .5];
addEventListener('pointermove', (e) => { mouse[0] = e.clientX / innerWidth; mouse[1] = 1 - e.clientY / innerHeight; });

// ---------------------------------------------------------------- the journey
// steady speed v0 (octaves/s) while loading; then exponential acceleration to vmax across the exit: no pause, no braking
const loadAt = (s) => { const x = Math.min(1, s / P.load); return Math.min(1, x + .035 * Math.sin(x * 19) * (1 - x) * x * 4); };
function journey(s) {
  const k = Math.log(Math.max(P.vmax, P.v0 + .01) / P.v0) / P.exit;
  const tau = Math.max(0, s - P.load), a = Math.min(s, P.load) * P.v0;
  const fall = P.v0 * (Math.exp(k * Math.min(tau, P.exit)) - 1) / k + Math.max(0, tau - P.exit) * P.vmax;
  const v = tau > 0 ? P.v0 * Math.exp(k * Math.min(tau, P.exit)) : P.v0;
  const e = Math.min(1, tau / P.exit), land = Math.max(0, Math.min(1, (e - .62) / .38));
  return { load: Math.max(0, loadAt(s)), exit: e, dive: a + fall, spin: (a + fall) * 1.15 + fall * fall * .06 + P.suck * Math.pow(Math.min(1, e / Math.max(P.revealStart, .05)), 2) * 6,
    speed: (v - P.v0) / Math.max(P.vmax - P.v0, .01), land: 1 - Math.pow(1 - land, 3) };
}
const total = () => P.load + P.exit;

const page = document.getElementById('page'), hud = document.getElementById('hud');
const hudN = document.getElementById('hud-n'), hudL = document.getElementById('hud-l'), fpsEl = document.getElementById('fps');
let clock = 0, last = performance.now(), lastDraw = 0, frames = 0, fpsT = performance.now(), endedAt = null;
function replay() { clock = 0; endedAt = null; document.body.classList.remove('done'); }
// pause freezes the exact frame on screen (it used to jump to the slider's position, which was 0 = black)
const pauseBtn = document.getElementById('pause');
function setPause(v) { P.paused = v; P.scrub = Math.min(1, clock / (total() + .2)); scrubCtl?.updateDisplay(); }

function setUniforms(st) {
  gl.uniform2f(U('uRes'), canvas.width, canvas.height); gl.uniform2f(U('uMouse'), m[0], m[1]);
  gl.uniform1f(U('uTime'), clock); gl.uniform1f(U('uLoad'), st.load); gl.uniform1f(U('uExit'), st.exit); gl.uniform1f(U('uDpr'), dpr);
  gl.uniform1f(U('uDive'), st.dive); gl.uniform1f(U('uSpin'), st.spin); gl.uniform1f(U('uSpeed'), st.speed);
  const f = (n, v) => gl.uniform1f(U(n), v);
  f('uCell', P.cell); f('uLevels', P.levels); f('uHoleRound', P.holeRound); f('uTileLift', P.tileLift);
  f('uGMin', P.gammaMin); f('uGMax', P.gammaMax); f('uMouseAmt', P.mouse); f('uBreath', P.breath);
  const ex2 = Math.min(1, st.exit / Math.max(P.revealStart, .05)), ee = ex2 * ex2 * (3 - 2 * ex2);
  f('uDepth', P.depth * (1 + P.depthGain * (.35 * st.load + ee))); f('uTwistBase', P.twistBase); f('uTwistLoad', P.twistLoad); f('uTwistExit', P.twistExit); f('uTwistAmt', P.twistAmt); f('uSpinAmt', P.spin);
  f('uTravel', P.travel); f('uBand', P.band); f('uBandAmp', P.bandAmp); f('uBandFreq', P.bandFreq); f('uFog', P.fog);
  f('uNebGamma', P.nebGamma); f('uNebGain', P.nebGain); f('uContrast', P.contrast); f('uBright', P.brightness); f('uFlicker', P.flicker);
  f('uEye', P.eye); f('uPersp', P.perspective); f('uPressure', P.pressure); f('uStreak', P.streak); gl.uniform1i(U('uStreakN'), P.streakSamples);
  f('uNearOn', P.nearOn ? 1 : 0); f('uNearSize', P.nearSize); f('uNearZoom', P.nearZoom); f('uNearThr', P.nearThreshold); f('uNearAmt', P.nearAmount); f('uNearOpacity', P.nearOpacity);
  gl.uniform3fv(U('uC0'), hex(P.c0)); gl.uniform3fv(U('uC1'), hex(P.c1)); gl.uniform3fv(U('uC2'), hex(P.c2)); gl.uniform3fv(U('uC3'), hex(P.c3)); gl.uniform3fv(U('uHole'), hex(P.hole));
  f('uStop1', P.stop1); f('uStop2', Math.max(P.stop2, P.stop1 + .01)); f('uRampScale', P.rampScale); f('uRampCap', P.rampCap);
  f('uVignette', P.vignette); f('uGrain', P.grain); f('uRevStart', P.revealStart); f('uRevSpread', P.revealSpread); f('uRevRag', P.revealRagged);
}

function tick(now) {
  requestAnimationFrame(tick);
  const cap = P.fpsCap === 'Off' ? 0 : +P.fpsCap;
  if (cap && now - lastDraw < 1000 / cap - 1) return;
  const dt = Math.min(.1, (now - last) / 1000); last = now; lastDraw = now;
  if (!P.paused && texReady) clock += dt * P.speed;
  // loop: replay after a short look at the page
  if (clock > total() + .05 && !P.paused) {
    if (endedAt == null) { endedAt = now; document.body.classList.add('done'); }
    if (P.loop && !P.paused && now - endedAt > P.loopPause * 1000) replay();
  }
  const st = journey(clock);
  m[0] += (mouse[0] - m[0]) * .08; m[1] += (mouse[1] - m[1]) * .08;
  setUniforms(st);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // the HUD and the page landing (it arrives still turning, then settles)
  hudN.textContent = String(Math.round(st.load * 100)).padStart(3, '0');
  hudL.textContent = `Loading lesson ${String(Math.max(1, Math.round(st.load * 18))).padStart(2, '0')} of 18`;
  hud.style.opacity = P.showHud ? String(1 - Math.min(1, st.exit * 3.2)) : '0';
  page.style.visibility = P.showPage ? 'visible' : 'hidden';
  page.style.transform = `scale(${1 + P.landScale * (1 - st.land)}) rotate(${P.landRotate * (1 - st.land)}deg)`;
  // fps
  frames++; if (now - fpsT > 500) { fpsEl.textContent = `${Math.round(frames * 1000 / (now - fpsT))} fps`; frames = 0; fpsT = now; }
  if (!P.paused) { P.scrub = Math.min(1, clock / (total() + .2)); scrubCtl?.updateDisplay(); }
  pauseBtn.textContent = P.paused ? 'Play' : 'Pause';
}
requestAnimationFrame(tick);

// ---------------------------------------------------------------- controls
const gui = new GUI({ title: 'Nebula violet · controls' });
const save = () => { history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify(diff()))); };
const diff = () => Object.fromEntries(Object.entries(P).filter(([k, v]) => v !== DEFAULTS[k] && !['paused', 'scrub'].includes(k)));
gui.onChange(save);

{ const pre = gui.addFolder('Presets');
  const apply = (o) => { Object.assign(P, o); gui.controllersRecursive().forEach((c) => c.updateDisplay()); fit(); save?.(); };
  pre.add({ n() { apply(NICCOLO); } }, 'n').name('Niccolò · 24 Oct (colours + glyph)');
  pre.add({ v() { apply(VIOLET); } }, 'v').name('Nebula violet (yesterday)'); }
const play = gui.addFolder('Playback');
play.add({ replay }, 'replay').name('Replay (R)');
play.add(P, 'speed', .1, 3, .05).name('Playback speed');
play.add(P, 'paused').name('Pause (Space)').listen().onChange(setPause);
let scrubCtl = play.add(P, 'scrub', 0, 1, .001).name('Scrub (pauses)').onChange((v) => { setPause(true); clock = v * (total() + .2); endedAt = null; document.body.classList.toggle('done', clock > total() + .05); });
play.add(P, 'loop').name('Loop');
play.add(P, 'loopPause', 0, 5, .1).name('Pause on the page (s)');
play.add(P, 'showHud').name('Show logo + counter');
play.add(P, 'showPage').name('Show the page underneath');

const tim = gui.addFolder('Timing & speed');
tim.add(P, 'load', .5, 10, .1).name('Loading time (s)');
tim.add(P, 'exit', .5, 6, .1).name('Pull-in time (s)');
tim.add(P, 'v0', .05, 2, .01).name('Cruise speed');
tim.add(P, 'vmax', 1, 30, .1).name('Top speed');

const perf = gui.addFolder('Performance');
perf.add(P, 'fpsCap', ['Off', '30', '60', '120']).name('FPS cap');
perf.add(P, 'renderScale', .5, 2, .05).name('Render scale (DPR)').onChange(fit);

const grid = gui.addFolder('Grid & glyph');
grid.add(P, 'cell', 6, 40, 1).name('Cell size (px)');
grid.add(P, 'levels', 3, 16, 1).name('Glyph levels');
grid.add(P, 'holeRound', 0, .5, .01).name('Square roundness');
grid.add(P, 'tileLift', .5, 2.5, .01).name('Tile brightness lift');
grid.add(P, 'gammaMin', 0, 1, .01).name('Glyph gamma min');
grid.add(P, 'gammaMax', 0, 1, .01).name('Glyph gamma max');
grid.add(P, 'mouse', 0, 1, .01).name('Mouse influence');
grid.add(P, 'breath', 0, .3, .005).name('Breathing');

const tun = gui.addFolder('Tunnel');
tun.add(P, 'depth', .05, 1, .01).name('Depth');
tun.add(P, 'depthGain', 0, 4, .01).name('Depth gained while diving');
tun.add(P, 'twistBase', 0, 2, .01).name('Twist');
tun.add(P, 'twistLoad', 0, 2, .01).name('Twist gained while loading');
tun.add(P, 'twistExit', 0, 8, .01).name('Twist at the end (sucked in)');
tun.add(P, 'twistAmt', 0, 2, .01).name('Twist strength');
tun.add(P, 'spin', 0, .6, .005).name('Spin');
tun.add(P, 'suck', 0, 6, .01).name('Spin at the end (sucked in)');
tun.add(P, 'travel', 0, 5, .01).name('Travel speed along the walls');
tun.add(P, 'band', 0, 1, .01).name('Nebula band (where)');
tun.add(P, 'bandAmp', 0, .6, .01).name('Nebula band (range)');
tun.add(P, 'bandFreq', 0, 3, .01).name('Nebula band (frequency)');
tun.add(P, 'fog', 0, .4, .005).name('Fog at the far end');
tun.add(P, 'eye', 0, .6, .01).name('Dark eye size');
tun.add(P, 'perspective', 0, 1, .01).name('Far end brightness');
tun.add(P, 'nebGamma', .2, 2, .01).name('Nebula gamma');
tun.add(P, 'nebGain', .2, 4, .01).name('Nebula gain');
tun.add(P, 'contrast', .3, 3, .01).name('Contrast');
tun.add(P, 'brightness', 0, 2, .01).name('Brightness');
tun.add(P, 'flicker', 0, .4, .005).name('Flicker');
tun.add(P, 'pressure', 0, 1.5, .01).name('Brighter at speed');
tun.add(P, 'streak', 0, .2, .001).name('Speed streak length');
tun.add(P, 'streakSamples', 1, 8, 1).name('Speed streak samples');

const near = gui.addFolder('Near layer (parallax)');
near.add(P, 'nearOn').name('On');
near.add(P, 'nearSize', 1, 4, .05).name('Tile size ×');
near.add(P, 'nearZoom', 1, 4, .05).name('Closeness');
near.add(P, 'nearThreshold', 0, 1, .01).name('Threshold');
near.add(P, 'nearAmount', 0, 1.5, .01).name('Amount');
near.add(P, 'nearOpacity', 0, 1, .01).name('Opacity');

const col = gui.addFolder('Colour');
col.addColor(P, 'c0').name('Ramp 1 · darkest');
col.addColor(P, 'c1').name('Ramp 2 · violet');
col.addColor(P, 'c2').name('Ramp 3 · lilac');
col.addColor(P, 'c3').name('Ramp 4 · highlight');
col.add(P, 'stop1', .05, .9, .01).name('Stop 1→2');
col.add(P, 'stop2', .1, .95, .01).name('Stop 2→3');
col.add(P, 'rampScale', .1, 2, .01).name('Colour range');
col.add(P, 'rampCap', .1, 1, .01).name('Colour cap (1 = allow highlight)');
col.addColor(P, 'hole').name('Glyph square');
col.add(P, 'vignette', 0, 1, .01).name('Vignette');
col.add(P, 'grain', 0, .1, .001).name('Grain');

const rev = gui.addFolder('Reveal & landing');
rev.add(P, 'revealStart', 0, 1, .01).name('Reveal starts at');
rev.add(P, 'revealSpread', 0, 1, .01).name('Reveal spread');
rev.add(P, 'revealRagged', 0, 1, .01).name('Ragged edge');
rev.add(P, 'landScale', 0, .5, .005).name('Page arrives zoomed');
rev.add(P, 'landRotate', -30, 30, .5).name('Page arrives turned (°)');

const out = gui.addFolder('Share');
out.add({ copy() { navigator.clipboard.writeText(location.href); } }, 'copy').name('Copy link with these settings');
out.add({ json() { navigator.clipboard.writeText(JSON.stringify(P, null, 2)); } }, 'json').name('Copy settings as JSON');
out.add({ reset() { Object.assign(P, structuredClone(DEFAULTS)); gui.controllersRecursive().forEach((c) => c.updateDisplay()); fit(); save(); replay(); } }, 'reset').name('Reset to the picked version');
[tim, perf, grid, tun, near, col, rev].forEach((f) => f.close());

document.getElementById('replay').onclick = () => { replay(); setPause(false); };
pauseBtn.onclick = () => setPause(!P.paused);
addEventListener('keydown', (e) => {
  if (e.target.closest?.('input')) return;
  if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('nogui');
  if (e.key === 'r' || e.key === 'R') replay();
  if (e.key === ' ') { e.preventDefault(); setPause(!P.paused); }
  if (P.paused && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { clock = Math.max(0, clock + (e.key === 'ArrowRight' ? 1 : -1) / 60); P.scrub = Math.min(1, clock / (total() + .2)); scrubCtl.updateDisplay(); }
});
canvas.addEventListener('click', () => setPause(!P.paused));   // click the tunnel to pause / play
