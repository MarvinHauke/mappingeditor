<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import BasePanel from './BasePanel.vue'
import type { VariableUsageInfo } from '@/composables/useVariableUsage'

interface VariableLike {
  readonly name: string
  value: number
}

const props = defineProps<{
  variables: VariableLike[]
  variableUsage: VariableUsageInfo[]
  displayRowIndexAsHex: boolean
  settingsPanelExpanded: boolean
  showSelectionToolbar: boolean
  selectionToolbarExpanded: boolean
  showMidiMonitor: boolean
  midiMonitorExpanded: boolean
}>()

const emit = defineEmits<{
  expandedChange: [expanded: boolean]
}>()

// Value display format
type ValueFormat = 'decimal' | 'hex' | 'binary' | 'boolean';
const valueFormat = ref<ValueFormat>('decimal');
const VALUE_FORMAT_KEY = 'variable-value-format';

// Display mode: values, writers, or readers
type DisplayMode = 'values' | 'writers' | 'readers';
const displayMode = ref<DisplayMode>('values');
const DISPLAY_MODE_KEY = 'variable-display-mode';

// Load preferences from localStorage
onMounted(() => {
  const savedFormat = localStorage.getItem(VALUE_FORMAT_KEY);
  if (savedFormat && ['decimal', 'hex', 'binary', 'boolean'].includes(savedFormat)) {
    valueFormat.value = savedFormat as ValueFormat;
  }

  const savedMode = localStorage.getItem(DISPLAY_MODE_KEY);
  if (savedMode && ['values', 'writers', 'readers'].includes(savedMode)) {
    displayMode.value = savedMode as DisplayMode;
  }
});

// Persist preferences
watch(valueFormat, (val) => {
  localStorage.setItem(VALUE_FORMAT_KEY, val);
});

watch(displayMode, (val) => {
  localStorage.setItem(DISPLAY_MODE_KEY, val);
});

// Variable labels A-P
const variableLabels = computed(() => {
  return props.variables.map((_, index) => String.fromCharCode(65 + index))
})

// Use single column for binary format, two columns otherwise
const useSingleColumn = computed(() => {
  return valueFormat.value === 'binary';
});

// Split variables based on layout mode
const leftColumn = computed(() => {
  return useSingleColumn.value ? props.variables : props.variables.slice(0, 8);
});

const rightColumn = computed(() => {
  return useSingleColumn.value ? [] : props.variables.slice(8, 16);
});

const leftLabels = computed(() => {
  return useSingleColumn.value ? variableLabels.value : variableLabels.value.slice(0, 8);
});

const rightLabels = computed(() => {
  return useSingleColumn.value ? [] : variableLabels.value.slice(8, 16);
});

// Format value based on selected format
function formatValue(value: number, format: ValueFormat): string {
  switch (format) {
    case 'hex':
      return value.toString(16).toUpperCase().padStart(3, '0'); // 000-FFF
    case 'binary':
      return value.toString(2).padStart(12, '0'); // 12-bit binary
    case 'boolean':
      return value === 0 ? '0' : '1';
    case 'decimal':
    default:
      return value.toString(); // 0-4095
  }
}

function getFormatPrefix(format: ValueFormat): string {
  switch (format) {
    case 'hex': return '0x';
    case 'binary': return '0b';
    default: return '';
  }
}

// Format row index based on hex/dec preference
function formatRowIndex(index: number): string {
  if (props.displayRowIndexAsHex) {
    return index.toString(16).toUpperCase().padStart(2, '0');
  }
  return index.toString();
}

// Get display content based on mode
function getDisplayContent(varIndex: number): string {
  if (displayMode.value === 'writers') {
    const writers = props.variableUsage[varIndex]?.writtenByRows ?? [];
    return writers.length > 0 ? writers.map(formatRowIndex).join(', ') : '—';
  } else if (displayMode.value === 'readers') {
    const readers = props.variableUsage[varIndex]?.readByRows ?? [];
    return readers.length > 0 ? readers.map(formatRowIndex).join(', ') : '—';
  } else {
    const variable = props.variables[varIndex];
    return getFormatPrefix(valueFormat.value) + formatValue(variable.value, valueFormat.value);
  }
}

