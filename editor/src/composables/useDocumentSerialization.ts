import type { Ref, ComputedRef } from 'vue';
import {
  DataModel, type MappingTuple, type MappingType
} from '../modules/dataModel';
import {
  MappingDocument, SourceType, SourceFunction, SourceExtra,
  DestinationType, DestinationFunction, DestinationExtra
} from '../modules/documentModel';
import type { CachedMapping, CacheSlot } from './useMappingCache';

interface MappingDocumentLike {
  header: {
    headerText: string;
    majorVersion: number;
    minorVersion: number;
    fileName: string;
  };
  rows: Array<{
    source: { type: { key: number }; function: { key: number }; extra: { keyOrValue: number } };
    destination: { type: { key: number }; function: { key: number }; extra: { keyOrValue: number } };
    unused1: number;
    unused2: number;
    unused3: number;
    unused4: number;
  }>;
  variables: Array<{ value: number }>;
  globalComment?: string;
}

export interface UseDocumentSerializationOptions {
  mappingDocument: Ref<MappingDocumentLike>;
  currentlySelectedSourceTypes: Ref<MappingType[]>;
  currentlySelectedDestinationTypes: Ref<MappingType[]>;
  rowColors: Ref<Map<number, string>>;
  rowComments: Ref<Record<number, string>>;
  clearRowSelection: () => void;
  analyzeDocument: () => void;
  reset: () => void;
  logInfo: (...args: any[]) => void;
  logError: (...args: any[]) => void;
  // From useMappingCache
  activeSlot: Ref<CacheSlot>;
  isCurrentLocked: ComputedRef<boolean>;
  saveToActiveSlot: (data: CachedMapping) => Promise<void>;
  switchToA: () => Promise<void>;
  switchToB: () => Promise<void>;
  toggleLockA: () => void;
  toggleLockB: () => void;
  loadFromSlot: (slot: CacheSlot) => Promise<CachedMapping | null>;
}

