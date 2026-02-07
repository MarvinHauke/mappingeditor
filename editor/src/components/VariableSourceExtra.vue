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
            <!-- Editable slider when "From Row/Var" is unchecked (constant value mode) -->
            <div v-if="!disableNum" class="variable-slider-container">
                <input
                    type="range"
                    class="variable-slider-editable"
                    :class="{ 'slider-locked': isLocked }"
                    min="0"
                    :max="MAX_VALUE"
                    v-model="varValue"
                    @input="numChanged"
                    :disabled="isLocked"
                    :style="{ '--slider-progress': toPercent(varValue) + '%' }"
                    :title="`Value: ${varValue} (${toHex(varValue)})`"
                />
                <div class="variable-value-label">
                    <span class="value-dec">{{ varValue }}</span>
                    <span class="value-hex">{{ toHex(varValue) }}</span>
                </div>
            </div>
            <!-- Read-only progress bar when "From Row/Var" is checked (incoming value mode) -->
            <div v-else class="variable-progress-readonly" :class="{ 'progress-locked': isLocked }">
                <div class="progress-bar-wrapper">
                    <div
                        class="progress-bar-fill"
                        :style="{ width: toPercent(incomingValue ?? 0) + '%' }"
                    ></div>
                </div>
                <div class="progress-label">
                    <span class="value-dec">{{ incomingValue ?? 0 }}</span>
                    <span class="value-hex">{{ toHex(incomingValue ?? 0) }}</span>
                </div>
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
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
    height: 100%;
    width: 50%;
    background-color: var(--color-primary);
    padding: 0 var(--form-padding-horizontal);
}

/* Editable Slider Container */
.variable-slider-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
}

.variable-slider-editable {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 8px;
    background: #000;
    border: 1px solid #34cc99;
    outline: none;
    overflow: hidden;
    cursor: pointer;
    position: relative;
}

.variable-slider-editable:hover:not(:disabled) {
    border-color: #F1F700;
}

.variable-slider-editable:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

/* Invisible but draggable thumb - spans full slider width */
.variable-slider-editable::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 16px;
    background: rgba(241, 247, 0, 0.01);
    border: none;
    cursor: ew-resize;
    border-radius: 0;
}

.variable-slider-editable::-moz-range-thumb {
    width: 12px;
    height: 16px;
    background: rgba(241, 247, 0, 0.01);
    border: none;
    cursor: ew-resize;
    border-radius: 0;
}

/* Create progress fill effect using track background - this IS the fader */
.variable-slider-editable::-webkit-slider-runnable-track {
    background: linear-gradient(to right, #34cc99 var(--slider-progress, 0%), transparent var(--slider-progress, 0%));
    height: 6px;
}

.variable-slider-editable::-moz-range-track {
    background: linear-gradient(to right, #34cc99 var(--slider-progress, 0%), transparent var(--slider-progress, 0%));
    height: 6px;
}

/* Hover effect - change fill color to yellow */
.variable-slider-editable:hover:not(:disabled)::-webkit-slider-runnable-track {
    background: linear-gradient(to right, #F1F700 var(--slider-progress, 0%), transparent var(--slider-progress, 0%));
}

.variable-slider-editable:hover:not(:disabled)::-moz-range-track {
    background: linear-gradient(to right, #F1F700 var(--slider-progress, 0%), transparent var(--slider-progress, 0%));
}

/* Value labels below slider */
.variable-value-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-primary);
    opacity: 0.8;
}

.value-dec {
    font-weight: 600;
}

.value-hex {
    font-family: monospace;
    opacity: 0.7;
}

/* Read-only Progress Bar - styled to match editable slider */
.variable-progress-readonly {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
}

.progress-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-primary);
    opacity: 0.8;
}

.progress-bar-wrapper {
    width: 100%;
    height: 8px;
    background-color: #000;
    overflow: hidden;
    position: relative;
}

.progress-bar-fill {
    height: 100%;
    background-color: #34cc99;
    transition: width 0.2s ease;
}

.progress-locked {
    opacity: 0.5;
}

/* Locked state for editable slider */
.slider-locked {
    opacity: 0.5;
}
</style>