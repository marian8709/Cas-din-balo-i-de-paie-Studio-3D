import { Compass, Sun, Layers, Ruler } from 'lucide-react';

export type ModalType = 'drawings' | 'bom' | 'calc' | null;

interface TopBarProps {
  activeTab: string;
  onSelectMode: (tab: 'prezentare' | 'soare') => void;
  onOpenModal: (modal: ModalType) => void;
}

export function TopBar({ activeTab, onSelectMode, onOpenModal }: TopBarProps) {
  return (
    <header className="fixed top-3 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-24px)] max-w-[1160px] h-[54px] px-5 rounded-xl bg-[#FAF8F3]/95 border border-[#E2DAC7] shadow-[0_6px_24px_rgba(24,22,18,0.08)] flex items-center justify-between gap-6">
      {/* Zone 1: Brand Title */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#9A6B1E] text-[#FAF8F3] flex items-center justify-center shrink-0">
          <Compass className="w-4 h-4" />
        </div>
        <div className="leading-tight whitespace-nowrap">
          <h1 className="font-display text-[15px] font-bold tracking-tight text-[#1E1C18]">
            Casă din baloți de paie
          </h1>
          <p className="text-[11px] text-[#6B6458] font-medium tabular-nums">
            7,20 × 11,73 m · 30° · Clejani
          </p>
        </div>
      </div>

      {/* Zone 2: Clean single-line navigation links */}
      <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#4A443A]">
        <button
          type="button"
          onClick={() => onSelectMode('prezentare')}
          className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 border-b-2 ${
            activeTab !== 'soare'
              ? 'text-[#1E1C18] border-[#9A6B1E] font-semibold'
              : 'border-transparent hover:text-[#1E1C18]'
          }`}
        >
          Model 3D
        </button>
        <button
          type="button"
          onClick={() => onSelectMode('soare')}
          className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer py-1 border-b-2 ${
            activeTab === 'soare'
              ? 'text-[#1E1C18] border-[#9A6B1E] font-semibold'
              : 'border-transparent hover:text-[#1E1C18]'
          }`}
        >
          <Sun className="w-3.5 h-3.5 text-[#9A6B1E]" />
          Soare &amp; PV
        </button>
        <button
          type="button"
          onClick={() => onOpenModal('bom')}
          className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer py-1 border-b-2 border-transparent hover:text-[#1E1C18]"
        >
          <Layers className="w-3.5 h-3.5 text-[#6B6458]" />
          Materiale
        </button>
        <button
          type="button"
          onClick={() => onOpenModal('calc')}
          className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer py-1 border-b-2 border-transparent hover:text-[#1E1C18]"
        >
          <Ruler className="w-3.5 h-3.5 text-[#6B6458]" />
          Structură
        </button>
      </nav>

      {/* Zone 3: Single Primary CTA */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onOpenModal('drawings')}
          className="whitespace-nowrap shrink-0 px-3.5 py-2 rounded-lg bg-[#9A6B1E] hover:bg-[#825816] text-[#FAF8F3] text-[13px] font-semibold transition-colors cursor-pointer shadow-xs"
        >
          Schițe A3
        </button>
      </div>
    </header>
  );
}
