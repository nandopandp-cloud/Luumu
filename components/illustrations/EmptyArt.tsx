import { Plum } from "./Plum";

/*
  Ilustrações dos estados vazios e de erro (flat com profundidade). Cartões usam a
  superfície do tema (claro/escuro); roxos, verdes e rosas são os da marca. Movimento leve
  (flutuar, folhas, faíscas) vem de classes ill-* em globals.css e respeita movimento reduzido.
*/
const card = { fill: "var(--bg-elev)" } as const;
const soft = { fill: "color-mix(in srgb, var(--luumu-roxo-claro) 14%, transparent)" } as const;
const softer = { fill: "color-mix(in srgb, var(--luumu-roxo-claro) 9%, transparent)" } as const;
const line = { fill: "color-mix(in srgb, var(--luumu-roxo-claro) 32%, var(--bg-elev))" } as const;
const dash = { stroke: "color-mix(in srgb, var(--luumu-roxo-claro) 55%, transparent)" } as const;

function Shadow({ id }: { id: string }) {
  return (
    <filter id={id} x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#4a2fa8" floodOpacity=".12" />
    </filter>
  );
}

function Leaf({ x, y, r = 0, s = 1, className }: { x: number; y: number; r?: number; s?: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} className={className}>
      <path d="M0 0 C 6 -14 24 -20 38 -14 C 30 0 14 6 0 0Z" fill="#7fd34e" />
      <path d="M0 0 C 12 -4 26 -9 38 -14 C 30 0 14 6 0 0Z" fill="#4cae3c" />
    </g>
  );
}

/** folha lavanda de planta decorativa */
function SoftLeaf({ x, y, r = 0, s = 1 }: { x: number; y: number; r?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0 C -14 -22 -8 -52 10 -62 C 24 -42 20 -16 0 0Z" style={soft} />
      <path d="M0 0 C 2 -20 6 -40 10 -62" fill="none" strokeWidth="2" strokeLinecap="round" style={dash} />
    </g>
  );
}

function Sparks({ x, y, color, r = 0 }: { x: number; y: number; color: string; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} stroke={color} strokeWidth="5" strokeLinecap="round" className="ill-sparks">
      <line x1="-16" y1="-2" x2="-22" y2="-14" />
      <line x1="0" y1="-8" x2="0" y2="-22" />
      <line x1="16" y1="-2" x2="22" y2="-14" />
    </g>
  );
}

const Bars = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-22" y="0" width="12" height="20" rx="3" fill="#a78bfa" />
    <rect x="-6" y="-14" width="12" height="34" rx="3" fill="#8b5cf6" />
    <rect x="10" y="-28" width="12" height="48" rx="3" fill="#7c3aed" />
  </g>
);