export function useDocumentSerialization(options: UseDocumentSerializationOptions) {
  const {
    mappingDocument,
    currentlySelectedSourceTypes,
    currentlySelectedDestinationTypes,
    rowColors,
    rowComments,
    clearRowSelection,
    analyzeDocument,
    reset,
    logInfo,
    logError,
    activeSlot,
    isCurrentLocked,
    saveToActiveSlot,
    switchToA,
    switchToB,
    toggleLockA,
    toggleLockB,
    loadFromSlot
  } = options;

  // Save current document to cache (debounced)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  function serializeDocument(): CachedMapping {
    const doc = mappingDocument.value;
    return {
      document: {
        header: {
          headerText: doc.header.headerText,
          majorVersion: doc.header.majorVersion,
          minorVersion: doc.header.minorVersion,
          fileName: doc.header.fileName
        },
        rows: doc.rows.map(row => ({
          sourceType: row.source.type.key,
          sourceFunction: row.source.function.key,
          sourceExtra: row.source.extra.keyOrValue,
          destinationType: row.destination.type.key,
          destinationFunction: row.destination.function.key,
          destinationExtra: row.destination.extra.keyOrValue,
          unused1: row.unused1,
          unused2: row.unused2,
          unused3: row.unused3,
          unused4: row.unused4
        })),
        variables: doc.variables.map(v => v.value)
      },
      rowColors: Object.fromEntries(rowColors.value),
      rowComments: { ...rowComments.value },
      globalComment: doc.globalComment,
      timestamp: Date.now()
    };
  }

  function deserializeToDocument(cached: CachedMapping): void {
    const doc = new MappingDocument();

    // Restore header
    doc.header.headerText = cached.document.header.headerText;
    doc.header.majorVersion = cached.document.header.majorVersion;
    doc.header.minorVersion = cached.document.header.minorVersion;
    doc.header.fileName = cached.document.header.fileName;

    // Restore rows
    cached.document.rows.forEach((serialized, i) => {
      if (i < doc.rows.length) {
        const row = doc.rows[i];

        // Source
        const sourceTypeData = DataModel.sourceTypes.find(st => st.key === serialized.sourceType);
        if (sourceTypeData) {
          row.source.type = new SourceType(sourceTypeData.key, sourceTypeData.abbr, sourceTypeData.description);
          currentlySelectedSourceTypes.value[i] = sourceTypeData as MappingType;

          const sourceFuncData = sourceTypeData.functions.find((f: MappingTuple) => f.key === serialized.sourceFunction);
          if (sourceFuncData) {
            row.source.function = new SourceFunction(sourceFuncData.key, sourceFuncData.abbr, sourceFuncData.description);
          }

          row.source.extra = new SourceExtra(serialized.sourceExtra, '', '');
        }

        // Destination
        const destTypeData = DataModel.destinationTypes.find(dt => dt.key === serialized.destinationType);
        if (destTypeData) {
          row.destination.type = new DestinationType(destTypeData.key, destTypeData.abbr, destTypeData.description);
          currentlySelectedDestinationTypes.value[i] = destTypeData as MappingType;

          const destFuncData = destTypeData.functions.find((f: MappingTuple) => f.key === serialized.destinationFunction);
          if (destFuncData) {
            row.destination.function = new DestinationFunction(destFuncData.key, destFuncData.abbr, destFuncData.description);
          }

          row.destination.extra = new DestinationExtra(serialized.destinationExtra, '', '');
        }

        // Unused fields
        row.unused1 = serialized.unused1;
        row.unused2 = serialized.unused2;
        row.unused3 = serialized.unused3;
        row.unused4 = serialized.unused4;
      }
    });

    // Restore variables
    cached.document.variables.forEach((val, i) => {
      if (i < doc.variables.length) {
        doc.variables[i].value = val;
      }
    });

    // Apply to reactive state
    mappingDocument.value = doc;

    // Restore colors (preserve Map reference for undo commands)
    rowColors.value.clear();
    for (const [k, v] of Object.entries(cached.rowColors)) {
      rowColors.value.set(parseInt(k), v);
    }

    // Restore comments
    rowComments.value = { ...cached.rowComments };

    // Restore global comment
    if (cached.globalComment) {
      doc.globalComment = cached.globalComment;
    }

    // Clear selection
    clearRowSelection();

    // Run analysis
    analyzeDocument();
  }

  function scheduleCacheSave(): void {
    if (isCurrentLocked.value) return;

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      try {
        await saveToActiveSlot(serializeDocument());
      } catch (error) {
        console.error('Failed to save to cache:', error);
      }
    }, 1000);
  }

  async function handleSlotSwitch(slot: 'A' | 'B'): Promise<void> {
    // If clicking on already active slot, toggle lock
    if (activeSlot.value === slot) {
      if (slot === 'A') {
        toggleLockA();
      } else {
        toggleLockB();
      }
      return;
    }

    // Save current to active slot first (if not locked)
    if (!isCurrentLocked.value) {
      try {
        await saveToActiveSlot(serializeDocument());
      } catch (error) {
        console.error('Failed to save before switch:', error);
      }
    }

    // Switch slot
    if (slot === 'A') {
      await switchToA();
    } else {
      await switchToB();
    }

    // Load from new slot
    try {
      const cached = await loadFromSlot(slot);
      if (cached) {
        deserializeToDocument(cached);
        logInfo('system', `Loaded mapping from slot ${slot}`);
      } else {
        // No data in slot, reset to empty
        reset();
        logInfo('system', `Slot ${slot} is empty`);
      }
    } catch (error) {
      console.error('Failed to load from slot:', error);
      logError('system', 'Failed to load cached mapping');
    }
  }

  return {
    serializeDocument,
    deserializeToDocument,
    scheduleCacheSave,
    handleSlotSwitch
  };
}
