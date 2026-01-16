<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

// Props definition
const props = defineProps<{
  rowIndex: number;
  hasCopiedData: boolean;
  hasContent: boolean;
}>();

// Events definition
const emit = defineEmits<{
  copy: [rowIndex: number];
  paste: [rowIndex: number];
}>();

// Event handlers
function handleCopy(): void {
  emit('copy', props.rowIndex);
}

function handlePaste(): void {
  emit('paste', props.rowIndex);
}
</script>

<template>
  <!-- Copy column -->
  <div class="gridItem copy-column">
    <button
      class="btn btn-sm copy-btn"
      @click="handleCopy"
      title="Copy this row"
      :disabled="!hasContent"
    >
      Copy
    </button>
  </div>

  <!-- Paste column -->
  <div class="gridItem paste-column">
    <button
      class="btn btn-sm paste-btn"
      @click="handlePaste"
      title="Paste copied row here"
      :disabled="!hasCopiedData"
    >
      Paste
    </button>
  </div>
</template>

<style scoped>
/* Copy/Paste columns */
.copy-column,
.paste-column {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
}

/* Button styles */
.copy-btn,
.paste-btn {
  font-size: var(--button-font-size);
  padding: var(--button-padding);
  margin: 0;
  white-space: nowrap;
  background-color: var(--color-primary);
  border: none;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--form-border-radius);
  transition: background-color var(--transition-standard),
              opacity var(--transition-standard);
}

/* Hover states */
.copy-btn:hover:not(:disabled),
.paste-btn:hover:not(:disabled) {
  background-color: var(--color-hover);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-hover);
}

/* Disabled state for copy and paste buttons */
.copy-btn:disabled,
.paste-btn:disabled {
  opacity: var(--opacity-disabled);
  cursor: not-allowed;
  background-color: var(--color-disabled);
}

.copy-btn:disabled:hover,
.paste-btn:disabled:hover {
  box-shadow: none;
  background-color: var(--color-disabled) !important;
}
</style>
