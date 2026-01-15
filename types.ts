
export interface ProcessingResult {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  rawText?: string;
  numbers: string[];
  error?: string;
  previewUrl: string;
}

export interface HistoryItem {
  id: string;
  fileName: string;
  timestamp: number;
  count: number;
  data: string; // CSV content
}

export enum PrebuiltVoiceConfig {
  Kore = 'Kore',
  Puck = 'Puck'
}
