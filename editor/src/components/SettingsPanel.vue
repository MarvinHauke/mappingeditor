<script setup lang="ts">
import BasePanel from './BasePanel.vue'

const props = defineProps<{
  displayRowIndexAsHex: boolean
}>()

const emit = defineEmits<{
  expandedChange: [expanded: boolean]
  'update:displayRowIndexAsHex': [value: boolean]
}>()

function toggleHexDisplay(): void {
  emit('update:displayRowIndexAsHex', !props.displayRowIndexAsHex)
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
</style>
