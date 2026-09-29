const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "do", "does", "did", "how", "what", "why", "when", "where", "who", "which",
  "can", "could", "should", "would", "will", "if", "of", "to", "in", "on", "at", "for", "with", "and", "or", "but", "not", "we", "you", "i",
  "it", "this", "that", "these", "those", "get", "gets", "got", "have", "has", "my", "our", "your", "me", "about", "tell", "explain", "give",
  "show", "please", "there", "some", "any", "so", "up", "out", "from", "by", "as", "into", "also", "while", "then", "than", "just", "handle",
  "work", "works", "happen", "happens", "mean", "means", "fix", "fixes", "problem", "problems", "issue", "issues", "solution", "solutions",
  "way", "ways", "possible", "answer", "question", "make", "use", "us", "they", "them", "their", "its", "s", "t",
  "go", "goes", "made", "stop", "stops", "avoid", "prevent", "sure", "doesnt", "dont", "isnt", "cant", "wont", "being", "does", "much", "many",
]);

const SUFFIXES = ["ing", "ed", "es", "s"];

export function stem(word) {
  if (/^\d+$/.test(word)) return word;
  let result = word;
  for (const suffix of SUFFIXES) {
    if (result.length > 4 && result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length);
      break;
    }
  }
  if (result.length > 3 && result.endsWith("e")) result = result.slice(0, -1);
  if (result.length > 3 && /(.)\1$/.test(result) && !/(ll|ss)$/.test(result)) result = result.slice(0, -1);
  return result;
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/['\u2019]/g, "")
    .replace(/\bno[- ]shows?\b/g, "noshow")
    .replace(/\bshow(s|ed)? up\b/g, "noshow")
    .replace(/\bnot show(ing)? up\b/g, "noshow");
}

export function tokenize(text) {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOPWORDS.has(word))
    .map(stem);
}

const FIELD_WEIGHT = { title: 1, alias: 0.85, text: 0.5 };
const ACCEPT_COVERAGE = 0.6;
const SECOND_MIN_SHARE = 0.25;
const JOINED_TOPICS = /\b(and|vs|versus|also|plus)\b|[,&]/i;

export function createMatcher(entries) {
  const docs = entries.map((entry) => ({
    entry,
    fields: {
      title: new Set(tokenize(entry.title)),
      alias: new Set(tokenize(entry.aliases || "")),
      text: new Set(tokenize(entry.text)),
    },
  }));
  const frequency = new Map();
  docs.forEach((doc) => {
    new Set([...doc.fields.title, ...doc.fields.alias, ...doc.fields.text]).forEach((token) => {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    });
  });
  const weightOf = (token) => Math.log(1 + docs.length / (frequency.get(token) || 1));

  const fieldWeight = (doc, token) => {
    if (doc.fields.title.has(token)) return FIELD_WEIGHT.title;
    if (doc.fields.alias.has(token)) return FIELD_WEIGHT.alias;
    if (doc.fields.text.has(token)) return FIELD_WEIGHT.text;
    return 0;
  };

  const rank = (tokens, withoutProblems = false) =>
    docs
      .filter((doc) => !(withoutProblems && doc.entry.kind === "problem"))
      .map((doc) => {
        const matched = tokens.filter((token) => fieldWeight(doc, token) > 0);
        const score = tokens.reduce((sum, token) => sum + fieldWeight(doc, token) * weightOf(token), 0);
        const adjusted = doc.entry.kind === "problem" ? score * 0.9 : score;
        return { entry: doc.entry, matched, score: adjusted };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);

  const total = (tokens) => tokens.reduce((sum, token) => sum + weightOf(token), 0);

  const related = (a, b) =>
    a.problemId === b.problemId && (a.kind === "problem" || b.kind === "problem" || a.kind === "item" || b.kind === "item");

  function search(question) {
    const tokens = [...new Set(tokenize(question))];
    if (tokens.length === 0) return [];
    const joined = JOINED_TOPICS.test(question);
    const ranked = rank(tokens, joined);
    if (ranked.length === 0) return [];
    const first = ranked[0];
    const picks = [first];
    const covered = new Set(first.matched);
    const remaining = tokens.filter((token) => !covered.has(token));
    if (joined && remaining.length > 0 && total(remaining) / total(tokens) >= SECOND_MIN_SHARE) {
      const second = rank(remaining, true).find((result) => !related(result.entry, first.entry));
      if (second && total(second.matched) / total(remaining) >= ACCEPT_COVERAGE) {
        picks.push(second);
        second.matched.forEach((token) => covered.add(token));
      }
    }
    const coverage = total([...covered]) / total(tokens);
    return coverage >= ACCEPT_COVERAGE ? picks.map((pick) => pick.entry) : [];
  }

  return { search };
}
