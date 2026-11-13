/**
 * Leitor mínimo de AssetBundle do Unity (formato UnityFS, arquivo serializado v17 — Unity
 * 2018.3, o que o dicionário do VLibras usa) para extrair o AnimationClip de um sinal.
 *
 * Módulo PURO: só Uint8Array/DataView, sem Node, DOM ou banco. Cobre exatamente o que os sinais
 * do VLibras usam (blocos sem compressão ou LZ4/LZ4HC, árvore de tipos embutida, little endian);
 * qualquer outra coisa gera erro em vez de um resultado errado.
 *
 * Formato (referência: UnityPy, AssetStudio):
 *   UnityFS: cabeçalho → tabela de blocos (LZ4) → blocos → nós (arquivos dentro do pacote)
 *   SerializedFile: cabeçalho → tipos (com árvore de tipos) → objetos → dados de cada objeto
 */

/* ---------------------------------------------------------------- nomes padrão do Unity 2018.3 */
// offsets → nomes da "common string" do Unity 2018.3 (árvores de tipos usam o bit alto para
// apontar aqui). Lista na ordem do buffer original: o offset de cada nome é a soma dos anteriores.
const COMMON_LIST = [
  "AABB", "AnimationClip", "AnimationCurve", "AnimationState", "Array", "Base", "BitField", "bitset",
  "bool", "char", "ColorRGBA", "Component", "data", "deque", "double", "dynamic_array",
  "FastPropertyName", "first", "float", "Font", "GameObject", "Generic Mono", "GradientNEW", "GUID",
  "GUIStyle", "int", "list", "long long", "map", "Matrix4x4f", "MdFour", "MonoBehaviour",
  "MonoScript", "m_ByteSize", "m_Curve", "m_EditorClassIdentifier", "m_EditorHideFlags", "m_Enabled", "m_ExtensionPtr", "m_GameObject",
  "m_Index", "m_IsArray", "m_IsStatic", "m_MetaFlag", "m_Name", "m_ObjectHideFlags", "m_PrefabInternal", "m_PrefabParentObject",
  "m_Script", "m_StaticEditorFlags", "m_Type", "m_Version", "Object", "pair", "PPtr<Component>", "PPtr<GameObject>",
  "PPtr<Material>", "PPtr<MonoBehaviour>", "PPtr<MonoScript>", "PPtr<Object>", "PPtr<Prefab>", "PPtr<Sprite>", "PPtr<TextAsset>", "PPtr<Texture>",
  "PPtr<Texture2D>", "PPtr<Transform>", "Prefab", "Quaternionf", "Rectf", "RectInt", "RectOffset", "second",
  "set", "short", "size", "SInt16", "SInt32", "SInt64", "SInt8", "staticvector",
  "string", "TextAsset", "TextMesh", "Texture", "Texture2D", "Transform", "TypelessData", "UInt16",
  "UInt32", "UInt64", "UInt8", "unsigned int", "unsigned long long", "unsigned short", "vector", "Vector2f",
  "Vector3f", "Vector4f", "m_ScriptingClassIdentifier", "Gradient", "Type*", "int2_storage", "int3_storage", "BoundsInt",
  "m_CorrespondingSourceObject", "m_PrefabInstance", "m_PrefabAsset",
];
const COMMON_STRINGS: Map<number, string> = (() => {
  const m = new Map<number, string>();
  let off = 0;
  for (const s of COMMON_LIST) {
    m.set(off, s);
    off += s.length + 1;
  }
  return m;
})();

