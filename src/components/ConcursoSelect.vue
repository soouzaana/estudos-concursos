<script setup lang="ts">
import { computed } from 'vue'
import { useDadosStore } from '@/stores/dados'

const props = withDefaults(
  defineProps<{ modelValue?: string; vazio?: string; incluirTodos?: boolean; id?: string; soAbertos?: boolean }>(),
  { vazio: 'Geral (sem concurso)', incluirTodos: false, soAbertos: true }
)
const emit = defineEmits<{ (e: 'update:modelValue', v: string | undefined): void }>()
const dados = useDadosStore()

const lista = computed(() =>
  dados.concursos
    .filter((c) => !props.soAbertos || c.status === 'preparacao' || c.id === props.modelValue)
    .sort((a, b) => a.nome.localeCompare(b.nome))
)
</script>

<template>
  <select :id="id" class="input" :value="modelValue ?? ''" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value || undefined)">
    <option value="">{{ incluirTodos ? 'Todos os concursos' : vazio }}</option>
    <option v-for="c in lista" :key="c.id" :value="c.id">{{ c.nome }}{{ c.status !== 'preparacao' ? ' (' + (c.status === 'pausado' ? 'pausado' : c.status === 'concluido' ? 'concluído' : 'arquivado') + ')' : '' }}</option>
  </select>
</template>