// Position based on Settings, Selection Toolbar, and MIDI Monitor states
const rightPosition = computed(() => {
  const settingsWidth = props.settingsPanelExpanded ? 180 : 100
  const selWidth = props.showSelectionToolbar ? (props.selectionToolbarExpanded ? 260 : 120) : 0
  const midiWidth = props.showMidiMonitor ? (props.midiMonitorExpanded ? 320 : 150) : 0
  const visiblePanelCount = 1 + (props.showSelectionToolbar ? 1 : 0) + (props.showMidiMonitor ? 1 : 0)
  const gaps = visiblePanelCount * 10
  return `${settingsWidth + selWidth + midiWidth + gaps + 10}px`
})

// Expanded width - consistent sizing to avoid scrollbars
const expandedWidth = computed(() => {
  // Use consistent 300px width for all formats to ensure proper panel docking
  // and to accommodate future Rows subsection
  return '300px';
})

function onExpandedChange(expanded: boolean): void {
  emit('expandedChange', expanded)
}
</script>

<template>
  <BasePanel
    title="Variables"
    storage-key="variable-monitor-expanded"
    :right-position="rightPosition"
    minimized-width="110px"
    :expanded-width="expandedWidth"
    @expanded-change="onExpandedChange"
  >
    <div class="variable-monitor-content">
      <!-- Toggle Controls Header (Fixed) -->
      <div class="variable-controls">
      <!-- Format buttons row -->
      <div class="control-group">
        <span class="control-label">Format:</span>
        <div class="toggle-group">
          <button
            class="format-toggle-btn"
            :class="{ active: valueFormat === 'decimal', disabled: displayMode !== 'values' }"
            :disabled="displayMode !== 'values'"
            @click="valueFormat = 'decimal'"
            title="Decimal (0-4095)"
          >
            DEC
          </button>
          <button
            class="format-toggle-btn"
            :class="{ active: valueFormat === 'hex', disabled: displayMode !== 'values' }"
            :disabled="displayMode !== 'values'"
            @click="valueFormat = 'hex'"
            title="Hexadecimal (000-FFF)"
          >
            HEX
          </button>
          <button
            class="format-toggle-btn"
            :class="{ active: valueFormat === 'binary', disabled: displayMode !== 'values' }"
            :disabled="displayMode !== 'values'"
            @click="valueFormat = 'binary'"
            title="Binary (12-bit)"
          >
            BIN
          </button>
          <button
            class="format-toggle-btn"
            :class="{ active: valueFormat === 'boolean', disabled: displayMode !== 'values' }"
            :disabled="displayMode !== 'values'"
            @click="valueFormat = 'boolean'"
            title="Boolean (0 or 1)"
          >
            BOOL
          </button>
        </div>
      </div>

      <!-- Display mode buttons row -->
      <div class="control-group">
        <span class="control-label">Show:</span>
        <div class="toggle-group">
          <button
            class="toggle-btn"
            :class="{ active: displayMode === 'values' }"
            @click="displayMode = 'values'"
            title="Show variable values"
          >
            Values
          </button>
          <button
            class="toggle-btn"
            :class="{ active: displayMode === 'writers' }"
            @click="displayMode = 'writers'"
            title="Show rows that write to variables"
          >
            Writers
          </button>
          <button
            class="toggle-btn"
            :class="{ active: displayMode === 'readers' }"
            @click="displayMode = 'readers'"
            title="Show rows that read from variables"
          >
            Readers
          </button>
        </div>
      </div>
    </div>

    <!-- Variables Grid Container (Scrollable) -->
    <div class="variables-container">
      <div class="variables-grid" :class="{ 'single-column': useSingleColumn }">
        <div class="variables-column">
        <div
          v-for="(variable, idx) in leftColumn"
          :key="leftLabels[idx]"
          class="variable-item"
          :class="{
            'variable-unused': !variableUsage[useSingleColumn ? idx : idx]?.isUsed,
            'variable-read': variableUsage[useSingleColumn ? idx : idx]?.isRead,
            'variable-written': variableUsage[useSingleColumn ? idx : idx]?.isWritten
          }"
        >
          <span class="variable-label">{{ leftLabels[idx] }}:</span>
          <span class="variable-value">
            {{ getDisplayContent(useSingleColumn ? idx : idx) }}
          </span>
        </div>
      </div>

      <div v-if="!useSingleColumn" class="variables-column">
        <div
          v-for="(variable, idx) in rightColumn"
          :key="rightLabels[idx]"
          class="variable-item"
          :class="{
            'variable-unused': !variableUsage[8 + idx]?.isUsed,
            'variable-read': variableUsage[8 + idx]?.isRead,
            'variable-written': variableUsage[8 + idx]?.isWritten
          }"
        >
          <span class="variable-label">{{ rightLabels[idx] }}:</span>
          <span class="variable-value">
            {{ getDisplayContent(8 + idx) }}
          </span>
        </div>
      </div>
    </div>
    </div>
    </div>
  </BasePanel>
