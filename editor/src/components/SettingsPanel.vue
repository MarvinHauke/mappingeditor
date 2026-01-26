<script setup lang="ts">
import { ref, watch } from 'vue'
import BasePanel from './BasePanel.vue'

const props = defineProps<{
  displayRowIndexAsHex: boolean
  showSelectionToolbar: boolean
  showMidiMonitor: boolean
  showVariableMonitor: boolean
  showLogMonitor: boolean
  showDescription: boolean
  // Info section props
  headerText: string
  firmwareMajor: number
  firmwareMinor: number
}>()

const emit = defineEmits<{
  expandedChange: [expanded: boolean]
  'update:displayRowIndexAsHex': [value: boolean]
  'update:showSelectionToolbar': [value: boolean]
  'update:showMidiMonitor': [value: boolean]
  'update:showVariableMonitor': [value: boolean]
  'update:showLogMonitor': [value: boolean]
  'update:showDescription': [value: boolean]
}>()

// Sub-section expanded states
const panelsSectionExpanded = ref(localStorage.getItem('settings-panels-expanded') !== 'false')
const infoSectionExpanded = ref(localStorage.getItem('settings-info-expanded') !== 'false')

watch(panelsSectionExpanded, (val) => {
  localStorage.setItem('settings-panels-expanded', val.toString())
})

watch(infoSectionExpanded, (val) => {
  localStorage.setItem('settings-info-expanded', val.toString())
})

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

function toggleLogMonitor(): void {
  emit('update:showLogMonitor', !props.showLogMonitor)
}

function toggleDescription(): void {
  emit('update:showDescription', !props.showDescription)
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
        class="toggle-btn"
        :class="{ active: displayRowIndexAsHex }"
        @click="toggleHexDisplay"
        :title="displayRowIndexAsHex ? 'Switch to decimal (0-69)' : 'Switch to hexadecimal (00-45)'"
      >
        {{ displayRowIndexAsHex ? 'HEX' : 'DEC' }}
      </button>
    </div>

    <div class="setting-divider" @click="panelsSectionExpanded = !panelsSectionExpanded">
      <span class="divider-label">Panels</span>
      <span class="collapse-icon" :class="{ expanded: panelsSectionExpanded }">▸</span>
    </div>

    <div v-if="panelsSectionExpanded" class="collapsible-section">
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
            :checked="showLogMonitor"
            @change="toggleLogMonitor"
          />
          <span>Log Monitor</span>
        </label>
      </div>

      <div class="setting-item">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="showDescription"
            @change="toggleDescription"
          />
          <span>Description</span>
        </label>
      </div>
    </div>

    <div class="setting-divider" @click="infoSectionExpanded = !infoSectionExpanded">
      <span class="divider-label">Info</span>
      <span class="collapse-icon" :class="{ expanded: infoSectionExpanded }">▸</span>
    </div>

    <div v-if="infoSectionExpanded" class="collapsible-section">
      <div class="info-item">
        <span class="info-label">Header:</span>
        <span class="info-value">{{ headerText }}</span>
      </div>

      <div class="info-item">
        <span class="info-label">Firmware:</span>
        <span class="info-value">{{ firmwareMajor }}.{{ firmwareMinor }}</span>
      </div>
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
  font-size: 10px;
  padding: 4px 6px;
  background-color: rgba(52, 204, 153, 0.2);
  border: 1px solid #34cc99;
  /* border-radius: 3px; */
  color: #34cc99;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.toggle-btn:hover {
  background-color: rgba(52, 204, 153, 0.4);
}

.toggle-btn.active {
  background-color: #F1F700;
  color: #000;
  border-color: #F1F700;
}

.setting-divider {
  border-top: 1px solid rgba(52, 204, 153, 0.3);
  margin: 8px 0;
  padding-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.setting-divider:hover .divider-label {
  color: #F1F700;
}

.setting-divider:hover .collapse-icon {
  color: #F1F700;
}

.divider-label {
  color: #34cc99;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.collapse-icon {
  color: #34cc99;
  font-size: 10px;
  transition: transform 0.2s ease;
  display: inline-block;
}

.collapse-icon.expanded {
  transform: rotate(90deg);
}

.collapsible-section {
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

/* Info section styles */
.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
}

.info-label {
  color: #888;
  font-size: 10px;
  font-weight: 500;
}

.info-value {
  color: #F1F700;
  font-size: 11px;
  font-weight: 500;
  word-break: break-all;
}
</style>
