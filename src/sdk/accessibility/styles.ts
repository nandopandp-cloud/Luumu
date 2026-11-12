/*
  CSS do widget de acessibilidade, isolado no Shadow DOM.

  `:host` usa !important de propósito: propriedades HERDÁVEIS (letter-spacing, line-height,
  font-size) atravessam o Shadow DOM, e o próprio plugin muda essas propriedades na página
  (espaçamento, tamanho do texto). Sem o reset, ligar "Espaçamento" bagunçaria o painel.
  Declarações !important do :host vencem as do documento (contexto do shadow ganha no !important).
*/
import { LEGIBLE_FONT } from "./page-effects";

const Z = 2147483000;

export const WIDGET_CSS = `
:host{all:initial!important;letter-spacing:normal!important;word-spacing:normal!important;line-height:normal!important;font-size:16px!important;filter:none}
/* fora do escopo de ativação o host fica [hidden]: precisa vencer o all:initial acima */
:host([hidden]){display:none!important}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
.root{--acc:#4F46E5;--acc-ink:#fff;--acc-soft:#EEF2FF;--acc-line:#C7D2FE;--bg:#fff;--card:#fff;--fg:#0F172A;--mut:#5B6478;--line:#E2E8F0;--tile:#F1F5F9;--shadow:0 24px 64px rgba(15,23,42,.24),0 4px 12px rgba(15,23,42,.08);
  font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--fg);-webkit-font-smoothing:antialiased;text-align:left}
.root.dark{--bg:#0F172A;--card:#131D35;--fg:#F1F5F9;--mut:#A3AEC4;--line:#24314F;--tile:#1C2742}
.root{--sheet:#FBFAFF;--ink:#151435;--row-line:#E7E6F2;--sw-off:#CACEDC;--sec-peach:#FAF5EF;--peach-tile:#FCE7CF;--sec-mint:#EEF8F2;--mint-tile:#D3F0DF}
.root.dark{--sheet:#0F172A;--ink:#F1F5F9;--row-line:#24314F;--sw-off:#334155;--sec-peach:#1E1A16;--peach-tile:#3A2C1C;--sec-mint:#12211A;--mint-tile:#1C3A2B}
.root.legible{font-family:${LEGIBLE_FONT}}
button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0;margin:0;text-align:inherit}
button:focus-visible,[tabindex]:focus-visible,a:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
.sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* ---------- launcher: atalhos (bolinhas soltas) ----------
   Cores vêm do painel (launcher.colors) como variáveis --lb-* calculadas no widget. O grupo
   não tem fundo nem borda: o contêiner é transparente, mas cobre o vão entre as bolinhas para
   o mouse não perder o hover ao subir do botão principal até os atalhos. */
.launcher{position:fixed;z-index:${Z};pointer-events:none}
.lb-pill{position:relative;display:flex;flex-direction:column;align-items:center;padding:4px;border-radius:999px;pointer-events:auto}
/* no meio da tela: botão principal em cima, atalhos abaixo (como na referência) */
.launcher.mid .lb-pill{flex-direction:column-reverse}
/* os atalhos entram pela altura; somem com um atraso curto */
.lb-more{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s cubic-bezier(.16,1,.3,1) .12s}
.lb-more-in{min-height:0;overflow-x:visible;overflow-y:clip;display:flex;flex-direction:column;align-items:center;gap:14px;margin:-8px;padding:8px 8px 22px}
.launcher.mid .lb-more-in{padding:22px 8px 8px}
.launcher:hover .lb-more,.launcher:focus-within .lb-more{grid-template-rows:1fr;transition-delay:0s}
.lb-x{opacity:0;visibility:hidden;transform:scale(.7);transition:opacity .18s ease,transform .25s cubic-bezier(.16,1,.3,1),visibility 0s linear .3s}
.launcher:hover .lb-x,.launcher:focus-within .lb-x{opacity:1;visibility:visible;transform:none;transition:opacity .22s ease .06s,transform .3s cubic-bezier(.16,1,.3,1) .04s,visibility 0s}
@media (hover:none){.lb-more{display:none}}
.lb{position:relative;display:grid;place-items:center;width:60px;height:60px;border-radius:50%;flex:none;transition:transform .2s cubic-bezier(.16,1,.3,1),filter .2s,box-shadow .2s}
.lb-main{color:var(--lb-main-ink);background:linear-gradient(180deg,var(--lb-main-hi) 0%,var(--lb-main) 48%,var(--lb-main-lo) 100%);box-shadow:inset 0 0 0 2.5px var(--lb-main-ring),0 0 22px var(--lb-main-glow),0 10px 22px rgba(15,17,40,.3)}
.lb-main:hover{transform:scale(1.05);filter:brightness(1.06)}
.lb-x{width:60px;height:60px;color:var(--lb-icon);background:linear-gradient(180deg,var(--lb-btn-hi) 0%,var(--lb-btn-lo) 100%);box-shadow:inset 0 0 0 1px var(--lb-line),inset 0 1px 0 rgba(255,255,255,.12),0 10px 22px rgba(15,17,40,.3)}
.lb-x:hover{filter:brightness(1.12)}
.lb-x.on{box-shadow:inset 0 0 0 2px var(--lb-main),0 0 16px var(--lb-main-glow)}
.lb-main.on{box-shadow:inset 0 0 0 2px var(--lb-main-ring),0 0 0 4px var(--lb-main-glow),0 0 26px var(--lb-main-glow)}
.lb:focus-visible{outline:3px solid var(--lb-main-ring);outline-offset:3px}
.lb-badge{position:absolute;top:-4px;right:-4px;min-width:21px;height:21px;padding:0 5px;border-radius:11px;background:#16A34A;color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center;box-shadow:0 0 0 2px var(--lb-surface-solid)}
.launcher.left .lb-badge{right:auto;left:-4px}
/* rótulo: dica ao lado do botão em foco ou sob o mouse */
.lb-label{position:absolute;right:calc(100% + 18px);top:50%;transform:translate(6px,-50%);background:var(--lb-surface-solid);color:var(--lb-surface-ink);border:1px solid var(--lb-line);box-shadow:0 10px 24px var(--lb-shade);padding:8px 13px;border-radius:12px;font-size:14px;font-weight:700;letter-spacing:.01em;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s,transform .15s}
.launcher.left .lb-label{right:auto;left:calc(100% + 18px);transform:translate(-6px,-50%)}
.lb:hover .lb-label,.lb:focus-visible .lb-label,.launcher.labels .lb-main .lb-label{opacity:1;transform:translate(0,-50%)}
@media (max-width:520px){.lb,.lb-x{width:54px;height:54px}}

/* ---------- painel (layout de referência) ----------
   Cabeçalho escuro derivado da cor de destaque, folha clara sobreposta, seções com fundo
   próprio (Leitura lilás, Cores pêssego, Comunicação menta) e linhas brancas. */
.scrim{position:fixed;inset:0;background:rgba(15,17,40,.42);z-index:${Z + 1};opacity:0;transition:opacity .25s;pointer-events:none}
.scrim.open{opacity:1;pointer-events:auto}
.panel:focus{outline:none}
.panel{position:fixed;top:0;bottom:0;right:0;width:min(460px,100vw);background:var(--sheet);color:var(--fg);z-index:${Z + 2};display:flex;flex-direction:column;box-shadow:var(--shadow);transform:translateX(105%);transition:transform .34s cubic-bezier(.16,1,.3,1),visibility 0s .34s;visibility:hidden;overflow:hidden}
.panel.left{right:auto;left:0;transform:translateX(-105%)}
.panel.open{transform:none;visibility:visible;transition:transform .34s cubic-bezier(.16,1,.3,1)}
.p-head{position:relative;flex:none;display:flex;align-items:center;gap:18px;padding:26px 22px 52px 26px;color:#fff;background:linear-gradient(115deg,var(--head-bg) 0%,var(--head-bg) 45%,var(--head-bg2) 100%);overflow:hidden}
.p-wave{position:absolute;right:0;bottom:0;width:62%;height:100%;color:var(--acc);pointer-events:none}
.p-logo{position:relative;width:62px;height:62px;border-radius:18px;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;flex:none;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,.25)}
.p-logo img{width:100%;height:100%;object-fit:contain;background:#fff;padding:8px}
.p-hd{position:relative;min-width:0;flex:1}
.p-title{font-size:26px;font-weight:800;letter-spacing:-.01em;margin:0 0 4px;line-height:1.1;color:#fff}
.p-sub{color:rgba(255,255,255,.9);font-size:14.5px;line-height:1.4;margin:0;max-width:300px}
.p-head .x{position:absolute;top:14px;right:14px;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:#fff;border:1.5px solid rgba(255,255,255,.4);background:rgba(255,255,255,.04)}
.p-head .x:hover{background:rgba(255,255,255,.14)}
.p-head .x:focus-visible{outline:3px solid #fff;outline-offset:2px}
.p-body{position:relative;z-index:1;flex:1;overflow:auto;margin-top:-26px;padding:14px 16px 20px;background:var(--sheet);border-radius:26px 26px 0 0;overscroll-behavior:contain}
.sec{margin-top:10px;padding:12px 10px 10px;border-radius:22px}
.sec-sub{margin:-8px 0 14px 56px;color:var(--mut);font-size:13px;line-height:1.35}
.profiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.prof{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 12px 14px;border-radius:18px;border:2px solid var(--acc-line);background:var(--acc-soft);color:var(--ink);text-align:center;transition:border-color .15s,transform .15s,box-shadow .15s,background .15s}
.prof:hover{border-color:var(--acc);transform:translateY(-1px)}
.prof .pi{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--card);color:var(--acc);box-shadow:0 2px 8px rgba(20,20,60,.08);margin-bottom:2px}
.prof b{font-size:14.5px;line-height:1.25;font-weight:800}
.prof .pd{font-size:12.5px;line-height:1.35;color:var(--mut)}
.prof[aria-pressed="true"]{background:var(--card);border-color:var(--acc);box-shadow:0 0 0 4px var(--acc-soft)}
.prof[aria-pressed="true"] .pi{background:var(--acc);color:var(--acc-ink)}
.prof .ck{position:absolute;top:8px;right:8px;width:20px;height:20px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:none;place-items:center}
.prof[aria-pressed="true"] .ck{display:grid}
.sec-leitura{background:var(--sec-lav)}
.sec-visual{background:var(--sec-peach)}
.sec-comunicacao{background:var(--sec-mint)}
.sec-t{display:flex;align-items:center;gap:14px;font-size:19px;font-weight:800;letter-spacing:-.01em;color:var(--ink);margin:0 0 14px 2px}
.sec-i{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--acc-tile);color:var(--acc);flex:none}
.sec-visual .sec-i{background:var(--peach-tile);color:var(--ink)}
.sec-comunicacao .sec-i{background:var(--mint-tile);color:#0F5132}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:0 11px;padding:9px 12px 9px 9px;margin-bottom:8px;border-radius:16px;background:var(--card);border:1px solid var(--row-line);box-shadow:0 1px 2px rgba(20,20,60,.04),0 4px 14px rgba(20,20,60,.04);cursor:pointer;transition:border-color .15s,box-shadow .15s}
.row:last-child{margin-bottom:0}
.row:hover{border-color:var(--acc-line)}
.row.on{border-color:var(--acc-line);box-shadow:0 0 0 3px var(--acc-soft)}
.tile{width:40px;height:40px;border-radius:11px;background:var(--acc-tile);display:grid;place-items:center;flex:none;color:var(--ink)}
.row.on .tile{background:var(--acc);color:var(--acc-ink)}
.row-div{width:1px;align-self:stretch;margin:6px 2px;background:var(--row-line);flex:none}
.txt{flex:1;min-width:0}
.txt b{display:block;font-size:15.5px;font-weight:800;line-height:1.25;color:var(--ink)}
.txt span{display:block;color:var(--mut);font-size:12.75px;margin-top:2px;line-height:1.35}
.sw{width:46px;height:28px;border-radius:14px;background:var(--sw-off);position:relative;flex:none;transition:background .2s}
.sw::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}
.sw[aria-checked="true"]{background:var(--acc)}
.sw[aria-checked="true"]::after{transform:translateX(18px)}
.chips{display:flex;gap:6px;flex-wrap:wrap;width:100%;margin:10px 0 2px;padding-left:63px}
.chip{padding:6px 12px;border-radius:999px;border:1.5px solid var(--row-line);font-size:13px;font-weight:700;background:var(--sheet);color:var(--ink)}
.chip:hover{border-color:var(--acc-line)}
.chip[aria-checked="true"]{background:var(--acc);border-color:var(--acc);color:var(--acc-ink)}
.stepper{display:flex;align-items:center;gap:6px;flex:none}
.stepper button{width:40px;height:36px;border-radius:10px;border:1.5px solid var(--row-line);display:grid;place-items:center;font-weight:800;font-size:14px;background:var(--sheet);color:var(--ink)}
.stepper button:hover:not(:disabled){border-color:var(--acc)}
.stepper button:disabled{opacity:.35;cursor:default}
.p-foot{flex:none;display:flex;gap:12px;padding:16px 18px 10px;border-top:1px solid var(--row-line);background:var(--sheet)}
.btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 16px;border-radius:14px;font-weight:800;font-size:16px;text-align:center}
.btn.ghost{border:1.5px solid var(--row-line);background:var(--card);color:var(--ink)}
.btn.ghost:hover{border-color:var(--acc-line)}
.btn.primary{background:var(--acc);color:var(--acc-ink)}
.btn.primary:hover{filter:brightness(1.06)}
.powered{font-size:12px;color:var(--mut);text-align:center;padding:2px 0 12px;background:var(--sheet)}
.empty{color:var(--mut);font-size:14px;padding:12px 0}
@media (max-width:520px){.p-foot{gap:10px;padding:14px 14px 8px}.btn{font-size:15px;gap:8px;padding:0 10px;white-space:nowrap}.p-head{padding:22px 18px 46px 18px;gap:14px}.p-logo{width:52px;height:52px;border-radius:15px}.p-title{font-size:22px}.p-sub{font-size:13.5px}.chips{padding-left:0}}

/* ---------- aviso ---------- */
.toast{position:fixed;top:22px;left:50%;transform:translate(-50%,-16px);background:#111827;color:#fff;padding:12px 18px;border-radius:14px;font-weight:600;font-size:15px;display:flex;gap:10px;align-items:center;z-index:${Z + 9};opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;box-shadow:0 12px 32px rgba(0,0,0,.25);max-width:calc(100vw - 32px)}
.toast.show{opacity:1;transform:translate(-50%,0)}

/* ---------- máscara e régua ---------- */
.mask{position:fixed;left:0;right:0;background:rgba(15,23,42,.66);pointer-events:none;z-index:${Z - 10}}
.mask-top{top:0}
.mask-bot{bottom:0}
.guide{position:fixed;left:0;right:0;height:8px;background:var(--acc);opacity:.9;border-radius:4px;pointer-events:none;z-index:${Z - 9};box-shadow:0 0 0 2px #fff,0 6px 18px rgba(15,23,42,.35)}

/* ---------- modais (convite e navegação por rosto) ---------- */
.mwrap{position:fixed;inset:0;background:rgba(15,23,42,.5);display:grid;place-items:center;z-index:${Z + 6};padding:16px;animation:lu-fade .2s ease-out}
.modal{position:relative;background:var(--bg);color:var(--fg);border-radius:28px;max-width:540px;width:100%;padding:36px 32px 28px;box-shadow:var(--shadow);text-align:center;max-height:calc(100vh - 32px);overflow:auto;animation:lu-pop .28s cubic-bezier(.16,1,.3,1)}
.modal .x{position:absolute;top:16px;right:16px}
.m-icon{width:112px;height:112px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;margin:4px auto 20px;box-shadow:0 0 0 14px var(--acc-soft)}
.m-title{font-size:27px;font-weight:800;margin:0 0 8px;letter-spacing:-.01em;line-height:1.2}
.m-text{color:var(--mut);font-size:16.5px;margin:0 auto 22px;max-width:440px}
.steps{display:flex;flex-direction:column;gap:10px;text-align:left;margin-bottom:16px}
.step{display:flex;gap:14px;align-items:center;background:var(--acc-soft);border-radius:16px;padding:14px 16px;font-size:15.5px;line-height:1.4}
.root.dark .step{background:var(--tile)}
.step i{width:38px;height:38px;border-radius:11px;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;flex:none}
.priv{display:flex;gap:10px;align-items:flex-start;color:#15803D;font-size:14px;text-align:left;margin:0 0 22px}
.root.dark .priv{color:#4ADE80}
.m-actions{display:flex;gap:12px}
.sugg{display:flex;gap:14px;align-items:center;text-align:left;border:1.5px solid var(--acc-line);border-radius:18px;padding:14px 16px;margin:0 0 22px;background:var(--acc-soft)}
.root.dark .sugg{background:var(--tile)}
.sugg .pi{width:44px;height:44px;border-radius:12px;background:var(--bg);color:var(--acc);display:grid;place-items:center;flex:none}
.sugg small{display:block;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--acc)}
.sugg b{display:block;font-size:16px}
.sugg span{display:block;font-size:13.5px;color:var(--mut)}
.spin{width:18px;height:18px;border-radius:50%;border:2.5px solid currentColor;border-right-color:transparent;animation:lu-spin .8s linear infinite}

/* ---------- convite (medidas do layout de referência, num modal de ~1000×613) ---------- */
.mwrap:has(.nudge){background:rgba(17,19,48,.55)}
.nudge{position:relative;display:grid;grid-template-columns:clamp(220px,24vw,335px) minmax(0,1fr);column-gap:22px;align-items:start;width:min(1000px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:55px 40px 51px 36px;border-radius:28px;background:var(--n-bg);color:var(--n-ink);box-shadow:0 30px 80px rgba(15,17,40,.35);animation:lu-pop .3s cubic-bezier(.16,1,.3,1)}
.nudge.no-art{grid-template-columns:minmax(0,1fr);width:min(700px,100%);padding:56px 48px 48px}
.n-x{position:absolute;top:22px;right:22px;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:var(--n-ink)}
.n-x:hover{background:var(--acc-soft)}
.n-art img{display:block;width:100%;height:auto}
.n-body{min-width:0;padding-top:21px}
.n-title{margin:0;padding-right:28px;font-size:clamp(28px,2.7vw,40px);line-height:1.25;font-weight:800;letter-spacing:-.015em;color:var(--n-ink);text-wrap:balance}
.n-bar{display:block;width:84px;height:8px;border-radius:4px;background:#FE8916;margin:20px 0 26px}
.n-text{margin:0;font-size:clamp(17px,1.5vw,22px);line-height:1.32;color:var(--n-ink2)}
.n-text strong{font-weight:800;color:var(--n-ink)}
.nudge:focus{outline:none}
.n-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:34px}
.n-card{position:relative;min-height:108px;padding:14px 16px;border-radius:18px;background:var(--acc-soft);color:var(--acc);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;transition:transform .15s,box-shadow .15s,background .15s}
.n-card:hover{transform:translateY(-2px)}
.n-card b{font-size:clamp(14px,1.2vw,17px);line-height:1.25;font-weight:700;color:var(--n-ink)}
.n-card[aria-pressed="true"]{background:var(--n-bg);box-shadow:inset 0 0 0 2px var(--acc),0 6px 16px rgba(82,85,232,.18)}
.n-ck{position:absolute;top:8px;right:8px;width:20px;height:20px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:none;place-items:center}
.n-card[aria-pressed="true"] .n-ck{display:grid}
.n-actions{grid-column:1 / -1;display:flex;justify-content:flex-end;gap:26px;margin-top:4px}
.nudge.no-art .n-actions{margin-top:44px}
.n-btn{height:58px;border-radius:14px;font-size:clamp(17px,1.4vw,20px);font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 24px;text-align:center}
.n-btn.ghost{flex:0 1 215px;background:#fff;color:var(--n-ink);border:1.5px solid #ACAECA}
.n-btn.ghost:hover{border-color:var(--acc)}
.n-btn.primary{flex:0 1 375px;background:var(--acc);color:var(--acc-ink)}
.n-btn.primary:hover{filter:brightness(1.07)}
.root.dark .n-btn.ghost{background:transparent;border-color:var(--line)}
@media (max-width:860px){
  .nudge{grid-template-columns:minmax(0,1fr);padding:30px 22px 24px;border-radius:24px}
  .n-art{justify-self:center;width:min(170px,46%);margin-bottom:6px}
  .n-body{padding-top:0}
  .n-title{font-size:26px;padding-right:36px}
  .n-bar{margin:14px 0 16px}
  .n-text{font-size:16.5px}
  .n-cards{gap:10px;margin-top:22px}
  .n-card{min-height:92px;padding:12px 8px}
  .n-actions{flex-direction:column-reverse;gap:10px;margin-top:22px}
  .n-actions .n-btn{flex:0 0 auto;width:100%;height:52px}
  .n-card b{font-size:13.5px}
}

/* ---------- navegação por rosto ---------- */
.fn-cursor{position:fixed;left:0;top:0;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;pointer-events:none;z-index:${Z + 8};background:conic-gradient(var(--acc) calc(var(--p,0) * 1turn),rgba(255,255,255,.35) 0);box-shadow:0 0 0 3px #fff,0 4px 14px rgba(0,0,0,.35);transition:transform .12s}
.fn-cursor::after{content:"";position:absolute;inset:9px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 3px var(--acc)}
.fn-cursor.click{transform:scale(.7)}
.fn-cam{position:fixed;bottom:24px;right:96px;width:212px;border-radius:18px;overflow:hidden;background:var(--bg);box-shadow:var(--shadow);z-index:${Z + 3};animation:lu-pop .28s cubic-bezier(.16,1,.3,1)}
.fn-cam.left{right:auto;left:96px}
.fn-cam video{display:block;width:100%;height:150px;object-fit:cover;transform:scaleX(-1);background:#0F172A}
.fn-cam .fn-bar{display:flex;align-items:center;gap:6px;padding:8px 10px;font-size:13px;font-weight:700}
.fn-cam .fn-bar span{flex:1;display:flex;align-items:center;gap:6px}
.fn-cam .dot{width:8px;height:8px;border-radius:50%;background:#16A34A;box-shadow:0 0 0 3px rgba(22,163,74,.2)}
.fn-cam .fn-bar button{padding:6px 10px;border-radius:9px;background:var(--tile);font-weight:800;font-size:12.5px}

@keyframes lu-fade{from{opacity:0}}
@keyframes lu-pop{from{opacity:0;transform:translateY(10px) scale(.98)}}
@keyframes lu-spin{to{transform:rotate(360deg)}}
@media (max-width:520px){
  .chips{padding-left:0}
  .modal{padding:30px 20px 22px;border-radius:24px}
  .m-actions{flex-direction:column-reverse}
  .fn-cam{right:16px;left:auto;bottom:96px}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}}
`;
