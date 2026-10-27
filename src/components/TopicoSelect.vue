<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useDadosStore } from '@/stores/dados'
import type { Topico } from '@/types'

const props = defineProps<{ modelValue?: string; disciplinaId?: string; id?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string | undefined): void }>()
const dados = useDadosStore()

const NOVO = '__novo__'
const criando = ref(false)
const nome = ref('')

/** Lista achatada com recuo para subtópicos. */
const opcoes = computed(() => {
  if (!props.disciplinaId) return [] as { t: Topico; nivel: number }[]
  const todos = dados.topicosDaDisciplina(props.disciplinaId, true).filter((t) => !t.arquivado || t.id === props.modelValue)
  const saida: { t: Topico; nivel: number }[] = []
  const visitar = (pai: string | undefined, nivel: number) => {
    todos.filter((t) => t.parentId === pai).forEach((t) => {
      saida.push({ t, nivel })
      visitar(t.id, nivel + 1)
    })
  }
  visitar(undefined, 0)
  return saida
})

function aoMudar(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (v === NOVO) {
    criando.value = true
    ;(e.target as HTMLSelectElement).value = props.modelValue ?? ''
    return
  }
  emit('update:modelValue', v || undefined)
}

async function criar() {
  if (!props.disciplinaId || !nome.value.trim()) return
  try {
    const t = await dados.criarTopico(props.disciplinaId, nome.value)
    emit('update:modelValue', t.id)
    nome.value = ''
    criando.value = false
  } catch {
    /* já notificado */
  }
}
</script>

<template>
  <div class="space-y-2">
    <select :id="id" class="input" :value="modelValue ?? ''" :disabled="!disciplinaId" @change="aoMudar">
      <option value="">{{ disciplinaId ? 'Sem tópico específico' : 'Escolha a disciplina primeiro' }}</option>
      <option v-for="o in opcoes" :key="o.t.id" :value="o.t.id">{{ '  '.repeat(o.nivel) }}{{ o.nivel ? '↳ ' : '' }}{{ o.t.nome }}{{ o.t.arquivado ? ' (arquivado)' : '' }}</option>
      <option v-if="disciplinaId" :value="NOVO">＋ Novo tópico…</option>
    </select>
    <form v-if="criando" class="flex gap-2" @submit.prevent="criar">
      <input v-model="nome" class="input" placeholder="Nome do novo tópico" autofocus maxlength="120" aria-label="Nome do novo tópico" />
      <button type="submit" class="btn btn-primary shrink-0" :disabled="!nome.trim()"><Plus class="h-4 w-4" />Criar</button>
      <button type="button" class="btn btn-ghost shrink-0" @click="criando = false">Cancelar</button>
    </form>
  </div>
</template>
