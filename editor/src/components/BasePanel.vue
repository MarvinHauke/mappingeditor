<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  storageKey: string
  rightPosition?: string
  minimizedWidth?: string
  expandedWidth?: string
}>(), {
  rightPosition: '10px',
  minimizedWidth: '150px',
  expandedWidth: '320px'
})

const emit = defineEmits<{
  expandedChange: [expanded: boolean]
}>()

const isExpanded = ref(false)

// Load persisted state
isExpanded.value = localStorage.getItem(props.storageKey) === 'true'

// Persist and emit on change
watch(isExpanded, (val) => {
  localStorage.setItem(props.storageKey, val.toString())
  emit('expandedChange', val)
})

// Emit initial state on mount
onMounted(() => {
  emit('expandedChange', isExpanded.value)
})

function toggleExpand(): void {
  isExpanded.value = !isExpanded.value
}

const panelWidth = computed(() => isExpanded.value ? props.expandedWidth : props.minimizedWidth)

// Expose isExpanded for parent components that need to read it
defineExpose({ isExpanded })
</script>

<template>
  <div
    class="base-panel"
    :class="{ expanded: isExpanded, minimized: !isExpanded }"
    :style="{ right: rightPosition, width: panelWidth }"
  >
    <div class="panel-header" @click="toggleExpand">
      <span class="title">{{ title }}</span>
      <slot name="header-extra" />
      <span class="toggle">{{ isExpanded ? '▼' : '▲' }}</span>
    </div>

    <div v-if="isExpanded" class="panel-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.base-panel {
  position: fixed;
  top: 10px;
  background-color: #34cc99;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  transition: all 0.3s ease;
  font-size: 12px;
}

.panel-header {
  display: flex;
  align-items: center;
  padding: 2px 8px;
  cursor: pointer;
  user-select: none;
  font-weight: bold;
  color: black;
  background-color: #34cc99;
  border-bottom: 2px solid #000;
  white-space: nowrap;
  gap: 2px;
}

.panel-header:hover {
  background-color: #F1F700;
}

.title {
  flex: 1;
}

.toggle {
  font-size: 12px;
  color: #000;
  margin-left: 8px;
}

.panel-body {
  padding: 4px;
  max-height: 350px;
  overflow-y: auto;
  background-color: #000;
  border: 2px solid #34cc99;
  border-top: none;
}

/* Scrollbar styling */
.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
}

.panel-body::-webkit-scrollbar-thumb {
  background: rgba(52, 204, 153, 0.5);
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: rgba(52, 204, 153, 0.8);
}
</style>