/* ---------------------------------------------------------------- leitura binária */
class Reader {
  pos = 0;
  readonly view: DataView;
  constructor(readonly buf: Uint8Array, public little = false) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  need(n: number) {
    if (this.pos + n > this.buf.length) throw new Error("Arquivo de sinal truncado.");
  }
  u8() { this.need(1); return this.buf[this.pos++]; }
  i16() { this.need(2); const v = this.view.getInt16(this.pos, this.little); this.pos += 2; return v; }
  u16() { this.need(2); const v = this.view.getUint16(this.pos, this.little); this.pos += 2; return v; }
  i32() { this.need(4); const v = this.view.getInt32(this.pos, this.little); this.pos += 4; return v; }
  u32() { this.need(4); const v = this.view.getUint32(this.pos, this.little); this.pos += 4; return v; }
  i64() { this.need(8); const v = this.view.getBigInt64(this.pos, this.little); this.pos += 8; return Number(v); }
  u64() { this.need(8); const v = this.view.getBigUint64(this.pos, this.little); this.pos += 8; return Number(v); }
  f32() { this.need(4); const v = this.view.getFloat32(this.pos, this.little); this.pos += 4; return v; }
  f64() { this.need(8); const v = this.view.getFloat64(this.pos, this.little); this.pos += 8; return v; }
  bytes(n: number) { this.need(n); const v = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  cstr() {
    const end = this.buf.indexOf(0, this.pos);
    if (end < 0) throw new Error("Texto sem fim no arquivo de sinal.");
    const s = new TextDecoder().decode(this.buf.subarray(this.pos, end));
    this.pos = end + 1;
    return s;
  }
  align(n = 4) { this.pos = (this.pos + n - 1) & ~(n - 1); }
}

/** Descompressão LZ4 (bloco, sem moldura) — o que o Unity grava como LZ4 e LZ4HC. */
export function lz4Block(src: Uint8Array, outSize: number): Uint8Array {
  const out = new Uint8Array(outSize);
  let i = 0, o = 0;
  while (i < src.length) {
    const token = src[i++];
    let lit = token >> 4;
    if (lit === 15) { let b; do { b = src[i++]; lit += b; } while (b === 255); }
    out.set(src.subarray(i, i + lit), o); i += lit; o += lit;
    if (i >= src.length) break;
    const off = src[i] | (src[i + 1] << 8); i += 2;
    if (!off) throw new Error("LZ4 inválido.");
    let len = token & 15;
    if (len === 15) { let b; do { b = src[i++]; len += b; } while (b === 255); }
    len += 4;
    for (let k = 0; k < len; k++, o++) out[o] = out[o - off];
  }
  if (o !== outSize) throw new Error("LZ4: tamanho inesperado.");
  return out;
}

function decompress(data: Uint8Array, flags: number, size: number): Uint8Array {
  const kind = flags & 0x3f;
  if (kind === 0) return data;
  if (kind === 2 || kind === 3) return lz4Block(data, size);
  throw new Error(`Compressão ${kind} não suportada (só LZ4).`);
}

/* ---------------------------------------------------------------- UnityFS */
function bundleFiles(buf: Uint8Array): Uint8Array[] {
  const SIG = [85, 110, 105, 116, 121, 70, 83, 0]; // "UnityFS\0"
  if (buf.length < 8 || SIG.some((b, i) => buf[i] !== b)) throw new Error("Não é um AssetBundle UnityFS.");
  const r = new Reader(buf, false);
  r.cstr();
  const version = r.u32();
  r.cstr(); // "5.x.x"
  r.cstr(); // revisão, ex.: 2018.3.1f1
  r.i64(); // tamanho total
  const cSize = r.u32(), uSize = r.u32(), flags = r.u32();
  if (version >= 7) r.align(16);
  const infoAtEnd = (flags & 0x80) !== 0;
  const infoRaw = infoAtEnd ? buf.subarray(buf.length - cSize) : r.bytes(cSize);
  if (flags & 0x200) r.align(16);
  const info = new Reader(decompress(infoRaw, flags, uSize), false);
  info.bytes(16); // hash
  const blocks = Array.from({ length: info.i32() }, () => ({ u: info.u32(), c: info.u32(), f: info.u16() }));
  const nodes = Array.from({ length: info.i32() }, () => ({ off: info.i64(), size: info.i64(), flags: info.u32(), path: info.cstr() }));
  const total = blocks.reduce((s, b) => s + b.u, 0);
  const data = new Uint8Array(total);
  let o = 0;
  for (const b of blocks) {
    data.set(decompress(r.bytes(b.c), b.f, b.u), o);
    o += b.u;
  }
  // arquivo serializado = nó sem extensão .resS/.resource
  return nodes.filter((n) => !/\.(resS|resource)$/i.test(n.path)).map((n) => data.subarray(n.off, n.off + n.size));
}

/* ---------------------------------------------------------------- SerializedFile + árvore de tipos */
type TNode = { type: string; name: string; size: number; level: number; flags: number; children: TNode[] };

function readTypeTree(r: Reader): TNode {
  const count = r.i32(), strSize = r.i32();
  const raw = Array.from({ length: count }, () => {
    r.u16(); // version
    const level = r.u8();
    r.u8(); // typeFlags
    const t = r.u32(), n = r.u32(), size = r.i32();
    r.i32(); // index
    const flags = r.i32();
    return { t, n, size, level, flags };
  });
  const strings = r.bytes(strSize);
  const str = (off: number) => {
    if (off & 0x80000000) {
      const s = COMMON_STRINGS.get(off & 0x7fffffff);
      if (s === undefined) throw new Error(`Nome padrão do Unity desconhecido (${off & 0x7fffffff}).`);
      return s;
    }
    const end = strings.indexOf(0, off);
    return new TextDecoder().decode(strings.subarray(off, end < 0 ? undefined : end));
  };
  const nodes: TNode[] = raw.map((x) => ({ type: str(x.t), name: str(x.n), size: x.size, level: x.level, flags: x.flags, children: [] }));
  const stack: TNode[] = [];
  for (const node of nodes) {
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return nodes[0];
}

const ALIGN = 0x4000;
function readValue(r: Reader, node: TNode): unknown {
  let v: unknown;
  switch (node.type) {
    case "bool": v = r.u8() !== 0; break;
    case "SInt8": v = (r.u8() << 24) >> 24; break;
    case "UInt8": case "char": v = r.u8(); break;
    case "SInt16": case "short": v = r.i16(); break;
    case "UInt16": case "unsigned short": v = r.u16(); break;
    case "SInt32": case "int": case "Type*": v = r.i32(); break;
    case "UInt32": case "unsigned int": v = r.u32(); break;
    case "SInt64": case "long long": case "FileSize": v = r.i64(); break;
    case "UInt64": case "unsigned long long": v = r.u64(); break;
    case "float": v = r.f32(); break;
    case "double": v = r.f64(); break;
    case "string": {
      const len = r.i32();
      v = new TextDecoder().decode(r.bytes(len));
      if (node.children[0] && node.children[0].flags & ALIGN) r.align();
      break;
    }
    case "TypelessData": v = r.bytes(r.i32()); break;
    default: {
      const arr = node.children[0];
      if (arr && arr.type === "Array") {
        const n = r.i32();
        const el = arr.children[1];
        const out: unknown[] = new Array(n);
        for (let i = 0; i < n; i++) out[i] = readValue(r, el);
        if (arr.flags & ALIGN) r.align();
        v = out;
      } else {
        const o: Record<string, unknown> = {};
        for (const c of node.children) o[c.name] = readValue(r, c);
        v = o;
      }
    }
  }
  if (node.flags & ALIGN) r.align();
  return v;
}

const CLASS_ANIMATION_CLIP = 74;

/** Lê o primeiro AnimationClip de um AssetBundle do VLibras (árvore de tipos genérica). */
export function readAnimationClip(bundle: Uint8Array): Record<string, unknown> {
  for (const file of bundleFiles(bundle)) {
    const h = new Reader(file, false);
    h.u32(); // tamanho dos metadados
    h.u32(); // tamanho do arquivo
    const version = h.u32();
    const dataOffset = h.u32();
    if (version < 14 || version >= 22) throw new Error(`Versão de arquivo serializado ${version} não suportada.`);
    const little = h.u8() === 0;
    h.bytes(3);
    const r = new Reader(file, little);
    r.pos = h.pos;
    r.cstr(); // versão do Unity
    r.i32(); // plataforma
    const hasTree = r.u8() !== 0;
    if (!hasTree) throw new Error("Arquivo de sinal sem árvore de tipos.");
    const types = Array.from({ length: r.i32() }, () => {
      const classID = r.i32();
      if (version >= 16) r.u8(); // isStripped
      if (version >= 17) r.i16(); // scriptTypeIndex
      if (version >= 17 ? classID === 114 : classID < 0) r.bytes(16); // scriptID
      r.bytes(16); // oldTypeHash
      const tree = readTypeTree(r);
      if (version >= 21) r.bytes(r.i32() * 4);
      return { classID, tree };
    });
    const count = r.i32();
    for (let i = 0; i < count; i++) {
      r.align(4);
      r.i64(); // pathID
      const start = r.u32();
      r.u32(); // tamanho
      const typeIndex = r.i32();
      const t = types[typeIndex];
      if (t && t.classID === CLASS_ANIMATION_CLIP) {
        const or = new Reader(file, little);
        or.pos = dataOffset + start;
        return readValue(or, t.tree) as Record<string, unknown>;
      }
    }
  }
  throw new Error("O pacote não tem animação de sinal.");
}
