<script setup lang="ts">
import _ from "lodash";
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  DataModel, type MappingTuple, type MappingType, EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION, MIDI_NRPN_SOURCE_TYPE_KEY, CALC_SOURCE_TYPE_KEY, SKIP_SOURCE_TYPE_KEY,
  EXTERNAL_SOURCE_TYPE_KEY, keyboardSourceExtras, segaGamepadSourceExtras, nerdseqButtonsSourceExtras, globalButtonsDestinationExtras, globalModesDestinationExtras, globalScreensDestinationExtras,
  KEYBOARD_EXTERNAL_SOURCE_FUNCTION_KEY, SEGA_GAMEPAD_EXTERNAL_SOURCE_FUNCTION_KEY, NERDSEQ_BUTTONS_EXTERNAL_SOURCE_FUNCTION_KEY, VAR_SOURCE_TYPE_KEY, GLOBAL_DESTINATION_TYPE_KEY, GLOBAL_BUTTONS_DESTINATION_FUNCTION_KEY,
  GLOBAL_SCREENS_DESTINATION_FUNCTION_KEY, GLOBAL_MODES_DESTINATION_FUNCTION_KEY, MIDI_CC_DESTINATION_TYPE_KEY, DUAL_DESTINATION_TYPE_KEY, SKIP_DESTINATION_TYPE_KEY, VISU_DESTINATION_TYPE_KEY, SETVAR_DESTINATION_TYPE_KEY,
  VISU_SHADER_SELECT_FUNCTION_KEY, VISU_SHADER_FUNCTIONS_FUNCTION_KEY, VISU_MODULATORS_FUNCTION_KEY, VISU_ENVELOPES_FUNCTION_KEY, VISU_LFOS_FUNCTION_KEY,
  visuShaderSelectExtras, visuShaderFunctionsExtras, visuModulatorsExtras, visuEnvelopesExtras, visuLfosExtras
} from '../modules/dataModel';
import { MappingDocument, Row as MappingRow, Source, SourceType, SourceFunction, SourceExtra, DestinationType, DestinationFunction, DestinationExtra, Destination, Header } from '../modules/documentModel';
import { MappingDocumentParser } from '../modules/parsers';
import * as formatters from '../modules/formatters';
import schema from '../modules/documentModel.schema.json';

import Ajv from 'ajv';

import CalcSkipSourceExtra from './CalcSkipSourceExtra.vue';
import NrpnSourceExtra from './NrpnSourceExtra.vue';
import VariableSourceExtra from './VariableSourceExtra.vue';
import MidiCcDestinationExtra from './MidiCcDestinationExtra.vue';
import SkipDestinationExtra from './SkipDestinationExtra.vue';
import DualDestinationExtra from './DualDestinationExtra.vue';
import VisuDestinationExtra from './VisuDestinationExtra.vue';
import VariableDestinationExtra from './VariableDestinationExtra.vue';
import MidiMonitor from './MidiMonitor.vue';
import VariableMonitor from './VariableMonitor.vue';
import MidiLearnExtra from './MidiLearnExtra.vue';
import RowCommentSection from './RowCommentSection.vue';
import SelectionToolbar from './SelectionToolbar.vue';
import SettingsPanel from './SettingsPanel.vue';
import LogMonitor from './LogMonitor.vue';
import GlobalDocumentationPanel from './GlobalDocumentationPanel.vue';
import MenuButton from './MenuButton.vue';
import IconButton from './IconButton.vue';
import ToastNotifications from './ToastNotifications.vue';
import { useMidi } from '../composables/useMidi';
import { useClipboard } from '../composables/useClipboard';
import { useStaticAnalyzer } from '../composables/useStaticAnalyzer';
import { useWarningLog } from '../composables/useWarningLog';
import { useMappingCache, type CachedMapping } from '../composables/useMappingCache';
import { useActionHistory, type DeserializationContext } from '../composables/useActionHistory';
import { useVariableUsage } from '../composables/useVariableUsage';
import { SetRowColorCommand, SetRowCommentCommand } from '../commands';
import { MIDI_LEARN_FUNCTION_KEY } from '../constants/midi';
import { COLOR_PALETTE } from '../constants/colors';

const mappingDocument = ref<MappingDocument>(new MappingDocument());
const fileInput = ref<HTMLInputElement | null>(null);

const currentlySelectedSourceTypes = ref(new Array<MappingType>());
const currentlySelectedDestinationTypes = ref(new Array<MappingType>());

// Multi-selection state
const selectedRowIndices = ref<Set<number>>(new Set());
const lastClickedRowIndex = ref<number | null>(null);

// Comment section expansion state
const expandedCommentRowIndex = ref<number | null>(null);

// Computed for backwards compatibility with single selection UI
const selectedRowIndex = computed(() =>
  selectedRowIndices.value.size === 1
    ? [...selectedRowIndices.value][0]
    : null
);

// Row comments storage (keyed by row index)
const rowComments = ref<Record<number, string>>({});

// Row colors storage (keyed by row index)
const rowColors = ref<Map<number, string>>(new Map());

// Toast notifications component ref
const toastNotifications = ref<InstanceType<typeof ToastNotifications> | null>(null);

function showToast(message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info', duration = 5000): void {
  // Show toast notification
  toastNotifications.value?.show(message, type, duration);

  // Also log to warning log (success messages go to info log)
  if (type === 'info' || type === 'success') {
    logInfo('system', message);
  } else if (type === 'warning') {
    logWarning('system', message);
  } else {
    logError('system', message);
  }
}


// Settings Panel expanded state (for MIDI Monitor positioning)
const settingsPanelExpanded = ref(false);

// MIDI Monitor expanded state (for Variable Monitor positioning)
const midiMonitorExpanded = ref(false);

// Variable Monitor expanded state (for toolbar positioning)
const variableMonitorExpanded = ref(false);

// Selection Toolbar expanded state
const selectionToolbarExpanded = ref(false);

// Log Monitor expanded state
const logMonitorExpanded = ref(false);

// Global Documentation Panel expanded state
const getInitialGlobalDocExpanded = (): boolean => {
  const stored = localStorage.getItem('global-doc-panel-expanded');
  return stored ? JSON.parse(stored) : false;
};
const globalDocPanelExpanded = ref(getInitialGlobalDocExpanded());

// Persist expanded state changes
watch(globalDocPanelExpanded, (newValue) => {
  localStorage.setItem('global-doc-panel-expanded', JSON.stringify(newValue));
});

// Panel visibility state (controlled from Settings Panel)
const SELECTION_TOOLBAR_VISIBLE_KEY = 'nerdseq-show-selection-toolbar';
const MIDI_MONITOR_VISIBLE_KEY = 'nerdseq-show-midi-monitor';
const VARIABLE_MONITOR_VISIBLE_KEY = 'nerdseq-show-variable-monitor';
const LOG_MONITOR_VISIBLE_KEY = 'nerdseq-show-log-monitor';
const DESCRIPTION_VISIBLE_KEY = 'nerdseq-show-description';
const MIDI_LEARN_AUTO_ADVANCE_KEY = 'nerdseq-midi-learn-auto-advance';
const PASTE_AUTO_ADVANCE_KEY = 'nerdseq-paste-auto-advance';
// Selection Toolbar defaults to true (enabled by default)
const showSelectionToolbar = ref(localStorage.getItem(SELECTION_TOOLBAR_VISIBLE_KEY) !== 'false');
const showMidiMonitor = ref(localStorage.getItem(MIDI_MONITOR_VISIBLE_KEY) === 'true');
const showVariableMonitor = ref(localStorage.getItem(VARIABLE_MONITOR_VISIBLE_KEY) === 'true');
const showLogMonitor = ref(localStorage.getItem(LOG_MONITOR_VISIBLE_KEY) === 'true');
const showDescription = ref(localStorage.getItem(DESCRIPTION_VISIBLE_KEY) === 'true');
const midiLearnAutoAdvance = ref(localStorage.getItem(MIDI_LEARN_AUTO_ADVANCE_KEY) !== 'false'); // Default: true

// Initialize paste auto-advance setting with proper type handling
const storedPasteAutoAdvance = localStorage.getItem(PASTE_AUTO_ADVANCE_KEY);
const pasteAutoAdvance = ref<'disabled' | 'rows-only' | 'all'>(
  storedPasteAutoAdvance === 'disabled' || storedPasteAutoAdvance === 'rows-only' || storedPasteAutoAdvance === 'all'
    ? storedPasteAutoAdvance
    : 'all' // Default: all
);

// Track which row should auto-start MIDI learn
const midiLearnAutoStartRow = ref<number | null>(null);

// Track last learned MIDI message globally to prevent duplicates
const lastLearnedMidiMessage = ref<string | null>(null);

// Watch and persist panel visibility
watch(showSelectionToolbar, (val) => {
  localStorage.setItem(SELECTION_TOOLBAR_VISIBLE_KEY, val.toString());
  if (!val) selectionToolbarExpanded.value = false;
});
watch(showMidiMonitor, (val) => {
  localStorage.setItem(MIDI_MONITOR_VISIBLE_KEY, val.toString());
  if (!val) midiMonitorExpanded.value = false;
});
watch(showVariableMonitor, (val) => {
  localStorage.setItem(VARIABLE_MONITOR_VISIBLE_KEY, val.toString());
  if (!val) variableMonitorExpanded.value = false;
});
watch(showLogMonitor, (val) => {
  localStorage.setItem(LOG_MONITOR_VISIBLE_KEY, val.toString());
  if (!val) logMonitorExpanded.value = false;
});
watch(showDescription, (val) => {
  localStorage.setItem(DESCRIPTION_VISIBLE_KEY, val.toString());
  if (!val) globalDocPanelExpanded.value = false;
});
watch(midiLearnAutoAdvance, (val) => {
  localStorage.setItem(MIDI_LEARN_AUTO_ADVANCE_KEY, val.toString());
});

watch(pasteAutoAdvance, (val) => {
  localStorage.setItem(PASTE_AUTO_ADVANCE_KEY, val);
});

// Row index display format (hex/decimal)
const displayRowIndexAsHex = ref(false);
const ROW_INDEX_DISPLAY_KEY = 'row-index-display-hex';

const { isSupported: midiSupported } = useMidi();

// Clipboard functionality via composable
const {
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
  clearDestination
} = useClipboard({
  mappingDocument,
  currentlySelectedSourceTypes,
  currentlySelectedDestinationTypes,
  rowComments  // Pass rowComments so they swap with rows
});

