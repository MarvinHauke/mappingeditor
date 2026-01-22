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
import RowActionButtons from './RowActionButtons.vue';
import RowCommentSection from './RowCommentSection.vue';
import MultiSelectionToolbar from './MultiSelectionToolbar.vue';
import SettingsPanel from './SettingsPanel.vue';
import { useMidi } from '../composables/useMidi';
import { useClipboard } from '../composables/useClipboard';
import { useStaticAnalyzer } from '../composables/useStaticAnalyzer';
import { MIDI_LEARN_FUNCTION_KEY } from '../constants/midi';
import { COLOR_PALETTE } from '../constants/colors';

const mappingDocument = ref<MappingDocument>(new MappingDocument());
const fileInput = ref<HTMLInputElement | null>(null);

const currentlySelectedSourceTypes = ref(new Array<MappingType>());
const currentlySelectedDestinationTypes = ref(new Array<MappingType>());

// Multi-selection state
const selectedRowIndices = ref<Set<number>>(new Set());
const lastClickedRowIndex = ref<number | null>(null);

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


// Settings Panel expanded state (for MIDI Monitor positioning)
const settingsPanelExpanded = ref(false);

// MIDI Monitor expanded state (for Variable Monitor positioning)
const midiMonitorExpanded = ref(false);

// Variable Monitor expanded state (for toolbar positioning)
const variableMonitorExpanded = ref(false);

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
  currentlySelectedDestinationTypes
});

// Static Logic Analyzer
const {
  warnings: analyzerWarnings,
  warningCount,
  errorCount,
  analyzeDocument,
  getRowWarnings,
  rowHasWarnings
} = useStaticAnalyzer(mappingDocument);

// Row selection functions
function handleRowClick(rowIndex: number, event: MouseEvent): void {
  if (event.shiftKey && lastClickedRowIndex.value !== null) {
    // Shift+Click: Select range
    const start = Math.min(lastClickedRowIndex.value, rowIndex);
    const end = Math.max(lastClickedRowIndex.value, rowIndex);
    for (let i = start; i <= end; i++) {
      selectedRowIndices.value.add(i);
    }
  } else if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd+Click: Toggle individual
    if (selectedRowIndices.value.has(rowIndex)) {
      selectedRowIndices.value.delete(rowIndex);
    } else {
      selectedRowIndices.value.add(rowIndex);
    }
  } else {
    // Normal click: Toggle single selection
    if (selectedRowIndices.value.size === 1 && selectedRowIndices.value.has(rowIndex)) {
      // Clicking on the only selected row - deselect it
      selectedRowIndices.value.clear();
    } else {
      // Select only this row
      selectedRowIndices.value.clear();
      selectedRowIndices.value.add(rowIndex);
    }
  }
  lastClickedRowIndex.value = rowIndex;
  // Force reactivity
  selectedRowIndices.value = new Set(selectedRowIndices.value);
}

function clearRowSelection(): void {
  selectedRowIndices.value.clear();
  selectedRowIndices.value = new Set();
  lastClickedRowIndex.value = null;
}

function isRowSelected(rowIndex: number): boolean {
  return selectedRowIndices.value.has(rowIndex);
}

function formatRowIndex(index: number): string {
  if (displayRowIndexAsHex.value) {
    return index.toString(16).toUpperCase().padStart(2, '0');
  }
  return index.toString();
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
  copyRows(sortedSelectedIndices.value);
}

function handleMultiPaste(): void {
  if (sortedSelectedIndices.value.length > 0) {
    pasteRows(sortedSelectedIndices.value[0]);
  }
}

function handleMultiMoveUp(): void {
  const newIndices = moveRowsUp(sortedSelectedIndices.value);
  selectedRowIndices.value = new Set(newIndices);
}

function handleMultiMoveDown(): void {
  const newIndices = moveRowsDown(sortedSelectedIndices.value);
  selectedRowIndices.value = new Set(newIndices);
}

function handleMultiClear(): void {
  clearRows(sortedSelectedIndices.value);
}

function setRowColor(color: string | null): void {
  for (const idx of selectedRowIndices.value) {
    if (color && COLOR_PALETTE[color]) {
      rowColors.value.set(idx, COLOR_PALETTE[color]);
    } else {
      rowColors.value.delete(idx);
    }
  }
  // Force reactivity
  rowColors.value = new Map(rowColors.value);
}

function getRowBackgroundColor(rowIndex: number): string | undefined {
  return rowColors.value.get(rowIndex);
}

