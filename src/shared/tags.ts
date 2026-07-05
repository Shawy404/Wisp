// Wisp. © Shawy404, MIT.

/**
 * Deterministic keyword extraction — no AI, no network. These tags are what
 * lets the concept map suggest edges between nodes for free.
 */

const STOPWORDS = new Set(
  (
    'the a an and or of in on to for with by from at as is are was were be been this that these those it its ' +
    'we our you your they their he she his her not no but if then than so such via using used use into over ' +
    'under between among can could may might will would should has have had do does did done more most other ' +
    'which what when where who whom whose how why all any both each few some own same s t don also however ' +
    // generic title/abstract filler — these made terrible tags and junk edges
    'study studies review reviews analysis effect effects approach method methods model models based data ' +
    'new role roles system systems research paper article introduction overview guide wikipedia wiki page ' +
    'results result evidence recent current towards toward within without during through about after before ' +
    've bir bu şu o ve veya ile için gibi kadar sonra önce ancak ama fakat çünkü yani daha en çok az mi mı mu mü ' +
    'da de ki ne nasıl neden niçin hangi her hiç bazı tüm bütün olan olarak üzerine üzerinden arasında göre ' +
    'araştırma inceleme derleme etki etkiler yöntem analiz giriş nedir hakkında üzerine ilgili yeni'
  ).split(/\s+/)
)

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
}

/** Top-N keywords (unigrams + bigrams) from a blob of text. */
export function extractKeywords(text: string, limit = 5): string[] {
  const words = normalize(text)
  const counts = new Map<string, number>()
  const bump = (key: string, weight: number): void => {
    counts.set(key, (counts.get(key) ?? 0) + weight)
  }
  for (let i = 0; i < words.length; i++) {
    bump(words[i], 1)
    if (i + 1 < words.length) bump(`${words[i]} ${words[i + 1]}`, 2)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k)
}

export function tagSlug(text: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }
  return text
    .toLowerCase()
    .replace(/[çğıöşü]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Academic vs general query classification — deterministic heuristics only. */
export function classifyQuery(query: string): 'academic' | 'general' {
  const q = query.toLowerCase()
  const academicTerms =
    /\b(kineti|enzim|enzyme|protein|dna|rna|hücre|cell(ular)?|molekül|molecul|quantum|kuantum|teorem|theorem|algorithm|algoritma|neural|nöral|clinical|klinik|sendrom|syndrome|reseptör|receptor|pathway|metaboliz|geometri|integral|türev|denklem|equation|hipotez|hypothes|in vitro|in vivo|regresyon|regression|entropi|entropy|kataliz|cataly|polimer|polymer|antikor|antibod|mutasyon|mutation|genom|genome|kortex|cortex|sinaps|synap|farmakoloji|pharmacol|epidemiyol|epidemiol|biyokimya|biochem|termodinamik|thermodynam)\w*/
  const academicSuffix = /\w+(ase|osis|itis|oloji|ology|emia|ectomy|genesis|lysis)\b/
  return academicTerms.test(q) || academicSuffix.test(q) ? 'academic' : 'general'
}

/** Stable short id from a string (djb2) so re-searches don't duplicate sources. */
export function stableId(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0
  return h.toString(36)
}