// Static Logic Analyzer
const {
  warnings: analyzerWarnings,
  warningCount,
  errorCount,
  analyzeDocument,
  getRowWarnings,
  rowHasWarnings
} = useStaticAnalyzer(mappingDocument, displayRowIndexAsHex);

// Variable Usage tracking
const { variableUsage } = useVariableUsage(mappingDocument);

// Warning Log
const {
  addInfo: logInfo,
  addWarning: logWarning,
  addError: logError
} = useWarningLog();

// Mapping Cache (A/B toggle)
const {
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
  loadFromSlot
} = useMappingCache();

// Action History (Undo/Redo) with per-slot support
const actionHistoryContext: DeserializationContext = {
  rowColors: rowColors.value,
  rowComments: rowComments.value
};

const {
  canUndo,
  canRedo,
  undoDescription,
  redoDescription,
  executeCommand,
  undo,
  redo,
  clearCurrentHistory
} = useActionHistory({
  activeSlot,
  isLockedA,
  isLockedB,
  context: actionHistoryContext,
  onExecute: (cmd, slot) => {
    logInfo('system', `[Slot ${slot}] ${cmd.getDescription()}`);
  },
  onUndo: (cmd, slot) => {
    logInfo('system', `[Slot ${slot}] Undid: ${cmd.getDescription()}`);
  },
  onRedo: (cmd, slot) => {
    logInfo('system', `[Slot ${slot}] Redid: ${cmd.getDescription()}`);
  }
});

// Serialize current document for caching
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

// Deserialize cached data to document
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

// Save current document to cache (debounced)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
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

// Handle A/B slot click - switch or toggle lock
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

// Row selection functions
function handleRowClick(rowIndex: number, event: MouseEvent): void {
  if (event.shiftKey && lastClickedRowIndex.value !== null) {
    // Shift+Click: Select range with sticky comment state
    const wasCommentOpen = expandedCommentRowIndex.value !== null;
    const start = Math.min(lastClickedRowIndex.value, rowIndex);
    const end = Math.max(lastClickedRowIndex.value, rowIndex);
    for (let i = start; i <= end; i++) {
      selectedRowIndices.value.add(i);
    }
    if (wasCommentOpen) {
      // Apply comment state to newly selected row
      if (rowComments.value[rowIndex] === undefined) {
        rowComments.value[rowIndex] = '';
      }
      expandedCommentRowIndex.value = rowIndex;
    } else {
      expandedCommentRowIndex.value = null;
    }
  } else if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd+Click: Toggle individual with sticky comment state
    const wasCommentOpen = expandedCommentRowIndex.value !== null;
    if (selectedRowIndices.value.has(rowIndex)) {
      selectedRowIndices.value.delete(rowIndex);
      // Clear comment expansion if this row was expanded
      if (expandedCommentRowIndex.value === rowIndex) {
        expandedCommentRowIndex.value = null;
      }
    } else {
      selectedRowIndices.value.add(rowIndex);
      if (wasCommentOpen) {
        // Apply comment state to newly selected row
        if (rowComments.value[rowIndex] === undefined) {
          rowComments.value[rowIndex] = '';
        }
        expandedCommentRowIndex.value = rowIndex;
      } else {
        expandedCommentRowIndex.value = null;
      }
    }
  } else {
    // Normal click: Simple three-click cycle with sticky comment state
    const isOnlySelected = selectedRowIndices.value.size === 1 && selectedRowIndices.value.has(rowIndex);
    const isCommentExpanded = expandedCommentRowIndex.value === rowIndex;
    const wasCommentOpen = expandedCommentRowIndex.value !== null; // Track if ANY comment was open

    if (!selectedRowIndices.value.has(rowIndex)) {
      // Click 1: Select row and apply current comment state
      selectedRowIndices.value.clear();
      selectedRowIndices.value.add(rowIndex);
      if (wasCommentOpen) {
        // Previous selection had comment open, so open this one too
        if (rowComments.value[rowIndex] === undefined) {
          rowComments.value[rowIndex] = '';
        }
        expandedCommentRowIndex.value = rowIndex;
      } else {
        // Previous selection had no comment, so don't open this one
        expandedCommentRowIndex.value = null;
      }
    } else if (isOnlySelected && !isCommentExpanded) {
      // Click 2: Open comment section
      if (rowComments.value[rowIndex] === undefined) {
        rowComments.value[rowIndex] = '';
      }
      expandedCommentRowIndex.value = rowIndex;
    } else if (isOnlySelected && isCommentExpanded) {
      // Click 3: Deselect row
      selectedRowIndices.value.clear();
      expandedCommentRowIndex.value = null;
    } else {
      // Clicked on a different row in a multi-selection - switch to single selection
      selectedRowIndices.value.clear();
      selectedRowIndices.value.add(rowIndex);
      if (wasCommentOpen) {
        // Previous selection had comment open, apply to new selection
        if (rowComments.value[rowIndex] === undefined) {
          rowComments.value[rowIndex] = '';
        }
        expandedCommentRowIndex.value = rowIndex;
      } else {
        expandedCommentRowIndex.value = null;
      }
    }
  }
  lastClickedRowIndex.value = rowIndex;
  // Force reactivity
  selectedRowIndices.value = new Set(selectedRowIndices.value);
}


