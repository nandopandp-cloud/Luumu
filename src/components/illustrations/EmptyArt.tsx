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

/* ------------------------------------------------------------------ Respostas vazio */
function Bubble({ x, y, r = 0, w = 92, cls }: { x: number; y: number; r?: number; w?: number; cls?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} className={cls}>
      <rect x={-w / 2} y="-30" width={w} height="56" rx="14" style={card} filter="url(#re-sh)" />
      <path d={`M${-w / 2 + 16} 24 L ${-w / 2 + 12} 40 L ${-w / 2 + 32} 25Z`} style={card} />
      {[-18, 0, 18].map((dx) => (
        <circle key={dx} cx={dx} cy="-2" r="6" fill="#c4b0f7" />
      ))}
    </g>
  );
}

export function ResponsesEmptyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 760 320" className={className} role="img" aria-label="A ameixa da Luumu esperando as primeiras respostas">
      <defs>
        <Shadow id="re-sh" />
      </defs>
      {/* nuvem de fundo */}
      <path d="M110 290 C 90 230 150 196 200 214 C 220 150 300 140 330 190 C 380 120 520 110 560 180 C 600 150 680 170 690 240 C 720 250 720 290 700 290Z" style={softer} />
      <ellipse cx="380" cy="294" rx="230" ry="13" style={soft} />
      {/* caminho tracejado das respostas chegando + avião de papel */}
      <path d="M420 210 C 450 140 470 200 500 210 C 540 224 560 170 600 200 C 630 222 650 250 690 236" fill="none" strokeWidth="2.2" strokeDasharray="5 7" strokeLinecap="round" style={dash} />
      <path d="M620 110 C 660 90 640 60 666 54 C 690 48 696 70 680 80 C 664 90 650 60 690 40 C 708 30 722 26 736 20" fill="none" strokeWidth="2.2" strokeDasharray="5 7" strokeLinecap="round" style={dash} />
      <g transform="translate(740 18) rotate(-14)" className="ill-drift">
        <path d="M-40 4 L 30 -22 L -6 22 Z" fill="#c4b0f7" />
        <path d="M-40 4 L 30 -22 L -12 8 Z" fill="#e4dafd" />
        <path d="M-12 8 L -6 22 L 2 4 Z" fill="#a98bf3" />
      </g>
      {/* balões de resposta "digitando…" */}
      <Bubble x={520} y={150} r={6} w={96} cls="ill-bob-a" />
      <Bubble x={620} y={96} r={-4} w={82} cls="ill-bob-b" />
      <Bubble x={640} y={222} r={5} w={84} cls="ill-bob-c" />
      <Leaf x={560} y={90} r={-60} s={0.7} className="ill-drift" />
      <Leaf x={588} y={190} r={-30} s={0.65} className="ill-drift-b" />
      <circle cx="560" cy="246" r="4" fill="#a98bf3" />
      <Sparks x={322} y={56} color="#ffc233" r={30} />
      <Plum x={300} y={182} scale={1.36} mood="curious" look={1} idPrefix="re">
        <ellipse cx="-58" cy="26" rx="15" ry="18" fill="#6127cf" transform="rotate(25 -58 26)" />
        {/* folha de respostas na mão */}
        <g transform="translate(66 48) rotate(10)">
          <rect x="-30" y="-38" width="64" height="80" rx="9" style={card} />
          {[-20, -4, 12].map((dy, i) => (
            <g key={i}>
              <rect x="-20" y={dy - 4} width="9" height="8" rx="2.5" fill="#a78bfa" />
              <rect x="-7" y={dy - 3} width={i === 1 ? 26 : 34} height="7" rx="3.5" style={line} />
            </g>
          ))}
        </g>
        <ellipse cx="94" cy="42" rx="13" ry="16" fill="#7238e6" transform="rotate(-20 94 42)" />
      </Plum>
    </svg>
  );
}

