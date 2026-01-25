import { ref, computed, type Ref } from 'vue';
import {
  DataModel,
  type MappingType,
  EMPTY_KEY,
  EMPTY_ABBR,
  EMPTY_DESCRIPTION
} from '../modules/dataModel';
import {
  buildPositionMapping,
  updateRowReferencesAfterMove,
  type ReferenceUpdateResult,
  type ReferenceWarning
} from '../services/rowReferenceService';
import {
  Row as MappingRow,
  Source,
  SourceType,
  SourceFunction,
  SourceExtra,
  Destination,
  DestinationType,
  DestinationFunction,
  DestinationExtra
} from '../modules/documentModel';

// Types for structural matching
export type RowLike = {
  index: number;
  source: SourceLike;
  destination: DestinationLike;
};

export type SourceLike = {
  type: { key: number; abbr: string; description: string };
  function: { key: number; abbr: string; description: string };
  extra: { keyOrValue: number; abbr: string; description: string };
};

export type DestinationLike = {
  type: { key: number; abbr: string; description: string };
  function: { key: number; abbr: string; description: string };
  extra: { keyOrValue: number; abbr: string; description: string };
};

/**
 * Creates an empty Source instance with all fields set to EMPTY_KEY.
 *
 * @returns A new Source with empty type, function, and extra
 */
export function createEmptySource(): Source {
  return new Source(
    new SourceType(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION),
    new SourceFunction(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION),
    new SourceExtra(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION)
  );
}

/**
 * Creates an empty Destination instance with all fields set to EMPTY_KEY.
 *
 * @returns A new Destination with empty type, function, and extra
 */
export function createEmptyDestination(): Destination {
  return new Destination(
    new DestinationType(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION),
    new DestinationFunction(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION),
    new DestinationExtra(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION)
  );
}

// Deep clone functions
function deepCloneSource(source: SourceLike): Source {
  return new Source(
    new SourceType(source.type.key, source.type.abbr, source.type.description),
    new SourceFunction(source.function.key, source.function.abbr, source.function.description),
    new SourceExtra(source.extra.keyOrValue, source.extra.abbr, source.extra.description)
  );
}

function deepCloneDestination(destination: DestinationLike): Destination {
  return new Destination(
    new DestinationType(destination.type.key, destination.type.abbr, destination.type.description),
    new DestinationFunction(destination.function.key, destination.function.abbr, destination.function.description),
    new DestinationExtra(destination.extra.keyOrValue, destination.extra.abbr, destination.extra.description)
  );
}

function deepCloneRow(row: RowLike): MappingRow {
  return new MappingRow(
    row.index,
    deepCloneSource(row.source),
    deepCloneDestination(row.destination)
  );
}

// Mutable versions of the types (for setting properties on document rows)
export interface MutableSource extends SourceLike {
  type: { key: number; abbr: string; description: string };
  function: { key: number; abbr: string; description: string };
  extra: { keyOrValue: number; abbr: string; description: string };
}

export interface MutableDestination extends DestinationLike {
  type: { key: number; abbr: string; description: string };
  function: { key: number; abbr: string; description: string };
  extra: { keyOrValue: number; abbr: string; description: string };
}

// Interface for a document-like structure with rows
// The rows support getting/setting source and destination properties
export interface MappingDocumentLike {
  rows: Array<{
    index: number;
    source: MutableSource;
    destination: MutableDestination;
  }>;
}

// Options interface for the composable
export interface UseClipboardOptions {
  mappingDocument: Ref<MappingDocumentLike>;
  currentlySelectedSourceTypes: Ref<MappingType[]>;
  currentlySelectedDestinationTypes: Ref<MappingType[]>;
}

// Result type for move operations including reference warnings
export interface MoveRowsResult {
  newIndices: number[];
  referenceUpdateResult: ReferenceUpdateResult;
}

// Re-export types for convenience
export type { ReferenceWarning, ReferenceUpdateResult };

