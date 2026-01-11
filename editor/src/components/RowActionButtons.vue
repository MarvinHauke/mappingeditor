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
  background-color: #34cc99;
}

/* Button styles */
.copy-btn,
.paste-btn {
  font-size: 10px;
  padding: 0 6px;
  margin: 0;
  white-space: nowrap;
  background-color: #34cc99;
  border: none;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

/* Hover states */
.copy-btn:hover:not(:disabled),
.paste-btn:hover:not(:disabled) {
  background-color: #F1F700;
  color: black;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
}

/* Disabled state for copy and paste buttons */
.copy-btn:disabled,
.paste-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background-color: grey;
}

.copy-btn:disabled:hover,
.paste-btn:disabled:hover {
  box-shadow: none;
  background-color: grey !important;
}
</style>
