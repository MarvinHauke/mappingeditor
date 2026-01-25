<script setup lang="ts">
import { ref, computed } from 'vue';
import BasePanel from './BasePanel.vue';
import { useWarningLog, type LogEntry, type LogEntryType, type LogEntrySource } from '../composables/useWarningLog';

const props = defineProps<{
  settingsPanelExpanded: boolean;
  showSelectionToolbar: boolean;
  selectionToolbarExpanded: boolean;
  showMidiMonitor: boolean;
  midiMonitorExpanded: boolean;
  showVariableMonitor: boolean;
  variableMonitorExpanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'expandedChange', expanded: boolean): void;
  (e: 'scrollToRow', rowIndex: number): void;
}>();

const { 
  filteredEntries, 
  filterByType, 
  filterBySource, 
  clearLog,
  entryCount,
  warningCount,
  errorCount
} = useWarningLog();

// Selected entry for expanded details view
const expandedEntryId = ref<number | null>(null);

// Position to the left of Variable Monitor
// Settings: minimized 100px, expanded 180px
// Selection: minimized 120px, expanded 260px (only if visible)
// MIDI: minimized 150px, expanded 320px (only if visible)
// Variable: minimized 110px, expanded 200px (only if visible)
const rightPosition = computed(() => {
  const settingsWidth = props.settingsPanelExpanded ? 180 : 100;
  const selWidth = props.showSelectionToolbar ? (props.selectionToolbarExpanded ? 260 : 120) : 0;
  const midiWidth = props.showMidiMonitor ? (props.midiMonitorExpanded ? 320 : 150) : 0;
  const varWidth = props.showVariableMonitor ? (props.variableMonitorExpanded ? 200 : 110) : 0;
  // Count visible panels for gap calculation: Settings always visible
  const visiblePanelCount = 1 + (props.showSelectionToolbar ? 1 : 0) + (props.showMidiMonitor ? 1 : 0) + (props.showVariableMonitor ? 1 : 0);
  const gaps = visiblePanelCount * 10; // 10px gap between each visible panel
  return `${settingsWidth + selWidth + midiWidth + varWidth + gaps + 10}px`;
});

// Toggle type filter
function toggleTypeFilter(type: LogEntryType): void {
  if (filterByType.value.has(type)) {
    filterByType.value.delete(type);
  } else {
    filterByType.value.add(type);
  }
  filterByType.value = new Set(filterByType.value);
}

// Toggle source filter
function toggleSourceFilter(source: LogEntrySource): void {
  if (filterBySource.value.has(source)) {
    filterBySource.value.delete(source);
  } else {
    filterBySource.value.add(source);
  }
  filterBySource.value = new Set(filterBySource.value);
}

// Toggle expanded view for an entry
function toggleExpanded(entryId: number): void {
  if (expandedEntryId.value === entryId) {
    expandedEntryId.value = null;
  } else {
    expandedEntryId.value = entryId;
  }
}

// Handle click on row number
function handleRowClick(rowIndex: number | undefined): void {
  if (rowIndex !== undefined) {
    emit('scrollToRow', rowIndex);
  }
}

// Format timestamp as HH:MM:SS
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

// Get type indicator color
function getTypeColor(type: LogEntryType): string {
  switch (type) {
    case 'info': return '#34cc99';
    case 'warning': return '#ffc107';
    case 'error': return '#dc3545';
  }
}

function onExpandedChange(expanded: boolean): void {
  emit('expandedChange', expanded);
}

// Panel title with entry count
const panelTitle = computed(() => {
  if (entryCount.value === 0) return 'Log';
  return `Log (${entryCount.value})`;
});
</script>

