// Stopwords em português (artigos, preposições, conectivos comuns) — excluídas da nuvem
// de palavras por não carregarem tema/opinião, só estrutura da frase.
const STOPWORDS = new Set([
  "a", "à", "ao", "aos", "as", "às", "com", "como", "da", "das", "de", "dela", "delas",
  "dele", "deles", "do", "dos", "e", "é", "ela", "elas", "ele", "eles", "em", "essa",
  "essas", "esse", "esses", "esta", "está", "estamos", "estão", "estar", "estas", "este",
  "estes", "estou", "eu", "foi", "for", "foram", "fosse", "há", "isso", "isto", "já",
  "lhe", "lhes", "mais", "mas", "me", "mesmo", "meu", "meus", "minha", "minhas", "muito",
  "na", "não", "nas", "nem", "no", "nos", "nossa", "nossas", "nosso", "nossos", "num",
  "numa", "o", "os", "ou", "para", "pela", "pelas", "pelo", "pelos", "por", "pra", "que",
  "quem", "se", "sem", "ser", "seu", "seus", "só", "sua", "suas", "também", "te", "tem",
  "têm", "tenho", "ter", "teu", "teus", "tinha", "toda", "todas", "todo", "todos", "tua",
  "tuas", "um", "uma", "umas", "uns", "vai", "vou", "você", "vocês", "aqui", "ali", "lá",
  "ainda", "assim", "então", "acho", "acha", "achei", "coisa", "coisas", "tudo", "nada",
]);

export interface WordCloudItem {
  text: string;
  count: number;
  weight: number; // 0 a 1, proporcional à contagem máxima — usado pro tamanho da fonte
}

/**
 * Extrai as palavras mais frequentes de uma lista de comentários (nuvem de palavras).
 * Tokeniza por palavra, ignora stopwords e palavras muito curtas, normaliza acentuação
 * só para agrupar variações (mantém a forma mais comum para exibição).
 */
export function buildWordCloud(comments: string[], limit = 24): WordCloudItem[] {
  const counts = new Map<string, Map<string, number>>(); // chave normalizada -> (forma exibida -> contagem)

  for (const comment of comments) {
    // tokeniza mantendo acentos (\p{L} já cobre letras acentuadas em NFC, forma padrão de string JS)
    const words = comment
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ") // remove pontuação, mantém letras/números/espaço
      .split(/\s+/)
      .filter(Boolean);

    for (const normalized of words) {
      // chave sem acento, só para agrupar variações (ex: "está"/"esta") sob a mesma entrada
      const key = normalized.normalize("NFD").replace(/\p{M}/gu, "");
      if (key.length < 4 || STOPWORDS.has(key) || STOPWORDS.has(normalized)) continue;
      if (/^\d+$/.test(key)) continue; // ignora números isolados

      if (!counts.has(key)) counts.set(key, new Map());
      const forms = counts.get(key)!;
      forms.set(normalized, (forms.get(normalized) ?? 0) + 1);
    }
  }

  const items = Array.from(counts.entries()).map(([, forms]) => {
    // usa a forma (com acento) mais comum como texto de exibição
    const [display, total] = Array.from(forms.entries()).sort((a, b) => b[1] - a[1])[0];
    const totalCount = Array.from(forms.values()).reduce((s, n) => s + n, 0);
    return { text: display, count: totalCount };
  });

  items.sort((a, b) => b.count - a.count);
  const top = items.slice(0, limit);
  const maxCount = top[0]?.count ?? 1;

  return top.map((it) => ({ ...it, weight: it.count / maxCount }));
}
