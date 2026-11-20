import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { buildArchitecturalScene, type BuiltSceneData } from '../model/buildScene';
import {
  ALL_LAYERS,
  F,
  JVIEWS,
  L,
  PL,
  PRESETS,
  RAD,
  RAMP,
  ROOMS,
  SITE,
  VIEWS,
  W,
  WALK_AT,
  clearSky,
  floorAt,
  fromDOY,
  halfDay,
  hm,
  isDST,
  nf,
  roomAt,
  sunPos,
  toLocal,
  C,
} from '../model/config';

export interface SunTelemetry {
  day: number;
  hour: number;
  dateLabel: string;
  solarTime: string;
  localTime: string;
  dst: boolean;
  altDeg: number;
  azDeg: number;
  compass: string;
  sunrise: string;
  sunset: string;
  dayLen: string;
  noonAltDeg: number;
  sunriseAzDeg: number;
  litPanels: number;
  totalPanels: number;
  incidenceDeg: number;
  kwNow: number;
  dayKwh: number;
  shadeLossKwh: number;
  sunHours: number;
}

export interface BuildState {
  active: boolean;
  playing: boolean;
  step: number;
  prog: number;
  speed: number;
  autoRotate: boolean;
}

export interface WalkState {
  active: boolean;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  room: string;
  fov: number;
  aspect: number;
}

export interface ViewportCallbacks {
  onSceneReady: (data: BuiltSceneData) => void;
  onSunUpdate: (info: SunTelemetry) => void;
  onBuildUpdate: (state: BuildState) => void;
  onWalkUpdate: (state: WalkState) => void;
  onLayersSync: (visible: Record<string, boolean>, xray: boolean) => void;
  onFloorplan2DChange?: (enabled: boolean) => void;
}

export interface WalkInputState {
  moveX: number;
  moveZ: number;
  turnYaw: number;
  turnPitch: number;
  sprint?: boolean;
}

