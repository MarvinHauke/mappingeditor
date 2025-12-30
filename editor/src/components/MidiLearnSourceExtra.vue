<script setup lang="ts">
import { defineModel, ref, computed, onUnmounted } from 'vue'
import { useMidi, type ParsedMidiMessage } from '../composables/useMidi'
import { SourceExtra, SourceFunction } from '../modules/documentModel'
import { EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION } from '../modules/dataModel'
import {
  MIDI_INTERFACES,
  LEARN_TIMEOUT_MS,
  type MidiInterface
} from '../constants/midi'

const model = defineModel<SourceExtra>({ required: true })
const props = defineProps<{
  sourceType: number // 5=MIDI, 6=MIDI CC, 7=MIDI NRPN
}>()

const emit = defineEmits(['update:modelValue', 'functionUpdate'])

const { isLearning, startLearning, stopLearning } = useMidi()

// Interface selection (TRS, USB Host, USB Device)
const selectedInterface = ref<MidiInterface>('trs')
const interfaces = MIDI_INTERFACES

// Learn state
const learnedChannel = ref<number | null>(null)
const learnedValue = ref<number | null>(null)
const learningCountdown = ref<number>(10)
const countdownInterval = ref<number | null>(null)
const learnError = ref<string>('')

// Computed values
const channelWithOffset = computed(() => {
  if (learnedChannel.value === null) return null
  const iface = interfaces.find((i) => i.value === selectedInterface.value)
  return learnedChannel.value + (iface?.offset || 0)
})

const hasLearnedValue = computed(() => learnedChannel.value !== null && learnedValue.value !== null)

// Start learning
function handleStartLearning(): void {
  learnError.value = ''
  learningCountdown.value = LEARN_TIMEOUT_MS / 1000

  // Start countdown
  if (countdownInterval.value) clearInterval(countdownInterval.value)
  countdownInterval.value = window.setInterval(() => {
    learningCountdown.value--
    if (learningCountdown.value <= 0) {
      handleStopLearning()
      learnError.value = 'No MIDI received'
      setTimeout(() => (learnError.value = ''), 3000)
    }
  }, 1000)

  // Start MIDI learning
  startLearning(handleMidiMessage)
}

// Stop learning
function handleStopLearning(): void {
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value)
    countdownInterval.value = null
  }
  stopLearning()
}

// Handle learned MIDI message
function handleMidiMessage(msg: ParsedMidiMessage): void {
  learnedChannel.value = msg.channel

  switch (props.sourceType) {
    case 5: // MIDI (Note)
      if (msg.type === 'note' && msg.note !== undefined) {
        learnedValue.value = msg.note
        updateModel(msg.note)
      }
      break

    case 6: // MIDI CC
      if (msg.type === 'cc' && msg.cc !== undefined) {
        learnedValue.value = msg.cc
        updateModel(msg.cc)
      }
      break

    case 7: // MIDI NRPN
      if (msg.type === 'nrpn' && msg.nrpn !== undefined) {
        learnedValue.value = msg.nrpn
        updateModel(msg.nrpn)
      }
      break
  }
}

// Update model with learned value
function updateModel(value: number): void {
  const abbr = generateAbbr(value)
  const description = generateDescription(value)
  model.value = new SourceExtra(value, abbr, description)

  // Also emit function update with learned channel
  if (channelWithOffset.value !== null) {
    const functionKey = channelWithOffset.value
    emit('functionUpdate', functionKey)
  }
}

function generateAbbr(value: number): string {
  switch (props.sourceType) {
    case 5:
      return `NOTE` // Will use extra field for note selection
    case 6:
      return `#${value.toString().padStart(3, ' ')}`
    case 7:
      return value.toString().padStart(4, ' ')
    default:
      return EMPTY_ABBR
  }
}

function generateDescription(value: number): string {
  switch (props.sourceType) {
    case 5:
      return `MIDI Note`
    case 6:
      return `MIDI Controller #${value}`
    case 7:
      return `MIDI NRPN Controller #${value}`
    default:
      return EMPTY_DESCRIPTION
  }
}

// Cleanup on unmount
onUnmounted(() => {
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value)
  }
  if (isLearning.value) {
    stopLearning()
  }
})
</script>

<template>
  <div class="learn-container">
    <!-- Interface Selection -->
    <div class="interface-select">
      <label>Interface:</label>
      <select v-model="selectedInterface" class="form-select form-select-sm">
        <option v-for="iface in interfaces" :key="iface.value" :value="iface.value">
          {{ iface.label }}
        </option>
      </select>
    </div>

    <!-- Learn Button / Status -->
    <div class="learn-controls">
      <button
        v-if="!isLearning"
        @click="handleStartLearning"
        class="btn btn-sm learn-btn"
        :class="{ 'btn-success': !hasLearnedValue, 'btn-info': hasLearnedValue }"
      >
        {{ hasLearnedValue ? 'Re-Learn' : 'Start Learning' }}
      </button>

      <div v-else class="learning-status">
        <span class="listening-text">Listening...</span>
        <span class="countdown">{{ learningCountdown }}s</span>
        <button @click="handleStopLearning" class="btn btn-sm btn-danger">Cancel</button>
      </div>
    </div>

    <!-- Learned Values Display -->
    <div v-if="hasLearnedValue" class="learned-values">
      <span class="value-label">Channel:</span>
      <span class="value-text">{{ channelWithOffset! + 1 }}</span>
      <span class="value-label">
        {{ props.sourceType === 5 ? 'Note' : props.sourceType === 6 ? 'CC' : 'NRPN' }}:
      </span>
      <span class="value-text">{{ learnedValue }}</span>
    </div>

    <!-- Error Message -->
    <div v-if="learnError" class="learn-error">
      {{ learnError }}
    </div>
  </div>
</template>

<style scoped>
.learn-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 2px;
  background-color: #34cc99;
}

.interface-select {
  display: flex;
  align-items: center;
  gap: 8px;
}

.interface-select label {
  font-weight: bold;
  min-width: 70px;
  color: black;
}

.interface-select select {
  flex: 1;
  background-color: rgba(0, 0, 0, 0.1);
  color: black;
  border: 1px solid rgba(0, 0, 0, 0.2);
  padding: 4px 8px;
}

.learn-controls {
  display: flex;
  align-items: center;
}

.learn-btn {
  background-color: #f1f700 !important;
  color: black;
  font-weight: bold;
  border: 1px solid black;
  padding: 4px 8px;
  width: 100%;
}

.learn-btn:hover {
  background-color: #fff700 !important;
}

.btn-info {
  background-color: #4ecdc4 !important;
}

.btn-info:hover {
  background-color: #3db9b0 !important;
}

.learning-status {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px;
  background-color: rgba(241, 247, 0, 0.3);
  border-radius: 3px;
  border: 2px solid #f1f700;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%,
  100% {
    border-color: #f1f700;
  }
  50% {
    border-color: #34cc99;
  }
}

.listening-text {
  flex: 1;
  font-weight: bold;
  color: black;
}

.countdown {
  font-weight: bold;
  color: #ff4444;
  min-width: 30px;
  text-align: right;
}

.learned-values {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background-color: rgba(0, 0, 0, 0.1);
}

.value-label {
  font-weight: bold;
  color: black;
}

.value-text {
  color: black;
  background-color: rgba(255, 255, 255, 0.3);
  padding: 2px 6px;
  border-radius: 2px;
}

.learn-error {
  padding: 6px 8px;
  background-color: #ff4444;
  color: white;
  border-radius: 3px;
  text-align: center;
  font-weight: bold;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
