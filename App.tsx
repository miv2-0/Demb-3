
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  PlusIcon, 
  ArrowPathIcon, 
  TrashIcon, 
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { ProcessingResult, HistoryItem } from './types';
import { preprocessImage } from './services/imageProcessing';
import { performOCR, extractIndianNumbers } from './services/ocrService';

const MAX_FILES = 20;

export default function App() {
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load History
  useEffect(() => {
    const saved = localStorage.getItem('ocr_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveToHistory = (fileName: string, numbers: string[]) => {
    if (numbers.length === 0) return;

    const csvContent = "Number,Phone Number\n" + 
      numbers.map((num, idx) => `${idx + 1},${num}`).join("\n");

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      fileName: `${history.length + 1}.csv`,
      timestamp: Date.now(),
      count: numbers.length,
      data: csvContent
    };

    const newHistory = [newItem, ...history].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('ocr_history', JSON.stringify(newHistory));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Fix: Cast Array.from result to File[] to resolve 'unknown' type issues in subsequent mapping and processing
    const files = Array.from(e.target.files || []).slice(0, MAX_FILES) as File[];
    if (files.length === 0) return;

    setIsProcessing(true);
    const initialResults: ProcessingResult[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      // Fix: file.name now correctly recognized as string from File interface
      fileName: file.name,
      status: 'pending',
      progress: 0,
      numbers: [],
      // Fix: file now correctly recognized as Blob for createObjectURL
      previewUrl: URL.createObjectURL(file)
    }));

    setResults(initialResults);

    // Process each file sequentially to avoid worker crashes in browser
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const resultId = initialResults[i].id;

      try {
        // 1. Update status to processing
        setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'processing' } : r));

        // 2. Preprocess
        // Fix: file now correctly recognized as File for preprocessImage
        const processedDataUrl = await preprocessImage(file);

        // 3. OCR
        const text = await performOCR(processedDataUrl, (progress) => {
          setResults(prev => prev.map(r => r.id === resultId ? { ...r, progress: Math.round(progress * 100) } : r));
        });

        // 4. Extract Numbers
        const numbers = extractIndianNumbers(text);

        setResults(prev => prev.map(r => r.id === resultId ? { 
          ...r, 
          status: 'completed', 
          progress: 100, 
          rawText: text, 
          numbers 
        } : r));

      } catch (error: any) {
        setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'error', error: error.message } : r));
      }
    }
    setIsProcessing(false);
  };

  const downloadCSV = (numbers: string[], customName?: string) => {
    const fileName = customName || `${history.length + 1}.csv`;
    const csvContent = "Number,Phone Number\n" + 
      numbers.map((num, idx) => `${idx + 1},${num}`).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    if (!customName) saveToHistory(fileName, numbers);
  };

  const clearResults = () => {
    results.forEach(r => URL.revokeObjectURL(r.previewUrl));
    setResults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadAllCombined = () => {
    const allNumbersSet = new Set<string>();
    results.forEach(r => r.numbers.forEach(n => allNumbersSet.add(n)));
    downloadCSV(Array.from(allNumbersSet));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
          India<span className="text-orange-500">OCR</span> Number Extractor
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Upload up to 20 images to extract and normalize Indian phone numbers to 91XXXXXXXXXX.
        </p>
      </header>

      {/* Main Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div 
          className="relative group border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center hover:border-orange-500 hover:bg-orange-50 transition-all cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <PlusIcon className="w-12 h-12 text-slate-400 group-hover:text-orange-500 mb-4 transition-colors" />
          <span className="text-slate-600 font-medium group-hover:text-orange-600">Click to upload images</span>
          <span className="text-xs text-slate-400 mt-2">JPG, PNG, WEBP (Max 20 files)</span>
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={isProcessing}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center">
            <ClockIcon className="w-4 h-4 mr-2" /> Recent Files
          </h2>
          {history.length === 0 ? (
            <p className="text-slate-400 text-sm italic py-4">No recent history</p>
          ) : (
            <ul className="space-y-3">
              {history.map(item => (
                <li key={item.id} className="flex items-center justify-between text-sm group">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700">{item.fileName}</span>
                    <span className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleTimeString()} • {item.count} numbers</span>
                  </div>
                  <button 
                    onClick={() => {
                       const blob = new Blob([item.data], { type: 'text/csv' });
                       const url = URL.createObjectURL(blob);
                       const a = document.createElement('a');
                       a.href = url;
                       a.download = item.fileName;
                       a.click();
                    }}
                    className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
            <h3 className="font-bold text-slate-800">Processing Queue ({results.length})</h3>
            <div className="flex gap-2">
              <button 
                onClick={downloadAllCombined}
                disabled={isProcessing || results.every(r => r.numbers.length === 0)}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" /> Download Combined CSV
              </button>
              <button 
                onClick={clearResults}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                  <th className="px-6 py-3 w-48">Image</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Found Numbers</th>
                  <th className="px-6 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((result) => (
                  <tr key={result.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-start gap-3">
                        <img 
                          src={result.previewUrl} 
                          alt={result.fileName} 
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-sm"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-slate-700 truncate">{result.fileName}</span>
                          <span className="text-xs text-slate-400">OCR Extraction</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {result.status === 'processing' && (
                        <div className="space-y-2">
                          <div className="flex items-center text-orange-600 text-xs font-semibold animate-pulse">
                            <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" /> Processing {result.progress}%
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-orange-500 h-1.5 transition-all duration-300" 
                              style={{ width: `${result.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {result.status === 'completed' && (
                        <div className="flex items-center text-green-600 text-xs font-bold">
                          <CheckCircleIcon className="w-4 h-4 mr-1" /> Completed
                        </div>
                      )}
                      {result.status === 'error' && (
                        <div className="flex items-center text-red-600 text-xs font-bold">
                          <ExclamationCircleIcon className="w-4 h-4 mr-1" /> Error
                        </div>
                      )}
                      {result.status === 'pending' && (
                        <div className="flex items-center text-slate-400 text-xs font-semibold">
                          <ClockIcon className="w-4 h-4 mr-1" /> Waiting...
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top">
                      {result.numbers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {result.numbers.map((num, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono border border-slate-200">
                              {num}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          {result.status === 'completed' ? 'No numbers found' : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      {result.numbers.length > 0 && (
                        <button 
                          onClick={() => downloadCSV(result.numbers, result.fileName.replace(/\.[^/.]+$/, "") + ".csv")}
                          className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                          title="Download this file's CSV"
                        >
                          <ArrowDownTrayIcon className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Instructions */}
      <footer className="mt-12 text-center text-slate-400 text-xs">
        <p>Regex used: Detects 10-digit Indian numbers starting with 6-9.</p>
        <p className="mt-1">Normalizes results to 12 digits (91XXXXXXXXXX).</p>
        <p className="mt-1">Built with Tesseract.js & Tailwind. Browser-only execution.</p>
      </footer>
    </div>
  );
}