/* ------------------------------------------------------------------ Analytics vazio */
export function AnalyticsEmptyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 760 320" className={className} role="img" aria-label="A ameixa da Luumu esperando os primeiros dados">
      <defs>
        <Shadow id="ae-sh" />
      </defs>
      {/* nuvens de fundo */}
      <ellipse cx="190" cy="240" rx="150" ry="62" style={softer} />
      <ellipse cx="590" cy="250" rx="160" ry="56" style={softer} />
      <circle cx="660" cy="232" r="48" style={softer} />
      <ellipse cx="380" cy="292" rx="210" ry="16" style={soft} />
      {/* linhas tracejadas ligando os dados */}
      <path d="M150 210 C 110 150 160 110 230 120" fill="none" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" style={dash} />
      <path d="M560 210 C 610 240 650 200 690 214" fill="none" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" style={dash} />
      <path d="M300 96 C 300 130 330 140 352 150" fill="none" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" style={dash} />
      {/* cartões */}
      <g transform="translate(232 82) rotate(-8)" filter="url(#ae-sh)" className="ill-bob-a">
        <rect x="-48" y="-46" width="96" height="92" rx="18" style={card} />
        <Bars x={0} y={4} />
      </g>
      <g transform="translate(548 92) rotate(8)" filter="url(#ae-sh)" className="ill-bob-b">
        <rect x="-70" y="-48" width="140" height="96" rx="16" style={card} />
        <rect x="-56" y="-34" width="112" height="68" rx="8" style={softer} />
        <path d="M-48 14 L -26 -6 L -6 6 L 14 -12 L 30 -2 L 48 -22" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="48" cy="-22" r="4" fill="#7c3aed" />
      </g>
      <g transform="translate(178 224) rotate(-7)" filter="url(#ae-sh)" className="ill-bob-c">
        <rect x="-66" y="-36" width="132" height="72" rx="14" style={card} />
        {[-14, 2, 18].map((dy, i) => (
          <g key={i}>
            <rect x="-48" y={dy - 5} width="11" height="10" rx="3" fill="#a78bfa" />
            <rect x="-30" y={dy - 4} width={i === 1 ? 52 : 72} height="8" rx="4" style={line} />
          </g>
        ))}
      </g>
      <g transform="translate(638 190) rotate(6)" filter="url(#ae-sh)" className="ill-bob-a">
        <rect x="-38" y="-38" width="76" height="76" rx="16" style={card} />
        <circle r="19" fill="none" stroke="#ede6ff" strokeWidth="11" />
        <path d="M0 -19 A19 19 0 0 1 18 6" fill="none" stroke="#ff8dbd" strokeWidth="11" />
        <path d="M18 6 A19 19 0 0 1 -14 13" fill="none" stroke="#8b5cf6" strokeWidth="11" />
      </g>
      {/* folhas soltas e planta */}
      <Leaf x={440} y={34} r={-30} className="ill-drift" />
      <Leaf x={268} y={150} r={20} s={0.9} className="ill-drift-b" />
      <Leaf x={600} y={276} r={-10} s={0.8} className="ill-drift" />
      <SoftLeaf x={286} y={262} r={-24} s={0.8} />
      <SoftLeaf x={534} y={256} r={22} s={0.9} />
      <Sparks x={338} y={70} color="#a78bfa" r={-12} />
      <Sparks x={500} y={168} color="#ffc233" r={60} />
      {/* ameixa com o tablet */}
      <Plum x={380} y={190} scale={1.36} mood="curious" look={1} idPrefix="ae">
        <ellipse cx="-56" cy="26" rx="15" ry="18" fill="#6127cf" transform="rotate(25 -56 26)" />
        <g transform="translate(34 30) rotate(-8)">
          <rect x="-34" y="-30" width="78" height="62" rx="10" fill="#d9cdfb" />
          <rect x="-28" y="-24" width="66" height="50" rx="7" fill="#efe9fe" />
          <Bars x={6} y={6} s={0.62} />
        </g>
        <ellipse cx="70" cy="30" rx="14" ry="17" fill="#7238e6" transform="rotate(-25 70 30)" />
      </Plum>
    </svg>
  );
}

/* ------------------------------------------------------------------ Pesquisas vazio */
export function SurveysEmptyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 760 320" className={className} role="img" aria-label="A ameixa da Luumu ao lado de uma caixa vazia">
      <defs>
        <Shadow id="se-sh" />
      </defs>
      <path d="M150 300 C 140 200 220 130 320 140 C 380 60 520 60 560 140 C 640 140 690 220 660 300Z" style={softer} />
      <ellipse cx="400" cy="296" rx="250" ry="14" style={soft} />
      {/* avião de papel com o rastro saindo da caixa */}
      <path d="M520 190 C 520 120 470 90 500 70 C 540 44 560 90 600 64 C 630 44 650 36 690 30" fill="none" strokeWidth="2.4" strokeDasharray="6 8" strokeLinecap="round" style={dash} />
      <g transform="translate(712 26) rotate(-12)" className="ill-drift">
        <path d="M-40 4 L 30 -22 L -6 22 Z" fill="#c4b0f7" />
        <path d="M-40 4 L 30 -22 L -12 8 Z" fill="#e4dafd" />
        <path d="M-12 8 L -6 22 L 2 4 Z" fill="#a98bf3" />
      </g>
      <circle cx="520" cy="64" r="18" fill="none" strokeWidth="2" strokeDasharray="5 6" style={dash} />
      {/* cartões */}
      <g transform="translate(176 120) rotate(-10)" filter="url(#se-sh)" className="ill-bob-a">
        <rect x="-48" y="-44" width="96" height="88" rx="18" style={card} />
        <Bars x={0} y={4} />
      </g>
      <g transform="translate(624 168) rotate(10)" filter="url(#se-sh)" className="ill-bob-b">
        <rect x="-62" y="-50" width="124" height="100" rx="16" style={card} />
        {[-24, -2, 20].map((dy, i) => (
          <g key={i}>
            <rect x="-42" y={dy - 6} width="13" height="12" rx="3.5" fill="#a78bfa" />
            <rect x="-22" y={dy - 5} width={i === 2 ? 48 : 64} height="10" rx="5" style={line} />
          </g>
        ))}
      </g>
      <SoftLeaf x={196} y={290} r={-30} s={1.1} />
      <SoftLeaf x={226} y={292} r={8} s={0.9} />
      <SoftLeaf x={606} y={286} r={24} s={0.85} />
      <Sparks x={430} y={70} color="#a78bfa" />
      {/* caixa aberta (atrás da ameixa) */}
      <g transform="translate(470 220)">
        <path d="M-70 -30 L 0 -50 L 70 -30 L 0 -10 Z" fill="#cdbdf8" />
        <path d="M-70 -30 L 0 -10 L 0 70 L -70 46 Z" fill="#e2d8fd" />
        <path d="M0 -10 L 70 -30 L 70 46 L 0 70 Z" fill="#d3c4fa" />
        <path d="M-70 -30 L -96 -62 L -26 -82 L 0 -50 Z" fill="#ece5fe" />
        <path d="M70 -30 L 104 -52 L 44 -80 L 0 -50 Z" fill="#c4b0f7" />
      </g>
      <Plum x={340} y={180} scale={1.34} mood="curious" look={0.6} idPrefix="se">
        <ellipse cx="-58" cy="22" rx="15" ry="18" fill="#6127cf" transform="rotate(25 -58 22)" />
        <ellipse cx="62" cy="34" rx="15" ry="13" fill="#7238e6" />
        <rect x="40" y="56" width="44" height="22" rx="10" fill="#e9e1fd" />
      </Plum>
    </svg>
  );
}

