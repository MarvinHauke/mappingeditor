<script setup lang="ts">
import { computed } from 'vue'
import BasePanel from './BasePanel.vue'

interface VariableLike {
  readonly name: string
  value: number
}

const props = defineProps<{
  variables: VariableLike[]
  settingsPanelExpanded: boolean
  showSelectionToolbar: boolean
  selectionToolbarExpanded: boolean
  showMidiMonitor: boolean
  midiMonitorExpanded: boolean
}>()

const emit = defineEmits<{
  expandedChange: [expanded: boolean]
}>()

// Variable labels A-P
const variableLabels = computed(() => {
  return props.variables.map((_, index) => String.fromCharCode(65 + index))
})

// Split variables into two columns (A-H and I-P)
const leftColumn = computed(() => props.variables.slice(0, 8))
const rightColumn = computed(() => props.variables.slice(8, 16))
const leftLabels = computed(() => variableLabels.value.slice(0, 8))
const rightLabels = computed(() => variableLabels.value.slice(8, 16))

// Position based on Settings, Selection Toolbar, and MIDI Monitor states
// Settings: minimized 100px, expanded 180px
// Selection Toolbar: minimized 120px, expanded 260px (only if visible)
// MIDI: minimized 150px, expanded 320px (only if visible)
// Gap: 10px between each visible panel
const rightPosition = computed(() => {
  const settingsWidth = props.settingsPanelExpanded ? 180 : 100
  const selWidth = props.showSelectionToolbar ? (props.selectionToolbarExpanded ? 260 : 120) : 0
  const midiWidth = props.showMidiMonitor ? (props.midiMonitorExpanded ? 320 : 150) : 0
  // Count visible panels for gap calculation: Settings always visible
  const visiblePanelCount = 1 + (props.showSelectionToolbar ? 1 : 0) + (props.showMidiMonitor ? 1 : 0)
  const gaps = visiblePanelCount * 10 // 10px gap between each visible panel
  return `${settingsWidth + selWidth + midiWidth + gaps + 10}px`
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
    expanded-width="200px"
    @expanded-change="onExpandedChange"
  >
    <div class="variables-grid">
      <div class="variables-column">
        <div
          v-for="(variable, idx) in leftColumn"
          :key="leftLabels[idx]"
          class="variable-item"
        >
          <span class="variable-label">{{ leftLabels[idx] }}:</span>
          <span class="variable-value">{{ variable.value }}</span>
        </div>
      </div>
      <div class="variables-column">
        <div
          v-for="(variable, idx) in rightColumn"
          :key="rightLabels[idx]"
          class="variable-item"
        >
          <span class="variable-label">{{ rightLabels[idx] }}:</span>
          <span class="variable-value">{{ variable.value }}</span>
        </div>
      </div>
    </div>
  </BasePanel>
</template>

<style scoped>
.variables-grid {
  display: flex;
  gap: 8px;
}

.variables-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.variable-item {
  display: flex;
  justify-content: space-between;
  padding: 2px 6px;
  background-color: rgba(52, 204, 153, 0.1);
  border-left: 2px solid #34cc99;
  color: #34cc99;
}

.variable-label {
  font-weight: bold;
}

.variable-value {
  color: #F1F700;
}
</style>
