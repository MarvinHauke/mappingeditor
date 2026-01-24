<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useMidi, type ParsedMidiMessage } from '../composables/useMidi'
import BasePanel from './BasePanel.vue'

const props = defineProps<{
  settingsPanelExpanded: boolean
  showSelectionToolbar: boolean
  selectionToolbarExpanded: boolean
}>()

const emit = defineEmits<{
  expandedChange: [expanded: boolean]
}>()

const { isSupported, isEnabled, messageHistory, lastMessage, enableMidi, clearHistory: clearHistoryComposable } = useMidi()

// Position based on Settings Panel and Selection Toolbar states
// Settings: minimized 100px, expanded 180px
// Selection Toolbar: minimized 120px, expanded 260px (only if visible)
const rightPosition = computed(() => {
  const settingsWidth = props.settingsPanelExpanded ? 180 : 100
  const selWidth = props.showSelectionToolbar ? (props.selectionToolbarExpanded ? 260 : 120) : 0
  const gaps = props.showSelectionToolbar ? 20 : 10 // 10px gap between each visible panel
  return `${settingsWidth + selWidth + gaps + 10}px`
})

const showActivity = ref(false)

// Activity indicator (blink on new message)
watch(lastMessage, () => {
  showActivity.value = true
  setTimeout(() => (showActivity.value = false), 200)
})

// Display last 5 messages (newest at bottom)
const recentMessages = computed(() => messageHistory.value.slice(-5))

function formatMessage(msg: ParsedMidiMessage): string {
  switch (msg.type) {
    case 'note':
      const noteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][msg.note! % 12]
      const octave = Math.floor(msg.note! / 12) - 1
      return `Note ${noteName}${octave} Ch${msg.channel + 1} Vel${msg.velocity}`
    case 'cc':
      return `CC #${msg.cc} Ch${msg.channel + 1} Val${msg.value}`
    case 'nrpn':
      return `NRPN ${msg.nrpn} Ch${msg.channel + 1} Val${msg.nrpnValue}`
    case 'pitchbend':
      return `Bend Ch${msg.channel + 1} Val${msg.value}`
    case 'aftertouch':
      return `AT Ch${msg.channel + 1} Val${msg.value}`
    default:
      return 'Unknown'
  }
}

function getMessageColor(type: string): string {
  const colors: Record<string, string> = {
    note: '#34cc99',
    cc: '#F1F700',
    nrpn: '#ff6b6b',
    pitchbend: '#4ecdc4',
    aftertouch: '#95e1d3'
  }
  return colors[type] || '#fff'
}

function clearHistory(): void {
  clearHistoryComposable()
}

function onExpandedChange(expanded: boolean): void {
  emit('expandedChange', expanded)
}

// Auto-enable MIDI on mount if supported
onMounted(async () => {
  if (isSupported.value && !isEnabled.value) {
    try {
      await enableMidi()
    } catch (error) {
      console.error('Failed to enable MIDI:', error)
    }
  }
})
</script>

<template>
  <BasePanel
    title="MIDI Monitor"
    storage-key="midi-monitor-expanded"
    :right-position="rightPosition"
    minimized-width="150px"
    expanded-width="320px"
    @expanded-change="onExpandedChange"
  >
    <template #header-extra>
      <span v-if="showActivity" class="activity-dot"></span>
    </template>

    <div v-if="!isSupported" class="message-item error">
      MIDI not supported in this browser
    </div>

    <div v-else-if="recentMessages.length === 0" class="message-item empty">
      No MIDI messages received
    </div>

    <div v-else class="messages-list">
      <div
        v-for="(msg, idx) in recentMessages"
        :key="`${msg.timestamp}-${idx}`"
        class="message-item"
        :style="{ borderLeftColor: getMessageColor(msg.type) }"
      >
        <span class="message-bullet">•</span>
        <span class="message-text">{{ formatMessage(msg) }}</span>
      </div>
    </div>

    <button
      v-if="recentMessages.length > 0"
      @click.stop="clearHistory"
      class="btn btn-sm clear-btn"
    >
      Clear
    </button>
  </BasePanel>
</template>

<style scoped>
.activity-dot {
  width: 8px;
  height: 8px;
  background-color: #ff4444;
  border-radius: 50%;
  animation: blink 0.2s ease;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.message-item {
  padding: 3px 6px;
  background-color: rgba(52, 204, 153, 0.1);
  border-left: 2px solid #34cc99;
  display: flex;
  align-items: center;
  color: #34cc99;
}

.message-item.empty,
.message-item.error {
  text-align: center;
  border-left: none;
}

.message-item.empty {
  color: #666;
}

.message-item.error {
  color: #ff4444;
}

.message-bullet {
  margin-right: 6px;
  font-weight: bold;
}

.message-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clear-btn {
  margin-top: 4px;
  width: 100%;
  background-color: #cc8534 !important;
  color: black;
  border: 1px solid #000;
  padding: 2px 6px;
  font-size: 11px;
}

.clear-btn:hover {
  background-color: #b87429 !important;
}
</style>
