import Fuse from 'fuse.js';

interface MenuItem {
  name: string;
  price: number;
  description: string;
  category: string;
  modifiers: ModifierGroup[];
}

interface ModifierGroup {
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  multiSelect: boolean;
  options: ModifierOption[];
}

interface ModifierOption {
  name: string;
  price: number;
  isDefault: boolean;
}

interface MatchedModifier {
  groupName: string;
  optionName: string;
  optionPrice: number;
}

interface ParseOrderResult {
  success: boolean;
  match: {
    item: {
      name: string;
      price: number;
      category: string;
      description: string;
    };
    confidence: number;
    matchedModifiers: MatchedModifier[];
    remainingRequiredModifiers: {
      groupName: string;
      required: boolean;
      options: { name: string; price: number; isDefault: boolean }[];
    }[];
    calculatedPrice: number;
  } | null;
  alternativeMatches: { name: string; confidence: number; category: string }[];
  error?: string;
}

const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'with', 'and', 'please', 'i', 'want', 'can', 'get',
  'ill', "i'll", 'have', 'id', "i'd", 'like', 'of', 'some', 'one', 'make',
  'it', 'me', 'give', 'order', 'um', 'uh', 'yeah', 'yes', 'ok', 'okay',
  'so', 'just', 'also', 'do', 'you', 'to', 'for', 'my', 'on', 'in'
]);

// Cache of matchers per phone number
const matcherCache = new Map<string, FuzzyMenuMatcher>();

export class FuzzyMenuMatcher {
  private fuseIndex: Fuse<MenuItem>;
  private allItems: MenuItem[];

