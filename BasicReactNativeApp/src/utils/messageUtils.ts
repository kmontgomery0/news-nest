/**
 * Splits text into chunks for progressive display
 * Returns initial chunk and remaining text
 */
export const getInitialChunk = (text: string): {initial: string; remaining: string} => {
  // Split by sentences first
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  // For initial response, show first 1-2 sentences (or ~150 chars max)
  const targetLength = 150;
  let initial = '';
  let remaining = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const candidate = initial + sentences[i];
    if (candidate.length <= targetLength && i < 2) {
      initial = candidate;
    } else {
      remaining = sentences.slice(i).join(' ');
      break;
    }
  }
  
  // If no split occurred, split by length
  if (!remaining && text.length > targetLength) {
    const splitPoint = text.lastIndexOf('. ', targetLength) || 
                       text.lastIndexOf(' ', targetLength) ||
                       targetLength;
    initial = text.substring(0, splitPoint);
    remaining = text.substring(splitPoint + 1);
  } else if (!remaining) {
    initial = text;
  }
  
  return {
    initial: initial.trim(),
    remaining: remaining.trim(),
  };
};

/**
 * Splits remaining text into progressive chunks (one sentence at a time)
 */
export const getNextChunk = (text: string): {chunk: string; remaining: string} => {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  if (sentences.length === 0) {
    return {chunk: '', remaining: ''};
  }
  
  const chunk = sentences[0];
  const remaining = sentences.slice(1).join(' ');
  
  return {
    chunk: chunk.trim(),
    remaining: remaining.trim(),
  };
};

/**
 * Splits text into multiple message chunks for progressive revelation
 * Each chunk becomes a separate message bubble
 */
export const splitIntoMessageChunks = (text: string): string[] => {
  const chunks: string[] = [];
  
  // First, try splitting by double newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
  
  if (paragraphs.length > 1) {
    // Multiple paragraphs - use them as chunks
    return paragraphs;
  }
  
  // If single paragraph or no paragraph breaks, split by sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  if (sentences.length <= 2) {
    // Short text - single chunk
    return [text.trim()];
  }
  
  // Group sentences into chunks (1-2 sentences per chunk)
  let currentChunk = '';
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const candidate = currentChunk ? currentChunk + ' ' + sentence : sentence;
    
    // Limit chunk size to ~100-150 chars or 2 sentences max
    if (candidate.length > 150 || (currentChunk && i % 2 === 0 && i > 0)) {
      // Save current chunk and start new one
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk = candidate;
    }
  }
  
  // Add remaining chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text.trim()];
};
