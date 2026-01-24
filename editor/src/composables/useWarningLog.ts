import { ref, computed, type ComputedRef, type Ref } from 'vue';

/**
 * Log entry types
 */
export type LogEntryType = 'info' | 'warning' | 'error';

/**
 * Log entry sources
 */
export type LogEntrySource = 'analyzer' | 'reference' | 'system';

/**
 * A log entry in the warning log
 */
export interface LogEntry {
  id: number;
  timestamp: Date;
  type: LogEntryType;
  source: LogEntrySource;
  message: string;
  rowIndex?: number;
  details?: string;
}

/**
 * Input for creating a new log entry (without auto-generated fields)
 */
export type LogEntryInput = Omit<LogEntry, 'id' | 'timestamp'>;

/**
 * Return type for useWarningLog composable
 */
export interface UseWarningLogReturn {
  entries: Ref<LogEntry[]>;
  addEntry: (entry: LogEntryInput) => void;
  addInfo: (source: LogEntrySource, message: string, rowIndex?: number, details?: string) => void;
  addWarning: (source: LogEntrySource, message: string, rowIndex?: number, details?: string) => void;
  addError: (source: LogEntrySource, message: string, rowIndex?: number, details?: string) => void;
  clearLog: () => void;
  filterByType: Ref<Set<LogEntryType>>;
  filterBySource: Ref<Set<LogEntrySource>>;
  filteredEntries: ComputedRef<LogEntry[]>;
  entryCount: ComputedRef<number>;
  warningCount: ComputedRef<number>;
  errorCount: ComputedRef<number>;
}

// Maximum number of entries to keep
const MAX_ENTRIES = 100;

// Singleton instance for global access
let instance: UseWarningLogReturn | null = null;

/**
 * Warning Log composable - provides a centralized log for all warnings
 * Uses singleton pattern so all components share the same log
 */
export function useWarningLog(): UseWarningLogReturn {
  // Return existing instance if already created
  if (instance) {
    return instance;
  }

  let nextId = 1;
  const entries = ref<LogEntry[]>([]);

  // Active filters
  const filterByType = ref<Set<LogEntryType>>(new Set(['info', 'warning', 'error']));
  const filterBySource = ref<Set<LogEntrySource>>(new Set(['analyzer', 'reference', 'system']));

  /**
   * Filtered entries based on active filters
   */
  const filteredEntries = computed(() => {
    return entries.value.filter(entry => 
      filterByType.value.has(entry.type) && 
      filterBySource.value.has(entry.source)
    );
  });

  /**
   * Total entry count (unfiltered)
   */
  const entryCount = computed(() => entries.value.length);

  /**
   * Count of warning-type entries
   */
  const warningCount = computed(() => 
    entries.value.filter(e => e.type === 'warning').length
  );

  /**
   * Count of error-type entries
   */
  const errorCount = computed(() => 
    entries.value.filter(e => e.type === 'error').length
  );

  /**
   * Add a new entry to the log
   */
  function addEntry(entry: LogEntryInput): void {
    const newEntry: LogEntry = {
      ...entry,
      id: nextId++,
      timestamp: new Date()
    };

    // Add to beginning (newest first)
    entries.value.unshift(newEntry);

    // Prune old entries if over limit
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_ENTRIES);
    }
  }

  /**
   * Add an info entry
   */
  function addInfo(source: LogEntrySource, message: string, rowIndex?: number, details?: string): void {
    addEntry({ type: 'info', source, message, rowIndex, details });
  }

  /**
   * Add a warning entry
   */
  function addWarning(source: LogEntrySource, message: string, rowIndex?: number, details?: string): void {
    addEntry({ type: 'warning', source, message, rowIndex, details });
  }

  /**
   * Add an error entry
   */
  function addError(source: LogEntrySource, message: string, rowIndex?: number, details?: string): void {
    addEntry({ type: 'error', source, message, rowIndex, details });
  }

  /**
   * Clear all entries from the log
   */
  function clearLog(): void {
    entries.value = [];
  }

  // Create and store instance
  instance = {
    entries,
    addEntry,
    addInfo,
    addWarning,
    addError,
    clearLog,
    filterByType,
    filterBySource,
    filteredEntries,
    entryCount,
    warningCount,
    errorCount
  };

  return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetWarningLog(): void {
  instance = null;
}