/* ------------------------------------------------------------------ peças comuns das novas cenas */
function Star4({ x, y, s = 1, color = "#ffc233", cls }: { x: number; y: number; s?: number; color?: string; cls?: string }) {
  return (
    <path
      className={cls}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -16 C 2 -5 5 -2 16 0 C 5 2 2 5 0 16 C -2 5 -5 2 -16 0 C -5 -2 -2 -5 0 -16Z"
      fill={color}
    />
  );
}
function Window({ w, h, children }: { w: number; h: number; children?: React.ReactNode }) {
  return (
    <>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="18" style={card} />
      <rect x={-w / 2 + 16} y={-h / 2 + 14} width={w - 32} height="18" rx="9" style={softer} />
      {[0, 14, 28].map((dx) => (
        <circle key={dx} cx={-w / 2 + 28 + dx} cy={-h / 2 + 23} r="4.5" fill="#c4b0f7" />
      ))}
      {children}
    </>
  );
}
const Feet = () => (
  <>
    <ellipse cx="-22" cy="60" rx="16" ry="10" fill="#5a22c7" />
    <ellipse cx="22" cy="60" rx="16" ry="10" fill="#5a22c7" />
  </>
);

/* ------------------------------------------------------------------ Dashboard vazio */
export function DashboardEmptyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 760 320" className={className} role="img" aria-label="A ameixa da Luumu pensativa diante de um painel ainda sem dados">
      <defs>
        <Shadow id="de-sh" />
      </defs>
      <path d="M90 290 C 80 220 150 180 220 200 C 250 120 380 100 430 160 C 480 110 600 120 630 190 C 690 190 720 250 700 290Z" style={softer} />
      <ellipse cx="380" cy="294" rx="260" ry="13" style={soft} />
      <path d="M160 190 C 130 120 220 80 260 110" fill="none" strokeWidth="2.2" strokeDasharray="5 7" strokeLinecap="round" style={dash} />
      <path d="M690 150 C 720 210 690 250 640 250" fill="none" strokeWidth="2.2" strokeDasharray="5 7" strokeLinecap="round" style={dash} />
      {/* painel principal (apagado) */}
      <g transform="translate(330 150) rotate(-6)" filter="url(#de-sh)" opacity=".92">
        <Window w={230} h={170}>
          <rect x="-70" y="10" width="26" height="44" rx="5" fill="#e4dafd" />
          <rect x="-34" y="-14" width="26" height="68" rx="5" fill="#d6c8fb" />
          <rect x="2" y="-36" width="26" height="90" rx="5" fill="#cbb9f9" />
          <rect x="-90" y="60" width="160" height="8" rx="4" style={line} />
        </Window>
      </g>
      <g transform="translate(176 200) rotate(-8)" filter="url(#de-sh)" className="ill-bob-a">
        <rect x="-44" y="-42" width="88" height="84" rx="18" style={card} />
        <circle r="24" fill="#ddd2fb" />
        <path d="M0 0 L 0 -24 A24 24 0 0 1 23 7Z" fill="#a78bfa" />
      </g>
      <g transform="translate(600 140) rotate(6)" filter="url(#de-sh)" className="ill-bob-b">
        <rect x="-70" y="-50" width="140" height="100" rx="16" style={card} />
        <rect x="-56" y="-36" width="112" height="72" rx="8" style={softer} />
        <path d="M-46 22 L -22 0 L -4 12 L 22 -16 L 44 -26" fill="none" stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34 -30 L 46 -27 L 42 -15" fill="none" stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <SoftLeaf x={440} y={286} r={-20} s={0.8} />
      <SoftLeaf x={460} y={286} r={14} s={0.7} />
      <SoftLeaf x={640} y={286} r={18} s={0.9} />
      <Sparks x={414} y={96} color="#ffc233" r={-50} />
      {/* balão de dúvida */}
      <g transform="translate(470 54)" className="ill-bob-c">
        <circle r="30" style={card} filter="url(#de-sh)" />
        <path d="M-4 22 L 2 34 L 8 22Z" style={card} />
        <text x="0" y="12" textAnchor="middle" fontSize="34" fontWeight="800" fill="#8b5cf6" fontFamily="ui-sans-serif, system-ui, sans-serif">?</text>
      </g>
      <Plum x={500} y={196} scale={1.3} mood="worried" look={-0.6} idPrefix="de">
        <ellipse cx="-56" cy="26" rx="15" ry="16" fill="#6127cf" />
        <ellipse cx="-50" cy="20" rx="6" ry="4.5" fill="#8a57f2" />
        <ellipse cx="58" cy="34" rx="14" ry="17" fill="#7238e6" transform="rotate(-20 58 34)" />
      </Plum>
    </svg>
  );
}

