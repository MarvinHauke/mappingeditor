import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';

/**
 * Slot identifier for cached mappings
 */
export type CacheSlot = 'A' | 'B';

/**
 * Serialized form of the mapping document for storage
 */
interface SerializedRow {
  sourceType: number;
  sourceFunction: number;
  sourceExtra: number;
  destinationType: number;
  destinationFunction: number;
  destinationExtra: number;
  unused1: number;
  unused2: number;
  unused3: number;
  unused4: number;
}

interface SerializedHeader {
  headerText: string;
  majorVersion: number;
  minorVersion: number;
  fileName: string;
}

interface SerializedDocument {
  header: SerializedHeader;
  rows: SerializedRow[];
  variables: number[];
}

/**
 * Cached mapping with metadata
 */
export interface CachedMapping {
  document: SerializedDocument;
  rowColors: Record<number, string>;
  rowComments: Record<number, string>;
  globalComment?: string;
  timestamp: number;
}

/**
 * Return type for useMappingCache composable
 */
export interface UseMappingCacheReturn {
  activeSlot: Ref<CacheSlot>;
  isLockedA: Ref<boolean>;
  isLockedB: Ref<boolean>;
  isCurrentLocked: ComputedRef<boolean>;
  hasDataA: Ref<boolean>;
  hasDataB: Ref<boolean>;
  switchToA: () => Promise<void>;
  switchToB: () => Promise<void>;
  toggleLockA: () => void;
  toggleLockB: () => void;
  saveToActiveSlot: (data: CachedMapping) => Promise<void>;
  loadFromSlot: (slot: CacheSlot) => Promise<CachedMapping | null>;
  clearSlot: (slot: CacheSlot) => Promise<void>;
}

// IndexedDB database name and store
const DB_NAME = 'nerdseq-editor';
const STORE_NAME = 'mappings';
const DB_VERSION = 1;

// localStorage keys for lock states
const LOCK_A_KEY = 'nerdseq-cache-lock-a';
const LOCK_B_KEY = 'nerdseq-cache-lock-b';
const ACTIVE_SLOT_KEY = 'nerdseq-cache-active-slot';

/**
 * Open the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save data to IndexedDB
 */
async function saveToIndexedDB(key: string, data: CachedMapping): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data, key);

    request.onerror = () => {
      reject(new Error('Failed to save to IndexedDB'));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Load data from IndexedDB
 */
async function loadFromIndexedDB(key: string): Promise<CachedMapping | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => {
      reject(new Error('Failed to load from IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Delete data from IndexedDB
 */
async function deleteFromIndexedDB(key: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => {
      reject(new Error('Failed to delete from IndexedDB'));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Check if a slot has data
 */
async function checkSlotHasData(slot: CacheSlot): Promise<boolean> {
  try {
    const data = await loadFromIndexedDB(`slot-${slot}`);
    return data !== null;
  } catch {
    return false;
  }
}

// Singleton instance
let instance: UseMappingCacheReturn | null = null;

/**
 * Mapping Cache composable - provides A/B toggle and lock functionality
 * Uses singleton pattern so all components share the same state
 */
export function useMappingCache(): UseMappingCacheReturn {
  // Return existing instance if already created
  if (instance) {
    return instance;
  }

  // Load initial states from localStorage
  const savedActiveSlot = localStorage.getItem(ACTIVE_SLOT_KEY) as CacheSlot | null;
  const activeSlot = ref<CacheSlot>(savedActiveSlot === 'B' ? 'B' : 'A');
  
  const isLockedA = ref(localStorage.getItem(LOCK_A_KEY) === 'true');
  const isLockedB = ref(localStorage.getItem(LOCK_B_KEY) === 'true');
  
  // Track if slots have data
  const hasDataA = ref(false);
  const hasDataB = ref(false);

  // Check initial slot data
  checkSlotHasData('A').then(has => { hasDataA.value = has; });
  checkSlotHasData('B').then(has => { hasDataB.value = has; });

  // Persist lock states
  watch(isLockedA, (val) => {
    localStorage.setItem(LOCK_A_KEY, val.toString());
  });

  watch(isLockedB, (val) => {
    localStorage.setItem(LOCK_B_KEY, val.toString());
  });

  watch(activeSlot, (val) => {
    localStorage.setItem(ACTIVE_SLOT_KEY, val);
  });

  /**
   * Whether the currently active slot is locked
   */
  const isCurrentLocked = computed(() => {
    return activeSlot.value === 'A' ? isLockedA.value : isLockedB.value;
  });

  /**
   * Switch to slot A
   */
  async function switchToA(): Promise<void> {
    activeSlot.value = 'A';
  }

  /**
   * Switch to slot B
   */
  async function switchToB(): Promise<void> {
    activeSlot.value = 'B';
  }

  /**
   * Toggle lock on slot A
   */
  function toggleLockA(): void {
    isLockedA.value = !isLockedA.value;
  }

  /**
   * Toggle lock on slot B
   */
  function toggleLockB(): void {
    isLockedB.value = !isLockedB.value;
  }

  /**
   * Save data to the active slot
   */
  async function saveToActiveSlot(data: CachedMapping): Promise<void> {
    const key = `slot-${activeSlot.value}`;
    await saveToIndexedDB(key, data);
    
    if (activeSlot.value === 'A') {
      hasDataA.value = true;
    } else {
      hasDataB.value = true;
    }
  }

  /**
   * Load data from a specific slot
   */
  async function loadFromSlot(slot: CacheSlot): Promise<CachedMapping | null> {
    const key = `slot-${slot}`;
    return await loadFromIndexedDB(key);
  }

  /**
   * Clear a specific slot
   */
  async function clearSlot(slot: CacheSlot): Promise<void> {
    const key = `slot-${slot}`;
    await deleteFromIndexedDB(key);
    
    if (slot === 'A') {
      hasDataA.value = false;
    } else {
      hasDataB.value = false;
    }
  }

  // Create and store instance
  instance = {
    activeSlot,
    isLockedA,
    isLockedB,
    isCurrentLocked,
    hasDataA,
    hasDataB,
    switchToA,
    switchToB,
    toggleLockA,
    toggleLockB,
    saveToActiveSlot,
    loadFromSlot,
    clearSlot
  };

  return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetMappingCache(): void {
  instance = null;
}
