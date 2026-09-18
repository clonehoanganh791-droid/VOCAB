import type { ParsedVocab } from './types';

const BULLET_PATTERN = /^\s*([-*•+>]|\d+\.)\s*/;

function cleanLine(line: string): string {
  let cleaned = line.trim();
  // Repeatedly strip leading bullets/symbols
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(BULLET_PATTERN, '');
  }
  return cleaned.trim();
}

// Format: "Word (Type): Meaning"
// Also handles: "Word: Meaning" (no type), "Word (Type) : Meaning"
const VOCAB_REGEX = /^(.+?)\s*\(([^)]+)\)\s*:\s*(.+)$/;

export function parseVocabText(text: string, defaultCategory: string = 'General'): ParsedVocab[] {
  const lines = text.split(/\r?\n/);
  const results: ParsedVocab[] = [];

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    const match = line.match(VOCAB_REGEX);
    if (match) {
      const word = match[1].trim();
      const type = match[2].trim();
      const meaning = match[3].trim();
      if (word && meaning) {
        results.push({ word, type, meaning, category: defaultCategory });
      }
      continue;
    }

    // Fallback: "Word: Meaning" (no type)
    const simpleMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (simpleMatch) {
      const word = simpleMatch[1].trim();
      const meaning = simpleMatch[2].trim();
      if (word && meaning && !word.includes('(')) {
        results.push({ word, type: '', meaning, category: defaultCategory });
      }
    }
  }

  return results;
}

export async function parseTxtFile(file: File, defaultCategory: string): Promise<ParsedVocab[]> {
  const text = await file.text();
  return parseVocabText(text, defaultCategory);
}

export async function parseDocxFile(file: File, defaultCategory: string): Promise<ParsedVocab[]> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return parseVocabText(result.value, defaultCategory);
}

export async function parsePdfFile(file: File, defaultCategory: string): Promise<ParsedVocab[]> {
  const pdfjs = await import('pdfjs-dist');
  // @ts-expect-error - vite handles worker URL
  pdfjs.GlobalWorkerOptions.workerSrc = await import('pdfjs-dist/build/pdf.worker.mjs?url');

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => 'str' in item ? item.str || '' : '')
      .join(' ');
    fullText += pageText + '\n';
  }

  return parseVocabText(fullText, defaultCategory);
}

export async function parseFile(file: File, defaultCategory: string): Promise<ParsedVocab[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt')) {
    return parseTxtFile(file, defaultCategory);
  }
  if (name.endsWith('.docx')) {
    return parseDocxFile(file, defaultCategory);
  }
  if (name.endsWith('.pdf')) {
    return parsePdfFile(file, defaultCategory);
  }
  // Fallback: try as text
  return parseTxtFile(file, defaultCategory);
}
