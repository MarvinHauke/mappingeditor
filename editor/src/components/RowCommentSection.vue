<script setup lang="ts">
defineProps<{
  rowIndex: number;
  sourceEmpty: boolean;
  destinationEmpty: boolean;
  hasCopiedSource: boolean;
  hasCopiedDestination: boolean;
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'copySource': [rowIndex: number];
  'pasteSource': [rowIndex: number];
  'clearSource': [rowIndex: number];
  'copyDestination': [rowIndex: number];
  'pasteDestination': [rowIndex: number];
  'clearDestination': [rowIndex: number];
}>();
</script>

<template>
  <div class="row-comment-section">
    <div class="comment-header">
      <span class="comment-row-label">Row {{ rowIndex }}</span>
      <div class="comment-sections">
        <div class="source-section">
          <span class="section-label">Source:</span>
          <button
            class="action-btn"
            @click="emit('copySource', rowIndex)"
            title="Copy Source"
            :disabled="sourceEmpty"
          >C</button>
          <button
            class="action-btn"
            @click="emit('pasteSource', rowIndex)"
            title="Paste Source"
            :disabled="!hasCopiedSource"
          >P</button>
          <button
            class="action-btn"
            @click="emit('clearSource', rowIndex)"
            title="Clear Source"
            :disabled="sourceEmpty"
          >X</button>
        </div>
        <div class="destination-section">
          <span class="section-label">Dest:</span>
          <button
            class="action-btn"
            @click="emit('copyDestination', rowIndex)"
            title="Copy Destination"
            :disabled="destinationEmpty"
          >C</button>
          <button
            class="action-btn"
            @click="emit('pasteDestination', rowIndex)"
            title="Paste Destination"
            :disabled="!hasCopiedDestination"
          >P</button>
          <button
            class="action-btn"
            @click="emit('clearDestination', rowIndex)"
            title="Clear Destination"
            :disabled="destinationEmpty"
          >X</button>
        </div>
      </div>
    </div>
    <textarea
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      class="comment-textarea"
      placeholder="Add a comment for this row..."
      rows="2"
    ></textarea>
  </div>
</template>

<style scoped>
.row-comment-section {
  grid-column: 1 / -1;
  background-color: rgba(241, 247, 0, 0.1);
  border: 2px solid #F1F700;
  border-radius: 4px;
  padding: 8px;
  margin-top: 4px;
  margin-bottom: 4px;
  animation: unfold 0.2s ease-out;
}

@keyframes unfold {
  from {
    opacity: 0;
    max-height: 0;
    padding: 0 8px;
  }
  to {
    opacity: 1;
    max-height: 100px;
    padding: 8px;
  }
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.comment-row-label {
  font-weight: bold;
  color: #F1F700;
  font-size: 12px;
  white-space: nowrap;
}

.comment-sections {
  display: flex;
  flex: 1;
  gap: 8px;
}

.source-section,
.destination-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.section-label {
  font-size: 11px;
  color: #F1F700;
  font-weight: bold;
}

.action-btn {
  padding: 3px 8px;
  font-size: 10px;
  font-weight: bold;
  border: 1px solid #F1F700;
  border-radius: 3px;
  background-color: var(--color-primary);
  color: #F1F700;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.action-btn:hover:not(:disabled) {
  background-color: #F1F700;
  color: #000;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.comment-textarea {
  width: 100%;
  background-color: #1a1a1a;
  border: 1px solid #F1F700;
  border-radius: 4px;
  color: #F1F700;
  padding: 6px;
  font-size: 12px;
  resize: vertical;
  min-height: 40px;
}

.comment-textarea:focus {
  outline: none;
  border-color: #34cc99;
  box-shadow: 0 0 4px rgba(52, 204, 153, 0.5);
}

.comment-textarea::placeholder {
  color: #666;
}
</style>
