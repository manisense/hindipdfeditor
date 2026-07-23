const PROTECTED_PATTERN =
  /https?:\/\/[^\s<>()]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b[\w.-]+\.(?:pdf|PDF|docx?|DOCX?|xlsx?|XLSX?|pptx?|PPTX?|txt|TXT|csv|CSV)\b|(?<=:\s)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+(?=\s+(?:sent|submitted|requested|signed|wrote|approved)\b)|\b[A-Z][A-Z0-9]*(?:[-/][A-Z0-9]+)+\b|[₹$€£]?\d[\d,]*(?:\.\d+)?(?:\/\d+){0,2}|\b[A-Z]{2,}\b/gu;

export type ProtectedText = {
  text: string;
  fragments: { token: string; value: string }[];
};

function splitTrailingPunctuation(value: string): {
  core: string;
  suffix: string;
} {
  const match = value.match(/^(.*?)([.,!?;:]+)$/u);
  return match
    ? { core: match[1] ?? value, suffix: match[2] ?? "" }
    : { core: value, suffix: "" };
}

export function protectFragments(text: string): ProtectedText {
  const fragments: ProtectedText["fragments"] = [];
  const protectedText = text.replace(PROTECTED_PATTERN, (value) => {
    const { core, suffix } = splitTrailingPunctuation(value);
    const token = `⟦P${fragments.length}⟧`;
    fragments.push({ token, value: core });
    return `${token}${suffix}`;
  });
  return { text: protectedText, fragments };
}

export function restoreFragments(
  text: string,
  fragments: ProtectedText["fragments"],
): string {
  let restored = text;
  for (const fragment of fragments) {
    const occurrences = restored.split(fragment.token).length - 1;
    if (occurrences !== 1)
      throw new Error(`protected fragment ${fragment.token} was not preserved`);
    restored = restored.replace(fragment.token, fragment.value);
  }
  if (/⟦P\d+⟧/u.test(restored))
    throw new Error("translation contained an unknown protected fragment");
  return restored;
}
