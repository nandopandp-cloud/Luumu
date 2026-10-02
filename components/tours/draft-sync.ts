"use client";

/*
  O Construtor salva o rascunho com debounce. Ações de fora dele (Publicar, Preview no
  produto) precisam do rascunho já gravado: elas chamam flushDraft(), que espera o save
  pendente terminar. Singleton de módulo — vive enquanto a aba do painel estiver aberta.
*/
let flusher: (() => Promise<void>) | null = null;

export function registerDraftFlush(fn: (() => Promise<void>) | null) {
  flusher = fn;
}

export async function flushDraft(): Promise<void> {
  if (flusher) await flusher();
}
