/* ==========================================================================
   Drawer · the WebGL2 frosted-glass card box (ported from R8.9, same shaders)
   One canvas, re-mounted between Home and a destination page.
   - renders only while visible on screen
   - DPR up to 2 (was 1.35 on phones → soft)
   - 1024px card textures
   ========================================================================== */
const Drawer = (() => {
  const canvas = document.createElement('canvas');
  canvas.id = 'scene'; canvas.className = 'scene'; canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '3D 磨砂玻璃收納盒，點卡片開啟');
  const THEME = {
    bg0: '#d7e8f8', bg1: '#f6f8fc', bg2: '#ffffff', blobA: '#f7d9e5', blobAO: .55, blobB: '#cfcbe9', blobBO: .55,
    cardNum: 'rgba(255,255,255,.34)', cardLabel: 'rgba(255,255,255,.94)', ringA: [.2, .3, .78],
    panel: '#a9d7f4', panelTop: '#b3dcf6', slat: '#a0cff0', groove: '#85b3d6', rim: '#e3f2fd',
    glassTop: '#a9d7f4', glassBot: '#c7c3e6', glassMix: .24, glassLift: .07, glassRim: .62
  };
  const SLOTS = 10;
  const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
  const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const css = c => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
  const BW = 268, BD = 293, HF = 162, HB = 337.4, GT = 4, PT = 6;
  const CW = 236, CH = 236, CT = 2.4, LEAN = 6 * Math.PI / 180;
  const TOP0 = { y: 241.5, z: 99.3 }, MAIN_STEP = { y: 9.8, z: -27.2 }, BRANCH_STEP = { y: 24.2, z: -48.8 };
  const DEG = Math.PI / 180;
  const HOV = { lift: 95, tilt: -7.2 * DEG, dz: -14 }, FRONT = { tilt: -6 * DEG, dz: 4 }, BEHIND = { tilt: 0, dz: -35 };
  const RING_C = [.505, .545], RING_R = [.195, .17], DOT_R = .03;
  const BUILD = { back: [0, .75], left: [.1, .75], right: [.16, .75], panel: [.26, .8], card0: .62, cardStep: .11, cardDur: .72, drop: 520, fold: 80 * DEG };
  const BUILD_END = BUILD.card0 + BUILD.cardStep * (SLOTS - 1) + BUILD.cardDur;
  const WAVE = { every: 6, step: .13, dur: 1, rise: 20, tilt: -3 * DEG };
  const CAM = { fov: 26 * Math.PI / 180, psi: 34.4 * Math.PI / 180, phi: 14.9 * Math.PI / 180, target: [1.2, 186.8, 0], half: 300.4 };

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2), nf = 1 / (n - fa); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0]); }
  function lookAt(e, t, u) { const z = nrm(sub(e, t)), x = nrm(cross(u, z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]); }
  function inv(a) {
    const o = new Float32Array(16); const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return o; d = 1 / d;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d; return o;
  }
  const t4 = (m, x, y, z, w) => [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w, m[3] * x + m[7] * y + m[11] * z + m[15] * w];
  const I4 = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function tr(x, y, z) { const m = I4(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function rz(a) { const c = Math.cos(a), s = Math.sin(a), m = I4(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function rx(a) { const c = Math.cos(a), s = Math.sin(a), m = I4(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  const hinge = (base, rot, p) => mul(tr(p[0], p[1], p[2]), mul(rot, mul(tr(-p[0], -p[1], -p[2]), base)));
  const easeOutBack = (p, s = 1.5) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
  const dropFrac = p => p < .6 ? 1 - (p / .6) * (p / .6) : -.05 * Math.sin((p - .6) / .4 * Math.PI) * (1 - (p - .6) / .4);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  function rrect(x0, y0, x1, y1, r, seg = 6) { const p = []; for (const [cx, cy, a0] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]]) for (let k = 0; k <= seg; k++) { const a = (a0 + 90 * k / seg) * Math.PI / 180; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }
  function slab(pts, t) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, cx = 0, cy = 0;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); cx += x; cy += y; }
    cx /= pts.length; cy /= pts.length;
    const U = x => (x - x0) / (x1 - x0), V = y => 1 - (y - y0) / (y1 - y0), hh = t / 2, o = [];
    const P = (x, y, z, nx, ny, nz, u, v, p) => o.push(x, y, z, nx, ny, nz, u, v, p);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      P(cx, cy, hh, 0, 0, 1, U(cx), V(cy), 0); P(a[0], a[1], hh, 0, 0, 1, U(a[0]), V(a[1]), 0); P(b[0], b[1], hh, 0, 0, 1, U(b[0]), V(b[1]), 0);
      P(cx, cy, -hh, 0, 0, -1, U(cx), V(cy), 1); P(b[0], b[1], -hh, 0, 0, -1, U(b[0]), V(b[1]), 1); P(a[0], a[1], -hh, 0, 0, -1, U(a[0]), V(a[1]), 1);
      let nx = b[1] - a[1], ny = -(b[0] - a[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      P(a[0], a[1], hh, nx, ny, 0, 0, 0, 2); P(a[0], a[1], -hh, nx, ny, 0, 0, 0, 2); P(b[0], b[1], -hh, nx, ny, 0, 0, 0, 2);
      P(a[0], a[1], hh, nx, ny, 0, 0, 0, 2); P(b[0], b[1], -hh, nx, ny, 0, 0, 0, 2); P(b[0], b[1], hh, nx, ny, 0, 0, 0, 2);
    }
    return o;
  }

  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  const VS_MESH = `#version 300 es
layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;layout(location=2) in vec2 aU;layout(location=3) in float aK;
uniform mat4 uM,uVP;out vec3 vW;out vec3 vN;out vec2 vU;out float vK;
void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(uM)*aN;vU=aU;vK=aK;gl_Position=uVP*w;}`;
  const VS_FS = `#version 300 es
out vec2 vUv;void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
  const FS_BG = `#version 300 es
precision highp float;uniform vec2 uRes;uniform float uDpr;uniform vec3 uC0,uC1,uC2,uBA,uBB;uniform vec4 uGA,uGB;out vec4 o;
float erf1(float x){float s=sign(x),a=abs(x),t=1./(1.+.3275911*a);float y=1.-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-a*a);return s*y;}
float blob(vec2 p,vec4 g){float d=length(p-g.xy);return g.w*.5*(1.-erf1((d-g.z)/(40.*1.41421356)));}
void main(){vec2 S=uRes/uDpr;vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr;vec3 c;
 float t=length(vec2((px.x-.5*S.x)/(1.2*S.x),px.y/(.9*S.y)));
 c=t<.55?mix(uC0,uC1,t/.55):mix(uC1,uC2,clamp((t-.55)/.45,0.,1.));
 c=mix(c,uBA,blob(px,uGA));c=mix(c,uBB,blob(px,uGB));
 float n=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
 o=vec4(c+n/255.,1.);}`;
  const FS_CARD = `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec2 vU;in float vK;
uniform sampler2D uTex;uniform vec3 uSide,uBackC,uL,uRingA;uniform vec2 uRC,uRR,uDot;uniform float uDotR,uClip,uSheen,uBoost;out vec4 o;
void main(){if(vW.y<uClip)discard;vec3 n=normalize(vN);vec3 c;
 if(vK<.5){c=texture(uTex,vU).rgb;vec2 p=vU-uRC;float d=length(p);float aa=fwidth(d);float w=.0026;
  float bo=1.+uBoost*1.3;
  c=mix(c,vec3(1.),min(1.,(1.-smoothstep(w,w+aa*1.5,abs(d-uRR.x)))*uRingA.x*bo));
  c=mix(c,vec3(1.),min(1.,(1.-smoothstep(w,w+aa*1.5,abs(d-uRR.y)))*uRingA.y*bo));
  float dd=length(p-uDot);c=mix(c,vec3(1.),(1.-smoothstep(uDotR*(1.+uBoost*.35)-aa,uDotR*(1.+uBoost*.35)+aa,dd))*uRingA.z);
  if(uSheen>-.5){float s=(vU.x+vU.y*.5)/1.5;float ce=mix(-.25,1.25,uSheen);c=mix(c,vec3(1.),exp(-pow((s-ce)/.085,2.))*.26);}
 }else if(vK<1.5)c=uBackC;else c=uSide;
 float dif=max(dot(n,normalize(uL)),0.);c*=.9+.14*dif;o=vec4(c,1.);}`;
  const FS_PANEL = `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec2 vU;in float vK;
uniform vec2 uSize;uniform vec3 uBase,uTop,uSlat,uGroove,uRim,uL;uniform float uAlpha,uSheen;out vec4 o;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
void main(){vec3 n=normalize(vN);vec3 c;
 if(vK<.5){vec2 p=vU*uSize;c=mix(uTop,uBase,smoothstep(0.,uSize.y*.7,p.y));
  float m=15.,g=14.4,sh=(uSize.y-2.*m-2.*g)/3.,best=1e9,ty=0.;
  for(int i=0;i<3;i++){float top=m+float(i)*(sh+g);float d=sdRB(p-vec2(uSize.x*.5,top+sh*.5),vec2(uSize.x*.5-m,sh*.5),6.);if(d<best){best=d;ty=(p.y-top)/sh;}}
  float aa=fwidth(best);float inside=1.-smoothstep(-aa,aa,best);
  vec3 s=mix(uSlat,uGroove,(1.-smoothstep(0.,.32,ty))*.42);
  c=mix(c,s,inside);
  float edge=1.-smoothstep(.35,1.9,abs(best));  c=mix(c,uGroove,edge*mix(.3,.85,1.-smoothstep(.3,.7,ty)));
  c=mix(c,uRim,(1.-smoothstep(0.,3.,p.y))*.4);
  if(uSheen>-.5){float s=vU.x*.85+vU.y*.3;float ce=mix(-.2,1.3,uSheen);c=mix(c,vec3(1.),exp(-pow((s-ce)/.07,2.))*.32);}
 }else if(vK<1.5)c=uBase*.85;else c=uRim;
 float dif=max(dot(n,normalize(uL)),0.);c*=.9+.14*dif;o=vec4(c,uAlpha);}`;
  const FS_GLASS = `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec2 vU;in float vK;
uniform sampler2D uBlur,uScene;uniform vec2 uRes;uniform vec3 uCam,uTT,uTB;uniform float uMix,uLift,uRim,uHb,uAlpha,uSheen;out vec4 o;
void main(){vec3 n=normalize(vN);vec3 v=normalize(uCam-vW);vec2 suv=gl_FragCoord.xy/uRes;
 vec3 b=texture(uBlur,suv).rgb;float lum=dot(b,vec3(.299,.587,.114));
 vec3 tint=mix(uTB,uTT,clamp(vW.y/uHb,0.,1.));vec3 c=mix(b,tint,uMix);
 c+=uLift*smoothstep(.2,.85,lum);
 float fr=pow(1.-abs(dot(n,v)),4.);c=mix(c,vec3(1.),fr*.22);
 c=mix(c,vec3(1.),smoothstep(.6,1.,vW.y/uHb)*.06);
 if(vK>1.5)c=mix(c,vec3(1.),uRim);
 if(uSheen>-.5){float s=suv.x*.8+(1.-suv.y)*.35;float ce=mix(-.25,1.35,uSheen);c=mix(c,vec3(1.),exp(-pow((s-ce)/.06,2.))*.3);}
 o=vec4(mix(texture(uScene,suv).rgb,min(c,vec3(1.)),uAlpha),1.);}`;
  const FS_DOWN = `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uS;uniform vec2 uO;out vec4 o;
void main(){o=vec4((texture(uS,vUv+uO*vec2(-1,-1)).rgb+texture(uS,vUv+uO*vec2(1,-1)).rgb+texture(uS,vUv+uO*vec2(-1,1)).rgb+texture(uS,vUv+uO).rgb)*.25,1.);}`;
  const FS_BLUR = `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uS;uniform vec2 uD;out vec4 o;
void main(){vec3 c=texture(uS,vUv).rgb*.227027;
 c+=(texture(uS,vUv+uD).rgb+texture(uS,vUv-uD).rgb)*.1945946;
 c+=(texture(uS,vUv+2.*uD).rgb+texture(uS,vUv-2.*uD).rgb)*.1216216;
 c+=(texture(uS,vUv+3.*uD).rgb+texture(uS,vUv-3.*uD).rgb)*.054054;
 c+=(texture(uS,vUv+4.*uD).rgb+texture(uS,vUv-4.*uD).rgb)*.016216;o=vec4(c,1.);}`;
  const FS_COPY = `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uS;out vec4 o;void main(){o=texture(uS,vUv);}`;

  let P = {}, M = {}, emptyVAO, aniso = null, parts = {}, cards = [], ready = false, failed = !gl;
  function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function program(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; }
  function mesh(d) { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW); const st = 36;[[0, 3, 0], [1, 3, 12], [2, 2, 24], [3, 1, 32]].forEach(([l, s, o]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, st, o); }); gl.bindVertexArray(null); return { vao, n: d.length / 9 }; }
  function model(tx, ty, tz, rotY90) { return rotY90 ? new Float32Array([0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, tx, ty, tz, 1]) : new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1]); }

  /* ---------- state ---------- */
  let mode = 'home';      // home | theme
  let data = [];          // [{num,label,code,title,sub,color}]
  const st = { pointer: null, force: null, hovered: null, hit: null, introStart: null, buildStart: null, nextWave: null, waveStart: null, glassSheen: -1, panelSheen: -1, parts: null, modal: null };
  let onHover = () => {}, onTap = () => {};

  function buildScene() {
    const zb = -BD / 2, zf = BD / 2 - PT;
    M.side = mesh(slab([[-zf, 0], [-zb, 0], [-zb, HB], [-zf, HF]], GT));
    M.back = mesh(slab([[-BW / 2 + GT, 0], [BW / 2 - GT, 0], [BW / 2 - GT, HB], [-BW / 2 + GT, HB]], GT));
    M.panel = mesh(slab(rrect(-BW / 2, 0, BW / 2, HF, 8, 5), PT));
    M.card = mesh(slab(rrect(-CW / 2, 0, CW / 2, CH, 7, 5), CT));
    parts = { left: model(-BW / 2 + GT / 2, 0, 0, true), right: model(BW / 2 - GT / 2, 0, 0, true), back: model(0, 0, zb + GT / 2, false), panel: model(0, 0, BD / 2 - PT / 2, false) };
    cards = Array.from({ length: SLOTS }, (_, i) => ({ i, lift: 0, tilt: 0, dz: 0, dot: [0, 0], yo: 0, zo: 0, drop: 0, dropTilt: 0, wave: 0, sheen: -1, hidden: true, ret: null, tex: null, model: null }));
  }
  /* more than eight cards: tighten the spacing so the stack still fits the box */
  const step = () => { const b = mode === 'theme' ? BRANCH_STEP : MAIN_STEP, n = Math.max(1, data.length); const f = n > 8 ? 7 / (n - 1) : 1; return { y: b.y * f, z: b.z * f }; };
  /* one tone for every card: sky → lavender, each card a step deeper */
  const RAMP = ['#E2EAF6', '#D8E1F3', '#CED7EF', '#C5CCEA', '#BCC2E5', '#B3B8DF', '#AAAED8', '#A1A4D1', '#989BCA', '#8F92C2'];
  const toneOf = i => { const n = Math.max(1, data.length); const k = Math.round(Math.min(i, n - 1) * (RAMP.length - 1) / Math.max(1, n - 1)); return RAMP[Math.max(0, Math.min(RAMP.length - 1, k))]; };
  function cardMatrix(c, rest) {
    const s = step();
    const baseBy = TOP0.y + s.y * c.i - CH * Math.cos(LEAN), baseBz = TOP0.z + s.z * c.i + CH * Math.sin(LEAN);
    const lean = LEAN + (rest ? 0 : c.tilt + c.dropTilt + c.wave * WAVE.tilt);
    const py = baseBy + (rest ? 0 : c.lift + c.yo + c.drop + c.wave * WAVE.rise), pz = baseBz + (rest ? 0 : c.dz + c.zo);
    const cx = Math.cos(-lean), sx = Math.sin(-lean);
    return new Float32Array([1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, py, pz, 1]);
  }
  function cardCanvas(i) {
    const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
    const d = data[i] || {}; const base = hex(toneOf(i));
    const g = x.createLinearGradient(0, 0, S * .7, S); g.addColorStop(0, css(mixc(base, [1, 1, 1], .42))); g.addColorStop(.55, css(base)); g.addColorStop(1, css(mixc(base, [.36, .34, .55], .16)));
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const sheen = x.createRadialGradient(S * .2, S * .1, 0, S * .2, S * .1, S * .8); sheen.addColorStop(0, 'rgba(255,255,255,.35)'); sheen.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = sheen; x.fillRect(0, 0, S, S);
    const ink = 'rgba(41,52,86,.86)', inkSoft = 'rgba(41,52,86,.55)';
    x.fillStyle = 'rgba(255,255,255,.62)'; x.font = `italic 400 ${S * .2}px "EB Garamond", Georgia, serif`; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillText(d.num || pad2(i + 1), S * .08, S * .27);
    x.fillStyle = ink; const label = String(d.label || '');
    const fs = label.length > 14 ? .026 : label.length > 10 ? .032 : label.length > 7 ? .042 : label.length > 4 ? .054 : .07;
    x.font = `500 ${S * fs}px "Noto Serif TC", "Songti TC", "Noto Serif CJK TC", serif`; x.textAlign = 'center'; x.textBaseline = 'top';
    [...label.slice(0, 18)].forEach((ch, k) => x.fillText(ch, S * .878, S * .075 + k * S * fs * 1.14));
    const ell = (s, n) => String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || '');
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    if (d.title) {
      x.fillStyle = ink; x.font = `500 ${S * .058}px "EB Garamond", Georgia, "Noto Serif TC", serif`;
      x.fillText(ell(d.title, 24), S * .08, S * .79);
    }
    if (d.sub) { x.fillStyle = inkSoft; x.font = `600 ${S * .024}px Archivo, "Helvetica Neue", Arial, sans-serif`; x.fillText(ell(d.sub, 40), S * .082, S * .84); }
    if (d.code) { x.fillStyle = inkSoft; x.font = `700 ${S * .022}px Archivo, "Helvetica Neue", Arial, sans-serif`; x.fillText(d.code, S * .082, S * .885); }
    return cv;
  }
  function uploadTextures() {
    if (!ready) return;
    cards.forEach(c => {
      if (!c.tex) c.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, c.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cardCanvas(c.i));
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    });
  }

  /* ---------- render targets & camera ---------- */
  let W = 1, H = 1, cssW = 1, cssH = 1, dpr = 1, T = null, VP = null, invVP = null, eye = [0, 0, 0];
  function colorTex(w, h) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  function target(w, h) { const tex = colorTex(w, h), fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); return { tex, fb, w, h }; }
  function freeTargets() { if (!T) return;[T.scene, T.half, T.a, T.b].forEach(t => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }); gl.deleteRenderbuffer(T.crb); gl.deleteRenderbuffer(T.drb); gl.deleteFramebuffer(T.ms); }
  function makeTargets() {
    freeTargets();
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
    const ms = gl.createFramebuffer(), crb = gl.createRenderbuffer(), drb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, crb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, W, H);
    gl.bindRenderbuffer(gl.RENDERBUFFER, drb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, ms); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, crb); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, drb);
    const bw = Math.max(48, Math.round(cssW / 3)), bh = Math.max(32, Math.round(cssH / 3));
    T = { ms, crb, drb, scene: target(W, H), half: target(Math.max(1, W >> 1), Math.max(1, H >> 1)), a: target(bw, bh), b: target(bw, bh) };
  }
  function layoutCamera() {
    const asp = cssW / cssH;
    // fit the box (and a lifted card) inside the mount with breathing room
    let half = mode === 'theme' ? 270 : 262;
    const needHalfW = mode === 'theme' ? 255 : 245;
    if (asp * half < needHalfW) half = needHalfW / asp;
    const dist = half / Math.tan(CAM.fov / 2);
    const dir = [-Math.sin(CAM.psi) * Math.cos(CAM.phi), Math.sin(CAM.phi), Math.cos(CAM.psi) * Math.cos(CAM.phi)];
    const tg = [CAM.target[0], mode === 'theme' ? 172 : 160, CAM.target[2]];
    eye = [tg[0] + dir[0] * dist, tg[1] + dir[1] * dist, tg[2] + dir[2] * dist];
    VP = mul(persp(CAM.fov, asp, Math.max(10, dist - 1100), dist + 1100), lookAt(eye, tg, [0, 1, 0]));
    invVP = inv(VP);
  }
  function resize() {
    if (!ready) return;
    const r = canvas.getBoundingClientRect();
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    const maxDpr = typeof PERF_PROFILE !== 'undefined' ? PERF_PROFILE.drawerDpr : 2;
    const pixelBudget = typeof PERF_PROFILE !== 'undefined' ? PERF_PROFILE.drawerPixels : 2600000;
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    if (cssW * cssH * dpr * dpr > pixelBudget) dpr = Math.sqrt(pixelBudget / (cssW * cssH));
    W = Math.max(1, Math.round(cssW * dpr)); H = Math.max(1, Math.round(cssH * dpr));
    canvas.width = W; canvas.height = H; makeTargets(); layoutCamera();
  }

  function project(x, y, z) { const c = t4(VP, x, y, z, 1); return [(c[0] / c[3] + 1) / 2 * cssW, (1 - c[1] / c[3]) / 2 * cssH]; }
  function cardRect(i, rest = false) {
    const c = cards[i]; if (!c) return null; const m = cardMatrix(c, rest); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [lx, ly] of [[-CW / 2, 0], [CW / 2, 0], [CW / 2, CH], [-CW / 2, CH]]) { const w = t4(m, lx, ly, CT / 2, 1); const p = project(w[0], w[1], w[2]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const r = canvas.getBoundingClientRect();
    return { x: r.left + x0, y: r.top + y0, w: x1 - x0, h: y1 - y0 };
  }
  function pick(mx, my) {
    const nx = mx / cssW * 2 - 1, ny = 1 - my / cssH * 2;
    const a = t4(invVP, nx, ny, -1, 1), b = t4(invVP, nx, ny, 1, 1);
    const P0 = [a[0] / a[3], a[1] / a[3], a[2] / a[3]], D = sub([b[0] / b[3], b[1] / b[3], b[2] / b[3]], P0);
    let best = null;
    for (const c of cards) {
      if (c.hidden || !c.model) continue;
      const mi = inv(c.model), o = t4(mi, P0[0], P0[1], P0[2], 1), d = t4(mi, D[0], D[1], D[2], 0);
      if (Math.abs(d[2]) < 1e-9) continue;
      const t = (CT / 2 - o[2]) / d[2]; if (t < 0) continue;
      const hx = o[0] + d[0] * t, hy = o[1] + d[1] * t;
      if (hx < -CW / 2 || hx > CW / 2 || hy < 0 || hy > CH) continue;
      if (P0[1] + D[1] * t < 0) continue;
      if (!best || t < best.t) best = { i: c.i, t, u: (hx + CW / 2) / CW, v: 1 - hy / CH };
    }
    return best;
  }

  const DUR = .48, STAG = .025;
  function update(dt, now) {
    const bt = st.buildStart == null ? -1 : (now - st.buildStart) / 1000, building = bt < BUILD_END;
    const fold = ([d, dur]) => { const p = clamp((bt - d) / dur, 0, 1); return bt < 0 ? { e: 0, a: 0 } : { e: easeOutBack(p), a: clamp(p / .35, 0, 1) }; };
    const fb = fold(BUILD.back), fl = fold(BUILD.left), fr = fold(BUILD.right), fp = fold(BUILD.panel);
    st.parts = { back: { m: hinge(parts.back, rx(-BUILD.fold * (1 - fb.e)), [0, 0, -BD / 2]), a: fb.a }, left: { m: hinge(parts.left, rz(BUILD.fold * (1 - fl.e)), [-BW / 2, 0, 0]), a: fl.a }, right: { m: hinge(parts.right, rz(-BUILD.fold * (1 - fr.e)), [BW / 2, 0, 0]), a: fr.a }, panel: { m: hinge(parts.panel, rx(BUILD.fold * (1 - fp.e)), [0, 0, BD / 2]), a: fp.a } };
    let hit = null;
    if (!building && st.modal == null && st.pointer) hit = pick(st.pointer.x, st.pointer.y);
    let h = hit ? hit.i : null; if (st.force != null) h = st.force;
    if (st.hovered !== h) onHover(h);
    st.hovered = h; st.hit = hit;
    canvas.style.cursor = hit && st.modal == null ? 'pointer' : '';
    const k = 1 - Math.exp(-dt * 9), kd = 1 - Math.exp(-dt * 12);
    const count = data.length, s = step();
    const introDone = st.introStart != null && (now - st.introStart) / 1000 > DUR + STAG * count;
    if (st.nextWave != null && now >= st.nextWave) {
      if (!REDUCE && !building && introDone && st.modal == null && h == null) { st.waveStart = now; st.nextWave = now + WAVE.every * 1000; } else st.nextWave = now + 900;
    }
    const wt = st.waveStart == null ? -1 : (now - st.waveStart) / 1000;
    st.glassSheen = wt >= 0 && wt <= 1.5 ? wt / 1.5 : -1; st.panelSheen = wt >= .45 && wt <= 1.45 ? wt - .45 : -1;
    for (const c of cards) {
      const on = h === c.i, tg = h == null ? null : on ? HOV : c.i < h ? FRONT : BEHIND;
      c.lift += ((on ? HOV.lift : 0) - c.lift) * k; c.tilt += ((tg ? tg.tilt : 0) - c.tilt) * k; c.dz += ((tg ? tg.dz : 0) - c.dz) * k;
      let tx = 0, ty = 0;
      if (on && hit && hit.i === c.i) { tx = (hit.u - RING_C[0]) * .6; ty = (hit.v - RING_C[1]) * .6; const l = Math.hypot(tx, ty), mx = RING_R[1] * .6; if (l > mx) { tx *= mx / l; ty *= mx / l; } }
      c.dot[0] += (tx - c.dot[0]) * kd; c.dot[1] += (ty - c.dot[1]) * kd;
      let e = 0; if (st.introStart != null) e = easeOut(clamp(((now - st.introStart) / 1000 - c.i * STAG) / DUR, 0, 1));
      c.yo = -(1 - e) * (25 + s.y * c.i); c.zo = (1 - e) * (-110 - 8 * c.i - s.z * c.i);
      if (c.ret != null) { const r = easeOut(clamp((now - c.ret) / 520, 0, 1)); c.yo -= (1 - r) * 25; c.zo -= (1 - r) * 110; if (r >= 1) c.ret = null; }
      c.drop = 0; c.dropTilt = 0;
      if (building && bt >= 0) { const p = clamp((bt - BUILD.card0 - ((cards.length - 1) - c.i) * BUILD.cardStep) / BUILD.cardDur, 0, 1), f = dropFrac(p); c.drop = p <= 0 ? 3000 : f * BUILD.drop; c.dropTilt = f > 0 ? f * 10 * DEG : 0; }
      const wp = wt < 0 ? -1 : (wt - ((count - 1) - c.i) * WAVE.step) / WAVE.dur;
      if (wp >= 0 && wp <= 1) { c.wave = (.5 - .5 * Math.cos(2 * Math.PI * wp)) * (on ? 0 : 1); c.sheen = wp; } else { c.wave = 0; c.sheen = -1; }
      c.model = cardMatrix(c, false);
    }
  }
  const L = nrm([-.4, .78, .5]); const C = {};
  function cacheColors() { C.bg0 = hex(THEME.bg0); C.bg1 = hex(THEME.bg1); C.bg2 = hex(THEME.bg2); C.ba = hex(THEME.blobA); C.bb = hex(THEME.blobB); C.panel = hex(THEME.panel); C.ptop = hex(THEME.panelTop); C.slat = hex(THEME.slat); C.groove = hex(THEME.groove); C.rim = hex(THEME.rim); C.gt = hex(THEME.glassTop); C.gb = hex(THEME.glassBot); }
  function drawMesh(prog, m, mat) { gl.uniformMatrix4fv(prog.u.uM, false, mat); gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n); }
  function fullscreen() { gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  function resolve() { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.scene.fb); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST); }
  function pass(dst, prog, src, setup) { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h); gl.useProgram(prog.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(prog.u.uS, 0); setup(); fullscreen(); }
  function render() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.ms); gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    const pb = P.bg; gl.useProgram(pb.p); gl.uniform2f(pb.u.uRes, W, H); gl.uniform1f(pb.u.uDpr, dpr);
    gl.uniform3fv(pb.u.uC0, C.bg0); gl.uniform3fv(pb.u.uC1, C.bg1); gl.uniform3fv(pb.u.uC2, C.bg2); gl.uniform3fv(pb.u.uBA, C.ba); gl.uniform3fv(pb.u.uBB, C.bb);
    gl.uniform4f(pb.u.uGA, cssW * .12 + 110, cssH * .16 + 90, 120, THEME.blobAO); gl.uniform4f(pb.u.uGB, cssW * .86 - 90, cssH * .86 - 80, 110, THEME.blobBO);
    fullscreen();
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LEQUAL);
    const S = st.parts, pc = P.card; gl.useProgram(pc.p); gl.uniformMatrix4fv(pc.u.uVP, false, VP);
    gl.uniform3fv(pc.u.uL, L); gl.uniform2fv(pc.u.uRC, RING_C); gl.uniform2fv(pc.u.uRR, RING_R); gl.uniform1f(pc.u.uDotR, DOT_R); gl.uniform3fv(pc.u.uRingA, THEME.ringA); gl.uniform1f(pc.u.uClip, .5);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(pc.u.uTex, 0);
    for (const c of cards) {
      if (c.hidden || !c.tex) continue;
      const base = hex(toneOf(c.i));
      gl.bindTexture(gl.TEXTURE_2D, c.tex); gl.uniform3fv(pc.u.uSide, mixc(base, [1, 1, 1], .28)); gl.uniform3fv(pc.u.uBackC, mixc(base, [0, 0, 0], .2));
      gl.uniform2fv(pc.u.uDot, c.dot); gl.uniform1f(pc.u.uSheen, c.sheen); gl.uniform1f(pc.u.uBoost, c.wave);
      drawMesh(pc, M.card, c.model);
    }
    if (S.panel.a > 0) {
      const pp = P.panel; gl.useProgram(pp.p); gl.uniformMatrix4fv(pp.u.uVP, false, VP);
      gl.uniform2f(pp.u.uSize, BW, HF); gl.uniform3fv(pp.u.uBase, C.panel); gl.uniform3fv(pp.u.uTop, C.ptop); gl.uniform3fv(pp.u.uSlat, C.slat); gl.uniform3fv(pp.u.uGroove, C.groove); gl.uniform3fv(pp.u.uRim, C.rim); gl.uniform3fv(pp.u.uL, L);
      gl.uniform1f(pp.u.uAlpha, S.panel.a); gl.uniform1f(pp.u.uSheen, st.panelSheen);
      if (S.panel.a < 1) { gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE); }
      drawMesh(pp, M.panel, S.panel.m); gl.disable(gl.BLEND);
    }
    resolve();
    pass(T.half, P.down, T.scene, () => gl.uniform2f(P.down.u.uO, .5 / W, .5 / H));
    const f = T.half.w / T.a.w;
    pass(T.a, P.down, T.half, () => gl.uniform2f(P.down.u.uO, .5 * f / T.half.w, .5 * f / T.half.h));
    for (let it = 0; it < 2; it++) { pass(T.b, P.blur, T.a, () => gl.uniform2f(P.blur.u.uD, 1.9 / T.a.w, 0)); pass(T.a, P.blur, T.b, () => gl.uniform2f(P.blur.u.uD, 0, 1.9 / T.a.h)); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.ms); gl.viewport(0, 0, W, H); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    const pg = P.glass; gl.useProgram(pg.p); gl.uniformMatrix4fv(pg.u.uVP, false, VP);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.a.tex); gl.uniform1i(pg.u.uBlur, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.scene.tex); gl.uniform1i(pg.u.uScene, 1); gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(pg.u.uSheen, st.glassSheen); gl.uniform2f(pg.u.uRes, W, H); gl.uniform3fv(pg.u.uCam, eye); gl.uniform3fv(pg.u.uTT, C.gt); gl.uniform3fv(pg.u.uTB, C.gb);
    gl.uniform1f(pg.u.uMix, THEME.glassMix); gl.uniform1f(pg.u.uLift, THEME.glassLift); gl.uniform1f(pg.u.uRim, THEME.glassRim); gl.uniform1f(pg.u.uHb, HB);
    for (const [k, m] of [['back', M.back], ['right', M.side], ['left', M.side]]) { if (S[k].a <= 0) continue; gl.uniform1f(pg.u.uAlpha, S[k].a); drawMesh(pg, m, S[k].m); }
    resolve();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(P.copy.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.scene.tex); gl.uniform1i(P.copy.u.uS, 0); fullscreen();
  }

  function intro() {
    cards.forEach(c => { c.hidden = c.i >= data.length; c.ret = null; c.lift = 0; c.tilt = 0; c.dz = 0; c.dot = [0, 0]; });
    st.introStart = performance.now() - (REDUCE ? 1e5 : 0); st.waveStart = null; st.nextWave = performance.now() + 2600;
  }
  function build() {
    const now = performance.now(); cards.forEach(c => { c.hidden = c.i >= data.length; c.ret = null; c.lift = 0; c.tilt = 0; c.dz = 0; c.dot = [0, 0]; });
    st.introStart = now - 1e5; st.buildStart = REDUCE ? now - 1e5 : now; st.nextWave = now + (BUILD_END + 1.6) * 1000;
  }

  /* ---------- pointer: hover lifts, tap opens, vertical swipe scrolls the page ---------- */
  const pt = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  let down = null;
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || down) { st.pointer = pt(e); if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down.moved = true; st.pointer = null; } } });
  canvas.addEventListener('pointerdown', e => { st.pointer = pt(e); down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; });
  canvas.addEventListener('pointerup', e => {
    const d = down; down = null; if (!ready || st.modal != null) return;
    if (d && !d.moved && performance.now() - d.t < 700) { const p = pt(e); const hit = pick(p.x, p.y); if (hit) { haptic(); onTap(hit.i); } }
    if (e.pointerType !== 'mouse') setTimeout(() => { st.pointer = null; }, 160);
  });
  canvas.addEventListener('pointercancel', () => { down = null; st.pointer = null; });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') st.pointer = null; });

  /* ---------- loop: only while on screen ---------- */
  /* render only while something moves; sleep until the next idle wave otherwise (battery) */
  let visible = false, running = false, last = performance.now(), wakeT = null;
  const io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) loop(); }, { threshold: .01 });
  function idle(now) {
    if (st.pointer || st.force != null || st.hovered != null) return false;
    if (st.buildStart != null && (now - st.buildStart) / 1000 < BUILD_END + .2) return false;
    if (st.introStart != null && (now - st.introStart) / 1000 < DUR + STAG * SLOTS + .3) return false;
    if (st.waveStart != null && (now - st.waveStart) / 1000 < WAVE.dur + WAVE.step * SLOTS + .8) return false;
    return cards.every(c => c.ret == null && Math.abs(c.lift) < .05 && Math.abs(c.tilt) < 1e-4 && Math.abs(c.dz) < .05 && Math.abs(c.dot[0]) + Math.abs(c.dot[1]) < 1e-3);
  }
  function loop() {
    clearTimeout(wakeT);
    if (running || !ready) return; running = true; last = performance.now();
    let calm = 0;
    const frame = now => {
      if (!visible || document.hidden || !canvas.isConnected) { running = false; return; }
      const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
      update(dt, now); render();
      calm = idle(now) ? calm + 1 : 0;
      if (calm > 3) { running = false; const wait = st.nextWave ? Math.max(60, st.nextWave - performance.now()) : 1500; wakeT = setTimeout(loop, wait); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  ['pointerdown', 'pointermove', 'pointerenter'].forEach(t => canvas.addEventListener(t, () => loop(), { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) loop(); });
  new ResizeObserver(() => { if (ready && canvas.isConnected) resize(); }).observe(canvas);

  function init() {
    if (ready || failed) return ready;
    try {
      aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      P.bg = program(VS_FS, FS_BG); P.card = program(VS_MESH, FS_CARD); P.panel = program(VS_MESH, FS_PANEL);
      P.glass = program(VS_MESH, FS_GLASS); P.down = program(VS_FS, FS_DOWN); P.blur = program(VS_FS, FS_BLUR); P.copy = program(VS_FS, FS_COPY);
      emptyVAO = gl.createVertexArray(); cacheColors(); buildScene(); ready = true;
      if (document.fonts) document.fonts.ready.then(() => uploadTextures()).catch(() => {});
    } catch (err) { console.warn('[drawer]', err); failed = true; }
    return ready;
  }

  return {
    canvas,
    get ready() { return ready; },
    get failed() { return failed; },
    mount(host, { cards: list, mode: m = 'home', build: doBuild = false } = {}) {
      if (!init()) { host.classList.add('no-gl'); return false; }
      mode = m; data = (list || []).slice(0, SLOTS);
      if (canvas.parentNode !== host) host.appendChild(canvas);
      io.disconnect(); io.observe(canvas);
      requestAnimationFrame(() => { resize(); uploadTextures(); (doBuild || st.buildStart == null) ? build() : intro(); loop(); });
      return true;
    },
    setCards(list, { animate = true } = {}) { data = (list || []).slice(0, SLOTS); if (!ready) return; uploadTextures(); if (animate) intro(); else cards.forEach(c => { c.hidden = c.i >= data.length; }); loop(); },
    cardRect,
    hold(i) { st.modal = i; st.force = null; if (cards[i]) { cards[i].hidden = true; cards[i].ret = null; } loop(); },
    release(i) { st.modal = null; if (cards[i]) { cards[i].hidden = false; cards[i].ret = REDUCE ? null : performance.now(); } loop(); },
    focus(i) { st.force = i; loop(); },
    blur() { st.force = null; loop(); },
    set onHover(f) { onHover = f; },
    set onTap(f) { onTap = f; },
    get hovered() { return st.hovered; },
    get running() { return running; },
    get visible() { return visible; }
  };
})();