/* ------------------------------------------------------------------ Tour guiado vazio */
export function ToursEmptyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 760 320" className={className} role="img" aria-label="A ameixa da Luumu guiando um caminho em três etapas">
      <defs>
        <Shadow id="te-sh" />
      </defs>
      <path d="M60 300 C 40 220 120 190 180 210 C 200 130 320 110 360 170 C 420 90 560 90 600 160 C 680 150 730 230 710 300Z" style={softer} />
      <ellipse cx="400" cy="296" rx="270" ry="13" style={soft} />
      {/* caminho tracejado do tour */}
      <path d="M210 176 C 260 210 270 260 320 250 C 380 240 380 200 420 196 C 470 192 470 150 520 130 C 570 110 600 140 620 180 C 640 220 670 220 690 210" fill="none" strokeWidth="2.4" strokeDasharray="6 8" strokeLinecap="round" style={dash} />
      {/* etapa 1: tela */}
      <g transform="translate(196 186) rotate(-6)" filter="url(#te-sh)" className="ill-bob-a">
        <Window w={170} h={120}>
          <rect x="-62" y="2" width="44" height="40" rx="8" style={softer} />
          <rect x="-8" y="6" width="70" height="9" rx="4.5" style={line} />
          <rect x="-8" y="24" width="50" height="9" rx="4.5" style={line} />
        </Window>
      </g>
      {/* etapa 2: mensagem */}
      <g transform="translate(606 112) rotate(5)" filter="url(#te-sh)" className="ill-bob-b">
        <rect x="-70" y="-38" width="140" height="76" rx="16" style={card} />
        <path d="M-40 36 L -48 54 L -22 37Z" style={card} />
        <rect x="-48" y="-14" width="96" height="10" rx="5" style={line} />
        <rect x="-48" y="4" width="66" height="10" rx="5" style={line} />
      </g>
      {/* etapa 3: concluído */}
      <g transform="translate(650 232) rotate(6)" filter="url(#te-sh)" className="ill-bob-c">
        <rect x="-62" y="-36" width="124" height="72" rx="16" style={card} />
        <circle cx="20" cy="2" r="20" fill="#ede6ff" />
        <path d="M10 2 L 17 9 L 30 -5" fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {[
        [138, 142, "1"],
        [548, 80, "2"],
        [598, 206, "3"],
      ].map(([x, y, n]) => (
        <g key={n as string} transform={`translate(${x} ${y})`}>
          <circle r="17" fill="#a78bfa" stroke="var(--bg-elev)" strokeWidth="4" />
          <text y="6" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff" fontFamily="ui-sans-serif, system-ui, sans-serif">
            {n}
          </text>
        </g>
      ))}
      <Star4 x={120} y={230} s={1.2} cls="ill-sparks" />
      <Star4 x={690} y={92} s={1.3} cls="ill-sparks" />
      <Star4 x={712} y={112} s={0.6} />
      <Sparks x={430} y={70} color="#a78bfa" r={30} />
      {/* ameixa correndo com a bandeira */}
      <Plum x={372} y={178} scale={1.28} mood="curious" look={1} idPrefix="te">
        <ellipse cx="-30" cy="62" rx="17" ry="10" fill="#5a22c7" transform="rotate(-20 -30 62)" />
        <ellipse cx="30" cy="58" rx="17" ry="10" fill="#5a22c7" transform="rotate(25 30 58)" />
        <ellipse cx="-62" cy="16" rx="15" ry="17" fill="#6127cf" transform="rotate(40 -62 16)" />
        <path d="M70 46 L 70 -88" stroke="#c4b0f7" strokeWidth="5" strokeLinecap="round" />
        <path d="M70 -88 L 128 -80 L 120 -58 L 128 -36 L 70 -40Z" style={card} />
        <path d="M86 -60 L 112 -72 L 100 -46 L 98 -58Z" fill="#7c3aed" />
        <ellipse cx="70" cy="20" rx="13" ry="15" fill="#7238e6" />
      </Plum>
    </svg>
  );
}

