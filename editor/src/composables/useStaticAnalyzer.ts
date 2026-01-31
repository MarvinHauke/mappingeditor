import { ref, computed, type Ref } from 'vue';
import {
  EMPTY_KEY,
  VAR_SOURCE_TYPE_KEY,
  CALC_SOURCE_TYPE_KEY,
  SKIP_SOURCE_TYPE_KEY,
  SETVAR_DESTINATION_TYPE_KEY,
  SKIP_DESTINATION_TYPE_KEY
} from '../modules/dataModel';

/**
 * Interfaces for reactive document structure (Vue unwraps class instances)
 */
interface TypeLike {
  key: number;
  abbr: string;
  description: string;
}

interface ExtraLike {
  keyOrValue: number;
  abbr: string;
  description: string;
}

interface SourceLike {
  type: TypeLike;
  function: TypeLike;
  extra: ExtraLike;
}

interface DestinationLike {
  type: TypeLike;
  function: TypeLike;
  extra: ExtraLike;
}

interface RowLike {
  index: number;
  source: SourceLike;
  destination: DestinationLike;
  channel: number;
  minValue: number;
  maxValue: number;
  offset: number;
}

interface MappingDocumentLike {
  rows: RowLike[];
}

/**
 * Warning severity levels
 */
export type WarningSeverity = 'error' | 'warning' | 'info';

/**
 * Warning types that the analyzer can detect
 */
export type WarningType =
  | 'variable-read-before-write'
  | 'skip-always-true'
  | 'skip-always-false'
  | 'unreachable-rows'
  | 'unused-variable'
  | 'destination-conflict'
  | 'out-of-range-value';

/**
 * A warning detected by the static analyzer
 */
export interface AnalyzerWarning {
  type: WarningType;
  severity: WarningSeverity;
  rowIndex: number;
  message: string;
  details?: string;
  relatedRows?: number[];
}

/**
 * Maps row index to warnings for that row
 */
export type RowWarningsMap = Map<number, AnalyzerWarning[]>;

/**
 * Variable names (A-P)
 */
const VARIABLE_NAMES = 'ABCDEFGHIJKLMNOP'.split('');

/**
 * Format row index based on hex/decimal preference
 */
function formatRowIndex(index: number, asHex: boolean): string {
  if (asHex) {
    return index.toString(16).toUpperCase().padStart(2, '0');
  }
  return index.toString();
}

/**
 * Extract variable index (0-15) from Calc/Skip extra byte
 * Returns -1 if not a variable reference
 */
function getVariableIndexFromCalcSkipByte(byte: number): number {
  // Variables are encoded as 10-25 (10=A, 11=B, ..., 25=P)
  if (byte >= 10 && byte <= 25) {
    return byte - 10;
  }
  return -1;
}

/**
 * Check if a Calc/Skip extra byte is a constant (0-9)
 */
function isConstant(byte: number): boolean {
  return byte >= 0 && byte <= 9;
}

/**
 * Get the constant value from a Calc/Skip extra byte
 */
function getConstantValue(byte: number): number {
  if (isConstant(byte)) {
    return byte;
  }
  return -1;
}

/**
 * Check if row has Skip source type
 */
function isSkipSource(row: RowLike): boolean {
  return row.source.type.key === SKIP_SOURCE_TYPE_KEY;
}

/**
 * Check if row is empty (no source or destination type)
 */
function isEmptyRow(row: RowLike): boolean {
  return row.source.type.key === EMPTY_KEY && row.destination.type.key === EMPTY_KEY;
}

/**
 * Get variable index from Variable source function (returns 0-15 for A-P)
 */
function getVariableIndexFromVariableSource(row: RowLike): number {
  if (row.source.type.key !== VAR_SOURCE_TYPE_KEY) {
    return -1;
  }
  // Variable source function key is the variable index (0-15 for A-P)
  const varIndex = row.source.function.key;
  if (varIndex >= 0 && varIndex <= 15) {
    return varIndex;
  }
  return -1;
}

/**
 * Get variable index from SetVar destination (returns 0-15 for A-P)
 */