</template>

<style scoped>
/* Main content wrapper */
.variable-monitor-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 350px;
  overflow: hidden;
  padding: 4px;
}

/* Controls Header - Fixed at top */
.variable-controls {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 5px 4px 7px 4px;
  border-bottom: 1px solid rgba(52, 204, 153, 0.3);
  margin-bottom: 5px;
  flex-shrink: 0;
  background-color: #000;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.control-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  min-width: 48px;
}

.toggle-group {
  display: flex;
  gap: 2px;
}

.format-toggle-btn {
  padding: 4px 8px;
  font-size: 0.8rem;
  background: rgba(52, 204, 153, 0.1);
  border: 1px solid rgba(52, 204, 153, 0.3);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
}

.format-toggle-btn:hover:not(:disabled) {
  background: rgba(52, 204, 153, 0.2);
  border-color: rgba(52, 204, 153, 0.5);
}

.format-toggle-btn.active {
  background: rgba(52, 204, 153, 0.4);
  border-color: #34cc99;
  color: #34cc99;
  font-weight: bold;
}

.format-toggle-btn.disabled,
.format-toggle-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.toggle-btn {
  padding: 4px 10px;
  font-size: 0.8rem;
  background: rgba(52, 204, 153, 0.1);
  border: 1px solid rgba(52, 204, 153, 0.3);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: rgba(52, 204, 153, 0.2);
  border-color: rgba(52, 204, 153, 0.5);
}

.toggle-btn.active {
  background: rgba(52, 204, 153, 0.4);
  border-color: #34cc99;
  color: #34cc99;
}

/* Variables Container - Scrollable, takes remaining space */
.variables-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding-right: 2px;
}

/* Custom scrollbar styling */
.variables-container::-webkit-scrollbar {
  width: 6px;
}

.variables-container::-webkit-scrollbar-track {
  background: rgba(52, 204, 153, 0.1);
}

.variables-container::-webkit-scrollbar-thumb {
  background: rgba(52, 204, 153, 0.4);
  border-radius: 3px;
}

.variables-container::-webkit-scrollbar-thumb:hover {
  background: rgba(52, 204, 153, 0.6);
}

/* Variables Grid */
.variables-grid {
  display: flex;
  gap: 6px;
  padding: 0 2px;
}

.variables-grid.single-column {
  flex-direction: column;
}

.variables-grid.single-column .variables-column {
  width: 100%;
}

.variables-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.variable-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 4px;
  gap: 4px;
  background-color: rgba(52, 204, 153, 0.1);
  border-left: 2px solid #34cc99;
  color: #34cc99;
  transition: opacity 0.2s, background-color 0.2s;
}

/* Unused variables - greyed out */
.variable-item.variable-unused {
  opacity: 0.6;
  background-color: rgba(108, 117, 125, 0.15);
  border-left-color: rgba(108, 117, 125, 0.6);
}

.variable-item.variable-unused .variable-label,
.variable-item.variable-unused .variable-value {
  color: rgba(108, 117, 125, 0.9);
}

/* Read indicator - subtle highlight */
.variable-item.variable-read {
  border-left-color: #34cc99;
}

/* Written indicator - stronger highlight */
.variable-item.variable-written {
  background-color: rgba(52, 204, 153, 0.15);
}

.variable-label {
  font-weight: bold;
  min-width: 18px;
  font-size: 0.85rem;
}

.variable-value {
  color: #F1F700;
  font-family: 'Courier New', monospace;
  font-size: 0.95rem; /* Increased from 0.85rem */
  font-weight: 500;
}

.variable-item.variable-unused .variable-value {
  color: rgba(241, 247, 0, 0.3);
}

/* Override BasePanel's overflow to let us handle it internally */
:deep(.panel-body) {
  overflow: hidden !important;
  padding: 0 !important;
}
</style>