  constructor(menu: { categories: any[] }) {
    this.allItems = this.flattenMenu(menu);
    this.fuseIndex = new Fuse(this.allItems, {
      keys: [
        { name: 'name', weight: 0.7 },
        { name: 'description', weight: 0.3 },
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }

  static getOrCreate(phoneNumber: string, menu: { categories: any[] }): FuzzyMenuMatcher {
    let matcher = matcherCache.get(phoneNumber);
    if (!matcher) {
      matcher = new FuzzyMenuMatcher(menu);
      matcherCache.set(phoneNumber, matcher);
    }
    return matcher;
  }

  static clearCache(phoneNumber?: string): void {
    if (phoneNumber) {
      matcherCache.delete(phoneNumber);
    } else {
      matcherCache.clear();
    }
  }

  private flattenMenu(menu: { categories: any[] }): MenuItem[] {
    const items: MenuItem[] = [];
    for (const category of menu.categories) {
      for (const item of category.items) {
        items.push({
          name: item.name,
          price: item.price,
          description: item.description || '',
          category: category.name,
          modifiers: item.modifiers || [],
        });
      }
    }
    return items;
  }

  parseOrder(speech: string): ParseOrderResult {
    const tokens = this.normalizeSpeech(speech);
    if (tokens.length === 0) {
      return { success: false, match: null, alternativeMatches: [], error: 'No meaningful words found in speech' };
    }

    const cleanedSpeech = tokens.join(' ');

    // Phase 1: Try full-string match
    const fullResults = this.fuseIndex.search(cleanedSpeech);

    let bestItem: MenuItem | null = null;
    let bestScore = 1; // fuse.js: 0 = perfect, 1 = worst
    let usedTokensForItem: string[] = [];
    let allResults = fullResults;

    if (fullResults.length > 0 && (fullResults[0].score ?? 1) < 0.3) {
      // Strong full-string match
      bestItem = fullResults[0].item;
      bestScore = fullResults[0].score ?? 1;
      usedTokensForItem = tokens.slice();
    } else {
      // Phase 2: Try sub-phrases from longest to shortest
      const subPhraseMatch = this.findBestSubPhraseMatch(tokens);
      if (subPhraseMatch) {
        bestItem = subPhraseMatch.item;
        bestScore = subPhraseMatch.score;
        usedTokensForItem = subPhraseMatch.usedTokens;
        // Also collect fuse results for alternatives
        allResults = this.fuseIndex.search(subPhraseMatch.usedTokens.join(' '));
      }
    }

    if (!bestItem || bestScore > 0.5) {
      // No good match found
      const alternatives = (allResults.length > 0 ? allResults : fullResults)
        .slice(0, 3)
        .map(r => ({
          name: r.item.name,
          confidence: Math.round((1 - (r.score ?? 1)) * 100) / 100,
          category: r.item.category,
        }));

      return {
        success: false,
        match: null,
        alternativeMatches: alternatives,
        error: alternatives.length > 0 ? 'No strong match found. Did you mean one of the alternatives?' : 'No matching menu item found',
      };
    }

    const confidence = Math.round((1 - bestScore) * 100) / 100;

    // Phase 3: Match modifiers from remaining tokens
    const remainingTokens = tokens.filter(t => !usedTokensForItem.includes(t));
    const { matched: matchedModifiers, unmatchedTokens } = this.matchModifiers(remainingTokens, bestItem);

    // Phase 4: Determine remaining required modifiers
    const matchedGroupNames = new Set(matchedModifiers.map(m => m.groupName));
    const remainingRequired = bestItem.modifiers
      .filter(g => g.required && !matchedGroupNames.has(g.name))
      .map(g => ({
        groupName: g.name,
        required: g.required,
        options: g.options.map(o => ({ name: o.name, price: o.price, isDefault: o.isDefault })),
      }));

    // Calculate price
    const modifierPriceTotal = matchedModifiers.reduce((sum, m) => sum + m.optionPrice, 0);
    const calculatedPrice = Math.round((bestItem.price + modifierPriceTotal) * 100) / 100;

    // Build alternatives (other possible items)
    const alternatives = (allResults.length > 0 ? allResults : fullResults)
      .filter(r => r.item.name !== bestItem!.name)
      .slice(0, 3)
      .map(r => ({
        name: r.item.name,
        confidence: Math.round((1 - (r.score ?? 1)) * 100) / 100,
        category: r.item.category,
      }));

    return {
      success: true,
      match: {
        item: {
          name: bestItem.name,
          price: bestItem.price,
          category: bestItem.category,
          description: bestItem.description,
        },
        confidence,
        matchedModifiers,
        remainingRequiredModifiers: remainingRequired,
        calculatedPrice,
      },
      alternativeMatches: alternatives,
    };
  }

  private normalizeSpeech(speech: string): string[] {
    const cleaned = speech
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned.split(' ').filter(word => !FILLER_WORDS.has(word) && word.length > 0);
  }

  private findBestSubPhraseMatch(tokens: string[]): { item: MenuItem; score: number; usedTokens: string[] } | null {
    let best: { item: MenuItem; score: number; usedTokens: string[] } | null = null;

    // Try contiguous sub-phrases from longest to shortest
    for (let len = tokens.length; len >= 1; len--) {
      for (let start = 0; start <= tokens.length - len; start++) {
        const subTokens = tokens.slice(start, start + len);
        const subPhrase = subTokens.join(' ');
        const results = this.fuseIndex.search(subPhrase);

        if (results.length > 0) {
          const score = results[0].score ?? 1;
          // Reward longer sub-phrases: subtract a small bonus per token used
          const adjustedScore = score - (len * 0.02);

          if (!best || adjustedScore < best.score) {
            best = {
              item: results[0].item,
              score: Math.max(0, adjustedScore),
              usedTokens: subTokens,
            };
          }
        }
      }

      // If we found a good match at this length, don't bother with shorter phrases
      if (best && best.score < 0.3) break;
    }

    return best;
  }

  private matchModifiers(remainingTokens: string[], item: MenuItem): { matched: MatchedModifier[]; unmatchedTokens: string[] } {
    const matched: MatchedModifier[] = [];
    const usedTokenIndices = new Set<number>();

    if (remainingTokens.length === 0 || item.modifiers.length === 0) {
      return { matched, unmatchedTokens: remainingTokens };
    }

    // Build a flat list of all modifier options for this item
    const allOptions: { group: ModifierGroup; option: ModifierOption; normalizedName: string; nameTokens: string[] }[] = [];
    for (const group of item.modifiers) {
      for (const option of group.options) {
        const normalized = option.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        allOptions.push({
          group,
          option,
          normalizedName: normalized,
          nameTokens: normalized.split(/\s+/),
        });
      }
    }

    // Try multi-token modifier matches first (longest first)
    for (let len = Math.min(remainingTokens.length, 4); len >= 1; len--) {
      for (let start = 0; start <= remainingTokens.length - len; start++) {
        // Skip if any of these tokens are already used
        const indices = Array.from({ length: len }, (_, i) => start + i);
        if (indices.some(i => usedTokenIndices.has(i))) continue;

        const candidateTokens = indices.map(i => remainingTokens[i]);
        const candidate = candidateTokens.join(' ');
        // Also try without spaces for compound words like "oatmilk" vs "oat milk"
        const candidateNoSpaces = candidateTokens.join('');

        for (const opt of allOptions) {
          const optNoSpaces = opt.normalizedName.replace(/\s+/g, '');

          // Check: exact match, compound match, or fuzzy match
          if (
            candidate === opt.normalizedName ||
            candidateNoSpaces === optNoSpaces ||
            this.fuzzyWordMatch(candidate, opt.normalizedName) ||
            this.fuzzyWordMatch(candidateNoSpaces, optNoSpaces)
          ) {
            // Check if this group already has a matched option (skip if single-select and already matched)
            const alreadyMatchedInGroup = matched.some(m => m.groupName === opt.group.name);
            if (alreadyMatchedInGroup && !opt.group.multiSelect) continue;

            matched.push({
              groupName: opt.group.name,
              optionName: opt.option.name,
              optionPrice: opt.option.price,
            });
            indices.forEach(i => usedTokenIndices.add(i));
            break;
          }
        }
      }
    }

    const unmatchedTokens = remainingTokens.filter((_, i) => !usedTokenIndices.has(i));
    return { matched, unmatchedTokens };
  }

  private fuzzyWordMatch(a: string, b: string): boolean {
    if (a === b) return true;
    const distance = this.levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen <= 3) return distance <= 0;
    if (maxLen <= 5) return distance <= 1;
    if (maxLen <= 8) return distance <= 2;
    return distance <= 3;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }
}