function getVariableIndexFromSetVarDest(row: RowLike): number {
  if (row.destination.type.key !== SETVAR_DESTINATION_TYPE_KEY) {
    return -1;
  }
  // SetVar destination function key is the variable index (0-15)
  const varIndex = row.destination.function.key;
  if (varIndex >= 0 && varIndex <= 15) {
    return varIndex;
  }
  return -1;
}

// Note: RandomRange destination does NOT write to variables directly.
// Its function keys 0-15 represent "Range 0-15", not Variables A-P.

/**
 * Get all variable indices read by a row (from source and Calc/Skip params)
 */
function getVariablesReadByRow(row: RowLike): number[] {
  const variables: number[] = [];

  // Check Variable source type
  const varSourceIdx = getVariableIndexFromVariableSource(row);
  if (varSourceIdx !== -1) {
    variables.push(varSourceIdx);
  }

  // Check Calc/Skip source extra for variable references
  if (row.source.type.key === CALC_SOURCE_TYPE_KEY || row.source.type.key === SKIP_SOURCE_TYPE_KEY) {
    const extraValue = row.source.extra.keyOrValue;
    const byte1 = (extraValue >> 8) & 0xFF;
    const byte2 = extraValue & 0xFF;

    const var1 = getVariableIndexFromCalcSkipByte(byte1);
    const var2 = getVariableIndexFromCalcSkipByte(byte2);

    if (var1 !== -1) variables.push(var1);
    if (var2 !== -1) variables.push(var2);
  }

  return [...new Set(variables)]; // Remove duplicates
}

/**
 * Get the variable index written by a row (from SetVar destination)
 */
function getVariableWrittenByRow(row: RowLike): number {
  return getVariableIndexFromSetVarDest(row);
}

/**
 * Get destination key for conflict detection
 * Returns a string like "CV:1" or "MIDI_CC:7:1" or null if not applicable
 */
function getDestinationKey(row: RowLike): string | null {
  if (row.destination.type.key === EMPTY_KEY) {
    return null;
  }

  // Skip type destinations don't write to outputs
  if (row.destination.type.key === SKIP_DESTINATION_TYPE_KEY) {
    return null;
  }

  // Create a unique key for the destination
  const typeKey = row.destination.type.key;
  const funcKey = row.destination.function.key;
  const extraKey = row.destination.extra.keyOrValue;

  // For most destinations, type + function + extra uniquely identifies the output
  return `${typeKey}:${funcKey}:${extraKey}`;
}

/**
 * Analyze Skip condition to check if it's always true or always false
 */
function analyzeSkipCondition(row: RowLike): { alwaysTrue: boolean; alwaysFalse: boolean } {
  if (row.source.type.key !== SKIP_SOURCE_TYPE_KEY) {
    return { alwaysTrue: false, alwaysFalse: false };
  }

  const extraValue = row.source.extra.keyOrValue;
  const byte1 = (extraValue >> 8) & 0xFF;
  const byte2 = extraValue & 0xFF;

  // Only analyze if both are constants
  if (!isConstant(byte1) || !isConstant(byte2)) {
    return { alwaysTrue: false, alwaysFalse: false };
  }

  const val1 = getConstantValue(byte1);
  const val2 = getConstantValue(byte2);

  // Get condition from function key
  // function_key = (skip_count - 1) * 6 + condition
  const funcKey = row.source.function.key;
  if (funcKey === EMPTY_KEY) {
    return { alwaysTrue: false, alwaysFalse: false };
  }

  const condition = funcKey % 6;

  // Evaluate the condition
  let result: boolean;
  switch (condition) {
    case 0: result = val1 < val2; break;   // <
    case 1: result = val1 <= val2; break;  // <=
    case 2: result = val1 > val2; break;   // >
    case 3: result = val1 >= val2; break;  // >=
    case 4: result = val1 === val2; break; // =
    case 5: result = val1 !== val2; break; // <>
    default: return { alwaysTrue: false, alwaysFalse: false };
  }

  return { alwaysTrue: result, alwaysFalse: !result };
}

/**
 * Get the number of rows to skip from a Skip source function
 */