/* ------------------------------------------------------------------ Heatmap vazio */
export function HeatmapEmptyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 760 320" className={className} role="img" aria-label="A ameixa da Luumu investigando um mapa de calor com uma lupa">
      <defs>
        <Shadow id="he-sh" />
        <radialGradient id="he-hot">
          <stop offset="0" stopColor="#ff3d3d" />
          <stop offset=".3" stopColor="#ffb02e" />
          <stop offset=".6" stopColor="#ffe36a" stopOpacity=".8" />
          <stop offset=".85" stopColor="#7fb6ff" stopOpacity=".45" />
          <stop offset="1" stopColor="#7fb6ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="he-cool">
          <stop offset="0" stopColor="#8ab8ff" stopOpacity=".7" />
          <stop offset="1" stopColor="#8ab8ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M120 290 C 100 220 170 190 230 210 C 260 120 420 90 470 150 C 540 100 680 130 690 200 C 730 210 740 270 710 290Z" style={softer} />
      <ellipse cx="420" cy="294" rx="270" ry="13" style={soft} />
      <path d="M180 150 C 150 200 180 250 230 240" fill="none" strokeWidth="2.2" strokeDasharray="5 7" strokeLinecap="round" style={dash} />
      <circle cx="232" cy="180" r="12" fill="none" strokeWidth="2.2" strokeDasharray="4 5" style={dash} />
      {/* página com o mapa de calor */}
      <g transform="translate(500 150) rotate(3)" filter="url(#he-sh)">
        <Window w={300} h={210}>
          <rect x="-130" y="-48" width="80" height="20" rx="10" style={softer} />
          <ellipse cx="40" cy="-10" rx="80" ry="54" fill="url(#he-cool)" />
          <ellipse cx="44" cy="-14" rx="56" ry="40" fill="url(#he-hot)" className="ill-sparks" />
          <ellipse cx="-56" cy="32" rx="46" ry="30" fill="url(#he-hot)" opacity=".8" />
          <ellipse cx="-10" cy="10" rx="40" ry="26" fill="url(#he-cool)" />
          <rect x="30" y="66" width="62" height="18" rx="9" style={softer} />
        </Window>
        <g transform="translate(60 4) rotate(-14)">
          <path d="M0 0 L 0 30 L 8 22 L 15 36 L 21 33 L 14 20 L 25 20Z" fill="#7c3aed" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      </g>
      <g transform="translate(208 128) rotate(-12)" filter="url(#he-sh)" className="ill-bob-a">
        <rect x="-46" y="-42" width="92" height="84" rx="18" style={card} />
        <Bars x={0} y={4} />
      </g>
      <g transform="translate(700 104) rotate(10)" filter="url(#he-sh)" className="ill-bob-b">
        <rect x="-40" y="-40" width="80" height="80" rx="18" style={card} />
        <path d="M-4 -8 L -4 20 L 3 13 L 9 26 L 15 23 L 9 10 L 19 10Z" fill="#8b5cf6" />
        <g stroke="#a78bfa" strokeWidth="3" strokeLinecap="round">
          <line x1="-16" y1="-16" x2="-22" y2="-22" />
          <line x1="-4" y1="-20" x2="-4" y2="-28" />
          <line x1="-20" y1="-4" x2="-28" y2="-4" />
        </g>
      </g>
      <SoftLeaf x={366} y={280} r={-16} s={0.7} />
      <Leaf x={690} y={262} r={-70} s={0.9} className="ill-drift" />
      <Sparks x={340} y={60} color="#a78bfa" r={20} />
      {/* ameixa com a lupa */}
      <Plum x={310} y={190} scale={1.28} mood="curious" look={0.8} idPrefix="he">
        <Feet />
        <ellipse cx="-58" cy="22" rx="15" ry="18" fill="#6127cf" transform="rotate(25 -58 22)" />
        <path d="M70 34 L 100 -6" stroke="#8b5cf6" strokeWidth="10" strokeLinecap="round" />
        <circle cx="114" cy="-30" r="34" fill="color-mix(in srgb, #ede6ff 55%, transparent)" stroke="#8b5cf6" strokeWidth="9" />
        <path d="M96 -46 A24 24 0 0 1 120 -54" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="68" cy="34" rx="14" ry="16" fill="#7238e6" />
      </Plum>
    </svg>
  );
}

