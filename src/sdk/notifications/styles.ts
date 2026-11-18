/*
  CSS do sino e do painel (dentro de Shadow DOM). Visual da biblioteca de notificações do Figma
  do projeto: abas em pílula, seções "Novas"/"Anteriores", não lidas em lilás, botão de ação.
  `accent` vem do painel da Luumu (cor de destaque).
*/
const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif`;

export function bellCss(accent: string, floating: boolean): string {
  return `
:host { all: initial; }
.bell { position: relative; display: inline-grid; place-items: center; cursor: pointer; border: 0; margin: 0;
  width: ${floating ? 48 : 38}px; height: ${floating ? 48 : 38}px; border-radius: ${floating ? "50%" : "10px"};
  background: ${floating ? "#fff" : "transparent"}; color: ${floating ? accent : "currentColor"};
  ${floating ? "box-shadow: 0 8px 24px rgba(20,16,50,.18), 0 0 0 1px rgba(20,16,50,.06);" : ""}
  font-family: ${FONT}; transition: background .15s ease, transform .15s ease; }
.bell:hover { background: ${floating ? "#fff" : "rgba(127,127,127,.12)"}; transform: ${floating ? "translateY(-1px)" : "none"}; }
.bell:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
.badge { position: absolute; top: ${floating ? 2 : 3}px; right: ${floating ? 2 : 2}px; min-width: 18px; height: 18px; padding: 0 5px;
  box-sizing: border-box; border-radius: 999px; background: #E5484D; color: #fff; border: 2px solid #fff;
  font: 700 10px/14px ${FONT}; text-align: center; }
`;
}

export function panelCss(accent: string): string {
  return `
:host { all: initial; }
* { box-sizing: border-box; }
.panel { position: fixed; display: flex; flex-direction: column; overflow: hidden; background: #fff; color: #191526;
  border: 1px solid #E7E4EE; border-radius: 14px; box-shadow: 0 18px 48px rgba(30,20,70,.22);
  font-family: ${FONT}; font-size: 14px; line-height: 1.45; animation: in .16s ease-out; }
@keyframes in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px; }
h2 { margin: 0; font-size: 16px; font-weight: 700; color: #191526; }
.x { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: #191526; cursor: pointer; }
.x:hover { background: #F4F3F7; }
button:focus-visible, .ntf:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
.tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin: 0 14px 12px; padding: 3px; border-radius: 10px; background: #F4F3F7; border: 1px solid #ECEAF1; }
.tabs button { border: 0; border-radius: 8px; padding: 7px 0; background: transparent; color: #55516A; font: 500 13px ${FONT}; cursor: pointer; }
.tabs button.on { background: ${accent}; color: #fff; font-weight: 600; }
.tabs b { display: inline-grid; place-items: center; min-width: 18px; height: 18px; margin-left: 4px; padding: 0 5px; border-radius: 999px; background: ${accent}; color: #fff; font-size: 11px; }
.tabs button.on b { background: #fff; color: ${accent}; }
.list { overflow-y: auto; overscroll-behavior: contain; border-top: 1px solid #EEECF3; flex: 1; }
.sec { padding: 7px 16px; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #6E6982; background: #F7F6FA; border-bottom: 1px solid #EEECF3; }
.ntf { position: relative; display: flex; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #EEECF3; }
.ntf.unread { background: color-mix(in srgb, ${accent} 8%, #fff); }
.ntf.link { cursor: pointer; }
.ntf.link:hover { background: color-mix(in srgb, ${accent} 5%, #fff); }
.ntf.unread.link:hover { background: color-mix(in srgb, ${accent} 12%, #fff); }
.ic { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; }
.nb { min-width: 0; padding-right: 10px; }
.nt { font-size: 14px; font-weight: 600; color: #191526; }
.pin { display: inline-block; margin-right: 6px; padding: 1px 6px; border-radius: 999px; background: #F4F3F7; color: #55516A; font-size: 10.5px; font-weight: 600; vertical-align: 1px; }
.nd { margin-top: 2px; font-size: 13px; color: #6E6982; overflow-wrap: anywhere; }
.cta { margin-top: 10px; padding: 7px 12px; border: 0; border-radius: 7px; background: ${accent}; color: #fff; font: 600 13px ${FONT}; cursor: pointer; }
.cta:hover { filter: brightness(.94); }
.nw { margin-top: 8px; font-size: 11.5px; color: #9A96AA; }
.dot { position: absolute; top: 18px; right: 14px; width: 7px; height: 7px; border-radius: 50%; background: #E5484D; }
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 24px 44px; color: #6E6982; }
.eic { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: color-mix(in srgb, ${accent} 12%, #fff); color: ${accent}; margin-bottom: 12px; }
.empty strong { color: #191526; font-size: 15px; }
.empty p { margin: 6px 0 0; font-size: 13px; max-width: 260px; }
footer { padding: 8px; text-align: center; font: 500 10px ${FONT}; letter-spacing: .08em; text-transform: uppercase; color: #8E88A3; border-top: 1px solid #EEECF3; }
footer strong { color: #6B2BD9; }
`;
}
