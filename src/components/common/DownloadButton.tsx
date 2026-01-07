import { useState, useRef, useEffect } from 'react';
import { handleDownload } from '../../utils/download';
import type { DownloadFormat, DownloadOptions } from '../../utils/download';

interface DownloadButtonProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  filename: string;
  csvData?: () => Record<string, unknown>[];
  csvColumns?: string[];
  matrixData?: () => { matrix: number[][]; rowLabels: string[]; colLabels: string[] };
  formats?: DownloadFormat[];
  pngScale?: number;
  className?: string;
}

export function DownloadButton({
  svgRef,
  filename,
  csvData,
  csvColumns,
  matrixData,
  formats = ['png', 'svg'],
  pngScale = 2,
  className = '',
}: DownloadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleDownloadClick = async (format: DownloadFormat) => {
    setIsDownloading(true);
    try {
      const options: DownloadOptions = {
        svgRef,
        filename,
        csvData,
        csvColumns,
        matrixData,
        pngScale,
      };
      await handleDownload(format, options);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
      setIsOpen(false);
    }
  };

  const formatLabels: Record<DownloadFormat, string> = {
    png: 'PNG Image',
    svg: 'SVG Vector',
    csv: 'CSV Data',
  };

  // If only one format, render a simple button
  if (formats.length === 1) {
    return (
      <button
        onClick={() => handleDownloadClick(formats[0])}
        disabled={isDownloading}
        className={`p-1.5 rounded hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-700 disabled:opacity-50 ${className}`}
        title={`Download as ${formatLabels[formats[0]]}`}
        aria-label={`Download as ${formatLabels[formats[0]]}`}
      >
        <DownloadIcon />
      </button>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDownloading}
        className="p-1.5 rounded hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-700 disabled:opacity-50"
        title="Download chart"
        aria-label="Download chart"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <DownloadIcon />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[140px]"
          role="menu"
        >
          {formats.map((format) => (
            <button
              key={format}
              onClick={() => handleDownloadClick(format)}
              disabled={isDownloading}
              className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 flex items-center gap-2"
              role="menuitem"
            >
              <FormatIcon format={format} />
              {formatLabels[format]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v8M4 7l4 4 4-4M2 12v2h12v-2" />
    </svg>
  );
}

function FormatIcon({ format }: { format: DownloadFormat }) {
  const iconClass = "w-4 h-4";

  if (format === 'png' || format === 'svg') {
    return (
      <svg className={iconClass} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="12" height="12" rx="1" />
        <circle cx="5.5" cy="5.5" r="1.5" />
        <path d="M14 10l-3-3-4 4-2-2-3 3" />
      </svg>
    );
  }

  // CSV icon
  return (
    <svg className={iconClass} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M4 8h8M4 11h8M4 5h4" />
    </svg>
  );
}
