import type { Diagnostic, Severity } from '@filament-workbench/schemas';

export function diagnostic(
  severity: Severity,
  category: string,
  code: string,
  message: string,
  filePath?: string,
  extras?: Partial<Diagnostic>,
): Diagnostic {
  return {
    severity,
    category,
    code,
    message,
    filePath,
    relatedNodes: [],
    ...extras,
  };
}

export function formatDiagnosticText(d: Diagnostic): string {
  const sev = d.severity.toUpperCase().padEnd(5, ' ');
  const location = d.filePath ? ` in ${d.filePath}` : '';
  return `${sev}[${d.category}] ${d.message}${location}`;
}
