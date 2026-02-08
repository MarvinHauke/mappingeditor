<script setup lang="ts">
import { defineModel, onMounted, ref } from 'vue';
import { EMPTY_ABBR, EMPTY_DESCRIPTION, EMPTY_KEY, genNrpnSourceExtraDnA, genVarSourceExtraDnA } from '../modules/dataModel';
import { SourceExtra } from '../modules/documentModel';

const props = defineProps<{
  isLocked?: boolean;
  incomingValue?: number;
}>();

const MAX_VALUE = 4095;
const model = defineModel<SourceExtra>({ required: true });
const varInput = ref<HTMLInputElement>();
const varCheck = ref<HTMLInputElement>();
const disableNum = ref<boolean>(false);
const varValue = ref<number>(EMPTY_KEY);

// Helper functions for value display
function toPercent(value: number): number {
  if (value === EMPTY_KEY) return 0;
  return Math.round((value / MAX_VALUE) * 100);
}

function toHex(value: number): string {
  if (value === EMPTY_KEY) return '0x0000';
  return '0x' + value.toString(16).toUpperCase().padStart(4, '0');
}

function checkChanged() {
    if (varCheck.value?.checked) {
        disableNum.value = true;
        const { abbr, description } = genVarSourceExtraDnA(0);
        model.value = new SourceExtra(0, abbr, description);
        varValue.value = EMPTY_KEY;
        return
    }

    varValue.value = EMPTY_KEY;
    disableNum.value = false;
    model.value = new SourceExtra(EMPTY_KEY, EMPTY_ABBR, EMPTY_DESCRIPTION);
}

function numChanged() {
    const actualKey = varValue.value + 1;
    const { abbr, description } = genVarSourceExtraDnA(actualKey);
    model.value = new SourceExtra(actualKey, abbr, description);
}

onMounted(() => {
    if (model.value.keyOrValue === 0) {
        disableNum.value = true;
        varValue.value = EMPTY_KEY;

        if (varCheck.value) {
            varCheck.value.checked = true;
        }
        return;
    }

    if (varCheck.value) {
        varCheck.value.checked = false;
    }

    disableNum.value = false
    varValue.value = model.value.keyOrValue - 1;
});

defineEmits(['update:modelValue']);

</script>

<template>
    <div class="extras-container" :class="{ 'container-locked': isLocked }">
        <div class="first" :class="{ 'input-disabled': !disableNum, 'section-locked': isLocked }" :title="model.abbr">
            <label for="varCheck">From Row/Var:</label>
            <div>
                <input type="checkbox" class="form-check-input" id="varCheck" ref="varCheck" @change="checkChanged" :disabled="isLocked" />
            </div>
        </div>
        <div class="second" :class="{ 'input-disabled': disableNum, 'section-locked': isLocked }">
            <!-- Editable fader when "From Row/Var" is unchecked (constant value mode) -->
            <div v-if="!disableNum" class="fader-container">
                <!-- Lighter green fill showing current value (filled area) -->
                <div class="fader-fill" :style="{ width: toPercent(varValue) + '%' }">
                    <!-- Grey handle at value position -->
                    <div class="fader-handle"></div>
                </div>

                <!-- Range slider (invisible, for mouse interaction) -->
                <input
                    type="range"
                    class="fader-slider"
                    :class="{ 'slider-locked': isLocked }"
                    min="0"
                    :max="MAX_VALUE"
                    v-model="varValue"
                    @input="numChanged"
                    :disabled="isLocked"
                />

                <!-- Number input fixed on the right -->
                <input
                    type="number"
                    class="fader-input"
                    :class="{ 'input-locked': isLocked }"
                    min="0"
                    :max="MAX_VALUE"
                    v-model="varValue"
                    @change="numChanged"
                    :disabled="isLocked"
                    ref="varInput"
                />
            </div>

            <!-- Read-only progress bar when "From Row/Var" is checked (incoming value mode) -->
            <div v-else class="fader-container readonly">
                <!-- Lighter green fill showing incoming value (filled area) -->
                <div class="fader-fill" :style="{ width: toPercent(incomingValue ?? 0) + '%' }">
                    <!-- Grey handle at value position -->
                    <div class="fader-handle"></div>
                </div>

                <!-- Display value -->
                <div class="fader-display">{{ incomingValue ?? 0 }}</div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Note: Base .extras-container, .input-disabled are in global form-elements.css */

