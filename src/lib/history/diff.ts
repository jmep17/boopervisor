/**
 * A simple unified diff of text lines. Returns an array of diff lines showing
 * what was removed (starting with -) and what was added (starting with +).
 * Context lines (starting with space) are shown around changes, up to 3 lines.
 */
export interface DiffLine {
  type: "context" | "remove" | "add";
  text: string;
}

/**
 * Computes a line-by-line diff between before and after text.
 * Returns only the changed section with context, or an empty array if identical.
 */
export function diffText(before: string, after: string): DiffLine[] {
  if (before === after) return [];

  // Split on newlines but don't create empty trailing elements
  const beforeLines = before === "" ? [] : before.split("\n");
  const afterLines = after === "" ? [] : after.split("\n");

  // Find common prefix and suffix to narrow down the diff window
  let prefixLen = 0;
  while (
    prefixLen < beforeLines.length &&
    prefixLen < afterLines.length &&
    beforeLines[prefixLen] === afterLines[prefixLen]
  ) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < beforeLines.length - prefixLen &&
    suffixLen < afterLines.length - prefixLen &&
    beforeLines[beforeLines.length - 1 - suffixLen] ===
      afterLines[afterLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const beforeSlice = beforeLines.slice(
    prefixLen,
    beforeLines.length - suffixLen
  );
  const afterSlice = afterLines.slice(prefixLen, afterLines.length - suffixLen);

  // Simple diff: use Myers' algorithm for optimal edit distance
  const diffs = computeEditDistanceDiff(beforeSlice, afterSlice);

  // Build result with context lines
  const result: DiffLine[] = [];
  const contextSize = 3;

  // Include prefix context
  const startPrefix = Math.max(0, prefixLen - contextSize);
  for (let i = startPrefix; i < prefixLen; i++) {
    result.push({ type: "context", text: beforeLines[i] });
  }

  // Add the actual diff
  for (const diff of diffs) {
    if (diff.type === "remove") {
      result.push({ type: "remove", text: diff.text });
    } else if (diff.type === "add") {
      result.push({ type: "add", text: diff.text });
    } else {
      result.push({ type: "context", text: diff.text });
    }
  }

  // Include suffix context
  const endSuffix = Math.min(
    afterLines.length,
    afterLines.length - suffixLen + contextSize
  );
  for (let i = Math.max(afterLines.length - suffixLen, 0); i < endSuffix; i++) {
    result.push({ type: "context", text: afterLines[i] });
  }

  return result;
}

interface Edit {
  type: "add" | "remove" | "keep";
  text: string;
}

/**
 * Simple Myers-like algorithm to find the shortest edit sequence.
 * Returns a list of operations showing what was removed, kept, or added.
 */
function computeEditDistanceDiff(before: string[], after: string[]): Edit[] {
  const m = before.length;
  const n = after.length;

  // Handle edge cases
  if (m === 0) {
    return after.map((text) => ({ type: "add", text }));
  }
  if (n === 0) {
    return before.map((text) => ({ type: "remove", text }));
  }

  // Create a table for edit distances (bottom-up DP)
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (before[i - 1] === after[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j], // delete from before
            dp[i][j - 1], // insert from after
            dp[i - 1][j - 1] // replace
          );
      }
    }
  }

  // Backtrack to find the actual edits
  const result: Edit[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && before[i - 1] === after[j - 1]) {
      // Match: keep this line
      result.unshift({ type: "keep", text: before[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      // Insert from after
      result.unshift({ type: "add", text: after[j - 1] });
      j--;
    } else if (i > 0) {
      // Delete from before
      result.unshift({ type: "remove", text: before[i - 1] });
      i--;
    }
  }

  return result;
}
