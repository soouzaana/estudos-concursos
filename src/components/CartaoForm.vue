<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Cartao, Dificuldade } from '@/types'
import { DIFICULDADES } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'
import ConcursoMulti from './ConcursoMulti.vue'
import DisciplinaSelect from './DisciplinaSelect.vue'
import FormField from './FormField.vue'
import TopicoSelect from './TopicoSelect.vue'

const props = defineProps<{ modelValue: boolean; cartao?: Cartao | null; inicial?: Partial<Cartao> }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const dados = useDadosStore()
const toast = useToast()

const f = reactive({
  frente: '', verso: '', disciplinaId: undefined as string | undefined, topicoId: undefined as string | undefined,
  dificuldade: 'media' as Dificuldade, tagsTexto: ''
})
const concursoIds = ref<string[]>([])
const erros = reactive<{ frente?: string; verso?: string }>({})
const editando = computed(() => !!props.cartao)

watch(
  () => props.modelValue,
  (aberto) => {
    if (!aberto) return
    erros.frente = erros.verso = undefined
    const b = props.cartao ?? props.inicial ?? {}
    Object.assign(f, {
      frente: b.frente ?? '', verso: b.verso ?? '', disciplinaId: b.disciplinaId, topicoId: b.topicoId, dificuldade: b.dificuldade ?? 'media',
      tagsTexto: (b.tags ?? []).join(', ')
    })
    concursoIds.value = [...(b.concursoIds ?? [])]
  },
  { immediate: true }
)
watch(() => f.disciplinaId, (n, o) => {
  if (o !== undefined && n !== o) f.topicoId = undefined
}, { flush: 'sync' })

async function salvar() {
  erros.frente = f.frente.trim() ? undefined : 'Escreva a frente do cartão.'
  erros.verso = f.verso.trim() ? undefined : 'Escreva o verso (resposta).'
  if (erros.frente || erros.verso) return
  const tags = [...new Set(f.tagsTexto.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
  const base = { frente: f.frente.trim(), verso: f.verso.trim(), disciplinaId: f.disciplinaId, topicoId: f.topicoId, dificuldade: f.dificuldade, tags, concursoIds: [...concursoIds.value] }
  try {
    if (props.cartao) await dados.atualizarCartao({ ...props.cartao, ...base })
    else await dados.criarCartao(base)
    toast.sucesso(editando.value ? 'Cartão atualizado.' : 'Cartão criado.')
    emit('update:modelValue', false)
  } catch {
    /* já notificado */
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" :titulo="editando ? 'Editar flashcard' : 'Novo flashcard'" @update:model-value="emit('update:modelValue', $event)">
    <form id="form-cartao" class="space-y-3" @submit.prevent="salvar">
      <FormField rotulo="Frente (pergunta) *" para="ca-f" :erro="erros.frente"><textarea id="ca-f" v-model="f.frente" class="input" maxlength="3000" autofocus /></FormField>
      <FormField rotulo="Verso (resposta) *" para="ca-v" :erro="erros.verso"><textarea id="ca-v" v-model="f.verso" class="input" maxlength="3000" /></FormField>
      <FormField rotulo="Disciplina" para="ca-d"><DisciplinaSelect id="ca-d" v-model="f.disciplinaId" permite-vazio rotulo-vazio="Sem disciplina" /></FormField>
      <FormField rotulo="Tópico" para="ca-t"><TopicoSelect id="ca-t" v-model="f.topicoId" :disciplina-id="f.disciplinaId" /></FormField>
      <FormField rotulo="Concursos (opcional)" para="ca-c"><ConcursoMulti v-model="concursoIds" /></FormField>
      <div class="grid grid-cols-2 gap-3">
        <FormField rotulo="Dificuldade" para="ca-dif"><select id="ca-dif" v-model="f.dificuldade" class="input"><option v-for="d in DIFICULDADES" :key="d.valor" :value="d.valor">{{ d.rotulo }}</option></select></FormField>
        <FormField rotulo="Tags" para="ca-tags"><input id="ca-tags" v-model="f.tagsTexto" class="input" maxlength="200" placeholder="separe por vírgula" /></FormField>
      </div>
    </form>
    <template #rodape>
      <button type="button" class="btn btn-outline" @click="emit('update:modelValue', false)">Cancelar</button>
      <button type="submit" form="form-cartao" class="btn btn-primary">Salvar cartão</button>
    </template>
  </BaseModal>
</template>
