/*
  A ameixa da Luumu em flat com profundidade (mesmo desenho da animação de entrada):
  cores chapadas, um tom mais escuro de um lado, brilho sólido. Usada dentro das ilustrações
  (coordenadas locais: centro do corpo em 0,0, raio 62).
*/
export type PlumMood = "curious" | "worried";

export function Plum({
  x,
  y,
  scale = 1,
  mood = "curious",
  look = 0,
  idPrefix,
  children,
}: {
  x: number;
  y: number;
  scale?: number;
  mood?: PlumMood;
  look?: number;
  idPrefix: string;
  /** braços e objetos na mão, em coordenadas da ameixa (flutuam junto) */
  children?: React.ReactNode;
}) {
  const clip = `${idPrefix}-body`;
  const px = look * 3.5;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <defs>
        <clipPath id={clip}>
          <circle r="62" />
        </clipPath>
      </defs>
      <g className="ill-float">
        <circle r="62" fill="#6a2fe0" />
        <circle cx="-9" cy="-10" r="58" fill="#7f45f2" clipPath={`url(#${clip})`} />
        <ellipse cx="-30" cy="-30" rx="13" ry="7.5" fill="#a47cff" transform="rotate(-38 -30 -30)" />
        <circle cx="-43" cy="-14" r="3.6" fill="#a47cff" />
        <path d="M-9 -60 Q0 -54 9 -60" stroke="#5422b8" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* caule e folhas (balançam de leve) */}
        <path d="M1 -57 C 1 -66 4 -72 9 -78" stroke="#8a3b34" strokeWidth="6" strokeLinecap="round" fill="none" />
        <g transform="translate(2 -58) scale(1.18) translate(-2 58)">
          <g className="ill-leaf-l">
            <path d="M-2 -60 C -14 -82 -44 -90 -64 -76 C -48 -58 -22 -50 -2 -60Z" fill="#7fd34e" />
            <path d="M-2 -60 C -22 -64 -42 -70 -64 -76 C -48 -58 -22 -50 -2 -60Z" fill="#4cae3c" />
          </g>
          <g className="ill-leaf-r">
            <path d="M5 -62 C 16 -94 52 -104 72 -88 C 60 -64 30 -54 5 -62Z" fill="#8ad95a" />
            <path d="M5 -62 C 28 -70 50 -78 72 -88 C 60 -64 30 -54 5 -62Z" fill="#52b541" />
          </g>
        </g>
        {/* rosto */}
        <ellipse cx="-38" cy="18" rx="11" ry="6.5" fill="#ff8dbd" />
        <ellipse cx="38" cy="18" rx="11" ry="6.5" fill="#ff8dbd" />
        <ellipse cx="-22" cy="-2" rx="12.5" ry="14" fill="#fff" />
        <ellipse cx="22" cy="-2" rx="12.5" ry="14" fill="#fff" />
        <g className="ill-pupils">
          <circle cx={-21 + px} cy="1" r="9" fill="#1c1033" />
          <circle cx={23 + px} cy="1" r="9" fill="#1c1033" />
          <circle cx={-17.5 + px} cy="-3" r="3.2" fill="#fff" />
          <circle cx={26.5 + px} cy="-3" r="3.2" fill="#fff" />
        </g>
        {mood === "curious" ? (
          <>
            {/* uma sobrancelha erguida: curiosa */}
            <path d="M-33 -24 Q -24 -30 -13 -26" stroke="#1c1033" strokeWidth="4.2" fill="none" strokeLinecap="round" />
            <path d="M12 -30 Q 22 -38 32 -32" stroke="#1c1033" strokeWidth="4.2" fill="none" strokeLinecap="round" />
            <path d="M-12 14 Q 0 34 12 14 Q 0 17 -12 14Z" fill="#2a0f4a" />
            <path d="M-7 25 Q 0 31 7 25 Q 0 21 -7 25Z" fill="#ff5d8f" />
          </>
        ) : (
          <>
            {/* sobrancelhas erguidas no meio + boca para baixo: preocupada */}
            <path d="M-34 -22 Q -24 -24 -14 -32" stroke="#1c1033" strokeWidth="4.2" fill="none" strokeLinecap="round" />
            <path d="M14 -32 Q 24 -24 34 -22" stroke="#1c1033" strokeWidth="4.2" fill="none" strokeLinecap="round" />
            <path d="M-10 26 Q 0 16 10 26" stroke="#2a0f4a" strokeWidth="4.6" fill="none" strokeLinecap="round" />
          </>
        )}
        {children}
      </g>
    </g>
  );
}