/* ------------------------------------------------------------------ Insights IA vazio */
export function InsightsEmptyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 760 320" className={className} role="img" aria-label="A ameixa da Luumu com uma ideia, cercada de dados a analisar">
      <defs>
        <Shadow id="ie-sh" />
      </defs>
      <path d="M80 300 C 60 220 140 180 200 200 C 220 120 360 90 400 150 C 460 80 600 100 640 170 C 700 170 740 240 710 300Z" style={softer} />
      <ellipse cx="400" cy="296" rx="270" ry="13" style={soft} />
      <circle cx="160" cy="130" r="26" fill="none" strokeWidth="2.2" strokeDasharray="4 6" style={dash} />
      <circle cx="680" cy="196" r="26" fill="none" strokeWidth="2.2" strokeDasharray="4 6" style={dash} />
      {/* conversa */}
      <g transform="translate(238 92) rotate(-2)" filter="url(#ie-sh)" className="ill-bob-a">
        <rect x="-86" y="-38" width="172" height="76" rx="16" style={card} />
        <circle cx="-48" cy="-2" r="17" fill="#c4b0f7" />
        <rect x="-20" y="-16" width="86" height="10" rx="5" style={line} />
        <rect x="-20" y="2" width="70" height="10" rx="5" style={line} />
        <rect x="-20" y="20" width="50" height="10" rx="5" style={softer} />
      </g>
      {/* gráfico */}
      <g transform="translate(206 210) rotate(-10)" filter="url(#ie-sh)" className="ill-bob-c">
        <rect x="-92" y="-42" width="184" height="84" rx="16" style={card} />
        <Bars x={-46} y={6} s={0.95} />
        <rect x="-6" y="-18" width="76" height="10" rx="5" style={line} />
        <rect x="-6" y="0" width="60" height="10" rx="5" style={line} />
        <rect x="-6" y="18" width="40" height="10" rx="5" style={softer} />
      </g>
      {/* relatório da IA */}
      <g transform="translate(590 160) rotate(8)" filter="url(#ie-sh)" className="ill-bob-b">
        <Window w={210} h={220}>
          {[
            [-40, "#ffc233"],
            [12, "#8b5cf6"],
            [64, "#a78bfa"],
          ].map(([dy, c], i) => (
            <g key={i}>
              <rect x="-80" y={(dy as number) - 14} width="30" height="30" rx="8" style={softer} />
              <circle cx="-65" cy={(dy as number) + 1} r="7" fill={c as string} />
              <rect x="-38" y={(dy as number) - 8} width="104" height="9" rx="4.5" style={line} />
              <rect x="-38" y={(dy as number) + 6} width="70" height="9" rx="4.5" style={softer} />
            </g>
          ))}
        </Window>
      </g>
      <Star4 x={470} y={58} s={1.1} color="#8b5cf6" cls="ill-sparks" />
      <Star4 x={652} y={40} s={1.2} color="#8b5cf6" />
      <Star4 x={712} y={262} s={1} color="#8b5cf6" cls="ill-sparks" />
      <Star4 x={92} y={180} s={0.8} color="#c4b0f7" />
      <Leaf x={470} y={276} r={-70} s={0.85} className="ill-drift" />
      <Leaf x={140} y={288} r={-40} s={0.75} />
      {/* ameixa com a ideia */}
      <Plum x={410} y={196} scale={1.22} mood="curious" look={0.4} idPrefix="ie">
        <Feet />
        <ellipse cx="-60" cy="20" rx="15" ry="18" fill="#6127cf" transform="rotate(25 -60 20)" />
        <ellipse cx="60" cy="20" rx="15" ry="18" fill="#7238e6" transform="rotate(-25 60 20)" />
        {/* lâmpada acima da cabeça */}
        <g transform="translate(-30 -112) scale(.85)" className="ill-sparks">
          <g stroke="#ffc233" strokeWidth="4.5" strokeLinecap="round">
            <line x1="-34" y1="-6" x2="-46" y2="-12" />
            <line x1="-24" y1="-30" x2="-32" y2="-42" />
            <line x1="0" y1="-40" x2="0" y2="-54" />
            <line x1="24" y1="-30" x2="32" y2="-42" />
            <line x1="34" y1="-6" x2="46" y2="-12" />
          </g>
        </g>
        <g transform="translate(-30 -112) scale(.85)">
          <circle r="24" fill="#8b5cf6" />
          <circle cx="-8" cy="-8" r="7" fill="#b89bfa" />
          <path d="M-8 4 L -4 -4 L 0 4 L 4 -4 L 8 4 M0 4 L 0 18" fill="none" stroke="#ede6ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="-12" y="20" width="24" height="12" rx="4" fill="#c4b0f7" />
          <rect x="-8" y="33" width="16" height="6" rx="3" fill="#a98bf3" />
        </g>
      </Plum>
    </svg>
  );
}
