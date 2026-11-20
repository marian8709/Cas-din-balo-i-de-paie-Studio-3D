import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Footprints,
  Hammer,
  Layers,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sun,
  X,
} from 'lucide-react';
import type { BuiltSceneData } from '../model/buildScene';
import {
  C,
  CEIL,
  F,
  IWALLS,
  L,
  LAYERS,
  PL,
  RAMP,
  RIDGE,
  ROOMS,
  W,
  getInteriorDoorSpecs,
  nf,
  roofY,
  wp,
  yApex,
  yRBb,
} from '../model/config';
import type { BuildState, SunTelemetry, ViewportHandle, WalkState } from './Viewport3D';
import { WalkNavOverlay } from './WalkNavOverlay';

export type DockTab = 'prezentare' | 'soare' | 'constructie' | 'plimbare' | 'straturi';

interface ControlDockProps {
  viewportRef: React.RefObject<ViewportHandle | null>;
  sceneData: BuiltSceneData | null;
  activeTab: DockTab;
  onTabChange: (tab: DockTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  activePreset: string;
  onPresetChange: (preset: string) => void;
  activeView: string;
  onViewChange: (view: string) => void;
  sunInfo: SunTelemetry | null;
  buildState: BuildState;
  walkState: WalkState;
  layerVis: Record<string, boolean>;
  xrayOn: boolean;
}

const PRESET_LIST: [string, string][] = [
  ['finisata', 'Casă finisată'],
  ['paie', 'Paie la vedere'],
  ['structura', 'Doar structura'],
  ['plan', 'Plan (fără acoperiș)'],
  ['instalatii', 'Instalații (apă, canal)'],
];

const VIEW_LIST: [string, string][] = [
  ['persp', 'Perspectivă'],
  ['sus', 'De sus'],
  ['nord', 'Nord'],
  ['sud', 'Sud'],
  ['est', 'Est'],
  ['vest', 'Vest'],
  ['interior', 'Interior'],
  ['teren', 'Tot terenul'],
  ['poarta', 'De la poartă'],
];

const JOINT_LIST: [string, string][] = [
  ['coama', 'Coamă: pană pe stâlp'],
  ['capriori', 'Căpriori la coamă'],
  ['streasina', 'Streașină'],
  ['colt', 'Colț'],
  ['baza', 'Bază perete + ancoră'],
  ['pilon', 'Pilon + grindă'],
];

const WALK_LIST: [string, string][] = [
  ['intrare', 'Intră pe ușa de sud'],
  ['living', 'Living'],
  ['bucatarie', 'Masă + bucătărie'],
  ['dorm1', 'Dormitor 1'],
  ['dorm2', 'Dormitor matrimonial'],
  ['baie', 'Baie'],
  ['tehnica', 'Cameră tehnică'],
  ['terasa', 'Terasa de sud'],
];

const MV = { x0: -0.6, z0: -2.2, s: 17.5 };
const toM = (x: number, z: number): [number, number] => [(x - MV.x0) * MV.s, (z - MV.z0) * MV.s];

export function ControlDock({
  viewportRef,
  sceneData,
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  activePreset,
  onPresetChange,
  activeView,
  onViewChange,
  sunInfo,
  buildState,
  walkState,
  layerVis,
  xrayOn,
}: ControlDockProps) {
  const [sunDay, setSunDay] = useState(111);
  const [sunHour, setSunHour] = useState(15);
  const [sunAnim, setSunAnim] = useState<'none' | 'day' | 'year'>('none');
  const [domeOn, setDomeOn] = useState(true);
  const [explodePct, setExplodePct] = useState(0);
  const [sectionPct, setSectionPct] = useState(100);
  const [labelsOn, setLabelsOn] = useState(true);
  const [walkMsg, setWalkMsg] = useState<string | null>(null);
  const [walkSpot, setWalkSpot] = useState<string>('living');
  const walkMapRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (sunInfo && sunAnim !== 'none') {
      setSunDay(sunInfo.day);
      setSunHour(sunInfo.hour);
    }
  }, [sunInfo, sunAnim]);

  // Draw interactive 2D minimap when walking
  useEffect(() => {
    if (!walkState.active || !sceneData) return;
    const mapC = walkMapRef.current;
    if (!mapC) return;
    const c = mapC.getContext('2d');
    if (!c) return;

    const s = MV.s;
    const TZ0 = L + PL + 0.015;
    const TZ1 = TZ0 + C.terrace.depth;
    const SA0 = W + PL + 0.015;
    const SA1 = SA0 + C.terrace.sideDepth;
    const SC0 = C.terrace.sideZ0;
    const SC1 = TZ0 + C.terrace.sideDepth + 0.1;

    c.clearRect(0, 0, mapC.width, mapC.height);
    c.fillStyle = '#8b9872';
    c.fillRect(0, 0, mapC.width, mapC.height);

    const R = (x0: number, z0: number, x1: number, z1: number, col: string) => {
      const [a, b] = toM(x0, z0);
      c.fillStyle = col;
      c.fillRect(a, b, (x1 - x0) * s, (z1 - z0) * s);
    };

    R(0, TZ0, W, TZ1, '#b78a5a');
    R(SA0, SC0, SA1, SC1, '#b78a5a');
    R(SA0, SC0 - RAMP.total, SA1, SC0, '#a07a50');
    R(0, 0, W, L, '#d9c39a');
    for (const r of ROOMS) {
      for (const [x0, x1, z0, z1] of r.r) R(x0, z0, x1, z1, r.fin === 'gresie' ? '#cfd8dc' : '#e3cfa4');
    }
    for (const n of sceneData.FURN) {
      if (n.r !== undefined && n.cx !== undefined && n.cz !== undefined) {
        const [a, b] = toM(n.cx, n.cz);
        c.fillStyle = '#9b8b78';
        c.beginPath();
        c.arc(a, b, n.r * s, 0, 7);
        c.fill();
      } else if (n.x0 !== undefined && n.z0 !== undefined && n.x1 !== undefined && n.z1 !== undefined) {
        R(n.x0, n.z0, n.x1, n.z1, '#a8957c');
      }
    }
    for (const o of sceneData.OBST) {
      if (o.wall && o.x0 !== undefined && o.z0 !== undefined && o.x1 !== undefined && o.z1 !== undefined) {
        R(o.x0, o.z0, o.x1, o.z1, '#5a4630');
      }
    }
    for (const iw of IWALLS) {
      const wl = { axis: iw.axis, c: iw.c, dir: 1 };
      for (const s of getInteriorDoorSpecs(iw)) {
        for (const pk of s.pockets) {
          const [ax, az] = wp(wl, pk.p0, 0.025);
          const [bx, bz] = wp(wl, pk.p1, 0.075);
          R(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), '#dfd5c3');
          const [lx0, lz0] = wp(wl, pk.leafU0, 0.032);
          const [lx1, lz1] = wp(wl, pk.leafU1, 0.068);
          R(Math.min(lx0, lx1), Math.min(lz0, lz1), Math.max(lx0, lx1), Math.max(lz0, lz1), '#b88652');
        }
      }
    }

    c.fillStyle = '#222';
    c.font = '9px Plus Jakarta Sans, sans-serif';
    c.textAlign = 'center';
    const short: Record<string, string> = {
      'Dormitor 1': 'Dormitor 1',
      'Dormitor matrimonial': 'Matrimonial',
      'Living + loc de masă + bucătărie': 'Living',
      Baie: 'Baie',
      'Cameră tehnică': 'Tehnică',
    };
    ROOMS.forEach((r) => {
      const [x0, x1, z0, z1] = r.r[0];
      const [a, b] = toM((x0 + x1) / 2, (z0 + z1) / 2 + (r.r.length > 1 ? 2.2 : 0));
      c.fillText(short[r.n] || r.n, a, b);
    });
    c.fillStyle = '#fff';
    c.fillText('N ↑', mapC.width - 14, 12);
    c.fillText('terasă', toM(W / 2, 0)[0], toM(0, TZ0 + 2)[1]);

    const [px, pz] = toM(walkState.x, walkState.z);
    const fx = Math.sin(walkState.yaw);
    const fz = Math.cos(walkState.yaw);
    const h = Math.atan(Math.tan(((walkState.fov / 2) * Math.PI) / 180) * walkState.aspect);
    c.fillStyle = 'rgba(217, 152, 42, 0.42)';
    c.beginPath();
    c.moveTo(px, pz);
    for (const a of [-h, h]) c.lineTo(px + 40 * Math.sin(walkState.yaw + a), pz + 40 * Math.cos(walkState.yaw + a));
    c.closePath();
    c.fill();
    c.fillStyle = '#c4311d';
    c.beginPath();
    c.arc(px, pz, 4.5, 0, 7);
    c.fill();
    c.strokeStyle = '#fff';
    c.lineWidth = 1.5;
    c.stroke();
    c.beginPath();
    c.moveTo(px, pz);
    c.lineTo(px + fx * 11, pz + fz * 11);
    c.stroke();
  }, [walkState, sceneData]);

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const mapC = walkMapRef.current;
    if (!mapC || !viewportRef.current) return;
    const r = mapC.getBoundingClientRect();
    const x = ((e.clientX - r.left) * mapC.width) / r.width / MV.s + MV.x0;
    const z = ((e.clientY - r.top) * mapC.height) / r.height / MV.s + MV.z0;
    const ok = viewportRef.current.walkTeleport(x, z);
    setWalkMsg(ok ? null : 'Acolo e perete / mobilă');
  };

  const curStep = sceneData && buildState.active ? sceneData.STEPS[buildState.step] : null;

  return (
    <>
      {/* Contextual Build Drawer (right side during construction playback) */}
      {buildState.active && curStep && sceneData && (
        <aside
          data-testid="build-drawer"
          className="fixed top-[72px] right-3 z-20 w-[356px] max-h-[calc(100vh-235px)] overflow-y-auto rounded-xl bg-[#FAF8F3]/95 border border-[#E2DAC7] shadow-[0_10px_30px_rgba(24,22,18,0.12)] p-4 text-[13px] text-[#2A2620]"
        >
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E7E0CE]">
            <span className="font-display font-bold text-[#9A6B1E] text-[13px] uppercase tracking-wider">
              Etapa {buildState.step + 1} / {sceneData.STEPS.length}
            </span>
            <button
              type="button"
              onClick={() => viewportRef.current?.buildAction('end')}
              className="px-2 py-1 rounded-md border border-[#D8CEB8] bg-white hover:bg-[#F1ECE0] text-[12px] font-medium text-[#3A352C] inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Închide
            </button>
          </div>

          <h3 className="font-display text-[16px] font-bold text-[#1E1C18] mt-2.5 mb-2">{curStep.t}</h3>

          <ol className="list-decimal pl-5 space-y-1.5 text-[12.5px] leading-relaxed text-[#3A352C]">
            {curStep.p.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ol>

          <div className="mt-3 pt-2.5 border-t border-[#EAE3D3] text-[12px] space-y-1.5">
            <p>
              <span className="font-semibold text-[#1E1C18]">Materiale:</span> {curStep.m}
            </p>
            <div className="rounded-lg bg-[#F5EBD6] border border-[#E5CFA0] px-2.5 py-2 text-[#5B3E0B]">
              <span className="font-semibold">Atenție:</span> {curStep.w}
            </div>
          </div>

          <ol className="mt-3 pt-2.5 border-t border-[#EAE3D3] list-decimal pl-5 space-y-0.5 text-[12px]">
            {sceneData.STEPS.map((st, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => viewportRef.current?.buildAction('goto', idx)}
                  className={`text-left w-full py-0.5 cursor-pointer transition-colors ${
                    idx === buildState.step
                      ? 'font-bold text-[#9A6B1E]'
                      : idx < buildState.step
                        ? 'text-[#3D372E] hover:text-[#1E1C18]'
                        : 'text-[#8C8373] hover:text-[#3D372E]'
                  }`}
                >
                  {st.t}
                </button>
              </li>
            ))}
          </ol>
        </aside>
      )}

      {/* Contextual Walkthrough Virtual Joystick / WASD Overlay (bottom-left) */}
      {walkState.active && <WalkNavOverlay viewportRef={viewportRef} />}

      {/* Contextual Walkthrough HUD (bottom-right on desktop, top-right below bar on mobile) */}
      {walkState.active && (
        <aside
          data-testid="walk-hud"
          className="fixed top-[68px] right-3 sm:top-auto sm:bottom-4 sm:right-4 z-20 w-[216px] rounded-xl bg-[#FAF8F3]/95 border border-[#E2DAC7] shadow-[0_10px_30px_rgba(24,22,18,0.14)] p-3 text-[12px] text-[#2A2620]"
        >
          <div className="text-[11px] text-[#6B6458] uppercase tracking-wider font-semibold">Locație curentă</div>
          <div className="font-display font-bold text-[14px] text-[#1E1C18] truncate" data-testid="walk-room">
            {walkMsg || walkState.room}
          </div>
          <div className="mt-1.5">
            <select
              aria-label="Sari rapid în altă cameră"
              data-testid="walk-room-select"
              value={walkSpot}
              onChange={(e) => {
                const id = e.target.value;
                setWalkSpot(id);
                setWalkMsg(null);
                viewportRef.current?.walkTo(id);
              }}
              className="w-full px-2 py-1 rounded-md border border-[#D8CEB8] bg-white text-[11.5px] font-medium text-[#2A2620] cursor-pointer"
            >
              {WALK_LIST.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <canvas
            ref={walkMapRef}
            width={180}
            height={320}
            onClick={handleMapClick}
            title="Clic pe plan ca să te muți acolo"
            className="hidden sm:block mx-auto my-2 rounded-md border border-[#D8CEB8] cursor-crosshair w-[180px] h-[280px]"
          />
          <p className="hidden sm:block text-[10.5px] leading-snug text-[#5B5449]">
            <b>Joystick / WASD</b> pe ecran sau tastatură · <b>trage</b> = privire · <b>clic plan</b> = teleport
          </p>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => viewportRef.current?.walkExit(true)}
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#9A6B1E] hover:bg-[#825816] text-white font-semibold text-[12px] cursor-pointer"
            >
              ✕ Ieși (Esc)
            </button>
          </div>
        </aside>
      )}

      {/* Bottom Floating Studio Dock (hidden during walkthrough unless collapsed bar is clicked) */}
      {!walkState.active && (
        <section
          aria-label="Panou de control model 3D"
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-24px)] max-w-[980px] rounded-xl bg-[#FAF8F3]/95 border border-[#E2DAC7] shadow-[0_10px_34px_rgba(24,22,18,0.12)] text-[#2A2620]"
        >
          {/* Dock Tab Strip + Collapse Toggle */}
          <div className="flex items-center justify-between gap-4 px-3.5 py-2 border-b border-[#E7E0CE]">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  ['prezentare', 'Prezentare', Eye],
                  ['soare', 'Soare & PV', Sun],
                  ['constructie', 'Construcție', Hammer],
                  ['plimbare', 'Plimbare', Footprints],
                  ['straturi', 'Straturi', Layers],
                ] as const
              ).map(([id, label, Icon]) => {
                const active = activeTab === id && !collapsed;
                return (
                  <button
                    key={id}
                    type="button"
                    data-tab={id}
                    onClick={() => {
                      onTabChange(id);
                      if (collapsed) onToggleCollapse();
                    }}
                    className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#9A6B1E] text-[#FAF8F3] font-semibold'
                        : 'text-[#4A443A] hover:bg-[#EFE9DA]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden xl:inline text-[11px] text-[#7D7567] whitespace-nowrap">
                Mouse: rotire / mutare / zoom
              </span>
              <button
                type="button"
                onClick={onToggleCollapse}
                title={collapsed ? 'Arată panoul (H)' : 'Ascunde panoul (H)'}
                className="px-2.5 py-1 rounded-lg border border-[#D8CEB8] bg-white hover:bg-[#EFE9DA] text-[12px] font-medium text-[#3A352C] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                {collapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" /> Panou (H)
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" /> Ascunde (H)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Dock Body */}
          {!collapsed && (
            <div className="px-4 py-3 max-h-[260px] overflow-y-auto">
              {/* TAB: PREZENTARE */}
              {activeTab === 'prezentare' && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6458] w-[82px] shrink-0">
                      Stadiu
                    </span>
                    {PRESET_LIST.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        data-preset={id}
                        onClick={() => {
                          onPresetChange(id);
                          viewportRef.current?.setPreset(id);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors cursor-pointer border ${
                          activePreset === id
                            ? 'bg-[#9A6B1E] text-white border-[#9A6B1E]'
                            : 'bg-white text-[#3A352C] border-[#DDD4BF] hover:bg-[#F1ECE0]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6458] w-[82px] shrink-0">
                      Vederi
                    </span>
                    {VIEW_LIST.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        data-view={id}
                        onClick={() => {
                          onViewChange(id);
                          viewportRef.current?.setView(id);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors cursor-pointer border ${
                          activeView === id
                            ? 'bg-[#2E2A24] text-[#FAF8F3] border-[#2E2A24]'
                            : 'bg-white text-[#3A352C] border-[#DDD4BF] hover:bg-[#F1ECE0]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6458] w-[82px] shrink-0">
                      Îmbinări
                    </span>
                    {JOINT_LIST.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        data-joint={id}
                        onClick={() => {
                          onPresetChange('imbinari');
                          viewportRef.current?.setJointView(id);
                        }}
                        className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-white text-[#3A352C] border border-[#DDD4BF] hover:bg-[#F1ECE0] transition-colors cursor-pointer"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: SOARE & PV */}
              {activeTab === 'soare' && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        [355, 'Iarnă (21 dec)'],
                        [80, 'Primăvară (20 mar)'],
                        [172, 'Vară (21 iun)'],
                        [266, 'Toamnă (23 sep)'],
                      ] as const
                    ).map(([doy, label]) => (
                      <button
                        key={doy}
                        type="button"
                        data-season={doy}
                        onClick={() => {
                          setSunDay(doy);
                          setSunAnim('none');
                          viewportRef.current?.setSunAnim('none');
                          viewportRef.current?.setSun(doy, sunHour, true);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[12px] font-medium border cursor-pointer transition-colors ${
                          Math.abs(sunDay - doy) <= 2
                            ? 'bg-[#9A6B1E] text-white border-[#9A6B1E]'
                            : 'bg-white text-[#3A352C] border-[#DDD4BF] hover:bg-[#F1ECE0]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const next = sunAnim === 'day' ? 'none' : 'day';
                        setSunAnim(next);
                        viewportRef.current?.setSunAnim(next);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[12px] font-medium border cursor-pointer ${
                        sunAnim === 'day'
                          ? 'bg-[#2E2A24] text-white border-[#2E2A24]'
                          : 'bg-white text-[#3A352C] border-[#DDD4BF] hover:bg-[#F1ECE0]'
                      }`}
                    >
                      {sunAnim === 'day' ? '❚❚ Stop zi' : '▶ Ziua'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const next = sunAnim === 'year' ? 'none' : 'year';
                        setSunAnim(next);
                        viewportRef.current?.setSunAnim(next);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[12px] font-medium border cursor-pointer ${
                        sunAnim === 'year'
                          ? 'bg-[#2E2A24] text-white border-[#2E2A24]'
                          : 'bg-white text-[#3A352C] border-[#DDD4BF] hover:bg-[#F1ECE0]'
                      }`}
                    >
                      {sunAnim === 'year' ? '❚❚ Stop an' : '▶ Anul'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDomeOn(true);
                        viewportRef.current?.setSunDomeVisible(true);
                        viewportRef.current?.setView('soare');
                      }}
                      className="px-2.5 py-1 rounded-md text-[12px] font-semibold bg-[#EFE7D4] text-[#6B480F] border border-[#D8C59B] hover:bg-[#E7DABF] cursor-pointer"
                    >
                      Vezi drumul soarelui
                    </button>

                    <label className="inline-flex items-center gap-1.5 text-[12px] text-[#3A352C] ml-auto cursor-pointer">
                      <input
                        type="checkbox"
                        checked={domeOn}
                        onChange={(e) => {
                          setDomeOn(e.target.checked);
                          viewportRef.current?.setSunDomeVisible(e.target.checked);
                        }}
                        className="accent-[#9A6B1E]"
                      />
                      Boltă solară 3D
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-[12px]">
                      <span className="w-10 font-medium text-[#5B5449]">Ziua</span>
                      <input
                        type="range"
                        min={1}
                        max={365}
                        step={1}
                        value={Math.round(sunDay)}
                        onChange={(e) => {
                          const d = Number(e.target.value);
                          setSunDay(d);
                          viewportRef.current?.setSun(d, sunHour, true);
                        }}
                        className="flex-1 accent-[#9A6B1E]"
                      />
                      <span className="w-24 text-right font-mono-num text-[11.5px] text-[#1E1C18] tabular-nums">
                        {sunInfo?.dateLabel ?? '–'}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 text-[12px]">
                      <span className="w-10 font-medium text-[#5B5449]">Ora</span>
                      <input
                        type="range"
                        min={4}
                        max={20.5}
                        step={0.1}
                        value={sunHour}
                        onChange={(e) => {
                          const h = Number(e.target.value);
                          setSunHour(h);
                          viewportRef.current?.setSun(sunDay, h, true);
                        }}
                        className="flex-1 accent-[#9A6B1E]"
                      />
                      <span className="w-24 text-right font-mono-num text-[11.5px] text-[#1E1C18] tabular-nums">
                        {sunInfo ? `${sunInfo.localTime} ceas` : '–'}
                      </span>
                    </label>
                  </div>

                  {sunInfo && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5 border-t border-[#EAE3D3] text-[11.5px] tabular-nums">
                      <div>
                        <div className="text-[#6B6458]">Poziție soare</div>
                        <div className="font-semibold text-[#1E1C18]">
                          {sunInfo.altDeg > 0
                            ? `${sunInfo.altDeg}° alt · ${sunInfo.azDeg}° (${sunInfo.compass})`
                            : 'Sub orizont'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#6B6458]">Răsărit / Apus</div>
                        <div className="font-semibold text-[#1E1C18]">
                          {sunInfo.sunrise} – {sunInfo.sunset} ({sunInfo.dayLen}h)
                        </div>
                      </div>
                      <div>
                        <div className="text-[#6B6458]">Panouri în soare</div>
                        <div className="font-semibold text-[#1E1C18]" data-testid="pv-lit">
                          {sunInfo.altDeg > 0 ? `${sunInfo.litPanels} / ${sunInfo.totalPanels} · ${nf(sunInfo.kwNow, 1)} kW` : 'Noapte (0 kW)'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#6B6458]">Producție zi senină</div>
                        <div className="font-semibold text-[#1E1C18]">
                          ≈ {nf(sunInfo.dayKwh, 1)} kWh{' '}
                          <span className="font-normal text-[#6B6458]">
                            {sunInfo.shadeLossKwh > 0.3 ? `(-${nf(sunInfo.shadeLossKwh, 1)} umbră)` : '(fără umbre)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: CONSTRUCȚIE */}
              {activeTab === 'constructie' && sceneData && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => viewportRef.current?.buildAction('prev')}
                      className="px-2.5 py-1.5 rounded-md border border-[#DDD4BF] bg-white hover:bg-[#F1ECE0] text-[12px] font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <SkipBack className="w-3.5 h-3.5" /> Înapoi
                    </button>
                    <button
                      type="button"
                      onClick={() => viewportRef.current?.buildAction('play')}
                      className="px-3.5 py-1.5 rounded-md bg-[#9A6B1E] hover:bg-[#825816] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {buildState.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {buildState.playing ? 'Pauză' : buildState.active ? 'Continuă' : 'Pornește etapele'}
                    </button>
                    <button
                      type="button"
                      onClick={() => viewportRef.current?.buildAction('next')}
                      className="px-2.5 py-1.5 rounded-md border border-[#DDD4BF] bg-white hover:bg-[#F1ECE0] text-[12px] font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      Înainte <SkipForward className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => viewportRef.current?.buildAction('end')}
                      className="px-2.5 py-1.5 rounded-md border border-[#DDD4BF] bg-white hover:bg-[#F1ECE0] text-[12px] font-medium cursor-pointer"
                    >
                      Arată tot
                    </button>

                    <select
                      aria-label="Viteză animație"
                      value={buildState.speed}
                      onChange={(e) => viewportRef.current?.setBuildOptions({ speed: Number(e.target.value) })}
                      className="px-2 py-1 rounded-md border border-[#DDD4BF] bg-white text-[12px]"
                    >
                      <option value={0.5}>Viteză: lent</option>
                      <option value={1}>Viteză: normal</option>
                      <option value={2.5}>Viteză: rapid</option>
                    </select>

                    <label className="inline-flex items-center gap-1.5 text-[12px] cursor-pointer ml-auto">
                      <input
                        type="checkbox"
                        checked={buildState.autoRotate}
                        onChange={(e) => viewportRef.current?.setBuildOptions({ autoRotate: e.target.checked })}
                        className="accent-[#9A6B1E]"
                      />
                      Rotire cameră
                    </label>
                  </div>

                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="font-medium text-[#5B5449] shrink-0 tabular-nums">
                      Etapă {buildState.active ? buildState.step + 1 : 0}/{sceneData.STEPS.length}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(buildState.prog * 100)}
                      onChange={(e) => viewportRef.current?.buildAction('prog', Number(e.target.value) / 100)}
                      className="flex-1 accent-[#9A6B1E]"
                    />
                    <span className="text-[#1E1C18] font-medium truncate max-w-[260px]">
                      {buildState.active ? sceneData.STEPS[buildState.step].t : 'Apasă „Pornește etapele” sau „Înainte”'}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB: PLIMBARE */}
              {activeTab === 'plimbare' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {WALK_LIST.map(([id, label], idx) => (
                      <button
                        key={id}
                        type="button"
                        data-walk={id}
                        onClick={() => {
                          setWalkMsg(null);
                          setWalkSpot(id);
                          viewportRef.current?.walkTo(id);
                        }}
                        className={`px-3 py-1.5 rounded-md text-[12px] font-medium border cursor-pointer transition-colors ${
                          idx === 0
                            ? 'bg-[#9A6B1E] hover:bg-[#825816] text-white border-[#9A6B1E] font-semibold'
                            : 'bg-white hover:bg-[#F1ECE0] text-[#2A2620] border-[#DDD4BF]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11.5px] text-[#6B6458]">
                    Mers la înălțimea ochilor (1,60 m) cu coliziuni pe pereți și mobilier, urcare automată pe rampa de 10 % și hartă interactivă.
                  </p>
                </div>
              )}

              {/* TAB: STRATURI & SECȚIUNE */}
              {activeTab === 'straturi' && sceneData && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center pb-2 border-b border-[#EAE3D3]">
                    <label className="flex items-center gap-2 text-[12px]">
                      <span className="font-medium text-[#5B5449] shrink-0">Explodare</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={explodePct}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setExplodePct(v);
                          viewportRef.current?.setExplode(v);
                        }}
                        className="flex-1 accent-[#9A6B1E]"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-[12px]">
                      <span className="font-medium text-[#5B5449] shrink-0">Secțiune S</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={sectionPct}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setSectionPct(v);
                          viewportRef.current?.setSection(v);
                        }}
                        className="flex-1 accent-[#9A6B1E]"
                      />
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[12px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={xrayOn}
                        onChange={(e) => viewportRef.current?.setXray(e.target.checked)}
                        className="accent-[#9A6B1E]"
                      />
                      Teren transparent
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[12px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={labelsOn}
                        onChange={(e) => {
                          setLabelsOn(e.target.checked);
                          viewportRef.current?.setLabelsVisible(e.target.checked);
                        }}
                        className="accent-[#9A6B1E]"
                      />
                      Etichete 3D
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-[11.5px]">
                    {LAYERS.map(([cat, items]) => (
                      <div key={cat}>
                        <div className="font-semibold uppercase tracking-wider text-[10.5px] text-[#9A6B1E] mb-1">
                          {cat}
                        </div>
                        <div className="space-y-0.5">
                          {items.map(([id, name]) => (
                            <label key={id} className="flex items-start gap-1.5 cursor-pointer text-[#3A352C]">
                              <input
                                type="checkbox"
                                checked={Boolean(layerVis[id])}
                                onChange={(e) => viewportRef.current?.setLayerVisible(id, e.target.checked)}
                                className="mt-0.5 accent-[#9A6B1E]"
                              />
                              <span className="leading-tight">{name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[#EAE3D3] text-[11px] text-[#5B5449] leading-relaxed tabular-nums">
                    <b>Rezumat tehnic:</b> Pană GL24h {Math.round(RIDGE.b * 100)}×{Math.round(RIDGE.h * 100)} · Înălțime interioară{' '}
                    {nf(roofY(0.4) - CEIL - F, 2)} m → {nf(yRBb - F, 2)} m · Coamă +{nf(yApex + 0.62 - F, 2)} m ·{' '}
                    {sceneData.Q.pilesHouse} piloni casă ({sceneData.Q.pileTH.B} B + {sceneData.Q.pileTH.A} A) ·{' '}
                    ≈ {Math.ceil((sceneData.Q.baleWall + sceneData.Q.baleFloor + sceneData.Q.baleRoof) * 1.1)} baloți ·{' '}
                    {sceneData.nPV} PV ({nf(sceneData.pvKw)} kWp) + {sceneData.batKwh} kWh baterii ·{' '}
                    Îmbinări 3D: {sceneData.JRES.filter((j) => j.ok).length}/{sceneData.JRES.length} ✓
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