/* ------------------------------------------------------------------ Erro */
export function ErrorArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 760 320" className={className} role="img" aria-label="A ameixa da Luumu preocupada ao lado de uma página com problema">
      <defs>
        <Shadow id="er-sh" />
      </defs>
      {/* nuvens */}
      <path d="M140 270 C 120 230 170 210 200 222 C 210 180 270 176 290 210 C 330 200 350 240 330 270Z" style={softer} />
      <path d="M570 230 C 560 196 600 180 622 196 C 636 166 690 170 694 206 C 724 206 730 236 712 248 L 580 248Z" style={softer} />
      <path d="M352 36 C 340 20 362 6 374 18 C 384 4 406 12 400 28 C 418 30 414 52 396 50 C 392 66 368 62 368 48 C 350 54 340 40 352 36Z" style={soft} />
      <ellipse cx="410" cy="292" rx="240" ry="14" style={soft} />
      {/* janela com problema */}
      <g transform="translate(486 150) rotate(4)" filter="url(#er-sh)">
        <rect x="-112" y="-96" width="224" height="186" rx="18" style={card} />
        <path d="M-112 -78 a18 18 0 0 1 18 -18 h188 a18 18 0 0 1 18 18 v18 h-224z" style={softer} />
        <circle cx="-90" cy="-76" r="5" fill="#c4b0f7" />
        <circle cx="-74" cy="-76" r="5" fill="#c4b0f7" />
        <circle cx="-58" cy="-76" r="5" fill="#c4b0f7" />
        <circle cx="0" cy="-8" r="38" fill="#ede6ff" />
        <path d="M-20 -22 l 12 12 m0 -12 l -12 12 M8 -22 l 12 12 m0 -12 l -12 12" stroke="#8b5cf6" strokeWidth="4.4" strokeLinecap="round" />
        <path d="M-15 16 Q 0 4 15 16" fill="none" stroke="#8b5cf6" strokeWidth="4.4" strokeLinecap="round" />
        <rect x="-80" y="48" width="150" height="10" rx="5" style={line} />
        <rect x="-80" y="66" width="104" height="10" rx="5" style={line} />
      </g>
      {/* cabo desconectado */}
      <path d="M588 214 C 600 250 604 262 636 262 L 656 262" fill="none" stroke="#a98bf3" strokeWidth="6" strokeLinecap="round" />
      <g transform="translate(670 262)" className="ill-unplug">
        <rect x="-16" y="-14" width="30" height="28" rx="8" fill="#8b5cf6" />
        <rect x="14" y="-9" width="12" height="5" rx="2.5" fill="#6d46e8" />
        <rect x="14" y="4" width="12" height="5" rx="2.5" fill="#6d46e8" />
      </g>
      <g stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" className="ill-sparks">
        <line x1="700" y1="234" x2="706" y2="222" />
        <line x1="712" y1="250" x2="726" y2="246" />
      </g>
      <g stroke="#ff5d8f" strokeWidth="6" strokeLinecap="round" className="ill-sparks">
        <line x1="604" y1="30" x2="600" y2="52" />
        <line x1="624" y1="62" x2="640" y2="50" />
      </g>
      <Plum x={300} y={184} scale={1.36} mood="worried" look={0.8} idPrefix="er">
        <ellipse cx="-56" cy="24" rx="15" ry="18" fill="#6127cf" transform="rotate(25 -56 24)" />
        {/* mão no queixo */}
        <ellipse cx="22" cy="44" rx="15" ry="14" fill="#7238e6" />
        <ellipse cx="18" cy="38" rx="6" ry="4.5" fill="#9a6cf7" />
      </Plum>
    </svg>
  );
}
