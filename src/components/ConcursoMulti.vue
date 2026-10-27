<script setup lang="ts">
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import { useDadosStore } from '@/stores/dados'

const props = defineProps<{ modelValue: string[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()
const dados = useDadosStore()

const lista = computed(() => dados.concursos.filter((c) => c.status === 'preparacao' || props.modelValue.includes(c.id)).sort((a, b) => a.nome.localeCompare(b.nome)))

function alternar(id: string) {
  emit('update:modelValue', props.modelValue.includes(id) ? props.modelValue.filter((x) => x !== id) : [...props.modelValue, id])
}
</script>

<template>
  <div>
    <div v-if="lista.length" class="flex flex-wrap gap-2" role="group" aria-label="Concursos associados">
      <button
        v-for="c in lista"
        :key="c.id"
        type="button"
        class="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition"
        :class="modelValue.includes(c.id) ? 'border-brand-500 bg-brand-100 text-accent dark:bg-brand-900/50' : 'border-line text-muted hover:bg-line/40'"
        :aria-pressed="modelValue.includes(c.id)"
        @click="alternar(c.id)"
      >
        <Check v-if="modelValue.includes(c.id)" class="h-3.5 w-3.5" />{{ c.nome }}
      </button>
    </div>
    <p v-else class="text-xs text-muted">Nenhum concurso em preparação. O registro ficará como geral.</p>
  </div>
</template>
