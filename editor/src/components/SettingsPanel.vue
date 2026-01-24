<script setup lang="ts">
import BasePanel from './BasePanel.vue'

const props = defineProps<{
  displayRowIndexAsHex: boolean
  showSelectionToolbar: boolean
  showMidiMonitor: boolean
  showVariableMonitor: boolean
  showWarningLog: boolean
}>()

const emit = defineEmits<{
  expandedChange: [expanded: boolean]
  'update:displayRowIndexAsHex': [value: boolean]
  'update:showSelectionToolbar': [value: boolean]
  'update:showMidiMonitor': [value: boolean]
  'update:showVariableMonitor': [value: boolean]
  'update:showWarningLog': [value: boolean]
}>()

function toggleHexDisplay(): void {
  emit('update:displayRowIndexAsHex', !props.displayRowIndexAsHex)
}

function toggleSelectionToolbar(): void {
  emit('update:showSelectionToolbar', !props.showSelectionToolbar)
}

function toggleMidiMonitor(): void {
  emit('update:showMidiMonitor', !props.showMidiMonitor)
}

function toggleVariableMonitor(): void {
  emit('update:showVariableMonitor', !props.showVariableMonitor)
}

function toggleWarningLog(): void {
  emit('update:showWarningLog', !props.showWarningLog)
}

function onExpandedChange(expanded: boolean): void {
  emit('expandedChange', expanded)
}
</script>

<template>
  <BasePanel
    title="Settings"
    storage-key="settings-panel-expanded"
    right-position="10px"
    minimized-width="100px"
    expanded-width="180px"
    @expanded-change="onExpandedChange"
  >
    <div class="setting-item">
      <span class="setting-label">Row Index Format</span>
      <button
        class="btn btn-sm toggle-btn"
        :class="{ active: displayRowIndexAsHex }"
        @click.stop="toggleHexDisplay"
        :title="displayRowIndexAsHex ? 'Switch to decimal (0-69)' : 'Switch to hexadecimal (00-45)'"
      >
        {{ displayRowIndexAsHex ? 'HEX' : 'DEC' }}
      </button>
    </div>
    
    <div class="setting-divider">
      <span class="divider-label">Panels</span>
    </div>

    <div class="setting-item">
      <label class="checkbox-label">
        <input
          type="checkbox"
          :checked="showSelectionToolbar"
          @change="toggleSelectionToolbar"
        />
        <span>Selection Toolbar</span>
      </label>
    </div>

    <div class="setting-item">
      <label class="checkbox-label">
        <input
          type="checkbox"
          :checked="showMidiMonitor"
          @change="toggleMidiMonitor"
        />
        <span>MIDI Monitor</span>
      </label>
    </div>
    
    <div class="setting-item">
      <label class="checkbox-label">
        <input
          type="checkbox"
          :checked="showVariableMonitor"
          @change="toggleVariableMonitor"
        />
        <span>Variable Monitor</span>
      </label>
    </div>

    <div class="setting-item">
      <label class="checkbox-label">
        <input
          type="checkbox"
          :checked="showWarningLog"
          @change="toggleWarningLog"
        />
        <span>Warning Log</span>
      </label>
    </div>
  </BasePanel>
</template>

<style scoped>
.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px;
}

.setting-label {
  color: #34cc99;
  font-size: 11px;
  font-weight: 500;
}

.toggle-btn {
  width: 100%;
  font-size: 11px;
  padding: 4px 8px;
  background-color: rgba(52, 204, 153, 0.2) !important;
  border: 1px solid #34cc99;
  color: #34cc99;
  font-weight: bold;
}

.toggle-btn:hover {
  background-color: rgba(52, 204, 153, 0.4) !important;
}

.toggle-btn.active {
  background-color: #F1F700 !important;
  color: #000;
  border-color: #F1F700;
}

.setting-divider {
  border-top: 1px solid rgba(52, 204, 153, 0.3);
  margin: 8px 0;
  padding-top: 8px;
}

.divider-label {
  color: #34cc99;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #888;
  font-size: 11px;
  margin: 0;
}

.checkbox-label:hover {
  color: #fff;
}

.checkbox-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #34cc99;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"]:checked + span {
  color: #34cc99;
}
</style>
