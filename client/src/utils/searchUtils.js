// High-performance ambiguity-resilient fuzzy search and ranking utility
export function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[-_./,\+&]/g, ' ')       // treat punctuation as separators
    .replace(/\s+/g, ' ')
    .trim();
}

export function compact(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function scoreMatch(targetStr, queryStr) {
  if (!targetStr || !queryStr) return 0;
  
  const rawTarget = String(targetStr).toLowerCase();
  const rawQuery = String(queryStr).toLowerCase();
  
  // 1. Exact string match
  if (rawTarget === rawQuery) return 1000;
  
  // 2. Starts with query
  if (rawTarget.startsWith(rawQuery)) return 700;
  
  const normTarget = normalize(targetStr);
  const normQuery = normalize(queryStr);
  
  // 3. Normalized exact match (e.g. "we-do" matches "we do")
  if (normTarget === normQuery) return 900;
  
  // 4. Normalized starts with
  if (normTarget.startsWith(normQuery)) return 600;
  
  const compTarget = compact(targetStr);
  const compQuery = compact(queryStr);
  
  // 5. Compact match (e.g. "wedo" in "we-do")
  if (compTarget === compQuery) return 850;
  if (compTarget.startsWith(compQuery)) return 550;
  if (compTarget.includes(compQuery)) return 450;
  
  // 6. Substring match
  if (normTarget.includes(normQuery)) return 400;
  if (rawTarget.includes(rawQuery)) return 350;
  
  // 7. Multi-word token matching
  const queryTokens = normQuery.split(' ').filter(t => t.length > 0);
  const targetTokens = normTarget.split(' ').filter(t => t.length > 0);
  
  if (queryTokens.length > 1) {
    let matchedTokens = 0;
    for (const qTok of queryTokens) {
      const match = targetTokens.some(tTok => 
        tTok === qTok || 
        tTok.startsWith(qTok) || 
        (qTok.length >= 4 && levenshtein(tTok, qTok) <= 1)
      );
      if (match) matchedTokens++;
    }
    if (matchedTokens === queryTokens.length) {
      return 300 + (matchedTokens * 25);
    }
    if (matchedTokens > 0) {
      return 80 + (matchedTokens * 15);
    }
  } else if (queryTokens.length === 1) {
    const singleQ = queryTokens[0];
    for (const tTok of targetTokens) {
      if (tTok === singleQ) return 500;
      if (tTok.startsWith(singleQ)) return 300;
      if (singleQ.length >= 4 && levenshtein(tTok, singleQ) <= 1) return 150;
    }
  }
  
  return 0;
}

export function smartSearch(items, query, getSearchableFields = (item) => [item.item_name || item.name || '', item.model || '', item.type || '']) {
  if (!items || !Array.isArray(items)) return [];
  if (!query || !query.trim()) return items;
  
  const q = query.trim();
  const scored = [];
  
  for (const item of items) {
    const fields = getSearchableFields(item);
    let maxScore = 0;
    
    // Primary field (usually item name) gets higher weighting (1.5x)
    const primary = fields[0] || '';
    const primaryScore = scoreMatch(primary, q) * 1.5;
    maxScore = Math.max(maxScore, primaryScore);
    
    for (let i = 1; i < fields.length; i++) {
      const s = scoreMatch(fields[i] || '', q);
      maxScore = Math.max(maxScore, s);
    }
    
    if (maxScore > 0) {
      scored.push({ item, score: maxScore });
    }
  }
  
  // Sort descending: best matches bubble to the top
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.item);
}
