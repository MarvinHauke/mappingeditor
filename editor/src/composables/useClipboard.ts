import { ref, computed, type Ref } from 'vue';
import {
  DataModel,
  type MappingType,
  EMPTY_KEY,
  EMPTY_ABBR,
  EMPTY_DESCRIPTION
} from '../modules/dataModel';
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

// Factory functions for creating empty Source/Destination
export function createEmptySource(): Source {
  return new Source(
    new SourceType(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION),
    new SourceFunction(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION),
    new SourceExtra(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION)
  );
}

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

// Return interface for the composable
export interface UseClipboardReturn {
  // State (computed booleans for UI)
  hasCopiedRow: Ref<boolean>;
  hasCopiedSource: Ref<boolean>;
  hasCopiedDestination: Ref<boolean>;

  // Row operations
  copyRow: (rowIndex: number) => void;
  pasteRow: (rowIndex: number) => void;
  clearRow: (rowIndex: number) => void;

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

export function useClipboard(options: UseClipboardOptions): UseClipboardReturn {
  const { mappingDocument, currentlySelectedSourceTypes, currentlySelectedDestinationTypes } = options;

  // Internal clipboard state
  const copiedRowData = ref<MappingRow | null>(null);
  const copiedSourceData = ref<Source | null>(null);
  const copiedDestinationData = ref<Destination | null>(null);

  // Computed state for UI bindings
  const hasCopiedRow = computed(() => copiedRowData.value !== null);
  const hasCopiedSource = computed(() => copiedSourceData.value !== null);
  const hasCopiedDestination = computed(() => copiedDestinationData.value !== null);

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

  // Utility
  function clearAllClipboards(): void {
    copiedRowData.value = null;
    copiedSourceData.value = null;
    copiedDestinationData.value = null;
  }

  return {
    hasCopiedRow,
    hasCopiedSource,
    hasCopiedDestination,
    copyRow,
    pasteRow,
    clearRow,
    copySource,
    pasteSource,
    clearSource,
    copyDestination,
    pasteDestination,
    clearDestination,
    clearAllClipboards
  };
}