// Handle scroll to row from LogMonitor
function handleScrollToRow(rowIndex: number): void {
  // Select the row (no comment opens)
  selectedRowIndices.value.clear();
  selectedRowIndices.value.add(rowIndex);
  expandedCommentRowIndex.value = null;
  selectedRowIndices.value = new Set(selectedRowIndices.value);
  
  // Scroll the row into view
  const rowElement = document.querySelector(`[data-row-index="${rowIndex}"]`);
  if (rowElement) {
    rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}


// Helper function for MIDI learn source function update
function handleSourceMidiLearnFunctionUpdate(rowIndex: number, functionKey: number): void {
  const sourceFunc = currentlySelectedSourceTypes.value[rowIndex].functions.find((f: MappingTuple) => f.key === functionKey);
  if (sourceFunc) {
    mappingDocument.value.rows[rowIndex].source.function = new SourceFunction(functionKey, sourceFunc.abbr, sourceFunc.description);
  }
  // Reset auto-start flag and advance to next MIDI Learn row
  midiLearnAutoStartRow.value = null;
  handleMidiLearnComplete(rowIndex);
}

// Helper function for MIDI learn destination function update
function handleDestMidiLearnFunctionUpdate(rowIndex: number, functionKey: number): void {
  const destFunc = currentlySelectedDestinationTypes.value[rowIndex].functions.find((f: MappingTuple) => f.key === functionKey);
  if (destFunc) {
    mappingDocument.value.rows[rowIndex].destination.function = new DestinationFunction(functionKey, destFunc.abbr, destFunc.description);
  }
  // Reset auto-start flag and advance to next MIDI Learn row
  midiLearnAutoStartRow.value = null;
  handleMidiLearnComplete(rowIndex);
}

// Handle MIDI learn completion - auto-advance to next MIDI Learn row if enabled
function handleMidiLearnComplete(currentRowIndex: number): void {
  if (!midiLearnAutoAdvance.value) return;
  
  // Find the next row with MIDI Learn (source MIDI Learn OR destination MIDI CC Learn)
  let nextLearnRowIndex = -1;
  for (let i = currentRowIndex + 1; i < mappingDocument.value.rows.length; i++) {
    const row = mappingDocument.value.rows[i];
    
    // Check for source MIDI Learn (MIDI/CC/NRPN with Learn function)
    const isSourceMidiLearn = [5, 6, 7].includes(row.source.type.key) && row.source.function.key === 48;
    
    // Check for destination MIDI CC Learn
    const isDestMidiLearn = row.destination.type.key === 5 && row.destination.function.key === 48;
    
    if (isSourceMidiLearn || isDestMidiLearn) {
      nextLearnRowIndex = i;
      break;
    }
  }
  
  // If found, select that row and trigger auto-start
  if (nextLearnRowIndex !== -1) {
    selectedRowIndices.value.clear();
    selectedRowIndices.value.add(nextLearnRowIndex);
    expandedCommentRowIndex.value = null;
    selectedRowIndices.value = new Set(selectedRowIndices.value);
    
    // Set the auto-start flag for the next row
    midiLearnAutoStartRow.value = nextLearnRowIndex;
    
    // Scroll into view
    const rowElement = document.querySelector(`[data-row-index="${nextLearnRowIndex}"]`);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

function clearRowSelection(): void {
  selectedRowIndices.value.clear();
  selectedRowIndices.value = new Set();
  lastClickedRowIndex.value = null;
}

function isRowSelected(rowIndex: number): boolean {
  return selectedRowIndices.value.has(rowIndex);
}

// Variable slider handler
function updateVariableValue(variableIndex: number, value: number): void {
  if (variableIndex >= 0 && variableIndex < mappingDocument.value.variables.length) {
    mappingDocument.value.variables[variableIndex].value = value;
    scheduleCacheSave();
  }
}

function formatRowIndex(index: number): string {
  if (displayRowIndexAsHex.value) {
    return index.toString(16).toUpperCase().padStart(2, '0');
  }
  return index.toString();
}

/**
 * Helper: Check if a byte is a constant (0-25 = constants 0-4095)
 */
function isConstant(byte: number): boolean {
  return byte >= 0 && byte <= 25;
}

/**
 * Helper: Get constant value from byte (0-25 maps to values 0-4095)
 */
function getConstantValue(byte: number): number {
  // Constants 0-25 map to values: 0, 1, 2, ..., 4095
  // Using step increments for higher values
  const constantMap = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50,
    100, 200, 500, 1000, 2000, 3000, 4095
  ];
  return constantMap[byte] ?? 0;
}

// Type alias for row-like objects (works with both Row instances and plain objects)
type RowLike = {
  index: number;
  source: {
    type: { key: number };
    function: { key: number };
    extra: { keyOrValue: number }
  };
  destination: {
    type: { key: number };
    function: { key: number };
    extra: { keyOrValue: number }
  }
};

/**
 * Analyze Skip SOURCE condition to check if it will actually skip
 * Returns: true if skip will execute, false if skip is always false, null if indeterminate
 */
function analyzeSkipSourceCondition(row: RowLike): boolean | null {
  if (row.source.type.key !== SKIP_SOURCE_TYPE_KEY) {
    return null;
  }

  const extraValue = row.source.extra.keyOrValue;
  const byte1 = (extraValue >> 8) & 0xFF;
  const byte2 = extraValue & 0xFF;

  // If not both constants, we can't determine at edit time - assume it might skip
  if (!isConstant(byte1) || !isConstant(byte2)) {
    return null; // Indeterminate
  }

  const val1 = getConstantValue(byte1);
  const val2 = getConstantValue(byte2);

  // Get condition from function key
  const funcKey = row.source.function.key;
  if (funcKey === EMPTY_KEY) {
    return false;
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
    default: return null;
  }

  return result;
}

/**
 * Analyze Skip DESTINATION condition
 * Now uses the same encoding as SOURCE (function = skip count + condition, extra = params)
 */
function analyzeSkipDestCondition(row: RowLike): boolean | null {
  if (row.destination.type.key !== SKIP_DESTINATION_TYPE_KEY) {
    return null;
  }

  const extraValue = row.destination.extra.keyOrValue;
  const byte1 = (extraValue >> 8) & 0xFF;
  const byte2 = extraValue & 0xFF;

  // If not both constants, we can't determine at edit time - assume it might skip
  if (!isConstant(byte1) || !isConstant(byte2)) {
    return null; // Indeterminate
  }

  const val1 = getConstantValue(byte1);
  const val2 = getConstantValue(byte2);

  // Get condition from function key (same as SOURCE)
  const funcKey = row.destination.function.key;
  if (funcKey === EMPTY_KEY) {
    return false;
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
    default: return null;
  }

  return result;
}

function isRowSkipped(row: RowLike): boolean {
  // Check if this row will be skipped by a previous row's Skip command
  const currentIndex = row.index;

  // Check all previous rows
  for (let i = 0; i < currentIndex; i++) {
    const prevRow = mappingDocument.value.rows[i] as MappingRow;

    // Check Skip source
    if (prevRow.source.type.key === SKIP_SOURCE_TYPE_KEY) {
      const functionKey = prevRow.source.function.key;
      if (functionKey !== EMPTY_KEY) {
        const skipCount = Math.floor(functionKey / 6) + 1;

        // Check if this row falls within the skip range
        if (skipCount > 0 && currentIndex > i && currentIndex <= i + skipCount) {
          // Analyze the skip condition
          const willSkip = analyzeSkipSourceCondition(prevRow);

          // Only show X if skip is DEFINITELY TRUE (not false, not indeterminate)
          // Show > for always false or indeterminate (variables, row refs)
          if (willSkip === true) {
            return true;
          }
        }
      }
    }

    // Check Skip destination
    // Skip DESTINATION function encoding: skip_count (1-16) * 6 + condition (0-5)
    // Decode skip count: Math.floor(functionKey / 6) + 1 (SAME AS SOURCE)
    if (prevRow.destination.type.key === SKIP_DESTINATION_TYPE_KEY) {
      const functionKey = prevRow.destination.function.key;
      if (functionKey !== EMPTY_KEY) {
        const skipCount = Math.floor(functionKey / 6) + 1;

        // Check if this row falls within the skip range
        if (skipCount > 0 && currentIndex > i && currentIndex <= i + skipCount) {
          // Analyze the skip condition
          const willSkip = analyzeSkipDestCondition(prevRow);

          // Only show X if skip is DEFINITELY TRUE (not false, not indeterminate)
          // Show > for always false or indeterminate (variables, row refs)
          if (willSkip === true) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

// Multi-selection computed properties
const sortedSelectedIndices = computed(() =>
  [...selectedRowIndices.value].sort((a, b) => a - b)
);

const canMoveUp = computed(() => {
  if (selectedRowIndices.value.size === 0) return false;
  return sortedSelectedIndices.value[0] > 0;
});

const canMoveDown = computed(() => {
  if (selectedRowIndices.value.size === 0) return false;
  const maxIndex = mappingDocument.value.rows.length - 1;
  return sortedSelectedIndices.value[sortedSelectedIndices.value.length - 1] < maxIndex;
});

// Multi-selection toolbar handlers
function handleMultiCut(): void {
  cutRows(sortedSelectedIndices.value);
}

function handleMultiCopy(): void {
  const indices = sortedSelectedIndices.value;
  if (indices.length === 1) {
    copyRow(indices[0]);
  } else if (indices.length > 1) {
    copyRows(indices);
  }
}

function handleMultiPaste(): void {
  if (sortedSelectedIndices.value.length > 0) {
    const startIndex = sortedSelectedIndices.value[0];

    // For single row paste, use handlePasteRow to get auto-advance behavior
    if (hasCopiedRow.value && sortedSelectedIndices.value.length === 1) {
      handlePasteRow(startIndex);
    } else {
      // For multi-row paste, use pasteRows directly (no auto-advance)
      pasteRows(startIndex);
    }
  }
}

function handleMultiMoveUp(): void {
  const result = moveRowsUp(sortedSelectedIndices.value);
  selectedRowIndices.value = new Set(result.newIndices);
  handleMoveWarnings(result.referenceUpdateResult);
}

function handleMultiMoveDown(): void {
  const result = moveRowsDown(sortedSelectedIndices.value);
  selectedRowIndices.value = new Set(result.newIndices);
  handleMoveWarnings(result.referenceUpdateResult);
}

// Paste operation wrappers with auto-advance support
function handlePasteRow(rowIndex: number): void {
  pasteRow(rowIndex);
  if (pasteAutoAdvance.value === 'rows-only' || pasteAutoAdvance.value === 'all') {
    advanceToNextRow(rowIndex, false); // Close comment section for full row paste
  }
}

function handlePasteSource(rowIndex: number): void {
  pasteSource(rowIndex);
  if (pasteAutoAdvance.value === 'all') {
    advanceToNextRow(rowIndex, true); // Keep comment section open for source paste
  }
}

function handlePasteDestination(rowIndex: number): void {
  pasteDestination(rowIndex);
  if (pasteAutoAdvance.value === 'all') {
    advanceToNextRow(rowIndex, true); // Keep comment section open for destination paste
  }
}

// Helper function to advance to the next row
function advanceToNextRow(currentRowIndex: number, keepCommentOpen = false): void {
  const nextRowIndex = currentRowIndex + 1;
  if (nextRowIndex < mappingDocument.value.rows.length) {
    selectedRowIndices.value.clear();
    selectedRowIndices.value.add(nextRowIndex);

    // Keep comment section open if requested (for source/destination paste workflow)
    if (keepCommentOpen) {
      expandedCommentRowIndex.value = nextRowIndex;
    } else {
      expandedCommentRowIndex.value = null;
    }

    selectedRowIndices.value = new Set(selectedRowIndices.value);

    // Scroll into view
    const rowElement = document.querySelector(`[data-row-index="${nextRowIndex}"]`);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// Track accumulated reference updates for toast deduplication
let accumulatedReferenceCount = 0;
let accumulatedWarnings: Array<{ message: string; type: string }> = [];
let toastDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function handleMoveWarnings(result: { updatedCount: number; warnings: Array<{ message: string; type: string }> }): void {
  // Accumulate reference count
  accumulatedReferenceCount += result.updatedCount;
  
  // Accumulate unique warnings
  const definitionOrderWarnings = result.warnings.filter(w => w.type === 'definition_order');
  for (const warning of definitionOrderWarnings) {
    if (!accumulatedWarnings.some(w => w.message === warning.message)) {
      accumulatedWarnings.push(warning);
    }
  }

  // Clear existing timer
  if (toastDebounceTimer) {
    clearTimeout(toastDebounceTimer);
  }

  // Debounce: show toast after 1 second of no moves
  toastDebounceTimer = setTimeout(() => {
    if (accumulatedReferenceCount > 0) {
      const msg = `Updated ${accumulatedReferenceCount} row reference${accumulatedReferenceCount > 1 ? 's' : ''}.`;
      showToast(msg, 'info');
      accumulatedReferenceCount = 0;
    }

    // Show accumulated warnings
    for (const warning of accumulatedWarnings) {
      showToast(warning.message, 'warning', 8000);
    }
    accumulatedWarnings = [];
  }, 1000);
}

function handleMultiClear(): void {
  clearRows(sortedSelectedIndices.value);
}

function setRowColor(color: string | null): void {
  for (const idx of selectedRowIndices.value) {
    const colorValue = color && COLOR_PALETTE[color] ? COLOR_PALETTE[color] : null;
    const cmd = new SetRowColorCommand(idx, colorValue, rowColors.value);
    executeCommand(cmd);
  }
  // Note: Vue 3 tracks Map operations, no need to create new Map
}

function getRowBackgroundColor(rowIndex: number): string | undefined {
  return rowColors.value.get(rowIndex);
}

// Keyboard shortcuts for multi-selection
function handleKeyDown(event: KeyboardEvent): void {
  // Don't handle shortcuts if user is typing in an input
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return;
  }

  // Slot switching shortcuts (1 = Slot A, 2 = Slot B)
  if (event.key === '1' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    if (activeSlot.value !== 'A') {
      handleSlotSwitch('A');
    }
    event.preventDefault();
    return;
  } else if (event.key === '2' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    if (activeSlot.value !== 'B') {
      handleSlotSwitch('B');
    }
    event.preventDefault();
    return;
  }

  // Undo/Redo shortcuts (work globally, not just for selections)
  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    undo();
    event.preventDefault();
    return;
  } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
    redo();
    event.preventDefault();
    return;
  }

  // Rest of shortcuts require row selection
  if (selectedRowIndices.value.size === 0) return;

  const indices = sortedSelectedIndices.value;

  if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
    if (selectedRowIndices.value.size > 1) {
      copyRows(indices);
    } else if (indices.length === 1) {
      copyRow(indices[0]);
    }
    event.preventDefault();
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'x') {
    if (selectedRowIndices.value.size > 1) {
      cutRows(indices);
    }
    event.preventDefault();
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
    if (hasCopiedRows.value && indices.length > 0) {
      pasteRows(indices[0]);
    } else if (hasCopiedRow.value && indices.length === 1) {
      const currentRowIndex = indices[0];
      pasteRow(currentRowIndex);

      // Auto-advance to next row after full row paste (if enabled)
      if (pasteAutoAdvance.value === 'rows-only' || pasteAutoAdvance.value === 'all') {
        advanceToNextRow(currentRowIndex);
      }
    }
    event.preventDefault();
  } else if (event.key === 'Escape') {
    clearRowSelection();
    event.preventDefault();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    // Check lock state before clearing
    if (isCurrentLocked.value) {
      event.preventDefault();
      return;
    }

    if (selectedRowIndices.value.size > 1) {
      clearRows(indices);
    } else if (indices.length === 1) {
      clearRow(indices[0]);
    }
    event.preventDefault();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
  // Load row index display preference from localStorage
  displayRowIndexAsHex.value = localStorage.getItem(ROW_INDEX_DISPLAY_KEY) === 'true';
});

// Persist row index display preference
watch(displayRowIndexAsHex, (val) => {
  localStorage.setItem(ROW_INDEX_DISPLAY_KEY, val.toString());
  // Re-run analysis to update row indices in warning messages
  analyzeDocument();
});

// Auto-save to cache when document changes
watch(
  () => mappingDocument.value,
  () => {
    scheduleCacheSave();
  },
  { deep: true }
);

// Also save when colors or comments change
watch(rowColors, () => scheduleCacheSave(), { deep: true });
watch(rowComments, () => scheduleCacheSave(), { deep: true });

// Watch for slot switching (history automatically switches with activeSlot)
watch(activeSlot, (newSlot, oldSlot) => {
  if (newSlot !== oldSlot) {
    logInfo('system', `Switched to Slot ${newSlot} (undo history preserved)`);
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});

function readFile() {
  const file = fileInput.value?.files?.[0];

  if (!file) {
    alert('No file uploaded!');
    return;
  }

  const reader = new FileReader();
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  switch (fileExtension) {

    case 'map':
      reader.readAsArrayBuffer(file);
      reader.onload = async function (e: any) {
        try {
          const fileData = new Uint8Array(e.target.result);
          console.log(`Loading .map file: ${file.name}, size: ${fileData.length} bytes`);
          mappingDocument.value = MappingDocumentParser.parse(fileData);
          init();
          clearCurrentHistory(); // Clear undo history after loading new file
          console.log('.map file loaded successfully');
          showToast(`Loaded ${file.name} successfully`, 'success', 3000);
          // Clear file input to allow reloading the same file
          if (fileInput.value) {
            fileInput.value.value = '';
          }
        } catch (error) {
          console.error('Error parsing .map file:', error);
          alert(`Error loading .map file: ${error instanceof Error ? error.message : String(error)}\n\nFile: ${file.name}\nSize: ${e.target.result.byteLength} bytes\n\nCheck console for details.`);
        }
      };
      break;

    case 'json':
      reader.readAsText(file);
      reader.onload = function (e: any) {
        try {
          const fileData = e.target.result;
          console.log(`Loading .json file: ${file.name}, size: ${fileData.length} chars`);
          const jsonData = JSON.parse(fileData);

          // Validate the JSON file against the schema
          const ajv = () => new Ajv({ allErrors: true });
          const validate = ajv().compile(schema);
          const isValid = validate(jsonData);
          if (!isValid) {
            console.error('JSON Schema validation failed:', validate.errors);
            alert(`Invalid JSON file structure!\n\nValidation errors:\n${validate.errors?.map(err => `• ${err.instancePath || 'root'}: ${err.message}`).join('\n')}\n\nCheck console for full details.`);
            return;
          }

          // Reconstruct the MappingDocument with proper class instances
          const mappingDoc = new MappingDocument();
          const jsonObj = jsonData as any; // Cast to any to access properties
          
          // Handle both old and new JSON formats
          if (jsonObj.header) {
            // Old format
            mappingDoc.header.headerText = jsonObj.header.headerText || mappingDoc.header.headerText;
            mappingDoc.header.majorVersion = jsonObj.header.majorVersion || mappingDoc.header.majorVersion;
            mappingDoc.header.minorVersion = jsonObj.header.minorVersion || mappingDoc.header.minorVersion;
            mappingDoc.header.fileName = jsonObj.header.fileName || mappingDoc.header.fileName;
          } else if (jsonObj.mappings) {
            // New format
            mappingDoc.header.headerText = jsonObj.header || mappingDoc.header.headerText;
            mappingDoc.header.majorVersion = jsonObj.versionMajor || mappingDoc.header.majorVersion;
            mappingDoc.header.minorVersion = jsonObj.versionMinor || mappingDoc.header.minorVersion;
            mappingDoc.header.fileName = jsonObj.filename || mappingDoc.header.fileName;
            
            // Handle placeholder bytes
            if (jsonObj.placeholderBytes && Array.isArray(jsonObj.placeholderBytes)) {
              mappingDoc.header.reserved = new Uint8Array(jsonObj.placeholderBytes);
            }
          }

          // Convert rows - handle both old and new formats
          const rowsData = jsonObj.rows || jsonObj.mappings;
          if (rowsData && Array.isArray(rowsData)) {
            for (let i = 0; i < mappingDoc.rows.length; i++) {
              const rowData = rowsData[i];
              const row = mappingDoc.rows[i]; // Use the pre-initialized row
              
              if (rowData) {
                // Handle both old format (rowData.source.type) and new format (rowData.sourceType)
                const sourceTypeKey = rowData.source?.type ?? rowData.sourceType;
                const sourceFunctionKey = rowData.source?.function ?? rowData.sourceFunction;  
                const sourceExtraKey = rowData.source?.extra ?? rowData.sourceFunctionExtra;
                const destinationTypeKey = rowData.destination?.type ?? rowData.destinationType;
                const destinationFunctionKey = rowData.destination?.function ?? rowData.destinationFunction;
                const destinationExtraKey = rowData.destination?.extra ?? rowData.destinationFunctionExtra;
                
                // Source - lookup from DataModel using numeric keys
                const sourceTypeData = DataModel.sourceTypes.find(st => st.key === sourceTypeKey) as MappingType | undefined;
                const sourceType = sourceTypeData ? new SourceType(sourceTypeData.key, sourceTypeData.abbr, sourceTypeData.description) 
                                                  : new SourceType(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
                
                const sourceFunctionData = sourceTypeData?.functions.find((sf: MappingTuple) => sf.key === sourceFunctionKey);
                const sourceFunction = sourceFunctionData ? new SourceFunction(sourceFunctionData.key, sourceFunctionData.abbr, sourceFunctionData.description)
                                                          : new SourceFunction(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
                
                const sourceExtraData = sourceTypeData?.extras?.find((se: MappingTuple) => se.key === sourceExtraKey);
                const sourceExtra = sourceExtraData ? new SourceExtra(sourceExtraData.key, sourceExtraData.abbr, sourceExtraData.description)
                                                    : new SourceExtra(sourceExtraKey, EMPTY_ABBR, EMPTY_DESCRIPTION);
                
                row.source = new Source(sourceType, sourceFunction, sourceExtra);
                
                // Destination - lookup from DataModel using numeric keys  
                const destinationTypeData = DataModel.destinationTypes.find(dt => dt.key === destinationTypeKey) as MappingType | undefined;
                const destinationType = destinationTypeData ? new DestinationType(destinationTypeData.key, destinationTypeData.abbr, destinationTypeData.description)
                                                            : new DestinationType(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
                
                const destinationFunctionData = destinationTypeData?.functions.find((df: MappingTuple) => df.key === destinationFunctionKey);
                const destinationFunction = destinationFunctionData ? new DestinationFunction(destinationFunctionData.key, destinationFunctionData.abbr, destinationFunctionData.description)
                                                                    : new DestinationFunction(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
                
                const destinationExtraData = destinationTypeData?.extras?.find((de: MappingTuple) => de.key === destinationExtraKey);
                const destinationExtra = destinationExtraData ? new DestinationExtra(destinationExtraData.key, destinationExtraData.abbr, destinationExtraData.description)
                                                              : new DestinationExtra(destinationExtraKey, EMPTY_ABBR, EMPTY_DESCRIPTION);
                
                row.destination = new Destination(destinationType, destinationFunction, destinationExtra);
                
                // Handle unused fields for new format
                if (typeof rowData.unused1 === 'number') row.unused1 = rowData.unused1;
                if (typeof rowData.unused2 === 'number') row.unused2 = rowData.unused2;
                if (typeof rowData.unused3 === 'number') row.unused3 = rowData.unused3;
                if (typeof rowData.unused4 === 'number') row.unused4 = rowData.unused4;
              }
              // If no rowData for this index, the row keeps its default empty values
            }
          }

          // Update variables from JSON
          const variablesData = jsonObj.variables;
          if (variablesData && Array.isArray(variablesData)) {
            for (let i = 0; i < mappingDoc.variables.length && i < variablesData.length; i++) {
              const varData = variablesData[i];
              if (typeof varData === 'number') {
                // New format: direct values
                mappingDoc.variables[i].value = varData;
              } else if (varData && typeof varData.value === 'number') {
                // Old format: objects with value property
                mappingDoc.variables[i].value = varData.value;
              }
            }
          }

          // Load editor metadata (row colors, comments, and global documentation)
          if (jsonObj.editorMetadata) {
            const metadata = jsonObj.editorMetadata;

            // Load row colors (preserve Map reference for undo commands)
            if (metadata.rowColors && typeof metadata.rowColors === 'object') {
              rowColors.value.clear();
              for (const [indexStr, color] of Object.entries(metadata.rowColors)) {
                const index = parseInt(indexStr, 10);
                if (!isNaN(index) && typeof color === 'string') {
                  rowColors.value.set(index, color);
                }
              }
            }

            // Load row comments
            if (metadata.rowComments && typeof metadata.rowComments === 'object') {
              rowComments.value = metadata.rowComments as Record<number, string>;
            }

            // Load global documentation field
            if (metadata.globalComment && typeof metadata.globalComment === 'string') {
              mappingDoc.globalComment = metadata.globalComment;
            }
          }

          mappingDocument.value = mappingDoc;
          init();
          clearCurrentHistory(); // Clear undo history after loading new file
          console.log('.json file loaded successfully');
          showToast(`Loaded ${file.name} successfully`, 'success', 3000);
          // Clear file input to allow reloading the same file
          if (fileInput.value) {
            fileInput.value.value = '';
          }
        } catch (error) {
          console.error('Error parsing .json file:', error);
          if (error instanceof SyntaxError) {
            alert(`JSON Parse Error: ${error.message}\n\nFile: ${file.name}\n\nThe file may be corrupted or not valid JSON.`);
          } else {
            alert(`Error loading .json file: ${error instanceof Error ? error.message : String(error)}\n\nFile: ${file.name}\n\nCheck console for details.`);
          }
        }
      };
      break;

    default:
      alert(`Invalid file type: "${fileExtension}"\n\nSupported formats: .map (binary) or .json (text)`);
  }

  reader.onerror = function (e: any) {
    console.error('FileReader error:', e);
    alert(`File reading error: ${e.target.error.name}\n\nFile: ${file.name}`);
  }
}

function reset() {
  // Check lock state before resetting
  if (isCurrentLocked.value) {
    return;
  }

  if (fileInput.value) {
    fileInput.value.value = '';
  }
  mappingDocument.value = new MappingDocument();
  currentlySelectedSourceTypes.value = new Array<MappingType>();
  currentlySelectedDestinationTypes.value = new Array<MappingType>();
  clearRowSelection();
  rowComments.value = {};
  rowColors.value.clear(); // Clear Map but preserve reference for undo commands
  clearCurrentHistory(); // Clear undo history when resetting
  // Clear analysis warnings for empty document
  analyzeDocument();
}

function init() {
  clearRowSelection();
  for (let i = 0; i < mappingDocument.value.rows.length; i++) {
    const row = mappingDocument.value.rows[i];
    // Use row.index instead of i to match template lookup
    const rowIndex = row.index;

    // Only find and set types if they're not empty
    if (row.source.type.key !== EMPTY_KEY) {
      currentlySelectedSourceTypes.value[rowIndex] = DataModel.sourceTypes.find(x => x.key === row.source.type.key) as MappingType;
    }
    if (row.destination.type.key !== EMPTY_KEY) {
      currentlySelectedDestinationTypes.value[rowIndex] = DataModel.destinationTypes.find(x => x.key === row.destination.type.key) as MappingType;
    }
  }
  // Run static analysis after loading
  analyzeDocument();

  // Show toast if warnings found
  if (warningCount.value > 0) {
    showToast(`Analysis found ${warningCount.value} warning${warningCount.value !== 1 ? 's' : ''}`, 'warning', 4000);
  }
}

function sourceTypeSelectionChanged(event: Event, rowIndex: number) {
  const sourceTypeSelectElement = event.target as HTMLSelectElement;
  const selectedSourceTypeKey = parseInt(sourceTypeSelectElement.value);
  const selectedSourceType = DataModel.sourceTypes.find(x => x.key === selectedSourceTypeKey) as MappingType;
  currentlySelectedSourceTypes.value[rowIndex] = selectedSourceType;
  const row = mappingDocument.value.rows.find(x => x.index === rowIndex) as MappingRow;
  const newSourceType = new SourceType(selectedSourceTypeKey, selectedSourceType.abbr, selectedSourceType.description);
  const newSourceFunction = new SourceFunction(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
  const newSourceExtra = new SourceExtra(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
  row.source = new Source(newSourceType, newSourceFunction, newSourceExtra);
}

function sourceFunctionSelectionChanged(event: Event, rowIndex: number) {
  const sourceFunctionSelectElement = event.target as HTMLSelectElement;
  const selectedSourceFunctionKey = parseInt(sourceFunctionSelectElement.value);
  const selectedSourceFunction = currentlySelectedSourceTypes.value[rowIndex].functions.find(x => x.key === selectedSourceFunctionKey) as MappingTuple;
  const row = mappingDocument.value.rows.find(x => x.index === rowIndex) as MappingRow
  row.source.function = new SourceFunction(selectedSourceFunctionKey, selectedSourceFunction.abbr, selectedSourceFunction.description);
  row.source.extra = new SourceExtra(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
}

enum SourceExtraVariant {
  DEFAULT,
  EXTERNAL_KEYBOARD,
  EXTERNAL_SEGA_GAMEPAD,
  EXTERNAL_NERDSEQ_BUTTONS,
}

function sourceExtraSelectionChanged(event: Event, rowIndex: number, extraVariant: SourceExtraVariant = SourceExtraVariant.DEFAULT) {
  const sourceExtraSelectElement = event.target as HTMLSelectElement;
  const selectedSourceExtraKey = parseInt(sourceExtraSelectElement.value);
  let selectedSourceExtra: MappingTuple;

  switch (extraVariant) {
    case SourceExtraVariant.EXTERNAL_KEYBOARD:
      selectedSourceExtra = keyboardSourceExtras.find(x => x.key === selectedSourceExtraKey) as MappingTuple;
      break;
    case SourceExtraVariant.EXTERNAL_SEGA_GAMEPAD:
      selectedSourceExtra = segaGamepadSourceExtras.find(x => x.key === selectedSourceExtraKey) as MappingTuple;
      break;
    case SourceExtraVariant.EXTERNAL_NERDSEQ_BUTTONS:
      selectedSourceExtra = nerdseqButtonsSourceExtras.find(x => x.key === selectedSourceExtraKey) as MappingTuple;
      break;
    default:
      selectedSourceExtra = currentlySelectedSourceTypes.value[rowIndex].extras.find(x => x.key === selectedSourceExtraKey) as MappingTuple;
      break;
  }

  const row = mappingDocument.value.rows.find(x => x.index === rowIndex) as MappingRow;
  row.source.extra = new SourceExtra(selectedSourceExtraKey, selectedSourceExtra.abbr, selectedSourceExtra.description);
}

function destinationTypeSelectionChanged(event: Event, rowIndex: number) {
  const destinationTypeSelectElement = event.target as HTMLSelectElement;
  const selectedDestinationTypeKey = parseInt(destinationTypeSelectElement.value);
  const selectedDestinationType = DataModel.destinationTypes.find(x => x.key === selectedDestinationTypeKey) as MappingType;
  currentlySelectedDestinationTypes.value[rowIndex] = selectedDestinationType;
  const row = mappingDocument.value.rows.find(x => x.index === rowIndex) as MappingRow;
  const newDestinationType = new DestinationType(selectedDestinationTypeKey, selectedDestinationType.abbr, selectedDestinationType.description);
  const newDestinationFunction = new DestinationFunction(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
  const newDestinationExtra = new DestinationExtra(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
  row.destination = new Destination(newDestinationType, newDestinationFunction, newDestinationExtra);
}

function destinationFunctionSelectionChanged(event: Event, rowIndex: number, isInit: boolean = false) {
  const destinationFunctionSelectElement = event.target as HTMLSelectElement;
  const selectedDestinationFunctionKey = parseInt(destinationFunctionSelectElement.value);
  const selectedDestinationFunction = currentlySelectedDestinationTypes.value[rowIndex].functions.find(x => x.key === selectedDestinationFunctionKey) as MappingTuple;
  const row = mappingDocument.value.rows.find(x => x.index === rowIndex) as MappingRow;
  row.destination.function = new DestinationFunction(selectedDestinationFunctionKey, selectedDestinationFunction.abbr, selectedDestinationFunction.description);
  row.destination.extra = new DestinationExtra(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
}

enum DestinationExtraVariant {
  DEFAULT,
  GLOBAL_BUTTONS,
  GLOBAL_SCREENS,
  GLOBAL_MODES,
  GLOBAL_OTHER,
  MIDI_CC,
  SKIP_CALC,
  DUAL_CHORD,
  VISU_SHADER_SELECT,
  VISU_SHADER_FUNCTIONS,
  VISU_MODULATORS,
  VISU_ENVELOPES,
  VISU_LFOS,
}

function destinationExtraSelectionChanged(event: Event, rowIndex: number, isInit: boolean = false, extraVariant: DestinationExtraVariant = DestinationExtraVariant.DEFAULT) {
  const destinationExtraSelectElement = event.target as HTMLSelectElement;
  const selectedDestinationExtraKey = parseInt(destinationExtraSelectElement.value);
  let selectedDestinationExtra: MappingTuple;
  switch (extraVariant) {
    case DestinationExtraVariant.GLOBAL_BUTTONS:
      selectedDestinationExtra = globalButtonsDestinationExtras.find(x => x.key === selectedDestinationExtraKey) as MappingTuple;
      break;
    case DestinationExtraVariant.GLOBAL_SCREENS:
      selectedDestinationExtra = globalScreensDestinationExtras.find(x => x.key === selectedDestinationExtraKey) as MappingTuple;
      break;
    case DestinationExtraVariant.GLOBAL_MODES:
      selectedDestinationExtra = globalModesDestinationExtras.find(x => x.key === selectedDestinationExtraKey) as MappingTuple;
      break;
    case DestinationExtraVariant.VISU_SHADER_SELECT:
      selectedDestinationExtra = visuShaderSelectExtras.find(x => x.key === selectedDestinationExtraKey) as MappingTuple;
      break;
    case DestinationExtraVariant.VISU_SHADER_FUNCTIONS:
      selectedDestinationExtra = visuShaderFunctionsExtras.find(x => x.key === selectedDestinationExtraKey) as MappingTuple;
      break;
    case DestinationExtraVariant.VISU_MODULATORS:
      selectedDestinationExtra = visuModulatorsExtras.find(x => x.key === selectedDestinationExtraKey) as MappingTuple;
      break;
    case DestinationExtraVariant.VISU_ENVELOPES:
      selectedDestinationExtra = visuEnvelopesExtras.find(x => x.key === selectedDestinationExtraKey) as MappingTuple;
      break;
    case DestinationExtraVariant.VISU_LFOS:
      selectedDestinationExtra = visuLfosExtras.find(x => x.key === selectedDestinationExtraKey) as MappingTuple;
      break;
    default:
      selectedDestinationExtra = currentlySelectedDestinationTypes.value[rowIndex].extras.find(x => x.key === selectedDestinationExtraKey) as MappingTuple;
      break;
  }
  const row = mappingDocument.value.rows.find(x => x.index === rowIndex) as MappingRow;
  row.destination.extra = new DestinationExtra(selectedDestinationExtraKey, selectedDestinationExtra.abbr, selectedDestinationExtra.description);
}

function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName; // name of the file to be downloaded
  link.click();

  URL.revokeObjectURL(url); // free up storage--remove the file blobs
}

function downloadHtml() {
  const output = formatters.toHtml(mappingDocument.value as MappingDocument);
  const blob = new Blob([output], { type: "text/html" });
  downloadFile(blob, `${mappingDocument.value.header.fileName}.html`);
  showToast('Exported to HTML successfully', 'success', 3000);
}

function downloadMarkdown(useAbbrs: boolean = false) {
  const output = formatters.toMarkdown(mappingDocument.value as MappingDocument, useAbbrs);
  const blob = new Blob([output], { type: "text/markdown" });
  downloadFile(blob, `${mappingDocument.value.header.fileName}.md`);
  showToast('Exported to Markdown successfully', 'success', 3000);
}

function downloadJson() {
  // Prepare editor metadata
  const metadata: formatters.EditorMetadata = {};

  // Convert rowColors Map to Record for JSON serialization
  if (rowColors.value.size > 0) {
    metadata.rowColors = {};
    rowColors.value.forEach((color, index) => {
      metadata.rowColors![index] = color;
    });
  }

  // Add row comments if any
  if (Object.keys(rowComments.value).length > 0) {
    metadata.rowComments = rowComments.value;
  }

  const output = formatters.toJson(mappingDocument.value as MappingDocument, metadata);
  const blob = new Blob([output], { type: "application/json" });
  downloadFile(blob, `${mappingDocument.value.header.fileName}.json`);
  showToast('Exported to JSON successfully', 'success', 3000);
}

function downloadMap() {
  const blob = formatters.toBlob(mappingDocument.value as MappingDocument);
  downloadFile(blob, `${mappingDocument.value.header.fileName}.map`);
  showToast('Downloaded MAP file successfully', 'success', 3000);
}

</script>
<template>
  <!-- Toast Notifications -->
  <ToastNotifications ref="toastNotifications" />

  <header>
    <div class="pt-5">
      <img alt="NerdSeq Logo" class="logo" src="/src/assets/images/nerdseq-logo.png" height="100" />
      <h2 class="pt-3">Mapping File Editor</h2>
    </div>
  </header>

  <!-- Settings Panel (rightmost) -->
  <SettingsPanel
    v-model:display-row-index-as-hex="displayRowIndexAsHex"
    v-model:show-selection-toolbar="showSelectionToolbar"
    v-model:show-midi-monitor="showMidiMonitor"
    v-model:show-variable-monitor="showVariableMonitor"
    v-model:show-log-monitor="showLogMonitor"
    v-model:show-description="showDescription"
    v-model:midi-learn-auto-advance="midiLearnAutoAdvance"
    v-model:paste-auto-advance="pasteAutoAdvance"
    :header-text="mappingDocument.header.headerText"
    :firmware-major="mappingDocument.header.majorVersion"
    :firmware-minor="mappingDocument.header.minorVersion"
    @expanded-change="settingsPanelExpanded = $event"
  />

  <!-- Selection Toolbar (docked to left of Settings) -->
  <SelectionToolbar
    v-if="showSelectionToolbar"
    :selected-count="selectedRowIndices.size"
    :has-copied-row="hasCopiedRow"
    :has-copied-rows="hasCopiedRows"
    :can-move-up="canMoveUp"
    :can-move-down="canMoveDown"
    :is-locked="isCurrentLocked"
    :settings-panel-expanded="settingsPanelExpanded"
    @expanded-change="selectionToolbarExpanded = $event"
    @cut="handleMultiCut"
    @copy="handleMultiCopy"
    @paste="handleMultiPaste"
    @move-up="handleMultiMoveUp"
    @move-down="handleMultiMoveDown"
    @clear="handleMultiClear"
    @set-color="setRowColor"
    @cancel="clearRowSelection"
  />

  <!-- MIDI Monitor (docked to left of Selection Toolbar) -->
  <MidiMonitor
    v-if="midiSupported && showMidiMonitor"
    :settings-panel-expanded="settingsPanelExpanded"
    :show-selection-toolbar="showSelectionToolbar"
    :selection-toolbar-expanded="selectionToolbarExpanded"
    @expanded-change="midiMonitorExpanded = $event"
  />

  <!-- Variable Monitor (docked to left of MIDI Monitor) -->
  <VariableMonitor
    v-if="showVariableMonitor"
    :variables="mappingDocument.variables"
    :variable-usage="variableUsage"
    :display-row-index-as-hex="displayRowIndexAsHex"
    :settings-panel-expanded="settingsPanelExpanded"
    :show-selection-toolbar="showSelectionToolbar"
    :selection-toolbar-expanded="selectionToolbarExpanded"
    :show-midi-monitor="midiSupported && showMidiMonitor"
    :midi-monitor-expanded="midiMonitorExpanded"
    :rows="mappingDocument.rows"
    @expanded-change="variableMonitorExpanded = $event"
  />

  <!-- Log Monitor (docked to left of Variable Monitor) -->
  <LogMonitor
    v-if="showLogMonitor"
    :settings-panel-expanded="settingsPanelExpanded"
    :show-selection-toolbar="showSelectionToolbar"
    :selection-toolbar-expanded="selectionToolbarExpanded"
    :show-midi-monitor="midiSupported && showMidiMonitor"
    :midi-monitor-expanded="midiMonitorExpanded"
    :show-variable-monitor="showVariableMonitor"
    :variable-monitor-expanded="variableMonitorExpanded"
    @expanded-change="logMonitorExpanded = $event"
    @scroll-to-row="handleScrollToRow"
  />

  <main>
    <div id="mappingFileSelectContainer" class="pt-3">
      <MenuButton
        variant="primary"
        border-radius="left"
        title="Open a .MAP or .JSON file."
        @click="fileInput?.click()"
      >
        Open Mapping File
      </MenuButton>
      <input id="fileInput" class="d-none" type="file" accept=".map, .json" ref="fileInput" @change="readFile" />
      <MenuButton
        variant="primary"
        border-radius="none"
        data-variant="reset"
        :disabled="isCurrentLocked"
        @click="reset"
        title="Reset the current mapping file"
      >
        Reset
      </MenuButton>
      <MenuButton
        variant="primary"
        border-radius="none"
        class="position-relative analyze-btn"
        :class="{ 'analyze-warning': warningCount > 0 }"
        @click="analyzeDocument"
        title="Run static analysis to detect potential issues"
      >
        Analyze
        <span
          v-if="warningCount > 0"
          class="position-absolute top-0 start-100 translate-middle badge rounded-pill"
          :class="errorCount > 0 ? 'bg-danger' : 'bg-warning text-dark'"
        >
          {{ warningCount }}
          <span class="visually-hidden">warnings</span>
        </span>
      </MenuButton>

      <!-- Undo/Redo buttons -->
      <MenuButton
        variant="primary"
        border-radius="none"
        :disabled="!canUndo"
        @click="undo"
        :title="undoDescription
          ? `Undo [Slot ${activeSlot}]: ${undoDescription}`
          : 'Nothing to undo'"
      >
        ↶ Undo
      </MenuButton>
      <MenuButton
        variant="primary"
        border-radius="none"
        :disabled="!canRedo"
        @click="redo"
        :title="redoDescription
          ? `Redo [Slot ${activeSlot}]: ${redoDescription}`
          : 'Nothing to redo'"
      >
        ↷ Redo
      </MenuButton>

      <!-- A/B Cache Toggle and Filename -->
      <MenuButton
        variant="slot"
        :active="activeSlot === 'A'"
        :locked="activeSlot === 'A' && isLockedA"
        :has-data="hasDataA"
        @click="handleSlotSwitch('A')"
        :title="activeSlot === 'A' ? (isLockedA ? 'Click to unlock' : 'Click to lock') : 'Switch to slot A'"
      >
        A
      </MenuButton>
      <MenuButton
        variant="slot"
        :active="activeSlot === 'B'"
        :locked="activeSlot === 'B' && isLockedB"
        :has-data="hasDataB"
        @click="handleSlotSwitch('B')"
        :title="activeSlot === 'B' ? (isLockedB ? 'Click to unlock' : 'Click to lock') : 'Switch to slot B'"
      >
        B
      </MenuButton>
      <input
        type="text"
        class="filename-input"
        v-model="mappingDocument.header.fileName"
        :disabled="isCurrentLocked"
        :class="{ 'input-locked': isCurrentLocked }"
        title="File name for exports"
      />

      <!-- Global Description Panel -->
      <GlobalDocumentationPanel
        v-if="showDescription"
        v-model:global-comment="mappingDocument.globalComment"
        :expanded="globalDocPanelExpanded"
        @toggle="globalDocPanelExpanded = !globalDocPanelExpanded"
      />
    </div>
    <div id="downloadActionsContainer" class="pt-3">
      <div class="download-label">Save as:</div>
      <div class="download-buttons">
        <MenuButton variant="download" border-radius="left" @click="downloadHtml">
          HTML
        </MenuButton>
        <MenuButton variant="download" border-radius="none" @click="downloadMarkdown(false)">
          Markdown
        </MenuButton>
        <MenuButton variant="download" border-radius="none" @click="downloadMarkdown(true)">
          NS Screens (MD)
        </MenuButton>
        <MenuButton variant="download" border-radius="none" @click="downloadJson">
          JSON
        </MenuButton>
        <MenuButton variant="download" border-radius="right" @click="downloadMap">
          MAP
        </MenuButton>
      </div>
    </div>

    <div id="docEditor" class="pt-3">
      <div id="rowsGridContainerHeader" class="pt-3">
        <div>Row</div>
        <div>Source Type</div>
        <div>Source Function</div>
        <div>Source Extra(s)</div>
        <div title="Row status: > = Active (default), X = Skip row (conditional)">●</div>
        <div>Destination Type</div>
        <div>Destination Function</div>
        <div>Destination Extra</div>
        <div>Clear</div>
      </div>
      <div id="rowsGridContainer" v-for="row in mappingDocument.rows" :key="row.index" :data-row-index="row.index" :style="{ backgroundColor: getRowBackgroundColor(row.index) }">

        <div
          class="gridItem rowIndex pt-1"
          :class="{
            'row-empty': row.source.type.key === EMPTY_KEY,
            'row-selected': isRowSelected(row.index),
            'row-multi-selected': selectedRowIndices.size > 1 && isRowSelected(row.index),
            'row-has-warning': rowHasWarnings(row.index)
          }"
          @click="handleRowClick(row.index, $event)"
          :title="rowHasWarnings(row.index) ? getRowWarnings(row.index).map(w => w.message).join('; ') : ''"
        >
          {{ formatRowIndex(row.index) }}
          <span v-if="rowHasWarnings(row.index)" class="warning-indicator">!</span>
        </div>

        <div class="gridItem">
          <select :value="row.source.type.key" @change="sourceTypeSelectionChanged($event, row.index)"
            :title="row.source.type.abbr" class="form-select pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.source.type.key === EMPTY_KEY, 'select-locked': isCurrentLocked }">

            <option v-for="sourceType in DataModel.sourceTypes" :key="sourceType.key" :value="sourceType.key"
              :title="sourceType.abbr">
              {{ sourceType.description }}
            </option>
          </select>
        </div>

        <div class="gridItem">
          <label class="label-empty border-dark pt-1" v-if="row.source.type.key === EMPTY_KEY">{{ EMPTY_DESCRIPTION
          }}</label>

          <select v-else :value="row.source.function.key" @change="sourceFunctionSelectionChanged($event, row.index)"
            :title="row.source.function.abbr" class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.source.function.key === EMPTY_KEY, 'select-locked': isCurrentLocked }">

            <option v-for="func in currentlySelectedSourceTypes[row.index]?.functions" :key="func.key" :value="func.key"
              :title="func.abbr">
              {{ func.description }}</option>
          </select>
        </div>

        <div class="gridItem">
          <!-- If no source type is selected then just show a label -->
          <label class="label-empty border-dark pt-1" v-if="row.source.type.key === EMPTY_KEY">{{ EMPTY_DESCRIPTION
          }}</label>

          <!-- Else handel all the edge cases -->

          <!-- MIDI Learn for MIDI source types when LRN function selected -->
          <MidiLearnExtra
            v-else-if="[5, 6, 7].includes(row.source.type.key) && row.source.function.key === 48"
            v-model="row.source.extra as SourceExtra"
            mode="source"
            :source-type="row.source.type.key"
            :is-locked="isCurrentLocked"
            :auto-start="midiLearnAutoStartRow === row.index"
            :last-learned-message="lastLearnedMidiMessage"
            @update-last-message="(msg: string) => lastLearnedMidiMessage = msg"
            @function-update="(functionKey: number) => handleSourceMidiLearnFunctionUpdate(row.index, functionKey)"
          />

          <!-- Calc or Skip Source Type -->
          <CalcSkipSourceExtra v-model="row.source.extra as SourceExtra"
            v-else-if="row.source.type.key === CALC_SOURCE_TYPE_KEY || row.source.type.key === SKIP_SOURCE_TYPE_KEY"
            :display-row-index-as-hex="displayRowIndexAsHex"
            :is-locked="isCurrentLocked" />

          <!-- NRPN Source Type -->
          <NrpnSourceExtra v-model="row.source.extra as SourceExtra"
            v-else-if="row.source.type.key === MIDI_NRPN_SOURCE_TYPE_KEY"
            :is-locked="isCurrentLocked" />

          <!-- Variable Source Type -->
          <VariableSourceExtra v-model="row.source.extra as SourceExtra"
            v-else-if="row.source.type.key === VAR_SOURCE_TYPE_KEY"
            :is-locked="isCurrentLocked" />

          <!-- External Source Type, Keyboard Function -->
          <select
            v-else-if="row.source.type.key == EXTERNAL_SOURCE_TYPE_KEY && row.source.function.key == KEYBOARD_EXTERNAL_SOURCE_FUNCTION_KEY"
            :value="row.source.extra.keyOrValue"
            @change="sourceExtraSelectionChanged($event, row.index, SourceExtraVariant.EXTERNAL_KEYBOARD)"
            :title="row.source.extra.abbr" class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.source.extra.keyOrValue === EMPTY_KEY, 'select-locked': isCurrentLocked }">

            <option v-for="extra in keyboardSourceExtras" :key="extra.key" :value="extra.key" :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

          <!-- External Source Type, Sega Gamepad Function  -->
          <select
            v-else-if="row.source.type.key == EXTERNAL_SOURCE_TYPE_KEY && row.source.function.key == SEGA_GAMEPAD_EXTERNAL_SOURCE_FUNCTION_KEY"
            :value="row.source.extra.keyOrValue"
            @change="sourceExtraSelectionChanged($event, row.index, SourceExtraVariant.EXTERNAL_SEGA_GAMEPAD)"
            :title="row.source.extra.abbr" class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.source.extra.keyOrValue === EMPTY_KEY, 'select-locked': isCurrentLocked }">

            <option v-for="extra in segaGamepadSourceExtras" :key="extra.key" :value="extra.key" :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

          <!-- External Source Type, NerdSEQ Buttons Function  -->
          <select
            v-else-if="row.source.type.key == EXTERNAL_SOURCE_TYPE_KEY && row.source.function.key == NERDSEQ_BUTTONS_EXTERNAL_SOURCE_FUNCTION_KEY"
            :value="row.source.extra.keyOrValue"
            @change="sourceExtraSelectionChanged($event, row.index, SourceExtraVariant.EXTERNAL_NERDSEQ_BUTTONS)"
            :title="row.source.extra.abbr" class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.source.extra.keyOrValue === EMPTY_KEY, 'select-locked': isCurrentLocked }">

            <option v-for="extra in nerdseqButtonsSourceExtras" :key="extra.key" :value="extra.key" :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

          <!-- Else show a select with all the extras for this source type -->
          <select v-else :value="row.source.extra.keyOrValue" @change="sourceExtraSelectionChanged($event, row.index)"
            :title="row.source.extra.abbr" class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.source.extra.keyOrValue === EMPTY_KEY, 'select-locked': isCurrentLocked }">

            <option v-for="extra in currentlySelectedSourceTypes[row.index]?.extras" :key="extra.key" :value="extra.key"
              :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

        </div>

        <div class="gridItem row-status pt-1"
          :class="{ 'row-status-active': !isRowSkipped(row), 'row-status-skipped': isRowSkipped(row) }"
          :title="isRowSkipped(row) ? 'Row will be skipped conditionally' : 'Row is active'">
          {{ isRowSkipped(row) ? 'X' : '>' }}
        </div>

        <div class="gridItem">
          <select :value="row.destination.type.key" @change="destinationTypeSelectionChanged($event, row.index)"
            :title="row.destination.type.abbr" class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.destination.type.key === EMPTY_KEY, 'select-locked': isCurrentLocked }">

            <option v-for="destinationType in DataModel.destinationTypes" :key="destinationType.key"
              :value="destinationType.key" :title="destinationType.abbr">
              {{ destinationType.description }}</option>

          </select>
        </div>

        <div class="gridItem">
          <label class="label-empty border-dark pt-1" v-if="row.destination.type.key === EMPTY_KEY">{{ EMPTY_DESCRIPTION
          }}</label>

          <select v-else :value="row.destination.function.key"
            @change="destinationFunctionSelectionChanged($event, row.index)" :title="row.destination.function.abbr"
            class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.destination.function.key === EMPTY_KEY, 'select-locked': isCurrentLocked }">
            <option v-for="func in currentlySelectedDestinationTypes[row.index]?.functions" :key="func.key"
              :value="func.key" :title="func.abbr">
              {{ func.description }}</option>
          </select>

        </div>

        <div class="gridItem">
          <!-- If no destination type is selected then just show a label -->
          <label class="label-empty border-dark pt-1" v-if="row.destination.type.key === EMPTY_KEY">{{ EMPTY_DESCRIPTION
          }}</label>

          <!-- Else handel all the edge cases -->

          <!-- MIDI Learn for MIDI CC destination when LRN function selected -->
          <MidiLearnExtra
            v-else-if="row.destination.type.key === MIDI_CC_DESTINATION_TYPE_KEY && row.destination.function.key === MIDI_LEARN_FUNCTION_KEY"
            v-model="row.destination.extra as DestinationExtra"
            mode="destination"
            :is-locked="isCurrentLocked"
            :auto-start="midiLearnAutoStartRow === row.index"
            :last-learned-message="lastLearnedMidiMessage"
            @update-last-message="(msg: string) => lastLearnedMidiMessage = msg"
            @function-update="(functionKey: number) => handleDestMidiLearnFunctionUpdate(row.index, functionKey)"
          />

          <!-- Midi CC Destination Type -->
          <MidiCcDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === MIDI_CC_DESTINATION_TYPE_KEY && row.destination.function.key !== MIDI_LEARN_FUNCTION_KEY"
            :midi-cc-extras="currentlySelectedDestinationTypes[row.index]?.extras"
            :is-locked="isCurrentLocked" />

          <!-- Skip Destination Type -->
          <SkipDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === SKIP_DESTINATION_TYPE_KEY"
            :display-row-index-as-hex="displayRowIndexAsHex"
            :is-locked="isCurrentLocked" />

          <!-- Variable Destination Type -->
          <VariableDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === SETVAR_DESTINATION_TYPE_KEY"
            :is-locked="isCurrentLocked" />

          <!-- DUAL Destination Type -->
          <DualDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === DUAL_DESTINATION_TYPE_KEY"
            :dual-extras="currentlySelectedDestinationTypes[row.index]?.extras"
            :is-locked="isCurrentLocked" />

          <!-- VISU Destination Type - Shader Select -->
          <VisuDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === VISU_DESTINATION_TYPE_KEY && row.destination.function.key === VISU_SHADER_SELECT_FUNCTION_KEY"
            :visu-extras="visuShaderSelectExtras"
            :is-locked="isCurrentLocked" />

          <!-- VISU Destination Type - Shader Functions -->
          <VisuDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === VISU_DESTINATION_TYPE_KEY && row.destination.function.key === VISU_SHADER_FUNCTIONS_FUNCTION_KEY"
            :visu-extras="visuShaderFunctionsExtras"
            :is-locked="isCurrentLocked" />

          <!-- VISU Destination Type - Modulators -->
          <VisuDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === VISU_DESTINATION_TYPE_KEY && row.destination.function.key === VISU_MODULATORS_FUNCTION_KEY"
            :visu-extras="visuModulatorsExtras"
            :is-locked="isCurrentLocked" />

          <!-- VISU Destination Type - Envelopes -->
          <VisuDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === VISU_DESTINATION_TYPE_KEY && row.destination.function.key === VISU_ENVELOPES_FUNCTION_KEY"
            :visu-extras="visuEnvelopesExtras"
            :is-locked="isCurrentLocked" />

          <!-- VISU Destination Type - LFOs -->
          <VisuDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === VISU_DESTINATION_TYPE_KEY && row.destination.function.key === VISU_LFOS_FUNCTION_KEY"
            :visu-extras="visuLfosExtras"
            :is-locked="isCurrentLocked" />

          <!-- Global Buttons Destination Type -->
          <select
            v-else-if="row.destination.type.key === GLOBAL_DESTINATION_TYPE_KEY && row.destination.function.key === GLOBAL_BUTTONS_DESTINATION_FUNCTION_KEY"
            :value="row.destination.extra.keyOrValue"
            @change="destinationExtraSelectionChanged($event, row.index, false, DestinationExtraVariant.GLOBAL_BUTTONS)"
            :title="row.destination.extra.abbr" class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.destination.extra.keyOrValue === EMPTY_KEY, 'select-locked': isCurrentLocked }">
            <option v-for="extra in globalButtonsDestinationExtras" :key="extra.key" :value="extra.key"
              :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

          <!-- Global Screens Destination Type -->
          <select
            v-else-if="row.destination.type.key === GLOBAL_DESTINATION_TYPE_KEY && row.destination.function.key === GLOBAL_SCREENS_DESTINATION_FUNCTION_KEY"
            :value="row.destination.extra.keyOrValue"
            @change="destinationExtraSelectionChanged($event, row.index, false, DestinationExtraVariant.GLOBAL_SCREENS)"
            :title="row.destination.extra.abbr" class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.destination.extra.keyOrValue === EMPTY_KEY, 'select-locked': isCurrentLocked }">
            <option v-for="extra in globalScreensDestinationExtras" :key="extra.key" :value="extra.key"
              :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

          <!-- Global Modes Destination Type -->
          <select
            v-else-if="row.destination.type.key === GLOBAL_DESTINATION_TYPE_KEY && row.destination.function.key === GLOBAL_MODES_DESTINATION_FUNCTION_KEY"
            :value="row.destination.extra.keyOrValue"
            @change="destinationExtraSelectionChanged($event, row.index, false, DestinationExtraVariant.GLOBAL_MODES)"
            :title="row.destination.extra.abbr" class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.destination.extra.keyOrValue === EMPTY_KEY, 'select-locked': isCurrentLocked }">
            <option v-for="extra in globalModesDestinationExtras" :key="extra.key" :value="extra.key"
              :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

          <!-- Else show a select with all the extras for this destination type -->
          <select v-else :value="row.destination.extra.keyOrValue"
            @change="destinationExtraSelectionChanged($event, row.index)" :title="row.destination.extra.abbr"
            class="form-select border-dark pt-1"
            :disabled="isCurrentLocked"
            :class="{ 'select-empty': row.destination.extra.keyOrValue === EMPTY_KEY, 'select-locked': isCurrentLocked }">
            <option v-for="extra in currentlySelectedDestinationTypes[row.index]?.extras" :key="extra.key"
              :value="extra.key" :title="extra.abbr">
              {{ extra.description }}</option>
          </select>
        </div>

        <!-- Clear button at grid position 10 -->
        <div class="endCap">
          <IconButton
            v-if="row.source.type.key !== EMPTY_KEY || row.destination.type.key !== EMPTY_KEY"
            class="clear-btn-fixed"
            :class="{ 'btn-locked': isCurrentLocked }"
            size="sm"
            variant="clear"
            :disabled="isCurrentLocked"
            @click="clearRow(row.index)"
            title="Clear this row"
          >
            X
          </IconButton>
        </div>

        <!-- Comment section (unfolds only when single row is selected) -->
        <RowCommentSection
          v-if="expandedCommentRowIndex === row.index"
          :row-index="row.index"
          :source-empty="row.source.type.key === EMPTY_KEY"
          :destination-empty="row.destination.type.key === EMPTY_KEY"
          :has-copied-source="hasCopiedSource"
          :has-copied-destination="hasCopiedDestination"
          :warnings="getRowWarnings(row.index)"
          :source-value="row.source.type.key === VAR_SOURCE_TYPE_KEY && row.source.extra.keyOrValue === 0 && row.source.function.key >= 0 && row.source.function.key < 16 ? mappingDocument.variables[row.source.function.key].value : row.source.extra.keyOrValue"
          :destination-value="row.destination.type.key === SETVAR_DESTINATION_TYPE_KEY && row.destination.extra.keyOrValue === 0 && row.destination.function.key >= 0 && row.destination.function.key < 16 ? mappingDocument.variables[row.destination.function.key].value : row.destination.extra.keyOrValue"
          :is-source-variable="row.source.type.key === VAR_SOURCE_TYPE_KEY && row.source.extra.keyOrValue === 0 && row.source.function.key >= 0 && row.source.function.key < 16"
          :source-variable-index="row.source.function.key"
          :is-destination-variable="row.destination.type.key === SETVAR_DESTINATION_TYPE_KEY && row.destination.extra.keyOrValue === 0 && row.destination.function.key >= 0 && row.destination.function.key < 16"
          :destination-variable-index="row.destination.function.key"
          :is-source-skip="row.source.type.key === SKIP_SOURCE_TYPE_KEY"
          :is-destination-skip="row.destination.type.key === SKIP_DESTINATION_TYPE_KEY"
          :source-skip-active="row.source.type.key === SKIP_SOURCE_TYPE_KEY && row.source.function.key !== EMPTY_KEY && Math.floor(row.source.function.key / 6) + 1 > 0"
          :destination-skip-active="row.destination.type.key === SKIP_DESTINATION_TYPE_KEY && row.destination.function.key !== EMPTY_KEY && Math.floor(row.destination.function.key / 6) + 1 > 0"
          :is-locked="isCurrentLocked"
          :model-value="rowComments[row.index] || ''"
          @update:model-value="(val) => rowComments[row.index] = val"
          @copy-source="copySource"
          @paste-source="handlePasteSource"
          @clear-source="clearSource"
          @copy-destination="copyDestination"
          @paste-destination="handlePasteDestination"
          @update-variable="updateVariableValue"
          @clear-destination="clearDestination"
        />
      </div>
      <div id="variablesContainer" class="pt-3"></div>
    </div>
  </main>
</template>

<style scoped>
h2 {
  color: var(--color-text-yellow);
}

/* File input label wrapping MenuButton */
#fileInputLabel {
  display: inline-block;
  cursor: pointer;
}

#fileInputLabel :deep(.menu-btn):hover {
  background-color: var(--color-hover) !important;
  color: var(--color-text-primary) !important;
}

/* Download container styles */
.download-label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
}

.download-buttons {
  display: inline-flex;
}

/* Analyze button warning state */
.analyze-btn.analyze-warning {
  background-color: #ffc107 !important;
  color: #000 !important;
}

#rowsGridContainer,
#rowsGridContainerHeader {
  display: grid;
  grid-template-columns: 2.5em 1.3fr 2fr 2.5fr 2em 1.3fr 2fr 2.5fr 3.5em;
  gap: var(--grid-gap);
  width: 100%;
}

