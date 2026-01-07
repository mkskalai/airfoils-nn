/**
 * Download utilities for exporting charts as PNG, SVG, and CSV
 */

/**
 * Inline critical styles into SVG elements for export
 */
function inlineStyles(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originalElements = svg.querySelectorAll('*');
  const clonedElements = clone.querySelectorAll('*');

  // Properties to inline
  const styleProperties = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
    'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity',
    'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
    'alignment-baseline'
  ];

  // Inline styles on SVG root
  const svgStyle = window.getComputedStyle(svg);
  styleProperties.forEach(prop => {
    const value = svgStyle.getPropertyValue(prop);
    if (value) {
      clone.style.setProperty(prop, value);
    }
  });

  // Inline styles on all children
  originalElements.forEach((original, i) => {
    const cloned = clonedElements[i];
    if (cloned instanceof SVGElement || cloned instanceof HTMLElement) {
      const computed = window.getComputedStyle(original);
      styleProperties.forEach(prop => {
        const value = computed.getPropertyValue(prop);
        if (value && value !== 'none' && value !== '') {
          (cloned as SVGElement).style.setProperty(prop, value);
        }
      });
    }
  });

  return clone;
}

/**
 * Generate a filename with timestamp
 */
function generateFilename(baseName: string, extension: string): string {
  const date = new Date();
  const timestamp = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${baseName}_${timestamp}.${extension}`;
}

/**
 * Download SVG as SVG file with inlined styles
 */
export function downloadSVG(svgElement: SVGSVGElement, filename: string): void {
  const styledSvg = inlineStyles(svgElement);

  // Add XML declaration and namespace
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(styledSvg);

  // Ensure proper namespace
  if (!svgString.includes('xmlns')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = generateFilename(filename, 'svg');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download SVG as PNG with white background
 */
export function downloadPNG(
  svgElement: SVGSVGElement,
  filename: string,
  scale: number = 2
): Promise<void> {
  return new Promise((resolve, reject) => {
    const styledSvg = inlineStyles(svgElement);

    // Get dimensions
    const bbox = svgElement.getBoundingClientRect();
    const width = bbox.width * scale;
    const height = bbox.height * scale;

    // Set explicit dimensions on cloned SVG
    styledSvg.setAttribute('width', String(bbox.width));
    styledSvg.setAttribute('height', String(bbox.height));

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(styledSvg);

    // Ensure proper namespace
    if (!svgString.includes('xmlns')) {
      svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          reject(new Error('Could not create PNG blob'));
          return;
        }

        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = generateFilename(filename, 'png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = url;
  });
}

/**
 * Download data as CSV file
 */
export function downloadCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns?: string[]
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Determine columns
  const cols = columns || Object.keys(data[0]);

  // Create header row
  const header = cols.join(',');

  // Create data rows
  const rows = data.map(row =>
    cols.map(col => {
      const value = row[col];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'number') {
        return Number.isInteger(value) ? value : value.toFixed(6);
      }
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(',')
  );

  const csvContent = [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = generateFilename(filename, 'csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download a 2D matrix as CSV (for correlation matrices, etc.)
 */
export function downloadMatrixCSV(
  matrix: number[][],
  rowLabels: string[],
  colLabels: string[],
  filename: string
): void {
  // Header row with column labels
  const header = ['', ...colLabels].join(',');

  // Data rows with row labels
  const rows = matrix.map((row, i) =>
    [rowLabels[i], ...row.map(v => v.toFixed(4))].join(',')
  );

  const csvContent = [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = generateFilename(filename, 'csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type DownloadFormat = 'png' | 'svg' | 'csv';

export interface DownloadOptions {
  svgRef: React.RefObject<SVGSVGElement | null>;
  filename: string;
  csvData?: () => Record<string, unknown>[];
  csvColumns?: string[];
  matrixData?: () => { matrix: number[][]; rowLabels: string[]; colLabels: string[] };
  pngScale?: number;
}

/**
 * Unified download handler
 */
export async function handleDownload(
  format: DownloadFormat,
  options: DownloadOptions
): Promise<void> {
  const { svgRef, filename, csvData, csvColumns, matrixData, pngScale = 2 } = options;

  if (format === 'csv') {
    if (matrixData) {
      const { matrix, rowLabels, colLabels } = matrixData();
      downloadMatrixCSV(matrix, rowLabels, colLabels, filename);
    } else if (csvData) {
      downloadCSV(csvData(), filename, csvColumns);
    } else {
      console.warn('No CSV data provided');
    }
    return;
  }

  const svg = svgRef.current;
  if (!svg) {
    console.warn('SVG element not found');
    return;
  }

  if (format === 'svg') {
    downloadSVG(svg, filename);
  } else if (format === 'png') {
    await downloadPNG(svg, filename, pngScale);
  }
}
