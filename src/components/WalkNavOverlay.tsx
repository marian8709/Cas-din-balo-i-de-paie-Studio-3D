import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Compass, Gamepad2, Move, RotateCcw, RotateCw, Zap } from 'lucide-react';
import type { ViewportHandle } from './Viewport3D';

interface WalkNavOverlayProps {
  viewportRef: React.RefObject<ViewportHandle | null>;
}

const JOY_R = 38;

export function WalkNavOverlay({ viewportRef }: WalkNavOverlayProps) {
  const [navMode, setNavMode] = useState<'joystick' | 'wasd'>('joystick');
  const [sprint, setSprint] = useState(false);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeKeys, setActiveKeys] = useState<Record<string, boolean>>({});
  const padRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Reset all virtual inputs if overlay unmounts
  useEffect(() => {
    return () => {
      viewportRef.current?.setWalkInput({ moveX: 0, moveZ: 0, turnYaw: 0, turnPitch: 0, sprint: false });
    };
  }, [viewportRef]);

  const updateJoystick = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > JOY_R) {
        dx = (dx / dist) * JOY_R;
        dy = (dy / dist) * JOY_R;
      }
      setKnob({ x: dx, y: dy });
      const nx = Math.abs(dx / JOY_R) < 0.12 ? 0 : dx / JOY_R;
      const ny = Math.abs(dy / JOY_R) < 0.12 ? 0 : -dy / JOY_R;
      viewportRef.current?.setWalkInput({ moveX: nx, moveZ: ny });
    },
    [viewportRef],
  );

  const releaseJoystick = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setKnob({ x: 0, y: 0 });
    viewportRef.current?.setWalkInput({ moveX: 0, moveZ: 0 });
  }, [viewportRef]);

  // Ensure pointer release & window blur never leave virtual joystick or hold buttons stuck
  useEffect(() => {
    const onGlobalRelease = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        setKnob({ x: 0, y: 0 });
      }
      setActiveKeys({});
      viewportRef.current?.setWalkInput({ moveX: 0, moveZ: 0, turnYaw: 0, turnPitch: 0 });
    };
    window.addEventListener('pointerup', onGlobalRelease);
    window.addEventListener('pointercancel', onGlobalRelease);
    window.addEventListener('blur', onGlobalRelease);
    return () => {
      window.removeEventListener('pointerup', onGlobalRelease);
      window.removeEventListener('pointercancel', onGlobalRelease);
      window.removeEventListener('blur', onGlobalRelease);
    };
  }, [viewportRef]);

  const applyButtonMap = useCallback(
    (next: Record<string, boolean>) => {
      const moveZ = (next.W ? 1 : 0) - (next.S ? 1 : 0);
      const moveX = (next.D ? 1 : 0) - (next.A ? 1 : 0);
      const turnYaw = (next.TR ? 1 : 0) - (next.TL ? 1 : 0);
      const turnPitch = (next.PU ? 1 : 0) - (next.PD ? 1 : 0);
      viewportRef.current?.setWalkInput({
        ...(navMode === 'wasd' ? { moveX, moveZ } : {}),
        turnYaw,
        turnPitch,
      });
    },
    [navMode, viewportRef],
  );

  const setHold = (code: string, down: boolean) => {
    setActiveKeys((prev) => {
      if (Boolean(prev[code]) === down) return prev;
      const next = { ...prev, [code]: down };
      applyButtonMap(next);
      return next;
    });
  };

  const toggleSprint = () => {
    setSprint((prev) => {
      const next = !prev;
      viewportRef.current?.setWalkInput({ sprint: next });
      return next;
    });
  };

  const switchMode = (m: 'joystick' | 'wasd') => {
    draggingRef.current = false;
    setNavMode(m);
    setKnob({ x: 0, y: 0 });
    setActiveKeys({});
    viewportRef.current?.setWalkInput({ moveX: 0, moveZ: 0, turnYaw: 0, turnPitch: 0 });
  };

  const holdProps = (code: string, label: string) => ({
    type: 'button' as const,
    'aria-label': label,
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Synthetic events may not support pointer capture
      }
      setHold(code, true);
    },
    onPointerUp: () => setHold(code, false),
    onPointerCancel: () => setHold(code, false),
    onLostPointerCapture: () => setHold(code, false),
    onPointerLeave: () => setHold(code, false),
  });

  const btnCls = (on?: boolean) =>
    `w-9 h-9 rounded-lg border text-[12px] font-bold flex items-center justify-center select-none touch-none transition-colors cursor-pointer ${
      on
        ? 'bg-[#9A6B1E] text-white border-[#9A6B1E] shadow-inner'
        : 'bg-white text-[#2A2620] border-[#D8CEB8] hover:bg-[#F1ECE0]'
    }`;

  return (
    <aside
      data-testid="walk-nav-overlay"
      className="fixed bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 rounded-xl bg-[#FAF8F3]/95 border border-[#E2DAC7] shadow-[0_10px_30px_rgba(24,22,18,0.14)] p-3 text-[#2A2620] select-none"
    >
      {/* Top Mode & Speed Strip */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-[#E7E0CE]">
        <div className="inline-flex rounded-lg bg-[#EFE9DA] p-0.5 border border-[#DED5C1]">
          <button
            type="button"
            data-testid="walk-mode-joystick"
            onClick={() => switchMode('joystick')}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
              navMode === 'joystick' ? 'bg-[#9A6B1E] text-white' : 'text-[#4A443A] hover:text-[#1E1C18]'
            }`}
          >
            <Gamepad2 className="w-3 h-3" /> Joystick
          </button>
          <button
            type="button"
            data-testid="walk-mode-wasd"
            onClick={() => switchMode('wasd')}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
              navMode === 'wasd' ? 'bg-[#9A6B1E] text-white' : 'text-[#4A443A] hover:text-[#1E1C18]'
            }`}
          >
            <Move className="w-3 h-3" /> WASD
          </button>
        </div>

        <button
          type="button"
          data-testid="walk-sprint-toggle"
          onClick={toggleSprint}
          title="Comută viteza de deplasare (1,3 m/s vs 2,6 m/s)"
          className={`px-2 py-1 rounded-md border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
            sprint
              ? 'bg-[#2E2A24] text-[#FAF8F3] border-[#2E2A24]'
              : 'bg-white text-[#4A443A] border-[#D8CEB8] hover:bg-[#F1ECE0]'
          }`}
        >
          <Zap className="w-3 h-3" /> {sprint ? 'Rapid 2×' : 'Normal'}
        </button>
      </div>

      {/* Movement + Look Pad */}
      <div className="flex items-center gap-3.5">
        {/* Left: Virtual Analog Joystick OR WASD Pad */}
        {navMode === 'joystick' ? (
          <div className="flex flex-col items-center">
            <div
              ref={padRef}
              data-testid="walk-joystick"
              onPointerDown={(e) => {
                e.preventDefault();
                draggingRef.current = true;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Synthetic events may not support pointer capture
                }
                updateJoystick(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (!draggingRef.current) return;
                updateJoystick(e.clientX, e.clientY);
              }}
              onPointerUp={releaseJoystick}
              onPointerCancel={releaseJoystick}
              onLostPointerCapture={releaseJoystick}
              className="relative w-[116px] h-[116px] rounded-full bg-[#EFE9DA] border-2 border-[#D4C9B1] shadow-inner flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
            >
              {/* Subtle axis crosshairs */}
              <div className="absolute inset-x-4 top-1/2 h-px bg-[#D8CEB8]" />
              <div className="absolute inset-y-4 left-1/2 w-px bg-[#D8CEB8]" />
              {/* Cardinal WASD hints */}
              <span className="absolute top-1.5 text-[9px] font-bold text-[#7D7567]">W</span>
              <span className="absolute bottom-1.5 text-[9px] font-bold text-[#7D7567]">S</span>
              <span className="absolute left-2 text-[9px] font-bold text-[#7D7567]">A</span>
              <span className="absolute right-2 text-[9px] font-bold text-[#7D7567]">D</span>
              {/* Thumb puck */}
              <div
                style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
                className="w-11 h-11 rounded-full bg-[#9A6B1E] border-2 border-[#FAF8F3] shadow-[0_4px_12px_rgba(30,28,24,0.28)] flex items-center justify-center pointer-events-none"
              >
                <div className="w-3 h-3 rounded-full bg-[#FAF8F3]/75" />
              </div>
            </div>
            <span className="text-[10px] text-[#6B6458] mt-1 font-medium">Deplasare</span>
          </div>
        ) : (
          <div className="flex flex-col items-center" data-testid="walk-wasd-pad">
            <div className="grid grid-cols-3 gap-1.5">
              <div />
              <button {...holdProps('W', 'Înainte (W)')} className={btnCls(activeKeys.W)}>
                W
              </button>
              <div />
              <button {...holdProps('A', 'Stânga (A)')} className={btnCls(activeKeys.A)}>
                A
              </button>
              <button {...holdProps('S', 'Înapoi (S)')} className={btnCls(activeKeys.S)}>
                S
              </button>
              <button {...holdProps('D', 'Dreapta (D)')} className={btnCls(activeKeys.D)}>
                D
              </button>
            </div>
            <span className="text-[10px] text-[#6B6458] mt-2 font-medium">Mers (W A S D)</span>
          </div>
        )}

        {/* Right: Camera Look / Turn Pad */}
        <div className="flex flex-col items-center pl-3 border-l border-[#E7E0CE]">
          <div className="grid grid-cols-3 gap-1">
            <div />
            <button {...holdProps('PU', 'Privește sus')} title="Privește sus" className={btnCls(activeKeys.PU)}>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <div />
            <button {...holdProps('TL', 'Rotește stânga')} title="Rotește stânga" className={btnCls(activeKeys.TL)}>
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => viewportRef.current?.walkResetPitch()}
              title="Resetează nivelul privirii"
              aria-label="Resetează nivelul privirii"
              className="w-9 h-9 rounded-lg border border-[#D8CEB8] bg-[#F5F1E8] hover:bg-[#EAE2D0] text-[#6B6458] flex items-center justify-center cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
            <button {...holdProps('TR', 'Rotește dreapta')} title="Rotește dreapta" className={btnCls(activeKeys.TR)}>
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <div />
            <button {...holdProps('PD', 'Privește jos')} title="Privește jos" className={btnCls(activeKeys.PD)}>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <div />
          </div>
          <span className="text-[10px] text-[#6B6458] mt-1.5 font-medium inline-flex items-center gap-1">
            <ArrowLeft className="w-2.5 h-2.5" /> Privire <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>
    </aside>
  );
}