// Keyboard shortcuts for multi-selection
function handleKeyDown(event: KeyboardEvent): void {
  if (selectedRowIndices.value.size === 0) return;

  // Don't handle shortcuts if user is typing in an input
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return;
  }

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
      pasteRow(indices[0]);
    }
    event.preventDefault();
  } else if (event.key === 'Escape') {
    clearRowSelection();
    event.preventDefault();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
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
          console.log('.map file loaded successfully');
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

          // Load editor metadata (row colors and comments)
          if (jsonObj.editorMetadata) {
            const metadata = jsonObj.editorMetadata;

            // Load row colors
            if (metadata.rowColors && typeof metadata.rowColors === 'object') {
              rowColors.value = new Map();
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
          }

          mappingDocument.value = mappingDoc;
          init();
          console.log('.json file loaded successfully');
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
  if (fileInput.value) {
    fileInput.value.value = '';
  }
  mappingDocument.value = new MappingDocument();
  currentlySelectedSourceTypes.value = new Array<MappingType>();
  currentlySelectedDestinationTypes.value = new Array<MappingType>();
  clearRowSelection();
  rowComments.value = {};
  rowColors.value = new Map();
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
}

function downloadMarkdown(useAbbrs: boolean = false) {
  const output = formatters.toMarkdown(mappingDocument.value as MappingDocument, useAbbrs);
  const blob = new Blob([output], { type: "text/markdown" });
  downloadFile(blob, `${mappingDocument.value.header.fileName}.md`);
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
}

function downloadMap() {
  const blob = formatters.toBlob(mappingDocument.value as MappingDocument);
  downloadFile(blob, `${mappingDocument.value.header.fileName}.map`);
}

</script>
<template>
  <header>
    <div class="pt-5">
      <img alt="NerdSeq Logo" class="logo" src="/src/assets/images/nerdseq-logo.png" height="100" />
      <h2 class="pt-3">Mapping File Editor</h2>
    </div>
  </header>

  <!-- Settings Panel -->
  <SettingsPanel
    v-model:display-row-index-as-hex="displayRowIndexAsHex"
    @expanded-change="settingsPanelExpanded = $event"
  />

  <!-- MIDI Monitor -->
  <MidiMonitor
    v-if="midiSupported"
    :settings-panel-expanded="settingsPanelExpanded"
    @expanded-change="midiMonitorExpanded = $event"
  />

  <!-- Variable Monitor -->
  <VariableMonitor
    :variables="mappingDocument.variables"
    :midi-monitor-expanded="midiMonitorExpanded"
    :settings-panel-expanded="settingsPanelExpanded"
    @expanded-change="variableMonitorExpanded = $event"
  />

  <!-- Multi-selection Toolbar (docked to left of Variable Monitor) -->
  <MultiSelectionToolbar
    :selected-count="selectedRowIndices.size"
    :has-copied-rows="hasCopiedRows"
    :can-move-up="canMoveUp"
    :can-move-down="canMoveDown"
    :midi-monitor-expanded="midiMonitorExpanded"
    :variable-monitor-expanded="variableMonitorExpanded"
    @cut="handleMultiCut"
    @copy="handleMultiCopy"
    @paste="handleMultiPaste"
    @move-up="handleMultiMoveUp"
    @move-down="handleMultiMoveDown"
    @clear="handleMultiClear"
    @set-color="setRowColor"
    @cancel="clearRowSelection"
  />

  <main>
    <div id="mappingFileSelectContainer" class="pt-3">
      <label id="fileInputLabel" for="fileInput" class="btn btn-info border-dark"
        title="Open a .MAP or .JSON file.">Open
        Mapping File</label>
      <input id="fileInput" class="d-none" type="file" accept=".map, .json" ref="fileInput" @change="readFile" />
      <button id="buttonReset" type="button" class="btn btn-info border-dark" @click="reset">Reset</button>
      <button
        id="buttonAnalyze"
        type="button"
        class="btn border-dark position-relative"
        :class="warningCount > 0 ? 'btn-warning' : 'btn-info'"
        @click="analyzeDocument"
        title="Run static analysis to detect potential issues">
        Analyze
        <span
          v-if="warningCount > 0"
          class="position-absolute top-0 start-100 translate-middle badge rounded-pill"
          :class="errorCount > 0 ? 'bg-danger' : 'bg-warning text-dark'">
          {{ warningCount }}
          <span class="visually-hidden">warnings</span>
        </span>
      </button>
    </div>
    <div id="downloadActionsContainer" class="pt-3">
      <div class="header-label">Save as:</div>
      <div>
        <button id="buttonDownloadHtml" type="button" @click="downloadHtml" class="btn btn-info border-dark">
          HTML</button>
        <button id="buttonDownloadMd" type="button" @click="downloadMarkdown(false)"
          class="btn btn-info border-dark">Markdown</button>
        <button id="buttonDownloadMd" type="button" @click="downloadMarkdown(true)" class="btn btn-info border-dark">NS
          Screens (MD)</button>
        <button id="buttonDownloadJson" type="button" @click="downloadJson" class="btn btn-info border-dark">
          JSON</button>
        <button id="buttonDownloadMap" type="button" @click="downloadMap" class="btn btn-info border-dark">
          MAP</button>
      </div>
    </div>
    <div id="docEditor" class="pt-3">
      <div class="pt-2">
        <div class="header-label">Header Text:</div>
        <div class="header-val">{{ mappingDocument.header.headerText }}</div>
      </div>
      <div class="pt-2">
        <div class="header-label">Firmware Major Version:</div>
        <div class="header-val">{{ mappingDocument.header.majorVersion }}</div>
      </div>
      <div class="pt-2">
        <div class="header-label">Firmware Minor Version:</div>
        <div class="header-val">{{ mappingDocument.header.minorVersion }}</div>
      </div>
      <div class="pt-2">
        <div class="header-label">File Name:</div>
        <div class="header-val"><input type="text" id="input" v-model="mappingDocument.header.fileName" /></div>
      </div>
      <div id="rowsGridContainerHeader" class="pt-3">
        <div>Row</div>
        <div>Copy</div>
        <div>Paste</div>
        <div>Source Type</div>
        <div>Source Function</div>
        <div>Source Extra(s)</div>
        <div>Destination Type</div>
        <div>Destination Function</div>
        <div>Destination Extra</div>
        <div>Clear</div>
      </div>
      <div id="rowsGridContainer" v-for="row in mappingDocument.rows" :key="row.index" :style="{ backgroundColor: getRowBackgroundColor(row.index) }">

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

        <RowActionButtons
          :row-index="row.index"
          :has-copied-data="hasCopiedRow"
          :has-content="row.source.type.key !== EMPTY_KEY || row.destination.type.key !== EMPTY_KEY"
          @copy="copyRow"
          @paste="pasteRow"
        />

        <div class="gridItem">
          <select :value="row.source.type.key" @change="sourceTypeSelectionChanged($event, row.index)"
            :title="row.source.type.abbr" class="form-select pt-1"
            :class="{ 'select-empty': row.source.type.key === EMPTY_KEY }">

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
            :class="{ 'select-empty': row.source.function.key === EMPTY_KEY }">

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
            @function-update="(functionKey: number) => {
              const sourceFunc = currentlySelectedSourceTypes[row.index].functions.find((f: MappingTuple) => f.key === functionKey)
              if (sourceFunc) {
                row.source.function = new SourceFunction(functionKey, sourceFunc.abbr, sourceFunc.description)
              }
            }"
          />

          <!-- Calc or Skip Source Type -->
          <CalcSkipSourceExtra v-model="row.source.extra as SourceExtra"
            v-else-if="row.source.type.key === CALC_SOURCE_TYPE_KEY || row.source.type.key === SKIP_SOURCE_TYPE_KEY"
            :display-row-index-as-hex="displayRowIndexAsHex" />

          <!-- NRPN Source Type -->
          <NrpnSourceExtra v-model="row.source.extra as SourceExtra"
            v-else-if="row.source.type.key === MIDI_NRPN_SOURCE_TYPE_KEY" />

          <!-- Variable Source Type -->
          <VariableSourceExtra v-model="row.source.extra as SourceExtra"
            v-else-if="row.source.type.key === VAR_SOURCE_TYPE_KEY" />

          <!-- External Source Type, Keyboard Function -->
          <select
            v-else-if="row.source.type.key == EXTERNAL_SOURCE_TYPE_KEY && row.source.function.key == KEYBOARD_EXTERNAL_SOURCE_FUNCTION_KEY"
            :value="row.source.extra.keyOrValue"
            @change="sourceExtraSelectionChanged($event, row.index, SourceExtraVariant.EXTERNAL_KEYBOARD)"
            :title="row.source.extra.abbr" class="form-select border-dark pt-1"
            :class="{ 'select-empty': row.source.extra.keyOrValue === EMPTY_KEY }">

            <option v-for="extra in keyboardSourceExtras" :key="extra.key" :value="extra.key" :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

          <!-- External Source Type, Sega Gamepad Function  -->
          <select
            v-else-if="row.source.type.key == EXTERNAL_SOURCE_TYPE_KEY && row.source.function.key == SEGA_GAMEPAD_EXTERNAL_SOURCE_FUNCTION_KEY"
            :value="row.source.extra.keyOrValue"
            @change="sourceExtraSelectionChanged($event, row.index, SourceExtraVariant.EXTERNAL_SEGA_GAMEPAD)"
            :title="row.source.extra.abbr" class="form-select border-dark pt-1"
            :class="{ 'select-empty': row.source.extra.keyOrValue === EMPTY_KEY }">

            <option v-for="extra in segaGamepadSourceExtras" :key="extra.key" :value="extra.key" :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

          <!-- External Source Type, NerdSEQ Buttons Function  -->
          <select
            v-else-if="row.source.type.key == EXTERNAL_SOURCE_TYPE_KEY && row.source.function.key == NERDSEQ_BUTTONS_EXTERNAL_SOURCE_FUNCTION_KEY"
            :value="row.source.extra.keyOrValue"
            @change="sourceExtraSelectionChanged($event, row.index, SourceExtraVariant.EXTERNAL_NERDSEQ_BUTTONS)"
            :title="row.source.extra.abbr" class="form-select border-dark pt-1"
            :class="{ 'select-empty': row.source.extra.keyOrValue === EMPTY_KEY }">

            <option v-for="extra in nerdseqButtonsSourceExtras" :key="extra.key" :value="extra.key" :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

          <!-- Else show a select with all the extras for this source type -->
          <select v-else :value="row.source.extra.keyOrValue" @change="sourceExtraSelectionChanged($event, row.index)"
            :title="row.source.extra.abbr" class="form-select border-dark pt-1"
            :class="{ 'select-empty': row.source.extra.keyOrValue === EMPTY_KEY }">

            <option v-for="extra in currentlySelectedSourceTypes[row.index]?.extras" :key="extra.key" :value="extra.key"
              :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

        </div>

        <div class="gridItem">
          <select :value="row.destination.type.key" @change="destinationTypeSelectionChanged($event, row.index)"
            :title="row.destination.type.abbr" class="form-select border-dark pt-1"
            :class="{ 'select-empty': row.destination.type.key === EMPTY_KEY }">

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
            :class="{ 'select-empty': row.destination.function.key === EMPTY_KEY }">
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
            @function-update="(functionKey: number) => {
              const destFunc = currentlySelectedDestinationTypes[row.index].functions.find((f: MappingTuple) => f.key === functionKey)
              if (destFunc) {
                row.destination.function = new DestinationFunction(functionKey, destFunc.abbr, destFunc.description)
              }
            }"
          />

          <!-- Midi CC Destination Type -->
          <MidiCcDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === MIDI_CC_DESTINATION_TYPE_KEY && row.destination.function.key !== MIDI_LEARN_FUNCTION_KEY"
            :midi-cc-extras="currentlySelectedDestinationTypes[row.index]?.extras" />

          <!-- Skip Destination Type -->
          <SkipDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === SKIP_DESTINATION_TYPE_KEY" />

          <!-- Variable Destination Type -->
          <VariableDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === SETVAR_DESTINATION_TYPE_KEY" />

          <!-- DUAL Destination Type -->
          <DualDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === DUAL_DESTINATION_TYPE_KEY"
            :dual-extras="currentlySelectedDestinationTypes[row.index]?.extras" />

          <!-- VISU Destination Type - Shader Select -->
          <VisuDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === VISU_DESTINATION_TYPE_KEY && row.destination.function.key === VISU_SHADER_SELECT_FUNCTION_KEY"
            :visu-extras="visuShaderSelectExtras" />

          <!-- VISU Destination Type - Shader Functions -->
          <VisuDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === VISU_DESTINATION_TYPE_KEY && row.destination.function.key === VISU_SHADER_FUNCTIONS_FUNCTION_KEY"
            :visu-extras="visuShaderFunctionsExtras" />

          <!-- VISU Destination Type - Modulators -->
          <VisuDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === VISU_DESTINATION_TYPE_KEY && row.destination.function.key === VISU_MODULATORS_FUNCTION_KEY"
            :visu-extras="visuModulatorsExtras" />

          <!-- VISU Destination Type - Envelopes -->
          <VisuDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === VISU_DESTINATION_TYPE_KEY && row.destination.function.key === VISU_ENVELOPES_FUNCTION_KEY"
            :visu-extras="visuEnvelopesExtras" />

          <!-- VISU Destination Type - LFOs -->
          <VisuDestinationExtra v-model="row.destination.extra as DestinationExtra"
            v-else-if="row.destination.type.key === VISU_DESTINATION_TYPE_KEY && row.destination.function.key === VISU_LFOS_FUNCTION_KEY"
            :visu-extras="visuLfosExtras" />

          <!-- Global Buttons Destination Type -->
          <select
            v-else-if="row.destination.type.key === GLOBAL_DESTINATION_TYPE_KEY && row.destination.function.key === GLOBAL_BUTTONS_DESTINATION_FUNCTION_KEY"
            :value="row.destination.extra.keyOrValue"
            @change="destinationExtraSelectionChanged($event, row.index, false, DestinationExtraVariant.GLOBAL_BUTTONS)"
            :title="row.destination.extra.abbr" class="form-select border-dark pt-1"
            :class="{ 'select-empty': row.destination.extra.keyOrValue === EMPTY_KEY }">
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
            :class="{ 'select-empty': row.destination.extra.keyOrValue === EMPTY_KEY }">
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
            :class="{ 'select-empty': row.destination.extra.keyOrValue === EMPTY_KEY }">
            <option v-for="extra in globalModesDestinationExtras" :key="extra.key" :value="extra.key"
              :title="extra.abbr">
              {{ extra.description }}</option>
          </select>

          <!-- Else show a select with all the extras for this destination type -->
          <select v-else :value="row.destination.extra.keyOrValue"
            @change="destinationExtraSelectionChanged($event, row.index)" :title="row.destination.extra.abbr"
            class="form-select border-dark pt-1"
            :class="{ 'select-empty': row.destination.extra.keyOrValue === EMPTY_KEY }">
            <option v-for="extra in currentlySelectedDestinationTypes[row.index]?.extras" :key="extra.key"
              :value="extra.key" :title="extra.abbr">
              {{ extra.description }}</option>
          </select>
        </div>

        <!-- Clear button at grid position 10 -->
        <div class="endCap">
          <button
            v-if="row.source.type.key !== EMPTY_KEY || row.destination.type.key !== EMPTY_KEY"
            class="btn btn-sm clear-btn-fixed"
            @click="clearRow(row.index)"
            title="Clear this row"
          >
            X
          </button>
        </div>

        <!-- Comment section (unfolds only when single row is selected) -->
        <RowCommentSection
          v-if="selectedRowIndices.size === 1 && isRowSelected(row.index)"
          :row-index="row.index"
          :source-empty="row.source.type.key === EMPTY_KEY"
          :destination-empty="row.destination.type.key === EMPTY_KEY"
          :has-copied-source="hasCopiedSource"
          :has-copied-destination="hasCopiedDestination"
          :warnings="getRowWarnings(row.index)"
          v-model="rowComments[row.index]"
          @copy-source="copySource"
          @paste-source="pasteSource"
          @clear-source="clearSource"
          @copy-destination="copyDestination"
          @paste-destination="pasteDestination"
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

