import { Fragment, useMemo, useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import type { BuiltSceneData } from '../model/buildScene';
import {
  C,
  COP,
  COS,
  DAYS,
  HDD,
  LD,
  LUNI,
  PR,
  PSP,
  PT,
  PV30S,
  PV8V,
  RAD,
  RIDGE,
  W,
  XL,
  XR,
  ZON,
  ZR,
  calcStructuralRows,
  ceilArea,
  nf,
  roofArea,
  roofY,
} from '../model/config';
import { generateAllSheets, sheetSVG } from '../model/drawings';
import type { ModalType } from './TopBar';

interface ModalsProps {
  modal: ModalType;
  onClose: () => void;
  data: BuiltSceneData | null;
}

const C1 = Math.ceil;
const PCS_RULES: [RegExp, (q: number) => string][] = [
  [/^Țeavă PVC/, (q) => `${C1((q * 1.1) / 2)} buc × 2 m (cu 10 %)`],
  [/^Țeavă PEHD/, (q) => `1 colac × ${C1((q * 1.05) / 25) * 25} m`],
  [/^Țeavă PPR/, (q) => `${C1((q * 1.1) / 4)} bare × 4 m (cu 10 %)`],
  [/^Cochilii/, (q) => `${C1((q * 1.1) / 2)} buc × 2 m`],
  [/^Cablu (CYY|solar)/, (q) => `${C1(q / 100)} colac × 100 m`],
  [/^Copex/, (q) => `${C1(q / 50)} colaci × 50 m`],
  [/^Cablu electric/, (q) => `1 colac × ${C1((q * 1.05) / 25) * 25} m`],
  [/^OSB3/, (q) => `${C1((q * 1.1) / 3.125)} plăci 2,50 × 1,25 m (cu 10 %)`],
  [/^Plăci gips/, (q) => `${C1((q * 1.1) / 3)} plăci 1,20 × 2,50 m (cu 10 %)`],
  [/^Tablă fălțuită/, () => `${2 * C1((XR - XL + 0.08) / 0.52)} fâșii × ${nf((ZR + C.ovE) / COS + 0.1, 2)} m`],
  [/^Membrană|^Frână/, (q) => `${C1(q / 75)} role 1,5 × 50 m`],
  [/^Astereală/, (q) => `${C1(q / 0.6)} scânduri 15 cm × 4 m`],
  [/^Lambriu\/scândură/, (q) => `${C1(q / 0.48)} buc 12 cm × 4 m`],
  [/^Lambriu exterior/, (q) => `${C1(q / 0.48)} buc 12 cm × 4 m`],
  [/^Pazie/, (q) => `${C1(q / 4)} buc × 4 m`],
  [/^Șorț/, (q) => `${C1(q / 2)} buc × 2 m`],
  [/^Jgheab/, (q) => `${C1(q / 3)} buc × 3 m`],
  [/^Burlan/, (q) => `${C1(q / 3)} buc × 3 m`],
  [/^Bandă perforată/, (q) => `${C1(q / 25)} role × 25 m`],
  [/^Bandă bitum/, (q) => `${C1(q / 10)} role × 10 m`],
  [/^Coș de fum/, (q) => `${C1(q)} tronsoane × 1 m`],
  [/^Var hidraulic/, (q) => `${C1(q / 25)} saci × 25 kg`],
  [/^Plasă fibră/, (q) => `${C1(q / 50)} role 1 × 50 m`],
  [/^Plasă zincată/, (q) => `${C1(q / 25)} role 1 × 25 m`],
  [/^Parchet/, (q) => `${C1(q / 2.2)} cutii × 2,2 m²`],
  [/^Suport izolant/, (q) => `${C1(q / 10)} role × 10 m²`],
  [/^Folie PE/, (q) => `${C1(q / 25)} role × 25 m²`],
  [/^Plintă/, (q) => `${C1((q * 1.1) / 2.4)} buc × 2,4 m`],
  [/^Placă cimentoasă/, (q) => `${C1(q / 0.96)} plăci 1,20 × 0,80 m`],
  [/^Gresie/, (q) => `${C1(q / 1.44)} cutii × 1,44 m²`],
  [/^Folie încălzitoare/, (q) => `${C1(q / 0.5 / 0.5) * 0.5} m de rolă lată de 50 cm`],
  [/^Covor încălzitor/, (q) => `1 covor de ${nf(Math.ceil(q * 2) / 2, 1)} m²`],
  [/^Dușumea teras/, (q) => `${C1((q * 1.05) / 4)} buc × 4 m (cu 5 %)`],
  [/^Dulap /, (q) => `${C1((q * 1.05) / 4)} buc × 4 m (cu 5 %)`],
  [/^Izolație/, (q) => `${C1((q * 1.05) / 5)} baloturi × 5 m²`],
  [/^Lăți 4×5/, (q) => `${C1(q / 4)} buc × 4 m`],
  [/^Parazăpezi/, (q) => `${C1(q / 3)} tuburi × 3 m + suporți`],
  [/^Cuie 2,8×65/, (q) => `≈ ${nf(q * 340, 0)} buc`],
  [/^Cuie 4×100/, (q) => `≈ ${nf(q * 100, 0)} buc`],
  [/^Cuie 3,1×80/, (q) => `≈ ${nf(q * 210, 0)} buc`],
  [/^Cuie 2×40/, (q) => `≈ ${nf(q * 1100, 0)} buc`],
  [/^Paie tocate/, (q) => `${C1(q / 20)} saci × 20 kg`],
  [/^Soluție|^Ulei/, (q) => `${C1(q / 5)} bidoane × 5 L`],
  [/^Glaf/, () => 'la dimensiunea fiecărei ferestre'],
  [/^Spumă/, (q) => `${C1(q / 10)} role × 10 m`],
];

const BOM_CAT_ORDER = [
  'Fundație',
  'Baloți de paie',
  'Plăci',
  'Acoperiș',
  'Tencuieli',
  'Tâmplărie',
  'Pereți interiori',
  'Pardoseli',
  'Terasă și trepte',
  'Instalații apă și canalizare',
  'Instalație electrică și încălzire',
  'Feronerie și fixări',
  'Tratamente',
];

export function Modals({ modal, onClose, data }: ModalsProps) {
  const [drwIdx, setDrwIdx] = useState(0);
  const [drwAll, setDrwAll] = useState(false);

  const sheets = useMemo(() => {
    if (!data || modal !== 'drawings') return [];
    return generateAllSheets(data);
  }, [data, modal]);

  const bomComputed = useMemo(() => {
    if (!data || modal !== 'bom') return null;
    const secs = [...data.TIM.values()].sort((a, b) => parseFloat(b.sec.replace(',', '.')) - parseFloat(a.sec.replace(',', '.')));
    let totalVol = 0;
    let totalPieces = 0;
    const csv: string[][] = [['Categorie', 'Material', 'UM', 'Cantitate', 'Bucăți', 'Observații']];

    const timberRows = secs.map((t) => {
      const [a, b] = t.sec.split('×').map((v) => parseFloat(v.replace(',', '.')) / 100);
      const stock =
        t.grade === 'GL24h'
          ? Math.ceil(Math.max(...t.pcs) * 10) / 10
          : t.sec === '4,5×9,5'
            ? 7.5
            : ['5×5', '5×10', '9×9'].includes(t.sec)
              ? 4
              : 6;
      const parts: number[] = [];
      for (const pc of t.pcs) {
        let r = pc;
        while (r > stock + 1e-6) {
          parts.push(stock);
          r -= stock;
        }
        if (r > 0.02) parts.push(r);
      }
      parts.sort((x, y) => y - x);
      const bins: number[] = [];
      for (const pc of parts) {
        let k = bins.findIndex((f) => f >= pc + 0.01 - 1e-9);
        if (k < 0) {
          bins.push(stock);
          k = bins.length - 1;
        }
        bins[k] -= pc + 0.01;
      }
      const nb = bins.length < 10 ? bins.length : Math.ceil(bins.length * 1.05);
      const vol = a * b * nb * stock;
      totalVol += vol;
      totalPieces += nb;
      csv.push([
        'Lemn structural',
        `Lemn ${t.grade} ${t.sec} cm (${[...t.uses].join(', ')})`,
        'm',
        nf(nb * stock),
        `${nb} buc × ${stock} m`,
        `${nf(vol, 2)} m³; ${t.pcs.length} piese în model, net ${nf(t.len)} m`,
      ]);
      return {
        sec: t.sec,
        grade: t.grade,
        uses: [...t.uses].join(', '),
        pcsCount: t.pcs.length,
        netLen: t.len,
        nb,
        stock,
        vol,
      };
    });

    const catSections = BOM_CAT_ORDER.map((cat) => {
      const items = [...data.BOMD.values()]
        .filter((e) => e.cat === cat)
        .map((e) => {
          const d = ['buc', 'rolă', 'kg', 'L', 'set'].includes(e.unit) ? 0 : 1;
          const rule = PCS_RULES.find((r) => r[0].test(e.name));
          const pcs = e.name.includes('informativ')
            ? '–'
            : rule
              ? rule[1](e.qty)
              : ['buc', 'rolă', 'set'].includes(e.unit)
                ? `${nf(e.qty, 0)} ${e.unit === 'set' ? 'seturi' : 'buc'}`
                : '–';
          csv.push([cat, e.name, e.unit, nf(e.qty, d), pcs, e.note]);
          return { ...e, d, pcs };
        });
      return { cat, items };
    }).filter((s) => s.items.length > 0);

    return { timberRows, totalVol, totalPieces, catSections, csv };
  }, [data, modal]);

  const calcComputed = useMemo(() => {
    if (!data || modal !== 'calc') return null;
    const c = calcStructuralRows(data.WALLS, data.Q.plExt, data.nPV);
    const aWin = data.WALLS.flatMap((w) => w.openings).reduce((a, o) => a + (o.u1 - o.u0) * ((o.v1 ?? 2.05) - (o.v0 ?? 0)), 0);
    const aFl = (W - 2 * C.T) * (C.L - 2 * C.T);
    const vol = aFl * (roofY(C.T) - (C.pileH + 0.24 + 0.018 + 0.4 + 0.022 + 0.021) + (C.hE + (ZR - C.T) * Math.tan(30 * RAD)) / 2);
    const HT = (data.Q.plExt * 0.14 + ceilArea * 0.13 + aFl * 0.13 + aWin * 0.9) * 1.1;
    const HV = vol * 0.5 * 0.34;
    const H = HT + HV;
    const Pd = (H * 35) / 1000;

    const sum = { pv: 0, pvOld: 0, res: 0, hp: 0, house: 0 };
    const months = LUNI.map((name, m) => {
      const pv = data.pvKw * PV30S[m] * DAYS[m];
      const pvOld = 12 * 0.45 * PV8V[m] * DAYS[m];
      const res = ((H * HDD[m] * 24) / 1000) * 0.75;
      const hp = COP[m] ? res / COP[m] : 0;
      const house = 5 * DAYS[m];
      sum.pv += pv;
      sum.pvOld += pvOld;
      sum.res += res;
      sum.hp += hp;
      sum.house += house;
      return { name, pv, pvOld, res, hp, house, bal: pv - house - hp };
    });

    return { c, aWin, vol, H, Pd, months, sum };
  }, [data, modal]);

  if (!modal || !data) return null;

  const downloadCsv = () => {
    if (!bomComputed) return;
    const txt = '\uFEFF' + bomComputed.csv.map((r) => r.map((col) => '"' + String(col).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = 'necesar-materiale-casa-paie.csv';
    a.click();
  };

  const downloadSvg = () => {
    if (!sheets[drwIdx]) return;
    const svg = sheetSVG(drwIdx, sheets.length, sheets[drwIdx]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    a.download = `plansa-${drwIdx + 1}.svg`;
    a.click();
  };

  const triggerPrint = () => {
    if (modal === 'drawings' && !drwAll) setDrwAll(true);
    setTimeout(() => window.print(), 60);
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/45 flex items-center justify-center p-3 sm:p-5 print:static print:bg-white print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-[#FAF8F3] text-[#1E1C18] rounded-xl border border-[#DED5C1] shadow-2xl flex flex-col overflow-hidden w-full max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:rounded-none ${
          modal === 'drawings' ? 'max-w-[1520px]' : 'max-w-[1080px]'
        }`}
      >
        {/* Modal Header */}
        <header className="px-5 py-3 bg-[#F1ECE0] border-b border-[#DED5C1] flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h2 className="font-display text-[16px] font-bold text-[#1E1C18]">
            {modal === 'drawings' && 'Schiță arhitecturală și de structură (planșe A3)'}
            {modal === 'bom' && 'Necesar de materiale – casă din baloți de paie 7,20 × 11,73 m'}
            {modal === 'calc' && 'Calcul de predimensionare a structurii'}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {modal === 'drawings' && (
              <>
                <button
                  type="button"
                  onClick={() => setDrwAll((v) => !v)}
                  className={`px-3 py-1.5 rounded-lg border text-[12.5px] font-medium cursor-pointer ${
                    drwAll ? 'bg-[#9A6B1E] text-white border-[#9A6B1E]' : 'bg-white border-[#CFC5B0] hover:bg-[#FAF8F3]'
                  }`}
                >
                  Toate planșele
                </button>
                <button
                  type="button"
                  onClick={downloadSvg}
                  className="px-3 py-1.5 rounded-lg border border-[#CFC5B0] bg-white hover:bg-[#FAF8F3] text-[12.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Descarcă SVG
                </button>
              </>
            )}

            {modal === 'bom' && (
              <button
                type="button"
                onClick={downloadCsv}
                className="px-3 py-1.5 rounded-lg border border-[#CFC5B0] bg-white hover:bg-[#FAF8F3] text-[12.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Descarcă CSV (Excel)
              </button>
            )}

            <button
              type="button"
              onClick={triggerPrint}
              className="px-3 py-1.5 rounded-lg border border-[#CFC5B0] bg-white hover:bg-[#FAF8F3] text-[12.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> {modal === 'drawings' ? 'Tipărește / PDF (A3)' : 'Tipărește'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#2E2A24] text-white hover:bg-[#1E1C18] text-[12.5px] font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Închide
            </button>
          </div>

          {modal === 'drawings' && (
            <div className="w-full flex flex-wrap gap-1.5 pt-1">
              {sheets.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setDrwIdx(i);
                    setDrwAll(false);
                  }}
                  className={`px-2.5 py-1 rounded-md border text-[12px] font-medium cursor-pointer ${
                    !drwAll && i === drwIdx
                      ? 'bg-[#9A6B1E] text-white border-[#9A6B1E]'
                      : 'bg-white text-[#3A352C] border-[#D5CCB8] hover:bg-[#FAF8F3]'
                  }`}
                >
                  {i + 1}. {s.title.split(' (')[0].replace('Structură: ', '')}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 text-[13px] leading-relaxed print:overflow-visible print:p-0">
          {/* DRAWINGS */}
          {modal === 'drawings' && (
            <div id="drwBody" className="space-y-4">
              {(drwAll ? sheets.map((s, i) => ({ s, i })) : sheets[drwIdx] ? [{ s: sheets[drwIdx], i: drwIdx }] : []).map(({ s, i }) => (
                <div
                  key={i}
                  className="bg-white border border-[#D8CEB8] rounded-lg overflow-hidden shadow-xs print:border-none print:shadow-none"
                  dangerouslySetInnerHTML={{ __html: sheetSVG(i, sheets.length, s) }}
                />
              ))}
            </div>
          )}

          {/* BOM */}
          {modal === 'bom' && bomComputed && (
            <div className="space-y-4">
              <p className="text-[12px] text-[#5B5449]">
                Cantitățile sunt calculate automat din modelul 3D (nete, dacă nu se specifică altfel). Coloana „De comandat” arată câte bucăți comerciale trebuie comandate, cu pierderile indicate. Lista nu include obiectele sanitare, finisajele interioare (vopsele, faianță) și mobilierul.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-[#EFE9DC] text-left">
                      <th className="py-2 px-2.5 font-semibold">Lemn – secțiune (cm)</th>
                      <th className="py-2 px-2.5 font-semibold">Clasă</th>
                      <th className="py-2 px-2.5 font-semibold">Folosit la</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Piese în model</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Lungime netă (m)</th>
                      <th className="py-2 px-2.5 font-semibold text-right">De comandat</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Volum (m³)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0CE]">
                    {bomComputed.timberRows.map((r) => (
                      <tr key={r.sec + r.grade}>
                        <td className="py-1.5 px-2.5 font-bold">{r.sec}</td>
                        <td className="py-1.5 px-2.5">{r.grade}</td>
                        <td className="py-1.5 px-2.5 text-[#5B5449]">{r.uses}</td>
                        <td className="py-1.5 px-2.5 text-right tabular-nums">{r.pcsCount}</td>
                        <td className="py-1.5 px-2.5 text-right tabular-nums">{nf(r.netLen)}</td>
                        <td className="py-1.5 px-2.5 text-right font-semibold tabular-nums">
                          {r.nb} buc × {nf(r.stock, r.stock % 1 ? 1 : 0)} m
                        </td>
                        <td className="py-1.5 px-2.5 text-right tabular-nums">{nf(r.vol, 2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#E7DCC0] font-bold">
                      <td className="py-2 px-2.5" colSpan={5}>
                        Total lemn ecarisat de comandat
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{bomComputed.totalPieces} buc</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{nf(bomComputed.totalVol, 2)} m³</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-[12px] text-[#5B5449]">
                Bucățile de comandat rezultă din așezarea pieselor din model pe bare de 6 m (7,5 m pentru tălpile grinzilor-scară, 4 m pentru 5×5, 5×10 și 9×9), plus 5 % rezervă la secțiunile cu cel puțin 10 bare. Grinzile de fundație de 11,73 m se înnădesc decalat, deasupra unui pilon. Elementele GL24h se comandă la lungimea exactă. Lemn uscat (umiditate ≤ 18 %), clasa C24.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-[#EFE9DC] text-left">
                      <th className="py-2 px-2.5 font-semibold">Material</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Cantitate</th>
                      <th className="py-2 px-2.5 font-semibold">UM</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Bucăți de comandat</th>
                      <th className="py-2 px-2.5 font-semibold">Observații</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0CE]">
                    {bomComputed.catSections.map((sec) => (
                      <Fragment key={sec.cat}>
                        <tr className="bg-[#E7DCC0] font-bold">
                          <td className="py-1.5 px-2.5" colSpan={5}>
                            {sec.cat}
                          </td>
                        </tr>
                        {sec.items.map((item) => (
                          <tr key={sec.cat + item.name}>
                            <td className="py-1.5 px-2.5">{item.name}</td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums">{nf(item.qty, item.d)}</td>
                            <td className="py-1.5 px-2.5">{item.unit}</td>
                            <td className="py-1.5 px-2.5 text-right font-semibold tabular-nums">{item.pcs}</td>
                            <td className="py-1.5 px-2.5 text-[12px] text-[#5B5449]">{item.note}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STRUCTURAL & ENERGY CALCULATIONS */}
          {modal === 'calc' && calcComputed && (
            <div className="space-y-4">
              <div className="space-y-2 text-[12.5px] text-[#2A2620]">
                <p>
                  <b>Ipoteze de încărcare</b> (SR EN 1990/1991, SR EN 1995-1-1, CR 1-1-3, CR 1-1-4, P100-1/2013):
                  <br />
                  Acoperiș în două ape la {C.slopeDeg}°: permanentă g = {nf(LD.gR, 2)} kN/m² de versant + panouri {nf(LD.gPV, 2)} kN/m²; zăpadă s = 0,8 × {nf(C.snowSk)} = {nf(LD.s, 2)} kN/m² → q<sub>Ed</sub> = {nf(LD.qd, 2)} kN/m².
                  <br />
                  Planșeu: g = {nf(calcComputed.c.gF)} kN/m², utilă q = {nf(calcComputed.c.qF)} kN/m² → q<sub>Ed</sub> = {nf(calcComputed.c.qFd, 2)} kN/m². Lemn C24, vânt q<sub>p</sub> ≈ {nf(C.qp, 2)} kPa, seism a<sub>g</sub> = {nf(C.ag, 2)} g.
                </p>
                <p>
                  <b>Calea încărcărilor</b>: tablă → astereală → contra-șipci → căpriori-scară (la {nf(PR, 3)} m) → <b>cosoroabele teșite N/S</b> și <b>pana de coamă</b> → stâlpi de coamă 20×20 → bloc lamelar în platformă → <b>pereche de piloni tip B</b>. Podeaua → grinzi-scară → 3 grinzi longitudinale → piloni tip A la {nf(PSP, 2)} m.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-[#EFE9DC] text-left">
                      <th className="py-2 px-2.5 font-semibold">Element</th>
                      <th className="py-2 px-2.5 font-semibold">Secțiune</th>
                      <th className="py-2 px-2.5 font-semibold">Încărcare / schemă</th>
                      <th className="py-2 px-2.5 font-semibold">Verificare</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Grad de utilizare</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0CE]">
                    {calcComputed.c.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-2.5 font-semibold">{r.el}</td>
                        <td className="py-1.5 px-2.5">{r.sec}</td>
                        <td className="py-1.5 px-2.5 text-[#5B5449]">{r.sch}</td>
                        <td className="py-1.5 px-2.5">{r.chk}</td>
                        <td className={`py-1.5 px-2.5 text-right font-bold tabular-nums ${r.u > 1 ? 'text-[#B00020]' : 'text-[#1C6B2A]'}`}>
                          {Number.isNaN(r.u) ? '–' : `${Math.round(r.u * 100)} %`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[12.5px]">
                <b>Seism (calcul orientativ):</b> greutatea seismică W = {nf(calcComputed.c.Wt, 0)} kN → forța tăietoare F<sub>b</sub> = {nf(calcComputed.c.Fb, 0)} kN pe fiecare direcție, preluată de cruci din tiranți Ø20 (M20) cu întinzător și ancore de ridicare ≥ 75 kN. Capacitățile pilonilor (R<sub>d</sub> = {PT.A.Rd} kN tip A, {PT.B.Rd} kN tip B) se confirmă pe teren prin cuplul final de înșurubare (T ≥ {PT.A.T} kN·m tip A, ≥ {PT.B.T} kN·m tip B).
              </p>

              <h3 className="font-display text-[15px] font-bold pt-2">
                Verificare automată a îmbinărilor 3D ({data.JRES.filter((j) => j.ok).length} din {data.JRES.length} în regulă)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-[#EFE9DC] text-left">
                      <th className="py-2 px-2.5 font-semibold">Zonă</th>
                      <th className="py-2 px-2.5 font-semibold">Ce se verifică</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Abatere</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Stare</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0CE]">
                    {data.JRES.map((j, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-2.5">{j.el}</td>
                        <td className="py-1.5 px-2.5">{j.desc}</td>
                        <td className="py-1.5 px-2.5 text-right tabular-nums">
                          {Number.isNaN(j.d) ? 'nu se suprapun' : `${nf((j.d - j.exp) * 1000, 1)} mm`}
                          {j.exp ? <span className="text-[#6B6458]"> (gol prevăzut {nf(j.exp * 1000, 0)} mm)</span> : null}
                        </td>
                        <td className={`py-1.5 px-2.5 text-right font-bold ${j.ok ? 'text-[#1C6B2A]' : 'text-[#B00020]'}`}>
                          {j.ok ? '✓' : '✗'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="font-display text-[15px] font-bold pt-2">
                Energie: panouri pe versantul sud, încălzire și baterii
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-[#EFE9DC] text-left">
                      <th className="py-2 px-2.5 font-semibold">Mărime</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Valoare</th>
                      <th className="py-2 px-2.5 font-semibold">Estimare</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0CE]">
                    <tr>
                      <td className="py-1.5 px-2.5">Pierderi de căldură</td>
                      <td className="py-1.5 px-2.5 text-right font-semibold tabular-nums">{nf(calcComputed.H, 0)} W/K</td>
                      <td className="py-1.5 px-2.5 text-[#5B5449]">pereți U ≈ 0,14, acoperiș/platformă U ≈ 0,13, tâmplărie {nf(calcComputed.aWin)} m²</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5">Necesar la −15 °C</td>
                      <td className="py-1.5 px-2.5 text-right font-semibold tabular-nums">{nf(calcComputed.Pd)} kW</td>
                      <td className="py-1.5 px-2.5 text-[#5B5449]">interior 20 °C</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5">Încălzire în pardoseală</td>
                      <td className="py-1.5 px-2.5 text-right font-semibold tabular-nums">{nf(data.heatKw)} kW</td>
                      <td className="py-1.5 px-2.5 text-[#5B5449]">{nf(data.heatArea)} m² ({ZON.length} zone cu senzor max. 27 °C)</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5">Panouri fotovoltaice</td>
                      <td className="py-1.5 px-2.5 text-right font-semibold tabular-nums">{data.nPV} × 450 W = {nf(data.pvKw)} kWp</td>
                      <td className="py-1.5 px-2.5 text-[#5B5449]">versant sud 30°: ≈ {nf(calcComputed.sum.pv / data.pvKw, 0)} kWh/kWp/an</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5">Baterii LiFePO4 48 V</td>
                      <td className="py-1.5 px-2.5 text-right font-semibold tabular-nums">{data.batKwh} kWh</td>
                      <td className="py-1.5 px-2.5 text-[#5B5449]">invertor hibrid în camera tehnică</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-[#EFE9DC] text-left">
                      <th className="py-2 px-2.5 font-semibold">Luna</th>
                      <th className="py-2 px-2.5 font-semibold text-right">PV 30° S (kWh)</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Comparație 8° V</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Folie pardoseală</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Pompă căldură</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Consum casnic</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Bilanț cu pompă</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0CE]">
                    {calcComputed.months.map((m) => (
                      <tr key={m.name}>
                        <td className="py-1 px-2.5 font-medium">{m.name}</td>
                        <td className="py-1 px-2.5 text-right tabular-nums">{nf(m.pv, 0)}</td>
                        <td className="py-1 px-2.5 text-right tabular-nums text-[#5B5449]">{nf(m.pvOld, 0)}</td>
                        <td className="py-1 px-2.5 text-right tabular-nums">{nf(m.res, 0)}</td>
                        <td className="py-1 px-2.5 text-right tabular-nums">{nf(m.hp, 0)}</td>
                        <td className="py-1 px-2.5 text-right tabular-nums">{nf(m.house, 0)}</td>
                        <td className={`py-1 px-2.5 text-right font-semibold tabular-nums ${m.bal < 0 ? 'text-[#B00020]' : 'text-[#1C6B2A]'}`}>
                          {nf(m.bal, 0)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#E7DCC0] font-bold">
                      <td className="py-2 px-2.5">An</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{nf(calcComputed.sum.pv, 0)}</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{nf(calcComputed.sum.pvOld, 0)}</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{nf(calcComputed.sum.res, 0)}</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{nf(calcComputed.sum.hp, 0)}</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{nf(calcComputed.sum.house, 0)}</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">
                        {nf(calcComputed.sum.pv - calcComputed.sum.hp - calcComputed.sum.house, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
