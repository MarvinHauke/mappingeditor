<script setup lang="ts">
import { defineModel, onMounted, ref, defineEmits } from 'vue';
import { EMPTY_ABBR, EMPTY_DESCRIPTION, EMPTY_KEY, genMidiCcDestinationDnA, type MappingTuple } from '../modules/dataModel';
import { DestinationExtra } from '../modules/documentModel';

const MAX_VALUE = 4095;
const model = defineModel<DestinationExtra>({ required: true });
const props = defineProps({ midiCcExtras: { type: Array<MappingTuple>, required: true } });
const nrpnInput = ref<HTMLInputElement>();
const nrpnSelect = ref<HTMLSelectElement>();
const nrpnCheck = ref<HTMLInputElement>();
const showNrpn = ref<boolean>(false);
const nrpnValue = ref<number>(EMPTY_KEY);

function checkChanged() {
    if (nrpnCheck.value?.checked) {
        showNrpn.value = true;
        return;
    }

    showNrpn.value = false;
}

function numChanged() {
    const actualKey = nrpnValue.value + 127;
    const { abbr, description } = genMidiCcDestinationDnA(actualKey);
    model.value = new DestinationExtra(actualKey, abbr, description);
}

function selectChanged() {
    const actualKey = parseInt(nrpnSelect.value?.value || "0");
    const { abbr, description } = genMidiCcDestinationDnA(actualKey);
    model.value = new DestinationExtra(actualKey, abbr, description);
}   

defineEmits(['update:modelValue']);

</script>

<template>
    <div class="extras-container">
        <div class="first" :class="{ 'input-disabled': !showNrpn }" :title="model.abbr">
            <label for="nrpnCheck">NRPN:</label>
            <div>
                <input type="checkbox" class="form-check-input" id="nrpnCheck" ref="nrpnCheck" @change="checkChanged" />
            </div>
        </div>
        <div class="second">
            <select v-if="!showNrpn" :value="model.keyOrValue" :title="model.abbr" class="form-select border-dark pt-1" id="nrpnSelect" ref="nrpnSelect" @change="selectChanged"
                :class="{ 'select-empty': model.keyOrValue === EMPTY_KEY }">
                <option v-for="extra in props.midiCcExtras" :key="extra.key" :value="extra.key" :title="extra.abbr">
                    {{ extra.description }}</option>
            </select>
            <input v-else type="number" class="form-control" id="nrpnInput" ref="nrpnInput" v-model="nrpnValue"
                @change="numChanged()" :max="MAX_VALUE" :min="0" :title="model.description" />
        </div>
    </div>
</template>

<style scoped>
/* Note: Base .extras-container, .input-disabled, .select-empty are in global form-elements.css */

.first {
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: center;
    height: 100%;
    width: 30%;
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
    width: 6em;
    color: var(--color-text-primary);
}

.second {
    display: flex;
    flex-direction: row;
    justify-content: right;
    align-items: center;
    height: 100%;
    width: 70%;
    background-color: var(--color-primary);
}

.second>input {
    background-color: var(--color-primary);
}

.second>select {
  background-color: var(--color-primary);
  color: var(--color-text-primary);
}
</style>