button,
label:not(.label-empty) {
  background-color: var(--color-primary) !important;
}

#buttonDownloadHtml,
#fileInputLabel {
  border-radius: var(--form-border-radius-left);
}

#buttonDownloadMap,
#buttonReset {
  border-radius: var(--form-border-radius-right);
}

.header-label {
  display: inline-flex;
  width: 13em;
  font-weight: bold;
}

.header-val {
  display: inline-flex;
  color: var(--color-text-yellow) !important;
}

.header-val input[type="text"] {
  background-color: var(--color-primary);
  border-radius: 5px !important;
  padding-left: 0.4em;
}

#rowsGridContainer,
#rowsGridContainerHeader {
  display: grid;
  grid-template-columns: 2.5em 3.5em 3.5em 1.3fr 2fr 2.5fr 1.3fr 2fr 2.5fr 3.5em;
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

.debugValue {
  color: red;
  display: inline-flex;
  width: 100px;
  font-size: xx-small;
}

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
  padding: var(--button-padding);
  margin: 0;
  background-color: var(--color-primary);
  border: none;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--form-border-radius-right);
  transition: background-color var(--transition-standard),
              box-shadow var(--transition-standard);
}

.clear-btn-fixed:hover {
  background-color: var(--color-hover);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-hover);
}
</style>