#rowsGridContainer {
  margin: 0px;
  padding: 1px;
}

#rowsGridContainerHeader {
  font-weight: bold;
  text-align: center;
}

.btn:hover {
  background-color: var(--color-hover) !important;
  color: var(--color-text-primary);
}

.rowIndex {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary) !important;
  color: var(--color-text-primary);
  border-radius: var(--form-border-radius-left);
  text-align: center;
  font-size: small;
  font-weight: bold;
}

.row-status {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
  text-align: center;
  font-size: medium;
  font-weight: bold;
}

.row-status-active {
  color: #888888;
}

.row-status-skipped {
  color: #ff4444;
  padding: 3px 0;
  cursor: pointer;
}

.rowIndex.row-selected {
  background-color: #F1F700 !important;
  color: #000;
  box-shadow: 0 0 8px rgba(241, 247, 0, 0.5);
}

.rowIndex.row-multi-selected {
  background-color: rgba(241, 247, 0, 0.7) !important;
  color: #000;
  border-left: 3px solid #F1F700;
}

.rowIndex.row-has-warning {
  border-left: 3px solid #ffc107;
}

.rowIndex.row-has-warning:not(.row-selected):not(.row-multi-selected) {
  background-color: rgba(255, 193, 7, 0.15) !important;
}

