<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'

interface VariableLike {
  readonly name: string
  value: number
}

const props = defineProps<{
  variables: VariableLike[]
  midiMonitorExpanded: boolean
}>()

const emit = defineEmits<{
  expandedChange: [expanded: boolean]
}>()

const isExpanded = ref(false)

// Persist expanded state
const STORAGE_KEY = 'variable-monitor-expanded'
isExpanded.value = localStorage.getItem(STORAGE_KEY) === 'true'
watch(isExpanded, (val) => {
  localStorage.setItem(STORAGE_KEY, val.toString())
  emit('expandedChange', val)
})

// Emit initial state on mount
onMounted(() => {
  emit('expandedChange', isExpanded.value)
})

// Variable labels A-P
const variableLabels = computed(() => {
  return props.variables.map((_, index) => String.fromCharCode(65 + index))
})

// Split variables into two columns (A-H and I-P)
const leftColumn = computed(() => props.variables.slice(0, 8))
const rightColumn = computed(() => props.variables.slice(8, 16))
const leftLabels = computed(() => variableLabels.value.slice(0, 8))
const rightLabels = computed(() => variableLabels.value.slice(8, 16))

// Position based on MIDI Monitor state (minimized: 150px, expanded: 320px, plus 10px gap each side)
const rightPosition = computed(() => props.midiMonitorExpanded ? '340px' : '170px')

function toggleExpand(): void {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="variable-monitor" :class="{ expanded: isExpanded, minimized: !isExpanded }" :style="{ right: rightPosition }">
    <div class="monitor-header" @click="toggleExpand">
      <span class="title">Variables</span>
      <span class="toggle">{{ isExpanded ? '▼' : '▲' }}</span>
    </div>

    <div v-if="isExpanded" class="monitor-body">
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
    </div>
  </div>
</template>

<style scoped>
.variable-monitor {
  position: fixed;
  top: 10px;
  background-color: #34cc99;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  transition: all 0.3s ease;
  font-size: 12px;
}

.minimized {
  width: 100px;
}

.expanded {
  width: 200px;
}

.monitor-header {
  display: flex;
  align-items: center;
  padding: 2px 8px;
  cursor: pointer;
  user-select: none;
  font-weight: bold;
  color: black;
  background-color: #34cc99;
  border-bottom: 2px solid #000;
}

.monitor-header:hover {
  background-color: #F1F700;
}

.title {
  flex: 1;
}

.toggle {
  font-size: 12px;
  color: #000;
}

.monitor-body {
  padding: 4px;
  background-color: #000;
  border: 2px solid #34cc99;
}

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
