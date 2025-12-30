import { ref, readonly, onMounted, onUnmounted } from 'vue'

// Type Definitions
export interface ParsedMidiMessage {
  type: 'note' | 'cc' | 'nrpn' | 'pitchbend' | 'aftertouch'
  channel: number        // 0-15
  note?: number          // 0-127 for note messages
  velocity?: number      // 0-127 for note messages
  cc?: number            // 0-127 for CC messages
  value?: number         // CC value or general value
  nrpn?: number          // 0-9999 for NRPN messages
  nrpnValue?: number     // NRPN data value
  timestamp: number
  rawData: Uint8Array
}

interface NrpnBuffer {
  msb: number | null
  lsb: number | null
  dataMsb: number | null
  dataLsb: number | null
  lastUpdate: number
}

// Singleton state to share across component instances
const isSupported = ref<boolean>(false)
const isEnabled = ref<boolean>(false)
const midiAccess = ref<MIDIAccess | null>(null)
const inputs = ref<MIDIInput[]>([])
const lastMessage = ref<ParsedMidiMessage | null>(null)
const messageHistory = ref<ParsedMidiMessage[]>([])
const isLearning = ref<boolean>(false)
const learningCallback = ref<((msg: ParsedMidiMessage) => void) | null>(null)
const learningTimeout = ref<number | null>(null)

// NRPN buffers (one per channel)
const nrpnBuffers: NrpnBuffer[] = Array(16).fill(null).map(() => ({
  msb: null,
  lsb: null,
  dataMsb: null,
  dataLsb: null,
  lastUpdate: 0
}))

const MAX_HISTORY = 50