<template>
  <BasePanel
    :title="panelTitle"
    storage-key="warning-log-expanded"
    :right-position="rightPosition"
    minimized-width="140px"
    expanded-width="350px"
    @expanded-change="onExpandedChange"
  >
    <template #header-extra>
      <div class="badge-container">
        <span v-if="warningCount > 0" class="count-badge warning-badge">{{ warningCount }}</span>
        <span v-if="errorCount > 0" class="count-badge error-badge">{{ errorCount }}</span>
      </div>
    </template>

    <div class="log-content">
      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <button
            class="filter-btn"
            :class="{ active: filterByType.has('info') }"
            @click="toggleTypeFilter('info')"
            title="Toggle info entries"
          >
            <span class="type-dot" style="background: #34cc99"></span>
          </button>
          <button
            class="filter-btn"
            :class="{ active: filterByType.has('warning') }"
            @click="toggleTypeFilter('warning')"
            title="Toggle warning entries"
          >
            <span class="type-dot" style="background: #ffc107"></span>
          </button>
          <button
            class="filter-btn"
            :class="{ active: filterByType.has('error') }"
            @click="toggleTypeFilter('error')"
            title="Toggle error entries"
          >
            <span class="type-dot" style="background: #dc3545"></span>
          </button>
        </div>
        <div class="filter-group">
          <button
            class="filter-btn source-btn"
            :class="{ active: filterBySource.has('analyzer') }"
            @click="toggleSourceFilter('analyzer')"
            title="Toggle analyzer entries"
          >
            A
          </button>
          <button
            class="filter-btn source-btn"
            :class="{ active: filterBySource.has('reference') }"
            @click="toggleSourceFilter('reference')"
            title="Toggle reference entries"
          >
            R
          </button>
          <button
            class="filter-btn source-btn"
            :class="{ active: filterBySource.has('system') }"
            @click="toggleSourceFilter('system')"
            title="Toggle system entries"
          >
            S
          </button>
        </div>
        <button
          class="clear-btn"
          @click="clearLog"
          title="Clear all entries"
          :disabled="entryCount === 0"
        >
          Clear
        </button>
      </div>

      <!-- Entries list -->
      <div class="entries-list">
        <div v-if="filteredEntries.length === 0" class="empty-state">
          <span v-if="entryCount === 0">No log entries</span>
          <span v-else>No entries match filters</span>
        </div>

        <div
          v-for="entry in filteredEntries"
          :key="entry.id"
          class="log-entry"
          :class="{ expanded: expandedEntryId === entry.id }"
          @click="toggleExpanded(entry.id)"
        >
          <div class="entry-header">
            <span class="type-indicator" :style="{ background: getTypeColor(entry.type) }"></span>
            <span class="entry-time">{{ formatTime(entry.timestamp) }}</span>
            <span class="entry-source">{{ entry.source.charAt(0).toUpperCase() }}</span>
            <span
              v-if="entry.rowIndex !== undefined"
              class="entry-row"
              @click.stop="handleRowClick(entry.rowIndex)"
              title="Click to scroll to row"
            >
              R{{ entry.rowIndex }}
            </span>
          </div>
          <div class="entry-message">{{ entry.message }}</div>
          <div v-if="expandedEntryId === entry.id && entry.details" class="entry-details">
            {{ entry.details }}
          </div>
        </div>
      </div>
    </div>
  </BasePanel>
</template>

<style scoped>
.log-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
}

.filter-bar {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: rgba(52, 204, 153, 0.1);
  border-bottom: 1px solid #34cc99;
}

.filter-group {
  display: flex;
  gap: 2px;
}

.filter-btn {
  width: 20px;
  height: 20px;
  border: 1px solid #34cc99;
  background: #000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  opacity: 0.4;
}

.filter-btn.active {
  opacity: 1;
}

.filter-btn:hover {
  border-color: #F1F700;
}

.filter-btn.source-btn {
  font-size: 10px;
  font-weight: bold;
  color: #34cc99;
}

.type-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.clear-btn {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: bold;
  border: 1px solid #34cc99;
  background: #000;
  color: #34cc99;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-btn:hover:not(:disabled) {
  background: #cc8534;
  color: #000;
  border-color: #cc8534;
}

.clear-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.entries-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px;
}

.empty-state {
  text-align: center;
  padding: 16px;
  color: rgba(52, 204, 153, 0.5);
  font-size: 11px;
}

.log-entry {
  padding: 4px 6px;
  margin-bottom: 2px;
  background: rgba(52, 204, 153, 0.05);
  border-left: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.log-entry:hover {
  background: rgba(52, 204, 153, 0.1);
}

.log-entry.expanded {
  background: rgba(52, 204, 153, 0.15);
}

.entry-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}

.type-indicator {
  width: 3px;
  height: 12px;
  border-radius: 1px;
}

.entry-time {
  font-size: 9px;
  color: rgba(52, 204, 153, 0.7);
  font-family: monospace;
}

.entry-source {
  font-size: 9px;
  font-weight: bold;
  color: #34cc99;
  background: rgba(52, 204, 153, 0.2);
  padding: 0 3px;
  border-radius: 2px;
}

.entry-row {
  font-size: 9px;
  font-weight: bold;
  color: #F1F700;
  background: rgba(241, 247, 0, 0.2);
  padding: 0 4px;
  border-radius: 2px;
  cursor: pointer;
  margin-left: auto;
}

.entry-row:hover {
  background: rgba(241, 247, 0, 0.4);
}

.entry-message {
  font-size: 10px;
  color: #34cc99;
  line-height: 1.3;
  word-break: break-word;
}

.entry-details {
  font-size: 9px;
  color: rgba(52, 204, 153, 0.7);
  margin-top: 4px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 2px;
  line-height: 1.4;
}

.badge-container {
  display: flex;
  align-items: center;
  gap: 2px;
}

.count-badge {
  font-size: 9px;
  font-weight: bold;
  padding: 0 4px;
  border-radius: 6px;
  white-space: nowrap;
}

.warning-badge {
  background: #ffc107;
  color: #000;
}

.error-badge {
  background: #dc3545;
  color: #fff;
}
</style>