.warning-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  background-color: #ffc107;
  color: #000;
  font-size: 9px;
  font-weight: bold;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.rowIndex {
  position: relative;
}

.gridItem {
  display: flex;
  align-items: center;
  justify-content: center;
}

.gridItem>select {
  background-color: var(--color-primary);
  color: var(--color-text-primary);
  height: 100%;
}

/* Note: .select-empty and .label-empty are now in global form-elements.css */

#buttonReset {
  background-color: var(--color-reset) !important;
}

#buttonReset:hover {
  background-color: var(--color-reset-hover) !important;
}

/* Clear button and endCap container */
.endCap {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
  border-radius: var(--form-border-radius-right);
}

.clear-btn-fixed {
  font-size: var(--button-font-size);
  margin: 0;
  height: 100%;
  width: 100%;
  border-radius: var(--form-border-radius-right);
}

/* Consistent spacing for all controls */
#mappingFileSelectContainer > *:not(.d-none) {
  margin-right: 4px;
}

#mappingFileSelectContainer > *:last-child {
  margin-right: 0;
}

/* Remove border-radius gap between grouped buttons */
#mappingFileSelectContainer :deep(.menu-btn--radius-left),
#mappingFileSelectContainer :deep(.menu-btn--radius-none) {
  margin-right: 0;
}

