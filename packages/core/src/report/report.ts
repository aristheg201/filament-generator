import type { Diagnostic } from '@filament-workbench/schemas';
import { stableStringify } from '../utils/stable-json.js';
import { formatDiagnosticText } from '../validate/diagnostics.js';

export function diagnosticsToText(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return 'No diagnostics.';
  }
  return diagnostics.map((entry) => formatDiagnosticText(entry)).join('\n');
}

export function diagnosticsToJson(diagnostics: Diagnostic[]): string {
  return stableStringify(diagnostics);
}