export function useMidi() {

  // Parse MIDI message data
  function parseMidiMessage(data: Uint8Array, timestamp: number): ParsedMidiMessage | null {
    const status = data[0]
    const command = status & 0xF0
    const channel = status & 0x0F

    switch (command) {
      case 0x80: // Note Off
        return {
          type: 'note',
          channel,
          note: data[1],
          velocity: 0,
          timestamp,
          rawData: data
        }

      case 0x90: // Note On
        const vel = data[2]
        return {
          type: 'note',
          channel,
          note: data[1],
          velocity: vel,
          timestamp,
          rawData: data
        }

      case 0xB0: // Control Change
        const cc = data[1]
        const value = data[2]

        // Check if this is NRPN-related
        if ([99, 98, 6, 38].includes(cc)) {
          return handleNrpnCC(channel, cc, value, timestamp, data)
        }

        return {
          type: 'cc',
          channel,
          cc,
          value,
          timestamp,
          rawData: data
        }

      case 0xE0: // Pitch Bend
        const bend = (data[2] << 7) | data[1]
        return {
          type: 'pitchbend',
          channel,
          value: bend,
          timestamp,
          rawData: data
        }

      case 0xD0: // Channel Aftertouch
        return {
          type: 'aftertouch',
          channel,
          value: data[1],
          timestamp,
          rawData: data
        }

      default:
        return null // Unsupported message type
    }
  }

  // Handle NRPN CC messages and assemble NRPN
  function handleNrpnCC(channel: number, cc: number, value: number, timestamp: number, data: Uint8Array): ParsedMidiMessage | null {
    const buffer = nrpnBuffers[channel]

    // Clear buffer if too old (>100ms)
    if (timestamp - buffer.lastUpdate > 100) {
      buffer.msb = buffer.lsb = buffer.dataMsb = buffer.dataLsb = null
    }

    buffer.lastUpdate = timestamp

    switch (cc) {
      case 99:
        buffer.msb = value
        break // NRPN MSB
      case 98:
        buffer.lsb = value
        break // NRPN LSB
      case 6:
        buffer.dataMsb = value
        break // Data Entry MSB
      case 38:
        buffer.dataLsb = value
        break // Data Entry LSB
    }

    // If we have MSB, LSB, and Data MSB, emit NRPN message
    if (buffer.msb !== null && buffer.lsb !== null && buffer.dataMsb !== null) {
      const nrpn = (buffer.msb << 7) | buffer.lsb
      const nrpnValue = buffer.dataLsb !== null
        ? (buffer.dataMsb << 7) | buffer.dataLsb
        : buffer.dataMsb

      // Clear buffer
      buffer.msb = buffer.lsb = buffer.dataMsb = buffer.dataLsb = null

      return {
        type: 'nrpn',
        channel,
        nrpn,
        nrpnValue,
        timestamp,
        rawData: data
      }
    }

    return null // Incomplete NRPN sequence
  }

  // Add message to history
  function addToHistory(msg: ParsedMidiMessage): void {
    messageHistory.value.push(msg)

    // Keep only last MAX_HISTORY messages
    if (messageHistory.value.length > MAX_HISTORY) {
      messageHistory.value.shift()
    }
  }

  // MIDI message event handler
  function onMidiMessage(event: MIDIMessageEvent): void {
    const parsed = parseMidiMessage(event.data, event.timeStamp)
    if (!parsed) return

    lastMessage.value = parsed
    addToHistory(parsed)

    // If learning, call callback and stop
    if (isLearning.value && learningCallback.value) {
      learningCallback.value(parsed)
      stopLearning()
    }
  }

  // Enable MIDI access
  async function enableMidi(): Promise<void> {
    if (!isSupported.value) {
      throw new Error('Web MIDI API not supported in this browser')
    }

    if (isEnabled.value) {
      return // Already enabled
    }

    try {
      midiAccess.value = await navigator.requestMIDIAccess()
      isEnabled.value = true

      // Setup input listeners
      inputs.value = []
      for (const input of midiAccess.value.inputs.values()) {
        input.onmidimessage = onMidiMessage as any
        inputs.value.push(input)
      }

      // Listen for device connection/disconnection
      midiAccess.value.onstatechange = ((event: Event) => {
        const midiEvent = event as MIDIConnectionEvent
        if (midiEvent.port.type === 'input') {
          if (midiEvent.port.state === 'connected') {
            const input = midiEvent.port as MIDIInput
            input.onmidimessage = onMidiMessage as any
            if (!inputs.value.includes(input)) {
              inputs.value.push(input)
            }
          } else if (midiEvent.port.state === 'disconnected') {
            inputs.value = inputs.value.filter(i => i.id !== midiEvent.port.id)
          }
        }
      }) as any

      console.log('MIDI enabled:', inputs.value.length, 'input(s) found')
    } catch (error) {
      console.error('MIDI access denied:', error)
      throw new Error('MIDI access denied. Please grant permission in browser settings.')
    }
  }

  // Disable MIDI access
  function disableMidi(): void {
    if (midiAccess.value) {
      // Remove listeners
      for (const input of inputs.value) {
        input.onmidimessage = null
      }
      inputs.value = []
      midiAccess.value = null
      isEnabled.value = false
    }
  }

  // Start learning mode
  function startLearning(callback: (msg: ParsedMidiMessage) => void, timeoutMs = 10000): void {
    isLearning.value = true
    learningCallback.value = callback

    // Set timeout
    if (learningTimeout.value) {
      clearTimeout(learningTimeout.value)
    }

    learningTimeout.value = window.setTimeout(() => {
      stopLearning()
    }, timeoutMs)
  }

  // Stop learning mode
  function stopLearning(): void {
    isLearning.value = false
    learningCallback.value = null

    if (learningTimeout.value) {
      clearTimeout(learningTimeout.value)
      learningTimeout.value = null
    }
  }

  // Clear message history
  function clearHistory(): void {
    messageHistory.value = []
    lastMessage.value = null
  }

  // Check MIDI support on mount
  onMounted(() => {
    isSupported.value = 'requestMIDIAccess' in navigator

    if (!isSupported.value) {
      console.warn('Web MIDI API not supported in this browser. Please use Chrome, Edge, Opera, or Firefox 109+.')
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    stopLearning()
  })

  return {
    // State (read-only)
    isSupported: readonly(isSupported),
    isEnabled: readonly(isEnabled),
    inputs: readonly(inputs),
    lastMessage: readonly(lastMessage),
    messageHistory: readonly(messageHistory),
    isLearning: readonly(isLearning),

    // Methods
    enableMidi,
    disableMidi,
    startLearning,
    stopLearning,
    clearHistory
  }
}
