/*
  Ícones do plugin de acessibilidade (traço 24×24, mesma linguagem do lucide usado no painel).
  Desenhados aqui para o bundle do SDK não depender de nenhuma biblioteca.
*/
const P: Record<string, string> = {
  access: '<circle cx="12" cy="4.4" r="2.1" fill="currentColor" stroke="none"/><path d="M4.6 8.7h14.8M12 8.7v5.3M12 14l-3.4 6.6M12 14l3.4 6.6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  type: '<path d="M3 18l5-12 5 12M5 14h6M17 9v8M14.5 11.5L17 9l2.5 2.5"/>',
  mask: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M3 14h18"/>',
  guide: '<path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16"/><circle cx="12" cy="12" r="2.6"/>',
  speaker: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>',
  font: '<path d="M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6"/>',
  spacing: '<path d="M3 7h18M3 12h18M3 17h18"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18z" fill="currentColor"/>',
  drop: '<path d="M12 3s6 6.4 6 11a6 6 0 01-12 0c0-4.6 6-11 6-11z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  cursor: '<path d="M5 3l14 7-6.2 2L11 18.5z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  face: '<path d="M3 7.5V5.5A2.5 2.5 0 0 1 5.5 3h2M16.5 3h2A2.5 2.5 0 0 1 21 5.5v2M21 16.5v2a2.5 2.5 0 0 1-2.5 2.5h-2M7.5 21h-2A2.5 2.5 0 0 1 3 18.5v-2"/><circle cx="12" cy="12.6" r="5.4"/><path d="M7.4 10.6c1.6-.2 2.9-1.2 3.4-2.6.9 1.1 2.6 1.8 4.4 1.6.5 0 1-.1 1.4-.3"/><path d="M10.1 12.6h.01M13.9 12.6h.01"/><path d="M10.4 14.9a2.3 2.3 0 0 0 3.2 0"/>',
  hands: '<path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  book: '<path d="M2.5 5.2c2.6-1.3 6-1.1 8.5.8v13.4c-2.5-1.9-5.9-2.1-8.5-.8z"/><path d="M21.5 5.2c-2.6-1.3-6-1.1-8.5.8v13.4c2.5-1.9 5.9-2.1 8.5-.8z"/>',
  eyeOff: '<path d="M2 12s3.6-7 10-7c2 0 3.8.7 5.2 1.7M22 12s-3.6 7-10 7c-2 0-3.8-.7-5.2-1.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/>',
  earOff: '<path d="M6 18.5a3.5 3.5 0 1 0 7 0c0-1.6.9-2.5 2.2-3.8"/><path d="M17.8 14.5c.7-1.1 1.2-2.2 1.2-3.5a7 7 0 0 0-11.4-5.5"/><path d="M6.4 7.2A7 7 0 0 0 5 11"/><path d="M2 2l20 20"/>',
  brain: '<path d="M9.5 3A3 3 0 0 0 6.5 6v.2A3 3 0 0 0 4 9.2a3 3 0 0 0 .5 5.3A3 3 0 0 0 7 19.5a3 3 0 0 0 5 .5V4.5A2.5 2.5 0 0 0 9.5 3z"/><path d="M14.5 3a3 3 0 0 1 3 3v.2A3 3 0 0 1 20 9.2a3 3 0 0 1-.5 5.3A3 3 0 0 1 17 19.5a3 3 0 0 1-5 .5"/><path d="M8.5 9.5h1.5M14 9.5h1.5M8.5 14h1.5M14 14h1.5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  sliders: '<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.4"/><circle cx="10" cy="12" r="2.4"/><circle cx="18" cy="18" r="2.4"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.6-4.6M11 8v6M8 11h6"/>',
  palette: '<path d="M12 3a9 9 0 100 18c1 0 1.6-.8 1.6-1.6 0-1.2-1-1.5-1-2.5s.8-1.5 1.8-1.5H17a4 4 0 004-4C21 6.8 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor"/><circle cx="10" cy="7" r="1.1" fill="currentColor"/><circle cx="15" cy="7.5" r="1.1" fill="currentColor"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  reset: '<path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"/><path d="M3 3v5h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.2 12.2l2.6 2.6 5-5.6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  click: '<path d="M9 9l11 4.2-5 1.8-1.8 5z"/><path d="M7.4 3.4l.7 2.5M3.4 7.4l2.5.7M4.2 4.2l1.7 1.7"/>',
  updown: '<path d="M8 3v18M4.5 6.5L8 3l3.5 3.5M16 21V3M12.5 17.5L16 21l3.5-3.5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  shrink: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>',
  skip: '<path d="M6 4.5l10 7.5-10 7.5zM18 5v14"/>',
  captions: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 10.2a2 2 0 100 3.6M17 10.2a2 2 0 100 3.6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  sparkles: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
};

export function icon(name: string, size = 22, stroke = 2): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] ?? P.info}</svg>`;
}
