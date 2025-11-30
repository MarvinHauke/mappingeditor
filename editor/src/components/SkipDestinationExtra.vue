<script setup lang="ts">
import { computed } from 'vue';
import { genCalcSkipSourceExtraDnA } from '../modules/dataModel';
import { DestinationExtra } from '../modules/documentModel';

const props = defineProps<{
  modelValue: DestinationExtra
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DestinationExtra]
}>();

const keyOrValue = computed({
  get() {
    return props.modelValue.keyOrValue;
  },
  set(newValue: number) {
    const { abbr, description } = genCalcSkipSourceExtraDnA(newValue);
    emit('update:modelValue', new DestinationExtra(newValue, abbr, description));
  }
});

</script>

<template>
  <input type="number" v-model.number="keyOrValue" :title="props.modelValue.abbr" class="form-control border-dark pt-1" 
    :class="{ 'select-empty': props.modelValue.keyOrValue === 65535 }" 
    min="0" max="65535" />
</template>

<style scoped>
.select-empty {
  background-color: grey !important;
  color: black;
}
</style>