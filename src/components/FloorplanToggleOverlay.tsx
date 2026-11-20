import { useEffect, useState } from 'react';
import { Box, Compass, Layers, Map, Maximize2, Ruler, ZoomIn, ZoomOut } from 'lucide-react';
import type { ViewportHandle } from './Viewport3D';

interface FloorplanToggleOverlayProps {
  viewportRef: React.RefObject<ViewportHandle | null>;
  floorplan2D: boolean;
  plasterVisible: boolean;
}

export function FloorplanToggleOverlay({
  viewportRef,
  floorplan2D,
  plasterVisible,
}: FloorplanToggleOverlayProps) {
  const [showPlaster, setShowPlaster] = useState(plasterVisible);

  useEffect(() => {
    setShowPlaster(plasterVisible);
  }, [plasterVisible]);

  const handleToggleMode = () => {
    viewportRef.current?.setFloorplan2D(!floorplan2D);
  };

  const handleTogglePlaster = () => {
    const next = !showPlaster;
    setShowPlaster(next);
    viewportRef.current?.setFloorplan2DPlaster(next);
  };

  return (
    <>
      {/* Primary 2D Floorplan / 3D Perspective Overlay Toggle Button */}
      <div className="fixed top-[68px] left-3 z-20 flex items-center gap-2">
        <button
          type="button"
          data-testid="toggle-floorplan-2d"
          aria-pressed={floorplan2D}
          onClick={handleToggleMode}
          title={
            floorplan2D
              ? 'Comută înapoi la vizualizarea în perspectivă 3D'
              : 'Comută la planul 2D ortografic de sus (secțiune +1,55 m)'
          }
          className={`px-3.5 py-2 rounded-xl border shadow-[0_6px_20px_rgba(24,22,18,0.12)] text-[12.5px] font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
            floorplan2D
              ? 'bg-[#9A6B1E] hover:bg-[#825816] text-[#FAF8F3] border-[#9A6B1E]'
              : 'bg-[#FAF8F3]/95 hover:bg-[#F1ECE0] text-[#1E1C18] border-[#E2DAC7]'
          }`}
        >
          {floorplan2D ? (
            <>
              <Box className="w-4 h-4 shrink-0" />
              <span>Înapoi la 3D</span>
            </>
          ) : (
            <>
              <Map className="w-4 h-4 text-[#9A6B1E] shrink-0" />
              <span>Plan 2D</span>
              <span className="hidden sm:inline text-[11px] font-medium text-[#6B6458]">· Ortografic</span>
            </>
          )}
        </button>
      </div>

      {/* Contextual 2D Orthographic Floorplan Controls (only visible in 2D mode) */}
      {floorplan2D && (
        <aside
          data-testid="floorplan-2d-hud"
          className="fixed top-[116px] left-3 z-20 w-[264px] rounded-xl bg-[#FAF8F3]/95 border border-[#E2DAC7] shadow-[0_8px_24px_rgba(24,22,18,0.12)] p-2.5 text-[11.5px] text-[#2A2620]"
        >
          <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-[#E7E0CE]">
            <span className="font-semibold text-[#1E1C18]">Plan 2D · secțiune +1,55 m</span>
            <span
              className="inline-flex items-center gap-1 font-bold text-[#9A6B1E] text-[11px]"
              title="Nordul este în sus"
            >
              <Compass className="w-3.5 h-3.5" /> N ↑
            </span>
          </div>

          <div
            data-testid="floorplan-2d-dimensions"
            className="mb-2 px-2 py-1.5 rounded-lg bg-[#F1ECE0] border border-[#E2DAC7] flex items-center justify-between gap-2 text-[11px]"
          >
            <span className="inline-flex items-center gap-1 font-semibold text-[#1E1C18]">
              <Ruler className="w-3.5 h-3.5 text-[#9A6B1E]" /> 7,20 × 11,73 m
            </span>
            <span className="text-[#6B6458] font-medium">84,5 m² constr.</span>
          </div>

          <div className="flex items-center gap-1.5 mb-1.5">
            <button
              type="button"
              data-testid="floorplan-2d-zoom-out"
              onClick={() => viewportRef.current?.zoomFloorplan2D(0.8)}
              title="Micșorează planul"
              className="px-2 py-1.5 rounded-lg border border-[#D8CEB8] bg-white hover:bg-[#F1ECE0] text-[#3A352C] text-[11px] font-semibold inline-flex items-center justify-center cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-testid="floorplan-2d-zoom-in"
              onClick={() => viewportRef.current?.zoomFloorplan2D(1.25)}
              title="Mărește planul"
              className="px-2 py-1.5 rounded-lg border border-[#D8CEB8] bg-white hover:bg-[#F1ECE0] text-[#3A352C] text-[11px] font-semibold inline-flex items-center justify-center cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-testid="floorplan-2d-reset"
              onClick={() => viewportRef.current?.resetFloorplan2DView()}
              title="Reîncadrează toată casa cu cote și terase"
              className="flex-1 px-2 py-1.5 rounded-lg border border-[#D8CEB8] bg-white hover:bg-[#F1ECE0] text-[#3A352C] text-[11px] font-medium inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" /> Toată casa
            </button>
          </div>

          <div className="flex items-center gap-1.5 mb-1.5">
            <button
              type="button"
              data-testid="floorplan-2d-focus-bedrooms"
              onClick={() => viewportRef.current?.focusFloorplan2D('bedrooms')}
              className="flex-1 px-2 py-1.5 rounded-lg border border-[#D8CEB8] bg-white hover:bg-[#F1ECE0] text-[#3A352C] text-[11px] font-medium cursor-pointer"
            >
              Dormitoare
            </button>
            <button
              type="button"
              data-testid="floorplan-2d-focus-tech"
              onClick={() => viewportRef.current?.focusFloorplan2D('tech')}
              className="flex-1 px-2 py-1.5 rounded-lg border border-[#D8CEB8] bg-white hover:bg-[#F1ECE0] text-[#3A352C] text-[11px] font-medium cursor-pointer"
            >
              Cam. tehnică &amp; Baie
            </button>
          </div>

          <button
            type="button"
            data-testid="floorplan-2d-plaster"
            onClick={handleTogglePlaster}
            className={`w-full px-2 py-1.5 rounded-lg border text-[11px] font-medium inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              showPlaster
                ? 'bg-[#2E2A24] text-[#FAF8F3] border-[#2E2A24]'
                : 'bg-white text-[#3A352C] border-[#D8CEB8] hover:bg-[#F1ECE0]'
            }`}
          >
            <Layers className="w-3 h-3 shrink-0" />
            {showPlaster ? 'Mod: Cu tencuială' : 'Mod: Baloți & lemn'}
          </button>

          <p className="mt-1.5 text-[10.5px] text-[#6B6458] leading-snug">
            Trage cu click stânga = mutare · Rotiță / + − = zoom · Săgeți = deplasare
          </p>
        </aside>
      )}
    </>
  );
}