/* Add spacing after last button in a group */
#mappingFileSelectContainer :deep(.menu-btn--radius-right),
#mappingFileSelectContainer :deep(.menu-btn--radius-all) {
  margin-right: 4px;
}

/* Filename input inline with buttons */
.filename-input {
  height: var(--form-height);
  background-color: var(--color-primary);
  border: 1px solid var(--color-dark-bg);
  border-radius: var(--form-border-radius);
  color: #F1F700;
  font-size: var(--form-font-size);
  font-weight: bold;
  padding: 0 10px;
  width: 200px;
  display: inline-block;
  vertical-align: middle;
}

.filename-input:focus {
  outline: none;
  border-color: var(--color-hover);
  background-color: rgba(52, 204, 153, 0.3);
}

.filename-input.input-locked {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--color-disabled);
}

/* Global description panel inline */
#mappingFileSelectContainer .global-doc-panel {
  display: inline-block;
  margin-bottom: 0;
  vertical-align: middle;
}

/* Locked state overlay for editor */
.editor-locked-overlay {
  position: relative;
}

.editor-locked-overlay::after {
  content: 'LOCKED';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(220, 53, 69, 0.9);
  color: #fff;
  padding: 10px 30px;
  font-size: 24px;
  font-weight: bold;
  border-radius: 4px;
  pointer-events: none;
}

/* Locked state for form elements */
.select-locked {
  opacity: 0.5;
  cursor: not-allowed !important;
  background-color: var(--color-disabled, #333) !important;
}

.select-locked:disabled {
  pointer-events: none;
}

.btn-locked {
  opacity: 0.5;
  cursor: not-allowed !important;
}

.btn-locked:disabled {
  pointer-events: none;
}

.input-locked {
  opacity: 0.5;
  cursor: not-allowed !important;
  background-color: var(--color-disabled, #333) !important;
}
</style>
