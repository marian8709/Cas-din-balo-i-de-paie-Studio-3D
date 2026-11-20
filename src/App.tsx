import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlDock, type DockTab } from './components/ControlDock';
import { FloorplanToggleOverlay } from './components/FloorplanToggleOverlay';
import { Modals } from './components/Modals';
import { TopBar, type ModalType } from './components/TopBar';
import { Viewport3D, type BuildState, type SunTelemetry, type ViewportHandle, type WalkState } from './components/Viewport3D';
import type { BuiltSceneData } from './model/buildScene';
import { ALL_LAYERS } from './model/config';

const INITIAL_BUILD: BuildState = {
  active: false,
  playing: false,
  step: 0,
  prog: 1,
  speed: 1,
  autoRotate: false,
};

const INITIAL_WALK: WalkState = {
  active: false,
  x: 0,
  z: 0,
  yaw: 0,
  pitch: -0.05,
  room: '–',
  fov: 68,
  aspect: 1.6,
};

export default function App() {
  const viewportRef = useRef<ViewportHandle | null>(null);
  const [sceneData, setSceneData] = useState<BuiltSceneData | null>(null);
  const [activeTab, setActiveTab] = useState<DockTab>('prezentare');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activePreset, setActivePreset] = useState('finisata');
  const [activeView, setActiveView] = useState('persp');
  const [modal, setModal] = useState<ModalType>(null);
  const [sunInfo, setSunInfo] = useState<SunTelemetry | null>(null);
  const [buildState, setBuildState] = useState<BuildState>(INITIAL_BUILD);
  const [walkState, setWalkState] = useState<WalkState>(INITIAL_WALK);
  const [layerVis, setLayerVis] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const id of ALL_LAYERS) map[id] = true;
    return map;
  });
  const [xrayOn, setXrayOn] = useState(false);
  const [floorplan2D, setFloorplan2D] = useState(false);
  const pre2DDockCollapsedRef = useRef<boolean | null>(null);

  const handleFloorplan2DChange = useCallback((enabled: boolean) => {
    setFloorplan2D(enabled);
    if (enabled) {
      setDockCollapsed((prev) => {
        if (pre2DDockCollapsedRef.current === null) pre2DDockCollapsedRef.current = prev;
        return true;
      });
    } else if (pre2DDockCollapsedRef.current !== null) {
      const prev = pre2DDockCollapsedRef.current;
      pre2DDockCollapsedRef.current = null;
      setDockCollapsed(prev);
    }
  }, []);

  const handleTabChange = useCallback((tab: DockTab) => {
    setActiveTab(tab);
    document.body.dataset.mode = tab;
    viewportRef.current?.setSunDomeVisible(tab === 'soare');
  }, []);

  const handleTopSelectMode = useCallback(
    (tab: 'prezentare' | 'soare') => {
      setDockCollapsed(false);
      handleTabChange(tab);
      if (tab === 'soare') {
        viewportRef.current?.setSunDomeVisible(true);
        viewportRef.current?.setView('soare');
        setActiveView('soare');
      }
    },
    [handleTabChange],
  );

  // Sync URL hash flags on initial load (#modal=..., #ui=0, etc.)
  useEffect(() => {
    document.body.dataset.mode = 'prezentare';
    const q = new URLSearchParams(window.location.hash.slice(1));
    if (q.get('ui') === '0') setDockCollapsed(true);
    const qModal = q.get('modal');
    if (qModal === 'drwModal') setModal('drawings');
    else if (qModal === 'bomModal') setModal('bom');
    else if (qModal === 'calcModal') setModal('calc');
  }, []);

  // Keyboard shortcuts: 'H' toggles bottom dock, 'Escape' closes modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
      if (e.key === 'Escape' && modal) {
        setModal(null);
        return;
      }
      if ((e.key === 'h' || e.key === 'H') && !modal && !walkState.active) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal, walkState.active]);

  const handleLayersSync = useCallback((vis: Record<string, boolean>, xray: boolean) => {
    setLayerVis(vis);
    setXrayOn(xray);
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#CFE3F1] select-none">
      {/* Full-Viewport 3D Architectural Canvas */}
      <div className="w-full h-full print:hidden">
        <Viewport3D
          ref={viewportRef}
          onSceneReady={setSceneData}
          onSunUpdate={setSunInfo}
          onBuildUpdate={setBuildState}
          onWalkUpdate={setWalkState}
          onLayersSync={handleLayersSync}
          onFloorplan2DChange={handleFloorplan2DChange}
        />
      </div>

      {/* Minimal 3-Zone Top Bar */}
      <div className="print:hidden">
        <TopBar activeTab={activeTab} onSelectMode={handleTopSelectMode} onOpenModal={setModal} />
      </div>

      {/* 2D Orthographic Floorplan / 3D Perspective Overlay Toggle */}
      <div className="print:hidden">
        <FloorplanToggleOverlay
          viewportRef={viewportRef}
          floorplan2D={floorplan2D}
          plasterVisible={Boolean(layerVis.tencuiala)}
        />
      </div>

      {/* Collapsible Floating Studio Dock, Build Drawer & Walkthrough Minimap */}
      <div className="print:hidden">
        <ControlDock
          viewportRef={viewportRef}
          sceneData={sceneData}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          collapsed={dockCollapsed}
          onToggleCollapse={() => setDockCollapsed((c) => !c)}
          activePreset={activePreset}
          onPresetChange={setActivePreset}
          activeView={activeView}
          onViewChange={setActiveView}
          sunInfo={sunInfo}
          buildState={buildState}
          walkState={walkState}
          layerVis={layerVis}
          xrayOn={xrayOn}
        />
      </div>

      {/* Technical Modals: A3 Drawings, Material BOM, Structural & Energy Calcs */}
      <Modals modal={modal} onClose={() => setModal(null)} data={sceneData} />
    </main>
  );
}
