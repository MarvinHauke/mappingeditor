<script setup lang="ts">
import { defineModel, onMounted, ref } from 'vue';
import { EMPTY_ABBR, EMPTY_DESCRIPTION, EMPTY_KEY, genNrpnSourceExtraDnA, genVarSourceExtraDnA } from '../modules/dataModel';
import { SourceExtra } from '../modules/documentModel';

const props = defineProps<{
  isLocked?: boolean
}>();

const MAX_VALUE = 4095;
const model = defineModel<SourceExtra>({ required: true });
const varInput = ref<HTMLInputElement>();
const varCheck = ref<HTMLInputElement>();
const disableNum = ref<boolean>(false);
const varValue = ref<number>(EMPTY_KEY);

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
            <input :disabled="disableNum || isLocked" type="number" class="form-control" id="varInput" ref="varInput"
                v-model="varValue" @change="numChanged" :max="MAX_VALUE" :min="0" :title="model.description" :class="{ 'input-locked': isLocked }" />
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
    justify-content: right;
    align-items: center;
    height: 100%;
    width: 50%;
    background-color: var(--color-primary);
}

.second>input {
    background-color: var(--color-primary);
    border: none;
    height: 100%;
    width: 100%;
    padding: var(--form-padding-vertical) var(--form-padding-horizontal);
    display: flex;
    align-items: center;
    color: var(--color-text-primary);
}

.second>input:disabled {
    background-color: var(--color-disabled);
    opacity: var(--opacity-full);
    color: transparent;
}
</style>