/**
 * Return type for the useClipboard composable.
 * Provides clipboard operations for rows, sources, and destinations.
 */
export interface UseClipboardReturn {
  // State (computed booleans for UI)
  hasCopiedRow: Ref<boolean>;
  hasCopiedSource: Ref<boolean>;
  hasCopiedDestination: Ref<boolean>;
  hasCopiedRows: Ref<boolean>;

  // Row operations
  copyRow: (rowIndex: number) => void;
  pasteRow: (rowIndex: number) => void;
  clearRow: (rowIndex: number) => void;

  // Multi-row operations
  copyRows: (rowIndices: number[]) => void;
  pasteRows: (startIndex: number) => void;
  cutRows: (rowIndices: number[]) => void;
  clearRows: (rowIndices: number[]) => void;
  moveRowsUp: (rowIndices: number[]) => MoveRowsResult;
  moveRowsDown: (rowIndices: number[]) => MoveRowsResult;

  // Source operations
  copySource: (rowIndex: number) => void;
  pasteSource: (rowIndex: number) => void;
  clearSource: (rowIndex: number) => void;

  // Destination operations
  copyDestination: (rowIndex: number) => void;
  pasteDestination: (rowIndex: number) => void;
  clearDestination: (rowIndex: number) => void;

  // Utility
  clearAllClipboards: () => void;
}

/**
 * Composable for clipboard operations on mapping rows, sources, and destinations.
 *
 * Provides copy/paste/cut/clear/move operations at three levels:
 * - **Row level**: Complete mapping (source + destination)
 * - **Source level**: Only source parameters
 * - **Destination level**: Only destination parameters
 *
 * All operations create deep clones to avoid reference sharing.
 * Move operations automatically update row references (Skip/Dual types).
 *
 * @example
 * ```typescript
 * const {
 *   copyRow,
 *   pasteRow,
 *   moveRowsUp,
 *   hasCopiedRow
 * } = useClipboard({
 *   mappingDocument,
 *   currentlySelectedSourceTypes,
 *   currentlySelectedDestinationTypes
 * });
 *
 * // Copy row 5
 * copyRow(5);
 *
 * // Paste to row 10
 * if (hasCopiedRow.value) {
 *   pasteRow(10);
 * }
 *
 * // Move rows 2, 3, 4 up (returns new indices and reference warnings)
 * const { newIndices, referenceUpdateResult } = moveRowsUp([2, 3, 4]);
 * console.log('Moved to:', newIndices); // [1, 2, 3]
 * console.log('Updated references:', referenceUpdateResult.updatedCount);
 * ```
 *
 * @param options - Configuration options
 * @param options.mappingDocument - Ref to the mapping document containing rows
 * @param options.currentlySelectedSourceTypes - Ref to source type selection state
 * @param options.currentlySelectedDestinationTypes - Ref to destination type selection state
 *
 * @returns Clipboard API with copy/paste/cut/clear/move operations
 */