function getSkipCount(row: RowLike): number {
  if (row.source.type.key !== SKIP_SOURCE_TYPE_KEY) {
    return 0;
  }

  const funcKey = row.source.function.key;
  if (funcKey === EMPTY_KEY) {
    return 0;
  }

  // function_key = (skip_count - 1) * 6 + condition
  return Math.floor(funcKey / 6) + 1;
}

/**
 * Composable for static analysis of mapping logic.
 *
 * Automatically analyzes mapping rows to detect potential issues:
 * - **Variable Read Before Write**: Variable used before being set
 * - **Unused Variables**: Variable set but never read
 * - **Destination Conflicts**: Multiple rows writing to the same destination
 * - **Skip Always True/False**: Skip conditions that never change
 * - **Unreachable Rows**: Rows after unconditional skips
 *
 * Analysis is performed on-demand via `analyzeDocument()` and results
 * are cached until the next analysis run.
 *
 * @example
 * ```typescript
 * const {
 *   warnings,
 *   warningCount,
 *   analyzeDocument,
 *   getRowWarnings,
 *   rowHasWarnings
 * } = useStaticAnalyzer(mappingDocument);
 *
 * // Run analysis
 * analyzeDocument();
 *
 * // Check results
 * console.log('Total warnings:', warningCount.value);
 *
 * // Get warnings for specific row
 * const row5Warnings = getRowWarnings(5);
 * row5Warnings.forEach(w => {
 *   console.log(`[${w.severity}] ${w.message}`);
 * });
 *
 * // Check if row has warnings (for UI badges)
 * if (rowHasWarnings(5)) {
 *   // Show warning indicator
 * }
 * ```
 *
 * @param mappingDocument - Ref to the mapping document to analyze
 * @param displayRowIndexAsHex - Ref to hex/decimal display preference
 * @returns Static analyzer API with warnings state and analysis methods
 */
