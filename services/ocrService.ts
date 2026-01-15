
declare const Tesseract: any;

/**
 * Extracts Indian phone numbers from text and normalizes them.
 * Format: 91XXXXXXXXXX
 */
export const extractIndianNumbers = (text: string): string[] => {
  // Regex: Finds 10-digit patterns that look like Indian mobile numbers
  // Supports optional prefixes like 0, 91, +91 and various separators
  const regex = /(?:(?:\+91|91|0)?[ -]?)?([6-9]\d{9})\b/g;
  const matches = text.matchAll(regex);
  const results = new Set<string>();

  for (const match of matches) {
    if (match[1]) {
      // Normalize to 91 + 10 digits
      results.add(`91${match[1]}`);
    }
  }

  return Array.from(results);
};

/**
 * Processes a single image for OCR.
 */
export const performOCR = async (
  imageDataUrl: string,
  onProgress: (p: number) => void
): Promise<string> => {
  try {
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          onProgress(m.progress);
        }
      },
    });

    const { data: { text } } = await worker.recognize(imageDataUrl);
    await worker.terminate();
    return text;
  } catch (err) {
    console.error('OCR Error:', err);
    throw new Error('Failed to extract text from image');
  }
};
