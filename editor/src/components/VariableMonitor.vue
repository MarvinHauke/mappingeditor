<script setup lang="ts">
import { computed } from 'vue'
import BasePanel from './BasePanel.vue'

interface VariableLike {
  readonly name: string
  value: number
}

const props = defineProps<{
  variables: VariableLike[]
  midiMonitorExpanded: boolean
  settingsPanelExpanded: boolean
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

// Position based on Settings Panel and MIDI Monitor states
// Settings: minimized 100px, expanded 180px
// MIDI: minimized 150px, expanded 320px
// Gap: 10px between each
const rightPosition = computed(() => {
  const settingsWidth = props.settingsPanelExpanded ? 180 : 100
  const midiWidth = props.midiMonitorExpanded ? 320 : 150
  const gaps = 20 // 10px gap on each side
  return `${settingsWidth + midiWidth + gaps + 10}px`
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