export function useClipboard(options: UseClipboardOptions): UseClipboardReturn {
  const { mappingDocument, currentlySelectedSourceTypes, currentlySelectedDestinationTypes } = options;

  // Internal clipboard state
  const copiedRowData = ref<MappingRow | null>(null);
  const copiedSourceData = ref<Source | null>(null);
  const copiedDestinationData = ref<Destination | null>(null);
  const copiedRowsData = ref<MappingRow[]>([]);

  // Computed state for UI bindings
  const hasCopiedRow = computed(() => copiedRowData.value !== null);
  const hasCopiedSource = computed(() => copiedSourceData.value !== null);
  const hasCopiedDestination = computed(() => copiedDestinationData.value !== null);
  const hasCopiedRows = computed(() => copiedRowsData.value.length > 0);

  // Helper to find a row by index
  function findRow(rowIndex: number) {
    return mappingDocument.value.rows.find(x => x.index === rowIndex);
  }

  // Row operations
  function copyRow(rowIndex: number): void {
    const row = findRow(rowIndex);
    if (!row) return;
    copiedRowData.value = deepCloneRow(row);
  }

  function pasteRow(rowIndex: number): void {
    if (!copiedRowData.value) return;
    const targetRow = findRow(rowIndex);
    if (!targetRow) return;

    const clonedData = deepCloneRow(copiedRowData.value);
    clonedData.index = rowIndex;

    targetRow.source = clonedData.source;
    targetRow.destination = clonedData.destination;

    currentlySelectedSourceTypes.value[rowIndex] =
      DataModel.sourceTypes.find(x => x.key === clonedData.source.type.key) as MappingType;
    currentlySelectedDestinationTypes.value[rowIndex] =
      DataModel.destinationTypes.find(x => x.key === clonedData.destination.type.key) as MappingType;
  }

  function clearRow(rowIndex: number): void {
    const targetRow = findRow(rowIndex);
    if (!targetRow) return;

    targetRow.source = createEmptySource();
    targetRow.destination = createEmptyDestination();

    currentlySelectedSourceTypes.value[rowIndex] = DataModel.sourceTypes[0] as MappingType;
    currentlySelectedDestinationTypes.value[rowIndex] = DataModel.destinationTypes[0] as MappingType;
  }

  // Source operations
  function copySource(rowIndex: number): void {
    const row = findRow(rowIndex);
    if (!row) return;
    copiedSourceData.value = deepCloneSource(row.source);
  }

  function pasteSource(rowIndex: number): void {
    if (!copiedSourceData.value) return;
    const targetRow = findRow(rowIndex);
    if (!targetRow) return;

    targetRow.source = deepCloneSource(copiedSourceData.value);
    currentlySelectedSourceTypes.value[rowIndex] =
      DataModel.sourceTypes.find(x => x.key === targetRow.source.type.key) as MappingType;
  }

  function clearSource(rowIndex: number): void {
    const targetRow = findRow(rowIndex);
    if (!targetRow) return;

    targetRow.source = createEmptySource();
    currentlySelectedSourceTypes.value[rowIndex] = DataModel.sourceTypes[0] as MappingType;
  }

  // Destination operations
  function copyDestination(rowIndex: number): void {
    const row = findRow(rowIndex);
    if (!row) return;
    copiedDestinationData.value = deepCloneDestination(row.destination);
  }

  function pasteDestination(rowIndex: number): void {
    if (!copiedDestinationData.value) return;
    const targetRow = findRow(rowIndex);
    if (!targetRow) return;

    targetRow.destination = deepCloneDestination(copiedDestinationData.value);
    currentlySelectedDestinationTypes.value[rowIndex] =
      DataModel.destinationTypes.find(x => x.key === targetRow.destination.type.key) as MappingType;
  }

  function clearDestination(rowIndex: number): void {
    const targetRow = findRow(rowIndex);
    if (!targetRow) return;

    targetRow.destination = createEmptyDestination();
    currentlySelectedDestinationTypes.value[rowIndex] = DataModel.destinationTypes[0] as MappingType;
  }

  // Multi-row operations
  function copyRows(rowIndices: number[]): void {
    const sortedIndices = [...rowIndices].sort((a, b) => a - b);
    copiedRowsData.value = sortedIndices
      .map(idx => findRow(idx))
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .map(row => deepCloneRow(row));
  }

  function pasteRows(startIndex: number): void {
    if (copiedRowsData.value.length === 0) return;

    const maxRows = mappingDocument.value.rows.length;
    for (let i = 0; i < copiedRowsData.value.length; i++) {
      const targetIndex = startIndex + i;
      if (targetIndex >= maxRows) break;

      const targetRow = findRow(targetIndex);
      if (!targetRow) continue;

      const clonedData = deepCloneRow(copiedRowsData.value[i]);
      targetRow.source = clonedData.source;
      targetRow.destination = clonedData.destination;

      currentlySelectedSourceTypes.value[targetIndex] =
        DataModel.sourceTypes.find(x => x.key === clonedData.source.type.key) as MappingType;
      currentlySelectedDestinationTypes.value[targetIndex] =
        DataModel.destinationTypes.find(x => x.key === clonedData.destination.type.key) as MappingType;
    }
  }

  function clearRows(rowIndices: number[]): void {
    for (const idx of rowIndices) {
      clearRow(idx);
    }
  }

  function cutRows(rowIndices: number[]): void {
    copyRows(rowIndices);
    clearRows(rowIndices);
  }

  // Helper: Swap row contents between two rows
  function swapRowContents(rowA: NonNullable<ReturnType<typeof findRow>>, rowB: NonNullable<ReturnType<typeof findRow>>): void {
    const tempSource = deepCloneSource(rowA.source);
    const tempDest = deepCloneDestination(rowA.destination);

    rowA.source = deepCloneSource(rowB.source);
    rowA.destination = deepCloneDestination(rowB.destination);

    rowB.source = tempSource;
    rowB.destination = tempDest;
  }

  // Helper: Swap selected types between two indices
  function swapSelectedTypes(idxA: number, idxB: number): void {
    const tempSourceType = currentlySelectedSourceTypes.value[idxA];
    const tempDestType = currentlySelectedDestinationTypes.value[idxA];

    currentlySelectedSourceTypes.value[idxA] = currentlySelectedSourceTypes.value[idxB];
    currentlySelectedDestinationTypes.value[idxA] = currentlySelectedDestinationTypes.value[idxB];

    currentlySelectedSourceTypes.value[idxB] = tempSourceType;
    currentlySelectedDestinationTypes.value[idxB] = tempDestType;
  }

  // Internal: Move rows in a given direction
  type MoveDirection = 'up' | 'down';

  function moveRows(rowIndices: number[], direction: MoveDirection): MoveRowsResult {
    const isUp = direction === 'up';
    const maxIndex = mappingDocument.value.rows.length - 1;
    const boundaryIndex = isUp ? 0 : maxIndex;
    const offset = isUp ? -1 : 1;

    // Sort: ascending for up (process top rows first), descending for down (process bottom rows first)
    const sorted = [...rowIndices].sort((a, b) => isUp ? a - b : b - a);

    // Boundary check
    if (sorted[0] === boundaryIndex) {
      return {
        newIndices: rowIndices,
        referenceUpdateResult: { updatedCount: 0, warnings: [] }
      };
    }

    // Build position mapping before the move
    const positionMapping = buildPositionMapping(rowIndices, direction);

    const newIndices: number[] = [];
    for (const idx of sorted) {
      const currentRow = findRow(idx);
      const adjacentRow = findRow(idx + offset);
      if (!currentRow || !adjacentRow) continue;

      swapRowContents(currentRow, adjacentRow);
      swapSelectedTypes(idx, idx + offset);
      newIndices.push(idx + offset);
    }

    // Update row references after the move
    const referenceUpdateResult = updateRowReferencesAfterMove(
      mappingDocument.value.rows as MappingRow[],
      positionMapping
    );

    return { newIndices, referenceUpdateResult };
  }

  function moveRowsUp(rowIndices: number[]): MoveRowsResult {
    return moveRows(rowIndices, 'up');
  }

  function moveRowsDown(rowIndices: number[]): MoveRowsResult {
    return moveRows(rowIndices, 'down');
  }

  // Utility
  function clearAllClipboards(): void {
    copiedRowData.value = null;
    copiedSourceData.value = null;
    copiedDestinationData.value = null;
    copiedRowsData.value = [];
  }

  return {
    hasCopiedRow,
    hasCopiedSource,
    hasCopiedDestination,
    hasCopiedRows,
    copyRow,
    pasteRow,
    clearRow,
    copyRows,
    pasteRows,
    cutRows,
    clearRows,
    moveRowsUp,
    moveRowsDown,
    copySource,
    pasteSource,
    clearSource,
    copyDestination,
    pasteDestination,
    clearDestination,
    clearAllClipboards
  };
}
