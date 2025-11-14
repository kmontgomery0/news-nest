/**
 * Splits text into paragraphs for better message display
 */
export const splitIntoParagraphs = (text: string): string[] => {
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length === 1) {
    const singleLineBreaks = text
      .split(/\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    if (singleLineBreaks.length > 1) {
      return singleLineBreaks;
    }
  }

  if (paragraphs.length === 1 && text.length > 200) {
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 2) {
      const chunks: string[] = [];
      for (let i = 0; i < sentences.length; i += 2) {
        const chunk = sentences.slice(i, i + 2).join(' ').trim();
        if (chunk) chunks.push(chunk);
      }
      if (chunks.length > 1) {
        return chunks;
      }
    }
  }

  return paragraphs;
};