.first {
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: center;
    height: 100%;
    width: 50%;
    background-color: var(--color-primary);
}

.first>div {
    display: flex;
    width: var(--extras-checkbox-size);
    height: var(--extras-checkbox-size);
    padding-right: var(--extras-checkbox-padding-right);
}

.first>label {
    padding-left: var(--extras-label-padding-left);
    height: 100%;
    width: 15em;
    color: var(--color-text-primary);
}

.second {
    display: flex;
    flex-direction: row;
    justify-content: stretch;
    align-items: stretch;
    height: 100%;
    width: 50%;
    background-color: var(--color-primary);
    padding: 0;
    border-top: 1px solid rgba(52, 204, 153, 0.1);
}

/* Fader Container - technical hardware style with inset effect */
.fader-container {
    position: relative;
    width: 100%;
    height: 100%;
    background:
        repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.3) 0px,
            transparent 1px,
            transparent 4px
        ),
        #1a1a1a;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 8px;
    border: 1px solid #000;
    border-top-color: #0a0a0a;
    border-left-color: #0a0a0a;
    border-bottom-color: #2a2a2a;
    border-right-color: #2a2a2a;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8);
}

/* Lighter green fill showing current value (filled area) - brighter technical green */
.fader-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: linear-gradient(
        180deg,
        rgba(52, 204, 153, 0.5) 0%,
        rgba(52, 204, 153, 0.4) 50%,
        rgba(52, 204, 153, 0.5) 100%
    );
    transition: width 0.1s ease;
    z-index: 0;
    pointer-events: none;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
}

/* Technical indicator handle at value position */
.fader-handle {
    position: absolute;
    right: -1px;
    top: 0;
    width: 2px;
    height: 100%;
    background: linear-gradient(
        180deg,
        #aaa 0%,
        #888 50%,
        #666 100%
    );
    box-shadow:
        1px 0 0 rgba(255, 255, 255, 0.3),
        -1px 0 2px rgba(0, 0, 0, 0.5);
    pointer-events: none;
}

/* Invisible range slider for mouse interaction (middle layer) */
.fader-slider {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
    z-index: 1;
    margin: 0;
}

.fader-slider:disabled {
    cursor: not-allowed;
}

/* Number input field - technical display style */
.fader-input {
    position: relative;
    z-index: 2;
    width: 70px;
    height: 70%;
    background: #0a0a0a;
    border: 1px solid #2a2a2a;
    border-top-color: #000;
    border-left-color: #000;
    color: #34cc99;
    text-align: left;
    font-size: 13px;
    font-weight: 700;
    font-family: 'Courier New', Courier, monospace;
    outline: none;
    padding: 4px 6px;
    box-shadow:
        inset 0 1px 2px rgba(0, 0, 0, 0.8),
        0 1px 0 rgba(255, 255, 255, 0.05);
    letter-spacing: 0.5px;
}

.fader-input:focus {
    background: #0d0d0d;
    border-color: #34cc99;
    color: #F1F700;
    box-shadow:
        inset 0 1px 2px rgba(0, 0, 0, 0.8),
        0 0 4px rgba(52, 204, 153, 0.3);
}

.fader-input:hover:not(:disabled) {
    border-color: #34cc99;
}

.fader-input:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* Read-only mode */
.fader-container.readonly {
    cursor: default;
}

/* Display value in read-only mode - technical readout style */
.fader-display {
    position: relative;
    z-index: 2;
    color: #34cc99;
    font-size: 13px;
    font-weight: 700;
    font-family: 'Courier New', Courier, monospace;
    letter-spacing: 0.5px;
    text-shadow: 0 0 3px rgba(52, 204, 153, 0.3);
}
</style>