export interface ViewportHandle {
  setPreset: (presetId: string) => void;
  setView: (viewId: string) => void;
  setJointView: (jointId: string) => void;
  setLayerVisible: (id: string, visible: boolean) => void;
  setExplode: (pct: number) => void;
  setSection: (pct: number) => void;
  setXray: (on: boolean) => void;
  setLabelsVisible: (on: boolean) => void;
  setSun: (day: number, hour: number, computeDayEnergy?: boolean) => void;
  setSunDomeVisible: (on: boolean) => void;
  setSunAnim: (mode: 'none' | 'day' | 'year') => void;
  buildAction: (action: 'play' | 'prev' | 'next' | 'end' | 'goto' | 'prog', arg?: number) => void;
  setBuildOptions: (opts: { speed?: number; autoRotate?: boolean }) => void;
  walkTo: (spotKey: string) => void;
  walkTeleport: (x: number, z: number) => boolean;
  walkExit: (restore?: boolean) => void;
  setWalkInput: (input: Partial<WalkInputState>) => void;
  walkResetPitch: () => void;
  setFloorplan2D: (enabled: boolean) => void;
  resetFloorplan2DView: () => void;
  zoomFloorplan2D: (factor: number) => void;
  focusFloorplan2D: (target: 'house' | 'tech' | 'bedrooms') => void;
  setFloorplan2DPlaster: (showPlaster: boolean) => void;
  getData: () => BuiltSceneData | null;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SV', 'V', 'NV'];
const MONTH_SEASONS = ['iarnă', 'iarnă', 'primăvară', 'primăvară', 'primăvară', 'vară', 'vară', 'vară', 'toamnă', 'toamnă', 'toamnă', 'iarnă'];
const LUNI = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const EYE = 1.60;
const RAD_P = 0.22;
const NAV_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'];

export const Viewport3D = forwardRef<ViewportHandle, ViewportCallbacks>(function Viewport3D(props, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef(props);
  cbRef.current = props;

  const ctrlRef = useRef<ViewportHandle | null>(null);
  useImperativeHandle(ref, () => ({
    setPreset: (id) => ctrlRef.current?.setPreset(id),
    setView: (id) => ctrlRef.current?.setView(id),
    setJointView: (id) => ctrlRef.current?.setJointView(id),
    setLayerVisible: (id, v) => ctrlRef.current?.setLayerVisible(id, v),
    setExplode: (pct) => ctrlRef.current?.setExplode(pct),
    setSection: (pct) => ctrlRef.current?.setSection(pct),
    setXray: (on) => ctrlRef.current?.setXray(on),
    setLabelsVisible: (on) => ctrlRef.current?.setLabelsVisible(on),
    setSun: (d, h, full) => ctrlRef.current?.setSun(d, h, full),
    setSunDomeVisible: (on) => ctrlRef.current?.setSunDomeVisible(on),
    setSunAnim: (m) => ctrlRef.current?.setSunAnim(m),
    buildAction: (a, arg) => ctrlRef.current?.buildAction(a, arg),
    setBuildOptions: (o) => ctrlRef.current?.setBuildOptions(o),
    walkTo: (k) => ctrlRef.current?.walkTo(k),
    walkTeleport: (x, z) => ctrlRef.current?.walkTeleport(x, z) ?? false,
    walkExit: (r) => ctrlRef.current?.walkExit(r),
    setWalkInput: (inp) => ctrlRef.current?.setWalkInput(inp),
    walkResetPitch: () => ctrlRef.current?.walkResetPitch(),
    setFloorplan2D: (on) => ctrlRef.current?.setFloorplan2D(on),
    resetFloorplan2DView: () => ctrlRef.current?.resetFloorplan2DView(),
    zoomFloorplan2D: (factor) => ctrlRef.current?.zoomFloorplan2D(factor),
    focusFloorplan2D: (target) => ctrlRef.current?.focusFloorplan2D(target),
    setFloorplan2DPlaster: (show) => ctrlRef.current?.setFloorplan2DPlaster(show),
    getData: () => ctrlRef.current?.getData() ?? null,
  }));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isSoftwareGl = false;
    try {
      const probe = document.createElement('canvas').getContext('webgl2');
      const dbg = probe?.getExtension('WEBGL_debug_renderer_info');
      const rendererName = dbg ? String(probe?.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '') : '';
      isSoftwareGl = /swiftshader|llvmpipe|software/i.test(rendererName);
    } catch {
      isSoftwareGl = false;
    }

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const sceneFog = new THREE.FogExp2(0xd8e7f2, 0.0038);
    scene.background = new THREE.Color(0xcde2f2);
    scene.fog = sceneFog;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.62;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 450);
    const ORTHO_HALF_H = 11.2;
    const orthoCam = new THREE.OrthographicCamera(
      -ORTHO_HALF_H * (width / height),
      ORTHO_HALF_H * (width / height),
      ORTHO_HALF_H,
      -ORTHO_HALF_H,
      0.1,
      200,
    );
    let activeCam: THREE.Camera = camera;
    let floorplan2D = false;

    const controls = new OrbitControls(camera as THREE.Camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 1.8;
    controls.maxDistance = 140;

    // Sky dome for natural atmospheric scattering
    const sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);
    const skyU = sky.material.uniforms;
    skyU['turbidity'].value = 4.2;
    skyU['rayleigh'].value = 1.85;
    skyU['mieCoefficient'].value = 0.004;
    skyU['mieDirectionalG'].value = 0.78;

    const hemi = new THREE.HemisphereLight(0xf6faff, 0x7c8661, 1.05);
    scene.add(hemi);

    const SUNT = new THREE.Vector3(W / 2, 0, L / 2);
    const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.3);
    sunLight.target.position.copy(SUNT);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunLight.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 150 });
    sunLight.shadow.bias = -0.0012;
    sunLight.shadow.normalBias = 0.04;
    scene.add(sunLight, sunLight.target);

    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1000);
    const planCutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), F + 1.55);
    const maxAniso = isSoftwareGl ? 1 : Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    const data = buildArchitecturalScene(scene, clipPlane, isSoftwareGl, maxAniso);

    // 2D Floorplan flat architectural room labels (visible only in 2D orthographic mode)
    const planLabelsGroup = new THREE.Group();
    planLabelsGroup.visible = false;
    const planLabelDisposables: { geo: THREE.BufferGeometry; mat: THREE.Material; tex: THREE.Texture }[] = [];
    const addPlanTag = (title: string, subtitle: string, x: number, z: number, widthM = 2.5, heightM = 0.72) => {
      const cv = document.createElement('canvas');
      cv.width = 512;
      cv.height = 148;
      const g = cv.getContext('2d')!;
      g.fillStyle = 'rgba(255, 253, 248, 0.95)';
      g.strokeStyle = 'rgba(130, 88, 22, 0.65)';
      g.lineWidth = 4;
      g.beginPath();
      g.roundRect(6, 6, 500, 136, 18);
      g.fill();
      g.stroke();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#1E1C18';
      g.font = '700 40px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      g.fillText(title, 256, 52);
      g.fillStyle = '#7A5416';
      g.font = '700 32px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      g.fillText(subtitle, 256, 102);

      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(widthM, heightM);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, F + 1.48, z);
      mesh.renderOrder = 40;
      planLabelsGroup.add(mesh);
      planLabelDisposables.push({ geo, mat, tex });
    };

    const roomShort: Record<string, string> = {
      'Dormitor 1': 'Dormitor 1',
      'Dormitor matrimonial': 'Dormitor matr.',
      'Living + loc de masă + bucătărie': 'Living + bucătărie',
      Baie: 'Baie',
      'Cameră tehnică': 'Cam. tehnică',
    };
    const roomDims: Record<string, string> = {
      'Dormitor 1': '2,93×4,32 m',
      'Dormitor matrimonial': '3,37×4,32 m',
      'Living + loc de masă + bucătărie': '6,40×6,51 m',
      Baie: '2,32×1,73 m',
      'Cameră tehnică': '2,32×1,50 m',
    };
    const roomAnchor: Record<string, [number, number, number]> = {
      'Dormitor 1': [2.15, 3.65, 2.05],
      'Dormitor matrimonial': [5.05, 3.62, 2.30],
      'Living + loc de masă + bucătărie': [2.05, 8.58, 2.35],
      Baie: [5.48, 5.64, 1.88],
      'Cameră tehnică': [5.52, 7.28, 1.88],
    };
    for (const r of ROOMS) {
      const area = r.r.reduce((acc, [x0, x1, z0, z1]) => acc + (x1 - x0) * (z1 - z0), 0);
      const [rx, rz, rw] = roomAnchor[r.n] || [W / 2, L / 2, 2.4];
      const dim = roomDims[r.n];
      const sub = dim ? `${nf(area, 1)} m² · ${dim}` : `${nf(area, 1)} m²`;
      addPlanTag(roomShort[r.n] || r.n, sub, rx, rz, rw, rw * 0.29);
    }
    addPlanTag('Terasă sud', `${nf(W * C.terrace.depth, 1)} m² · 7,20×4,00 m`, W / 2, L + PL + C.terrace.depth / 2, 2.85, 0.78);
    addPlanTag('Terasă est · rampă', '1,50 m · pantă 10 %', W + PL + C.terrace.sideDepth / 2, C.terrace.sideZ0 + 2.4, 2.35, 0.66);
    scene.add(planLabelsGroup);

    // 2D Floorplan CAD dimension lines & overall house measurements
    const planDimsGroup = new THREE.Group();
    planDimsGroup.visible = false;
    const planDimDisposables: { geo: THREE.BufferGeometry; mat: THREE.Material; tex?: THREE.Texture }[] = [];
    const dimSegVerts: number[] = [];
    const dimExtVerts: number[] = [];
    const dimY = F + 1.49;

    const addDimLabel = (
      text: string,
      x: number,
      z: number,
      vertical = false,
      primary = false,
      widthM = 1.65,
    ) => {
      const cv = document.createElement('canvas');
      cv.width = 360;
      cv.height = 96;
      const g = cv.getContext('2d')!;
      g.fillStyle = primary ? 'rgba(30, 28, 24, 0.96)' : 'rgba(250, 248, 243, 0.96)';
      g.strokeStyle = primary ? '#C28A2A' : 'rgba(130, 88, 22, 0.72)';
      g.lineWidth = primary ? 4 : 3.5;
      g.beginPath();
      g.roundRect(6, 8, 348, 80, 16);
      g.fill();
      g.stroke();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = primary ? '#FAF8F3' : '#6A4710';
      g.font = `700 ${primary ? 44 : 38}px "Plus Jakarta Sans", "Segoe UI", sans-serif`;
      g.fillText(text, 180, 49);

      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(widthM, widthM * (96 / 360));
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      if (vertical) mesh.rotation.z = Math.PI / 2;
      mesh.position.set(x, dimY + 0.02, z);
      mesh.renderOrder = 44;
      planDimsGroup.add(mesh);
      planDimDisposables.push({ geo, mat, tex });
    };

    const addDimH = (x0: number, x1: number, z: number, refZ: number, label: string, primary = false) => {
      // Main line & witness extension lines
      dimSegVerts.push(x0, dimY, z, x1, dimY, z);
      dimSegVerts.push(x0, dimY, z - 0.14, x0, dimY, z + 0.14);
      dimSegVerts.push(x1, dimY, z - 0.14, x1, dimY, z + 0.14);
      // 45° architectural tick slashes
      dimSegVerts.push(x0 - 0.10, dimY, z - 0.10, x0 + 0.10, dimY, z + 0.10);
      dimSegVerts.push(x1 - 0.10, dimY, z - 0.10, x1 + 0.10, dimY, z + 0.10);
      dimExtVerts.push(x0, dimY, refZ, x0, dimY, z);
      dimExtVerts.push(x1, dimY, refZ, x1, dimY, z);
      addDimLabel(label, (x0 + x1) / 2, z, false, primary, primary ? 1.95 : 1.48);
    };

    const addDimV = (z0: number, z1: number, x: number, refX: number, label: string, primary = false) => {
      dimSegVerts.push(x, dimY, z0, x, dimY, z1);
      dimSegVerts.push(x - 0.14, dimY, z0, x + 0.14, dimY, z0);
      dimSegVerts.push(x - 0.14, dimY, z1, x + 0.14, dimY, z1);
      dimSegVerts.push(x - 0.10, dimY, z0 - 0.10, x + 0.10, dimY, z0 + 0.10);
      dimSegVerts.push(x - 0.10, dimY, z1 - 0.10, x + 0.10, dimY, z1 + 0.10);
      dimExtVerts.push(refX, dimY, z0, x, dimY, z0);
      dimExtVerts.push(refX, dimY, z1, x, dimY, z1);
      addDimLabel(label, x, (z0 + z1) / 2, true, primary, primary ? 2.05 : 1.52);
    };

    // Overall exterior house footprint dimensions (North & West)
    addDimH(0, W, -1.35, -0.04, '7,20 m', true);
    addDimH(0.40, 3.33, -0.68, 0.0, '2,93 m', false);
    addDimH(3.43, 6.80, -0.68, 0.0, '3,37 m', false);

    addDimV(0, L, -1.55, -0.04, '11,73 m', true);
    addDimV(0.40, 4.72, -0.82, 0.0, '4,32 m', false);
    addDimV(4.82, L - 0.40, -0.82, 0.0, '6,51 m', false);

    // Terrace overall dimensions (South & East)
    addDimH(0, W, L + PL + C.terrace.depth + 0.65, L + PL + C.terrace.depth, '7,20 m', false);
    addDimV(L + PL, L + PL + C.terrace.depth, -0.82, 0, '4,00 m', false);
    addDimH(W + PL, W + PL + C.terrace.sideDepth, L + PL + C.terrace.sideDepth + 0.65, L + PL + C.terrace.sideDepth, '1,50 m', false);

    const dimMainGeo = new THREE.BufferGeometry();
    dimMainGeo.setAttribute('position', new THREE.Float32BufferAttribute(dimSegVerts, 3));
    const dimMainMat = new THREE.LineBasicMaterial({ color: 0x26211a, depthTest: false, depthWrite: false });
    const dimMainLines = new THREE.LineSegments(dimMainGeo, dimMainMat);
    dimMainLines.renderOrder = 42;
    planDimsGroup.add(dimMainLines);
    planDimDisposables.push({ geo: dimMainGeo, mat: dimMainMat });

    const dimExtGeo = new THREE.BufferGeometry();
    dimExtGeo.setAttribute('position', new THREE.Float32BufferAttribute(dimExtVerts, 3));
    const dimExtMat = new THREE.LineBasicMaterial({
      color: 0x7a6d59,
      transparent: true,
      opacity: 0.65,
      depthTest: false,
      depthWrite: false,
    });
    const dimExtLines = new THREE.LineSegments(dimExtGeo, dimExtMat);
    dimExtLines.renderOrder = 41;
    planDimsGroup.add(dimExtLines);
    planDimDisposables.push({ geo: dimExtGeo, mat: dimExtMat });

    scene.add(planDimsGroup);

    // State
    let disposed = false;
    let rafId: number | null = null;
    let syncTimer: number | null = null;
    const gl = renderer.getContext() as WebGL2RenderingContext;

    const layerVis: Record<string, boolean> = {};
    for (const id of ALL_LAYERS) layerVis[id] = true;
    let xrayOn = false;
    let labelsOn = true;
    let currentPreset = 'finisata';
    let saved3D: { pos: THREE.Vector3; target: THREE.Vector3; preset: string; layerVis: Record<string, boolean> } | null = null;

    const sunState = {
      day: 111,
      hour: 15,
      anim: 'none' as 'none' | 'day' | 'year',
      domeVisible: false,
      lastEnergyDay: -1,
      dayE: { e: 0, e0: 0, sunH: 0 },
      energyTimer: null as number | null,
    };

    const buildState: BuildState = {
      active: false,
      playing: false,
      step: 0,
      prog: 1,
      speed: 1,
      autoRotate: false,
    };

    const walkState = {
      active: false,
      x: W / 2,
      z: L / 2,
      y: F + EYE,
      yaw: 0,
      pitch: -0.05,
      keys: {} as Record<string, boolean>,
      virtual: { moveX: 0, moveZ: 0, turnYaw: 0, turnPitch: 0, sprint: false },
      drag: null as { x: number; y: number } | null,
      saved: null as { p: THREE.Vector3; t: THREE.Vector3; fov: number } | null,
    };

    const camAnim = {
      active: false,
      goalPos: new THREE.Vector3(),
      goalTarget: new THREE.Vector3(),
    };

    const navKeys: Record<string, boolean> = {};
    let navShift = false;
    let explodeTarget = 0;
    let explodeCurrent = 0;

    // Schedule & coalesce renders cleanly (with fenceSync pacing for SwiftShader)
    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      if (!isSoftwareGl || typeof gl.fenceSync !== 'function') {
        cb();
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        cb();
        return;
      }
      gl.flush();
      const started = performance.now();
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const status = gl.clientWaitSync(sync, 0, 0);
        if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED || status === gl.WAIT_FAILED || performance.now() - started > 80) {
          gl.deleteSync(sync);
          cb();
        } else {
          syncTimer = window.setTimeout(poll, 4);
        }
      };
      syncTimer = window.setTimeout(poll, 0);
    };

    let lastTimeMs = performance.now();
    const fwdVec = new THREE.Vector3();
    const sideVec = new THREE.Vector3();
    const mvVec = new THREE.Vector3();

    function applyWalkCam() {
      const cp = Math.cos(walkState.pitch);
      const d = new THREE.Vector3(Math.sin(walkState.yaw) * cp, Math.sin(walkState.pitch), Math.cos(walkState.yaw) * cp);
      camera.position.set(walkState.x, walkState.y, walkState.z);
      controls.target.copy(camera.position).addScaledVector(d, 1.5);
      camera.lookAt(controls.target);
    }

    function blocked(x: number, z: number) {
      if (x < SITE.x0 + 0.3 || x > SITE.x1 - 0.3 || z < SITE.z0 + 0.3 || z > SITE.z1 - 0.3) return true;
      return data.OBST.some((o) =>
        o.r !== undefined && o.cx !== undefined && o.cz !== undefined
          ? Math.hypot(x - o.cx, z - o.cz) < o.r + RAD_P
          : o.x0 !== undefined &&
            o.x1 !== undefined &&
            o.z0 !== undefined &&
            o.z1 !== undefined &&
            x > o.x0 - RAD_P &&
            x < o.x1 + RAD_P &&
            z > o.z0 - RAD_P &&
            z < o.z1 + RAD_P,
      );
    }

    function stepWalk(dx: number, dz: number) {
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
      for (let i = 0; i < n; i++) {
        if (!blocked(walkState.x + dx / n, walkState.z)) walkState.x += dx / n;
        if (!blocked(walkState.x, walkState.z + dz / n)) walkState.z += dz / n;
      }
    }

    function emitWalk() {
      const room = roomAt(walkState.x, walkState.z);
      document.body.dataset.walkRoom = room;
      cbRef.current.onWalkUpdate({
        active: walkState.active,
        x: walkState.x,
        z: walkState.z,
        yaw: walkState.yaw,
        pitch: walkState.pitch,
        room,
        fov: camera.fov,
        aspect: camera.aspect,
      });
    }

    function applySun(day: number, hour: number, fullEnergy = true) {
      sunState.day = day;
      sunState.hour = hour;
      const n = Math.max(1, Math.min(365, Math.round(day)));
      const s = sunPos(n, hour);
      const sunVec = new THREE.Vector3(s.vx, s.vy, s.vz);

      sunLight.position.copy(SUNT).addScaledVector(sunVec, 70);
      sunLight.target.position.copy(SUNT);
      sunLight.target.updateMatrixWorld();

      skyU['sunPosition'].value.copy(sunVec);
      const up = Math.max(0, Math.sin(s.alt));
      const warmMix = 1 - Math.min(1, up * 3.0);

      // Sun light color warms naturally near horizon
      sunLight.color.setRGB(1.0, 0.94 - warmMix * 0.24, 0.86 - warmMix * 0.42);
      sunLight.intensity = s.alt > 0 ? 0.65 + 2.05 * Math.min(1, up * 2.1) : 0;
      hemi.intensity = 0.42 + 0.72 * Math.min(1, up * 2.0);
      scene.environmentIntensity = 0.30 + 0.35 * Math.min(1, up * 2.0);

      // Atmospheric fog matches horizon hue
      const fogColor = new THREE.Color().setHSL(0.57 - warmMix * 0.45, 0.38 + warmMix * 0.15, 0.22 + 0.60 * Math.min(1, up * 2.2));
      sceneFog.color.copy(fogColor);
      scene.background = fogColor;

      // Warm interior & stove ember glow at golden hour / dusk
      const duskFactor = Math.max(0, Math.min(1, (0.28 - s.alt) / 0.32));
      for (const pl of data.warmLights) {
        pl.intensity = 0.4 + duskFactor * 2.2;
      }
      (data.stoveEmber.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + duskFactor * 1.4;

      const vis = data.updateSunVisuals(n, hour);
      data.dome.visible = sunState.domeVisible && !walkState.active;

      const [m, d] = fromDOY(n);
      const hd = halfDay(n);
      const noon = sunPos(n, 12);
      const sunriseAz = sunPos(n, 12 - hd + 0.02).az;

      if (fullEnergy || sunState.lastEnergyDay !== n) {
        if (sunState.energyTimer) window.clearTimeout(sunState.energyTimer);
        if (fullEnergy) {
          sunState.energyTimer = window.setTimeout(() => {
            if (disposed) return;
            sunState.dayE = data.dayEnergy(n);
            sunState.lastEnergyDay = n;
            applySun(sunState.day, sunState.hour, false);
          }, 80);
        }
      }

      const telemetry: SunTelemetry = {
        day: n,
        hour,
        dateLabel: `${d} ${LUNI[m - 1]} – ${MONTH_SEASONS[m - 1]}`,
        solarTime: hm(hour),
        localTime: hm(toLocal(n, hour)),
        dst: isDST(n),
        altDeg: Math.round(s.alt / RAD),
        azDeg: Math.round(s.az / RAD),
        compass: COMPASS[Math.round(s.az / RAD / 45) % 8],
        sunrise: hm(toLocal(n, 12 - hd)),
        sunset: hm(toLocal(n, 12 + hd)),
        dayLen: hm(2 * hd),
        noonAltDeg: Math.round(noon.alt / RAD),
        sunriseAzDeg: Math.round(sunriseAz / RAD),
        litPanels: vis.lit,
        totalPanels: vis.totalPv,
        incidenceDeg: vis.ci > 0 ? Math.round(Math.acos(Math.min(1, vis.ci)) / RAD) : 90,
        kwNow: s.alt > 0 && vis.ci > 0 ? (clearSky(s.alt) * vis.ci * vis.lit) / vis.totalPv * (data.pvKw / 1000) * 0.85 : 0,
        dayKwh: sunState.dayE.e,
        shadeLossKwh: Math.max(0, sunState.dayE.e0 - sunState.dayE.e),
        sunHours: sunState.dayE.sunH,
      };
      cbRef.current.onSunUpdate(telemetry);
    }

    function setXrayInternal(on: boolean) {
      xrayOn = on;
      for (const m of data.XRAY) {
        const std = m as THREE.MeshStandardMaterial;
        std.transparent = on || m === data.XRAY[0] ? on : std.transparent;
        std.opacity = on ? 0.28 : 1;
        std.depthWrite = !on;
        std.needsUpdate = true;
      }
      cbRef.current.onLayersSync({ ...layerVis }, xrayOn);
    }

    function updateOrthoFrustum(w: number, h: number) {
      const aspect = Math.max(w, 1) / Math.max(h, 1);
      orthoCam.left = -ORTHO_HALF_H * aspect;
      orthoCam.right = ORTHO_HALF_H * aspect;
      orthoCam.top = ORTHO_HALF_H;
      orthoCam.bottom = -ORTHO_HALF_H;
      orthoCam.updateProjectionMatrix();
    }

    function centerOrthoCam() {
      const cx = W / 2 + 0.25;
      const cz = 7.45;
      orthoCam.position.set(cx, 32, cz + 0.001);
      controls.target.set(cx, 0, cz);
      orthoCam.zoom = 1;
      updateOrthoFrustum(renderer.domElement.clientWidth || width, renderer.domElement.clientHeight || height);
      controls.update();
    }

    function exitFloorplan2DInternal(restorePoseAndLayers: boolean) {
      if (!floorplan2D) return;
      floorplan2D = false;
      activeCam = camera;
      renderer.clippingPlanes = [];
      scene.fog = sceneFog;
      planLabelsGroup.visible = false;
      planDimsGroup.visible = false;
      controls.object = camera;
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.screenSpacePanning = false;
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
      controls.minZoom = 0;
      controls.maxZoom = Infinity;

      if (restorePoseAndLayers && saved3D) {
        camera.position.copy(saved3D.pos);
        controls.target.copy(saved3D.target);
        currentPreset = saved3D.preset;
        document.body.dataset.preset = currentPreset;
        for (const id of ALL_LAYERS) {
          const on = Boolean(saved3D.layerVis[id]);
          data.G[id].visible = on;
          layerVis[id] = on;
        }
        cbRef.current.onLayersSync({ ...layerVis }, xrayOn);
      }
      saved3D = null;
      controls.update();
      document.body.dataset.viewMode = '3d';
      cbRef.current.onFloorplan2DChange?.(false);
    }

    function setFloorplan2DInternal(enabled: boolean) {
      if (enabled === floorplan2D) return;
      if (enabled) {
        if (walkState.active) walkExitInternal(false);
        if (buildState.active) endBuildInternal();
        saved3D = {
          pos: camera.position.clone(),
          target: controls.target.clone(),
          preset: currentPreset,
          layerVis: { ...layerVis },
        };
        floorplan2D = true;
        activeCam = orthoCam;
        camAnim.active = false;

        // Show architectural floorplan layers (straw bales, timber framing, partitions, doors/windows, flooring, furniture, terraces)
        const planIds = PRESETS.plan;
        for (const id of ALL_LAYERS) {
          const on = planIds.includes(id);
          data.G[id].visible = on;
          layerVis[id] = on;
        }
        setXrayInternal(false);
        cbRef.current.onLayersSync({ ...layerVis }, xrayOn);

        // Slice horizontally at +1.55 m above finished floor to expose windows, doors, and bathroom/tech room below loft
        renderer.clippingPlanes = [planCutPlane];
        scene.fog = null;
        planLabelsGroup.visible = true;
        planDimsGroup.visible = true;

        controls.object = orthoCam;
        controls.enableRotate = false;
        controls.enablePan = true;
        controls.screenSpacePanning = true;
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
        controls.touches = {
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        };
        controls.minZoom = 0.45;
        controls.maxZoom = 5.0;
        centerOrthoCam();

        document.body.dataset.viewMode = '2d';
        cbRef.current.onFloorplan2DChange?.(true);
        requestRender();
      } else {
        exitFloorplan2DInternal(true);
        requestRender();
      }
    }

    function setPresetInternal(presetId: string, applyPresetView = true) {
      currentPreset = presetId;
      const activeIds = PRESETS[presetId] || PRESETS.finisata;
      for (const id of ALL_LAYERS) {
        const on = activeIds.includes(id);
        data.G[id].visible = on;
        layerVis[id] = on;
      }
      document.body.dataset.preset = presetId;
      if (applyPresetView && !floorplan2D) {
        if (presetId === 'plan') setViewInternal('sus');
        if (presetId === 'instalatii') setViewInternal('inst');
      }
      setXrayInternal(presetId === 'instalatii');
      cbRef.current.onLayersSync({ ...layerVis }, xrayOn);
      requestRender();
    }

    function setViewInternal(viewId: string) {
      if (walkState.active) walkExitInternal(false);
      if (floorplan2D) exitFloorplan2DInternal(false);
      const v = VIEWS[viewId] || VIEWS.persp;
      if (isSoftwareGl) {
        camera.position.set(...v[0]);
        controls.target.set(...v[1]);
        controls.update();
        camAnim.active = false;
      } else {
        camAnim.goalPos.set(...v[0]);
        camAnim.goalTarget.set(...v[1]);
        camAnim.active = true;
      }
      requestRender();
    }

    function applyBuildVisuals() {
      const S = data.STEPS;
      const done = new Set<string>();
      for (let i = 0; i < buildState.step; i++) S[i].layers.forEach((l) => done.add(l));
      const cur = S[buildState.step];
      const hide = new Set(cur.hide || []);
      for (const id of ALL_LAYERS) {
        const on = (id === 'teren' || id === 'vecini' || done.has(id) || cur.layers.includes(id)) && !hide.has(id);
        data.G[id].visible = on;
        layerVis[id] = on;
      }
      for (let i = 0; i < buildState.step; i++) {
        for (const it of S[i].items) it.m.visible = !hide.has(S[i].layers[0]);
      }
      const n = cur.items.length;
      const k = Math.floor(buildState.prog * n);
      cur.items.forEach((it, i) => {
        it.m.visible = i < k;
      });
      setXrayInternal(Boolean(cur.xray));
      cbRef.current.onLayersSync({ ...layerVis }, xrayOn);
      cbRef.current.onBuildUpdate({ ...buildState });
      requestRender();
    }

    function goBuildStep(stepIdx: number, prog = 1, snap = false) {
      if (floorplan2D) exitFloorplan2DInternal(false);
      buildState.active = true;
      buildState.step = Math.max(0, Math.min(data.STEPS.length - 1, stepIdx));
      buildState.prog = prog;
      const v = data.STEPS[buildState.step].view;
      if (snap || isSoftwareGl) {
        camera.position.set(...v[0]);
        controls.target.set(...v[1]);
        controls.update();
        camAnim.active = false;
      } else {
        camAnim.goalPos.set(...v[0]);
        camAnim.goalTarget.set(...v[1]);
        camAnim.active = true;
      }
      controls.autoRotate = !isSoftwareGl && buildState.playing && buildState.autoRotate;
      controls.autoRotateSpeed = 0.7;
      applyBuildVisuals();
    }

    function endBuildInternal() {
      buildState.active = false;
      buildState.playing = false;
      controls.autoRotate = false;
      for (const st of data.STEPS) for (const it of st.items) it.m.visible = true;
      setPresetInternal('finisata');
      cbRef.current.onBuildUpdate({ ...buildState });
      requestRender();
    }

    function walkToInternal(spotKey: string) {
      const spot = WALK_AT[spotKey] || WALK_AT.intrare;
      if (floorplan2D) exitFloorplan2DInternal(false);
      if (!walkState.active) {
        if (buildState.active) endBuildInternal();
        walkState.saved = { p: camera.position.clone(), t: controls.target.clone(), fov: camera.fov };
        walkState.active = true;
        controls.enabled = false;
        camAnim.active = false;
        camera.fov = 68;
        camera.updateProjectionMatrix();
        if (!data.G.tencuiala.visible || !data.G.mobilier.visible || !data.G.invelitoare.visible) {
          setPresetInternal('finisata');
        }
        document.body.classList.add('walking');
      }
      data.dome.visible = false;
      walkState.x = spot[0];
      walkState.z = spot[1];
      walkState.y = floorAt(spot[0], spot[1]) + EYE;
      walkState.yaw = Math.atan2(spot[2] - spot[0], spot[3] - spot[1]);
      walkState.pitch = -0.05;
      applyWalkCam();
      emitWalk();
      requestRender();
    }

    function walkExitInternal(restore = true) {
      if (!walkState.active) return;
      walkState.active = false;
      controls.enabled = true;
      camera.fov = walkState.saved ? walkState.saved.fov : 42;
      camera.updateProjectionMatrix();
      document.body.classList.remove('walking');
      walkState.keys = {};
      walkState.virtual = { moveX: 0, moveZ: 0, turnYaw: 0, turnPitch: 0, sprint: false };
      if (restore && walkState.saved) {
        camera.position.copy(walkState.saved.p);
        controls.target.copy(walkState.saved.t);
      }
      controls.update();
      data.dome.visible = sunState.domeVisible;
      emitWalk();
      requestRender();
    }

    const requestRender = () => {
      if (disposed || rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (disposed) return;

        const nowMs = performance.now();
        const dt = Math.min((nowMs - lastTimeMs) / 1000, 0.1);
        lastTimeMs = nowMs;
        let needMore = false;

        // Smooth camera transitions
        if (camAnim.active && !walkState.active) {
          const factor = 1 - Math.exp(-8 * dt);
          camera.position.lerp(camAnim.goalPos, factor);
          controls.target.lerp(camAnim.goalTarget, factor);
          if (camera.position.distanceTo(camAnim.goalPos) < 0.03 && controls.target.distanceTo(camAnim.goalTarget) < 0.03) {
            camera.position.copy(camAnim.goalPos);
            controls.target.copy(camAnim.goalTarget);
            camAnim.active = false;
          } else {
            needMore = true;
          }
        }

        // Smooth explode interpolation
        if (Math.abs(explodeCurrent - explodeTarget) > 0.002) {
          explodeCurrent = THREE.MathUtils.damp(explodeCurrent, explodeTarget, 10, dt);
          const e = (explodeCurrent / 100) * 1.6;
          for (const id of ALL_LAYERS) data.G[id].position.y = data.TIER[id] * e;
          needMore = true;
        }

        // Walkthrough tick (keyboard + virtual joystick / WASD overlay)
        if (walkState.active) {
          const k = walkState.keys;
          const v = walkState.virtual;
          const run = k.ShiftLeft || k.ShiftRight || v.sprint ? 2.6 : 1.3;
          const fw = Math.max(-1, Math.min(1, (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + v.moveZ));
          const st = Math.max(-1, Math.min(1, (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + v.moveX));
          const rt = Math.max(-1, Math.min(1, (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0) + v.turnYaw));
          const pt = Math.max(-1, Math.min(1, (k.PageUp ? 1 : 0) - (k.PageDown ? 1 : 0) + v.turnPitch));
          let moved = false;
          if (Math.abs(rt) > 0.005) {
            walkState.yaw -= rt * 1.5 * dt;
            moved = true;
          }
          if (Math.abs(pt) > 0.005) {
            walkState.pitch = Math.max(-1.3, Math.min(1.3, walkState.pitch + pt * 1.0 * dt));
            moved = true;
          }
          if (Math.abs(fw) > 0.005 || Math.abs(st) > 0.005) {
            const sp = run * dt;
            const sx = Math.sin(walkState.yaw);
            const sz = Math.cos(walkState.yaw);
            stepWalk((fw * sx - st * sz) * sp, (fw * sz + st * sx) * sp);
            moved = true;
          }
          const yT = floorAt(walkState.x, walkState.z) + EYE;
          if (Math.abs(yT - walkState.y) > 0.002) {
            walkState.y += (yT - walkState.y) * Math.min(1, dt * 8);
            moved = true;
          }
          if (moved) {
            applyWalkCam();
            emitWalk();
            needMore = true;
          }
        } else if (NAV_KEYS.some((key) => navKeys[key])) {
          if (floorplan2D) {
            const sp = 4.0 * dt;
            const dx = ((navKeys.ArrowRight ? 1 : 0) - (navKeys.ArrowLeft ? 1 : 0)) * sp;
            const dz = ((navKeys.ArrowDown ? 1 : 0) - (navKeys.ArrowUp ? 1 : 0)) * sp;
            orthoCam.position.x += dx;
            orthoCam.position.z += dz;
            controls.target.x += dx;
            controls.target.z += dz;
            needMore = true;
          } else {
            fwdVec.subVectors(controls.target, camera.position);
            fwdVec.y = 0;
            if (fwdVec.lengthSq() < 1e-6) fwdVec.set(0, 0, -1);
            fwdVec.normalize();
            sideVec.set(-fwdVec.z, 0, fwdVec.x);
            const sp = 3.0 * dt;
            mvVec.set(0, 0, 0);
            if (navKeys.ArrowUp) mvVec.addScaledVector(fwdVec, sp);
            if (navKeys.ArrowDown) mvVec.addScaledVector(fwdVec, -sp);
            if (navKeys.PageUp) mvVec.y += sp;
            if (navKeys.PageDown && camera.position.y > 0.4) mvVec.y -= sp;
            const lr = (navKeys.ArrowRight ? 1 : 0) - (navKeys.ArrowLeft ? 1 : 0);
            if (lr && navShift) mvVec.addScaledVector(sideVec, lr * sp);
            camera.position.add(mvVec);
            controls.target.add(mvVec);
            if (lr && !navShift) {
              const a = -lr * 1.2 * dt;
              const o = controls.target.clone().sub(camera.position);
              const c = Math.cos(a);
              const s = Math.sin(a);
              controls.target.set(camera.position.x + o.x * c + o.z * s, controls.target.y, camera.position.z - o.x * s + o.z * c);
            }
            needMore = true;
          }
        }

        // Build playback tick
        if (buildState.active && buildState.playing) {
          const cur = data.STEPS[buildState.step];
          buildState.prog += (dt * buildState.speed) / cur.dur;
          if (buildState.prog >= 1) {
            if (buildState.step < data.STEPS.length - 1) {
              goBuildStep(buildState.step + 1, 0);
            } else {
              buildState.prog = 1;
              buildState.playing = false;
              controls.autoRotate = false;
              applyBuildVisuals();
            }
          } else {
            applyBuildVisuals();
          }
          if (buildState.playing) needMore = true;
        }

        // Sun animation tick
        if (sunState.anim === 'day') {
          const n = Math.round(sunState.day);
          const hd = halfDay(n);
          let h = sunState.hour + dt * 1.2;
          if (h > 12 + hd + 0.4) h = 12 - hd - 0.4;
          applySun(sunState.day, h, false);
          needMore = true;
        } else if (sunState.anim === 'year') {
          let n = sunState.day + dt * 30;
          if (n > 365) n -= 365;
          applySun(n, sunState.hour, false);
          needMore = true;
        }

        if (!walkState.active) {
          const movedByControls = controls.update();
          if (movedByControls || controls.autoRotate) needMore = true;
        }

        renderer.render(scene, activeCam);

        if (needMore && !disposed) {
          afterDraw(() => {
            if (!disposed) requestRender();
          });
        }
      });
    };

    controls.addEventListener('change', requestRender);

    // Pointer/wheel listeners for walkthrough
    const cv = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      if (!walkState.active) return;
      walkState.drag = { x: e.clientX, y: e.clientY };
      cv.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!walkState.active || !walkState.drag) return;
      walkState.yaw -= (e.clientX - walkState.drag.x) * 0.0045;
      walkState.pitch = Math.max(-1.3, Math.min(1.3, walkState.pitch - (e.clientY - walkState.drag.y) * 0.0045));
      walkState.drag = { x: e.clientX, y: e.clientY };
      applyWalkCam();
      emitWalk();
      requestRender();
    };
    const onPointerUp = () => {
      walkState.drag = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!walkState.active) return;
      e.preventDefault();
      const d = -Math.sign(e.deltaY) * 0.35;
      stepWalk(Math.sin(walkState.yaw) * d, Math.cos(walkState.yaw) * d);
      walkState.y = floorAt(walkState.x, walkState.z) + EYE;
      applyWalkCam();
      emitWalk();
      requestRender();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
      if (walkState.active) {
        if (e.code === 'Escape') {
          walkExitInternal(true);
          return;
        }
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', ...NAV_KEYS].includes(e.code)) {
          walkState.keys[e.code] = true;
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur?.();
          requestRender();
        }
      } else if (NAV_KEYS.includes(e.key)) {
        camAnim.active = false;
        navKeys[e.key] = true;
        navShift = e.shiftKey;
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        requestRender();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (walkState.active) {
        walkState.keys[e.code] = false;
      }
      if (NAV_KEYS.includes(e.key)) {
        navKeys[e.key] = false;
        navShift = e.shiftKey;
      }
    };
    const onBlur = () => {
      walkState.keys = {};
      for (const k of Object.keys(navKeys)) navKeys[k] = false;
    };

    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointermove', onPointerMove);
    cv.addEventListener('pointerup', onPointerUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const nw = Math.max(container.clientWidth, 1);
      const nh = Math.max(container.clientHeight, 1);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      updateOrthoFrustum(nw, nh);
      renderer.setSize(nw, nh);
      if (walkState.active) emitWalk();
      requestRender();
    });
    ro.observe(container);

    // Expose imperative handle
    ctrlRef.current = {
      setPreset: (id) => {
        if (buildState.active) endBuildInternal();
        setPresetInternal(id);
      },
      setView: (id) => setViewInternal(id),
      setJointView: (jointId) => {
        if (floorplan2D) exitFloorplan2DInternal(false);
        if (buildState.active) endBuildInternal();
        setPresetInternal('imbinari');
        if (jointId === 'pilon') setXrayInternal(true);
        const j = JVIEWS[jointId] || JVIEWS.coama;
        if (isSoftwareGl) {
          camera.position.set(...j[0]);
          controls.target.set(...j[1]);
          controls.update();
          camAnim.active = false;
        } else {
          camAnim.goalPos.set(...j[0]);
          camAnim.goalTarget.set(...j[1]);
          camAnim.active = true;
        }
        requestRender();
      },
      setLayerVisible: (id, vis) => {
        data.G[id].visible = vis;
        layerVis[id] = vis;
        cbRef.current.onLayersSync({ ...layerVis }, xrayOn);
        requestRender();
      },
      setExplode: (pct) => {
        explodeTarget = pct;
        if (isSoftwareGl) {
          explodeCurrent = pct;
          const e = (pct / 100) * 1.6;
          for (const id of ALL_LAYERS) data.G[id].position.y = data.TIER[id] * e;
        }
        requestRender();
      },
      setSection: (pct) => {
        clipPlane.constant = pct >= 100 ? 1000 : -1 + ((L + 2) * pct) / 100;
        requestRender();
      },
      setXray: (on) => {
        setXrayInternal(on);
        requestRender();
      },
      setLabelsVisible: (on) => {
        labelsOn = on;
        for (const sp of data.LABELS) sp.visible = labelsOn;
        requestRender();
      },
      setSun: (day, hour, fullEnergy = true) => {
        applySun(day, hour, fullEnergy);
        requestRender();
      },
      setSunDomeVisible: (on) => {
        sunState.domeVisible = on;
        data.dome.visible = on && !walkState.active;
        requestRender();
      },
      setSunAnim: (mode) => {
        sunState.anim = mode;
        if (mode === 'none') applySun(sunState.day, sunState.hour, true);
        requestRender();
      },
      buildAction: (action, arg) => {
        if (action === 'end') {
          endBuildInternal();
          return;
        }
        if (action === 'play') {
          if (!buildState.active || (buildState.step === data.STEPS.length - 1 && buildState.prog >= 1)) {
            buildState.playing = true;
            goBuildStep(0, 0);
          } else {
            buildState.playing = !buildState.playing;
            controls.autoRotate = !isSoftwareGl && buildState.playing && buildState.autoRotate;
            applyBuildVisuals();
          }
          requestRender();
          return;
        }
        if (action === 'goto' && typeof arg === 'number') {
          buildState.playing = false;
          controls.autoRotate = false;
          goBuildStep(arg, 1);
          return;
        }
        if (action === 'prog' && typeof arg === 'number') {
          buildState.playing = false;
          buildState.prog = arg;
          applyBuildVisuals();
          return;
        }
        buildState.playing = false;
        controls.autoRotate = false;
        const nextStep = buildState.active ? buildState.step + (action === 'next' ? 1 : -1) : 0;
        goBuildStep(nextStep, 1);
      },
      setBuildOptions: (opts) => {
        if (opts.speed !== undefined) buildState.speed = opts.speed;
        if (opts.autoRotate !== undefined) {
          buildState.autoRotate = opts.autoRotate;
          controls.autoRotate = !isSoftwareGl && buildState.playing && buildState.autoRotate;
        }
        cbRef.current.onBuildUpdate({ ...buildState });
        requestRender();
      },
      walkTo: (spotKey) => walkToInternal(spotKey),
      walkTeleport: (x, z) => {
        if (blocked(x, z)) return false;
        walkState.x = x;
        walkState.z = z;
        walkState.y = floorAt(x, z) + EYE;
        applyWalkCam();
        emitWalk();
        requestRender();
        return true;
      },
      walkExit: (restore = true) => walkExitInternal(restore),
      setWalkInput: (inp) => {
        Object.assign(walkState.virtual, inp);
        if (walkState.active) {
          if (rafId === null) lastTimeMs = performance.now() - 16;
          requestRender();
        }
      },
      walkResetPitch: () => {
        if (!walkState.active) return;
        walkState.pitch = -0.05;
        applyWalkCam();
        emitWalk();
        requestRender();
      },
      setFloorplan2D: (on) => setFloorplan2DInternal(on),
      resetFloorplan2DView: () => {
        if (!floorplan2D) return;
        centerOrthoCam();
        requestRender();
      },
      zoomFloorplan2D: (factor) => {
        if (!floorplan2D) return;
        orthoCam.zoom = THREE.MathUtils.clamp(orthoCam.zoom * factor, 0.45, 5.0);
        orthoCam.updateProjectionMatrix();
        controls.update();
        requestRender();
      },
      focusFloorplan2D: (target) => {
        if (!floorplan2D) return;
        if (target === 'house') {
          centerOrthoCam();
        } else if (target === 'tech') {
          const cx = 5.65;
          const cz = 6.50;
          orthoCam.position.set(cx, 32, cz + 0.001);
          controls.target.set(cx, 0, cz);
          orthoCam.zoom = 2.6;
          orthoCam.updateProjectionMatrix();
          controls.update();
        } else if (target === 'bedrooms') {
          const cx = W / 2;
          const cz = 2.45;
          orthoCam.position.set(cx, 32, cz + 0.001);
          controls.target.set(cx, 0, cz);
          orthoCam.zoom = 1.95;
          orthoCam.updateProjectionMatrix();
          controls.update();
        }
        requestRender();
      },
      setFloorplan2DPlaster: (show) => {
        if (!floorplan2D) return;
        data.G.tencuiala.visible = show;
        layerVis.tencuiala = show;
        cbRef.current.onLayersSync({ ...layerVis }, xrayOn);
        requestRender();
      },
      getData: () => data,
    };

    // Initial scene setup: default "finisata" + "persp"
    camera.position.set(...VIEWS.persp[0]);
    controls.target.set(...VIEWS.persp[1]);
    controls.update();
    setPresetInternal('finisata');
    applySun(111, 15, true);
    cbRef.current.onSceneReady(data);
    cbRef.current.onBuildUpdate({ ...buildState });
    emitWalk();
    requestRender();

    // Support deep-link URL hash parameters (#preset=...&view=...&sun=m,h&walk=...)
    const q = new URLSearchParams(window.location.hash.slice(1));
    const qPreset = q.get('preset');
    if (qPreset && PRESETS[qPreset]) setPresetInternal(qPreset);
    const qView = q.get('view');
    if (qView && VIEWS[qView]) {
      camera.position.set(...VIEWS[qView][0]);
      controls.target.set(...VIEWS[qView][1]);
      controls.update();
    }
    const qJoint = q.get('joint');
    if (qJoint && JVIEWS[qJoint]) {
      ctrlRef.current.setJointView(qJoint);
    }
    const qWalk = q.get('walk');
    if (qWalk && WALK_AT[qWalk]) {
      walkToInternal(qWalk);
    }

    return () => {
      disposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (syncTimer !== null) clearTimeout(syncTimer);
      if (sunState.energyTimer !== null) clearTimeout(sunState.energyTimer);
      ro.disconnect();
      cv.removeEventListener('pointerdown', onPointerDown);
      cv.removeEventListener('pointermove', onPointerMove);
      cv.removeEventListener('pointerup', onPointerUp);
      cv.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      controls.dispose();
      data.dispose();
      for (const item of planLabelDisposables) {
        item.geo.dispose();
        item.mat.dispose();
        item.tex.dispose();
      }
      for (const item of planDimDisposables) {
        item.geo.dispose();
        item.mat.dispose();
        item.tex?.dispose();
      }
      envRT.dispose();
      pmrem.dispose();
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full relative" data-testid="viewport-3d" />;
});