export function useStaticAnalyzer(
  mappingDocument: Ref<MappingDocumentLike>,
  displayRowIndexAsHex: Ref<boolean>
) {
  const warnings = ref<RowWarningsMap>(new Map());
  const lastAnalyzedTimestamp = ref<number>(0);

  /**
   * Total count of all warnings
   */
  const warningCount = computed(() => {
    let count = 0;
    for (const rowWarnings of warnings.value.values()) {
      count += rowWarnings.length;
    }
    return count;
  });

  /**
   * Count of error-severity warnings
   */
  const errorCount = computed(() => {
    let count = 0;
    for (const rowWarnings of warnings.value.values()) {
      count += rowWarnings.filter(w => w.severity === 'error').length;
    }
    return count;
  });

  /**
   * Get warnings for a specific row
   */
  function getRowWarnings(rowIndex: number): AnalyzerWarning[] {
    return warnings.value.get(rowIndex) || [];
  }

  /**
   * Check if a row has any warnings
   */
  function rowHasWarnings(rowIndex: number): boolean {
    const rowWarnings = warnings.value.get(rowIndex);
    return rowWarnings !== undefined && rowWarnings.length > 0;
  }

  /**
   * Add a warning to the warnings map
   */
  function addWarning(warning: AnalyzerWarning): void {
    const rowWarnings = warnings.value.get(warning.rowIndex) || [];
    rowWarnings.push(warning);
    warnings.value.set(warning.rowIndex, rowWarnings);
  }

  /**
   * Analyze for variables read before write
   */
  function analyzeVariableReadBeforeWrite(rows: RowLike[]): void {
    const writtenVariables = new Set<number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (isEmptyRow(row)) continue;

      // Check what variables this row reads
      const varsRead = getVariablesReadByRow(row);
      for (const varIdx of varsRead) {
        if (!writtenVariables.has(varIdx)) {
          const rowLabel = formatRowIndex(row.index, displayRowIndexAsHex.value);
          addWarning({
            type: 'variable-read-before-write',
            severity: 'warning',
            rowIndex: row.index,
            message: `Variable ${VARIABLE_NAMES[varIdx]} used but never set in previous rows`,
            details: `Variable ${VARIABLE_NAMES[varIdx]} is read in Row ${rowLabel} but no earlier row sets it. The variable will have its initial value (set in the Variables section or 0).`
          });
        }
      }

      // Track what variable this row writes (if any)
      const varWritten = getVariableWrittenByRow(row);
      if (varWritten !== -1) {
        writtenVariables.add(varWritten);
      }
    }
  }

  /**
   * Analyze for unused variables (set but never read)
   */
  function analyzeUnusedVariables(rows: RowLike[]): void {
    const writtenVars = new Map<number, number>(); // varIndex -> first row that writes
    const readVars = new Set<number>();

    // First pass: find all writes
    for (const row of rows) {
      if (isEmptyRow(row)) continue;

      const varWritten = getVariableWrittenByRow(row);
      if (varWritten !== -1 && !writtenVars.has(varWritten)) {
        writtenVars.set(varWritten, row.index);
      }
    }

    // Second pass: find all reads
    for (const row of rows) {
      if (isEmptyRow(row)) continue;

      const varsRead = getVariablesReadByRow(row);
      for (const varIdx of varsRead) {
        readVars.add(varIdx);
      }
    }

    // Report variables that are written but never read
    for (const [varIdx, rowIndex] of writtenVars) {
      if (!readVars.has(varIdx)) {
        const rowLabel = formatRowIndex(rowIndex, displayRowIndexAsHex.value);
        addWarning({
          type: 'unused-variable',
          severity: 'info',
          rowIndex: rowIndex,
          message: `Variable ${VARIABLE_NAMES[varIdx]} is set but never read`,
          details: `Variable ${VARIABLE_NAMES[varIdx]} is written in Row ${rowLabel} but no row reads its value. This may indicate dead code or an incomplete mapping.`
        });
      }
    }
  }

  /**
   * Analyze for always-true/false Skip conditions
   */
  function analyzeSkipConditions(rows: RowLike[]): void {
    for (const row of rows) {
      if (!isSkipSource(row)) continue;

      const { alwaysTrue, alwaysFalse } = analyzeSkipCondition(row);

      if (alwaysTrue) {
        const skipCount = getSkipCount(row);
        const rowLabel = formatRowIndex(row.index, displayRowIndexAsHex.value);
        addWarning({
          type: 'skip-always-true',
          severity: 'warning',
          rowIndex: row.index,
          message: `Skip condition always evaluates to TRUE`,
          details: `The Skip condition in Row ${rowLabel} compares two constants and will always be true. This will always skip ${skipCount} row(s).`
        });
      } else if (alwaysFalse) {
        const rowLabel = formatRowIndex(row.index, displayRowIndexAsHex.value);
        addWarning({
          type: 'skip-always-false',
          severity: 'info',
          rowIndex: row.index,
          message: `Skip condition always evaluates to FALSE`,
          details: `The Skip condition in Row ${rowLabel} compares two constants and will always be false. The skip will never occur.`
        });
      }
    }
  }

  /**
   * Analyze for unreachable rows after unconditional skip
   */
  function analyzeUnreachableRows(rows: RowLike[]): void {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!isSkipSource(row)) continue;

      const { alwaysTrue } = analyzeSkipCondition(row);
      if (!alwaysTrue) continue;

      const skipCount = getSkipCount(row);
      const startUnreachable = row.index + 1;
      const endUnreachable = Math.min(row.index + skipCount, rows.length - 1);

      if (startUnreachable <= endUnreachable) {
        // Mark the rows that will be skipped as unreachable
        for (let j = startUnreachable; j <= endUnreachable; j++) {
          const unreachableRow = rows.find(r => r.index === j);
          if (unreachableRow && !isEmptyRow(unreachableRow)) {
            const jLabel = formatRowIndex(j, displayRowIndexAsHex.value);
            const rowLabel = formatRowIndex(row.index, displayRowIndexAsHex.value);
            addWarning({
              type: 'unreachable-rows',
              severity: 'warning',
              rowIndex: j,
              message: `Row ${jLabel} is unreachable`,
              details: `This row will always be skipped due to the unconditional Skip in Row ${rowLabel}.`,
              relatedRows: [row.index]
            });
          }
        }
      }
    }
  }

  /**
   * Analyze for destination conflicts (multiple rows writing to same output)
   */
  function analyzeDestinationConflicts(rows: RowLike[]): void {
    const destinationMap = new Map<string, number[]>(); // destKey -> row indices

    for (const row of rows) {
      if (isEmptyRow(row)) continue;

      const destKey = getDestinationKey(row);
      if (destKey === null) continue;

      const rowIndices = destinationMap.get(destKey) || [];
      rowIndices.push(row.index);
      destinationMap.set(destKey, rowIndices);
    }

    // Report conflicts
    for (const [_destKey, rowIndices] of destinationMap) {
      if (rowIndices.length > 1) {
        // Add warning to all conflicting rows except the last one
        // (the last write wins, so it's not really a problem for the last row)
        for (let i = 0; i < rowIndices.length - 1; i++) {
          const rowIndex = rowIndices[i];
          const otherRows = rowIndices.filter(idx => idx !== rowIndex);
          const row = rows.find(r => r.index === rowIndex);

          const otherRowsLabels = otherRows.map(idx => formatRowIndex(idx, displayRowIndexAsHex.value)).join(', ');
          const lastRowLabel = formatRowIndex(rowIndices[rowIndices.length - 1], displayRowIndexAsHex.value);

          addWarning({
            type: 'destination-conflict',
            severity: 'info',
            rowIndex: rowIndex,
            message: `Destination also written by Row ${otherRowsLabels}`,
            details: `Multiple rows write to the same destination: ${row?.destination.type.description || 'Unknown'}. The last write (Row ${lastRowLabel}) will take effect.`,
            relatedRows: otherRows
          });
        }
      }
    }
  }

  /**
   * Analyze for out-of-range values
   */
  function analyzeOutOfRangeValues(rows: RowLike[]): void {
    const MAX_VALUE = 4095;
    const MIN_VALUE = -2048;

    for (const row of rows) {
      if (isEmptyRow(row)) continue;

      // Check if offset + maxValue exceeds the limit
      // Note: minValue is typically -2048 and maxValue is 2047 by default
      // The actual value range is 0-4095 (12-bit)

      // Only warn if maxValue is set to something other than default
      if (row.maxValue !== 2047) {
        if (row.offset + row.maxValue > MAX_VALUE) {
          const rowLabel = formatRowIndex(row.index, displayRowIndexAsHex.value);
          addWarning({
            type: 'out-of-range-value',
            severity: 'warning',
            rowIndex: row.index,
            message: `Offset + MaxValue exceeds 4095`,
            details: `Row ${rowLabel}: offset (${row.offset}) + maxValue (${row.maxValue}) = ${row.offset + row.maxValue} exceeds the maximum value of ${MAX_VALUE}.`
          });
        }
      }

      // Check if offset + minValue goes below 0 (only for certain types)
      if (row.minValue !== -2048) {
        if (row.offset + row.minValue < MIN_VALUE) {
          const rowLabel = formatRowIndex(row.index, displayRowIndexAsHex.value);
          addWarning({
            type: 'out-of-range-value',
            severity: 'warning',
            rowIndex: row.index,
            message: `Offset + MinValue below -2048`,
            details: `Row ${rowLabel}: offset (${row.offset}) + minValue (${row.minValue}) = ${row.offset + row.minValue} is below the minimum value of ${MIN_VALUE}.`
          });
        }
      }
    }
  }

  /**
   * Run the full analysis on the document
   */
  function analyzeDocument(): void {
    // Clear previous warnings
    warnings.value = new Map();

    const rows = mappingDocument.value.rows;

    // Run all analyzers
    analyzeVariableReadBeforeWrite(rows);
    analyzeUnusedVariables(rows);
    analyzeSkipConditions(rows);
    analyzeUnreachableRows(rows);
    analyzeDestinationConflicts(rows);
    analyzeOutOfRangeValues(rows);

    // Update timestamp
    lastAnalyzedTimestamp.value = Date.now();

    // Force reactivity update
    warnings.value = new Map(warnings.value);
  }

  /**
   * Clear all warnings
   */
  function clearWarnings(): void {
    warnings.value = new Map();
  }

  return {
    // State
    warnings,
    warningCount,
    errorCount,
    lastAnalyzedTimestamp,

    // Methods
    analyzeDocument,
    getRowWarnings,
    rowHasWarnings,
    clearWarnings
  };
}
