<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import type { Dificuldade, Erro, MotivoErro } from '@/types'
import { DIFICULDADES, MOTIVOS } from '@/types'
import { hoje } from '@/utils/datas'
import { useDadosStore } from '@/stores/dados'
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'
import ConcursoMulti from './ConcursoMulti.vue'
import DisciplinaSelect from './DisciplinaSelect.vue'
import FormField from './FormField.vue'
import TopicoSelect from './TopicoSelect.vue'

/**
 * Cadastro/edição de erro do caderno. `inicial` pré-preenche a partir de um bloco de questões,
 * evitando que o usuário refaça disciplina, tópico, concursos, fonte e data.
 */
const props = defineProps<{ modelValue: boolean; erro?: Erro | null; inicial?: Partial<Erro>; restantes?: number }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'salvo', erro: Erro, continuar: boolean): void }>()
const dados = useDadosStore()
const toast = useToast()

const f = reactive({
  enunciado: '', respostaMarcada: '', respostaCorreta: '', explicacao: '', motivo: 'falta_conhecimento' as MotivoErro,
  disciplinaId: undefined as string | undefined, topicoId: undefined as string | undefined, fonte: '', data: hoje(),
  dificuldade: 'media' as Dificuldade, tagsTexto: ''
})
const concursoIds = ref<string[]>([])
const alternativas = ref<string[]>([])
const erros = reactive<{ enunciado?: string; disciplina?: string }>({})
const editando = computed(() => !!props.erro)

watch(
  () => props.modelValue,
  (aberto) => {
    if (!aberto) return
    erros.enunciado = erros.disciplina = undefined
    const base = props.erro ?? props.inicial ?? {}
    Object.assign(f, {
      enunciado: base.enunciado ?? '', respostaMarcada: base.respostaMarcada ?? '', respostaCorreta: base.respostaCorreta ?? '',
      explicacao: base.explicacao ?? '', motivo: base.motivo ?? 'falta_conhecimento', disciplinaId: base.disciplinaId, topicoId: base.topicoId,
      fonte: base.fonte ?? '', data: base.data ?? hoje(), dificuldade: base.dificuldade ?? 'media', tagsTexto: (base.tags ?? []).join(', ')
    })
    concursoIds.value = [...(base.concursoIds ?? [])]
    alternativas.value = [...(base.alternativas ?? [])]
  },
  { immediate: true }
)
watch(() => f.disciplinaId, (n, o) => {
  if (o !== undefined && n !== o) f.topicoId = undefined
}, { flush: 'sync' })

function validar() {
  erros.enunciado = f.enunciado.trim() ? undefined : 'Escreva o enunciado (ou um resumo da questão).'
  erros.disciplina = f.disciplinaId ? undefined : 'Escolha a disciplina.'
  return !erros.enunciado && !erros.disciplina
}

async function salvar(continuar: boolean) {
  if (!validar()) return
  const tags = [...new Set(f.tagsTexto.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
  try {
    const salvo = await dados.salvarErro({
      ...(props.erro ? { id: props.erro.id } : {}),
      ...(props.inicial?.blocoId && !props.erro ? { blocoId: props.inicial.blocoId } : {}),
      enunciado: f.enunciado.trim(), alternativas: alternativas.value.map((a) => a.trim()).filter(Boolean),
      respostaMarcada: f.respostaMarcada.trim(), respostaCorreta: f.respostaCorreta.trim(), explicacao: f.explicacao.trim(), motivo: f.motivo,
      disciplinaId: f.disciplinaId!, topicoId: f.topicoId, concursoIds: [...concursoIds.value], fonte: f.fonte.trim(), data: f.data,
      dificuldade: f.dificuldade, tags
    })
    toast.sucesso(editando.value ? 'Erro atualizado.' : 'Erro adicionado ao caderno.')
    emit('salvo', salvo, continuar)
    if (!continuar) emit('update:modelValue', false)
  } catch {
    /* já notificado */
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" :titulo="editando ? 'Editar erro' : 'Novo erro no caderno'" largura="lg" @update:model-value="emit('update:modelValue', $event)">
    <form id="form-erro" class="space-y-3" @submit.prevent="salvar(false)">
      <p v-if="restantes && restantes > 0" class="rounded-xl bg-brand-50 p-3 text-xs text-accent dark:bg-brand-900/30">Faltam {{ restantes }} erro(s) deste bloco para cadastrar. Disciplina, tópico, concursos e fonte já vêm preenchidos.</p>
      <FormField rotulo="Enunciado *" para="er-enun" :erro="erros.enunciado"><textarea id="er-enun" v-model="f.enunciado" class="input min-h-[120px]" maxlength="6000" autofocus /></FormField>

      <fieldset>
        <legend class="label">Alternativas (opcional)</legend>
        <div class="space-y-2">
          <div v-for="(_, i) in alternativas" :key="i" class="flex gap-2">
            <input v-model="alternativas[i]" class="input" maxlength="600" :aria-label="`Alternativa ${i + 1}`" :placeholder="`Alternativa ${String.fromCharCode(65 + i)}`" />
            <button type="button" class="btn-icon" :aria-label="`Remover alternativa ${i + 1}`" @click="alternativas.splice(i, 1)"><X class="h-4 w-4" /></button>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" @click="alternativas.push('')"><Plus class="h-3.5 w-3.5" />Adicionar alternativa</button>
        </div>
      </fieldset>

      <div class="grid grid-cols-2 gap-3">
        <FormField rotulo="Resposta marcada" para="er-marc"><input id="er-marc" v-model="f.respostaMarcada" class="input" maxlength="300" /></FormField>
        <FormField rotulo="Resposta correta" para="er-corr"><input id="er-corr" v-model="f.respostaCorreta" class="input" maxlength="300" /></FormField>
      </div>
      <FormField rotulo="Explicação detalhada" para="er-exp"><textarea id="er-exp" v-model="f.explicacao" class="input min-h-[100px]" maxlength="6000" /></FormField>

      <div class="grid gap-3 sm:grid-cols-2">
        <FormField rotulo="Motivo do erro" para="er-mot"><select id="er-mot" v-model="f.motivo" class="input"><option v-for="m in MOTIVOS" :key="m.valor" :value="m.valor">{{ m.rotulo }}</option></select></FormField>
        <FormField rotulo="Dificuldade" para="er-dif"><select id="er-dif" v-model="f.dificuldade" class="input"><option v-for="d in DIFICULDADES" :key="d.valor" :value="d.valor">{{ d.rotulo }}</option></select></FormField>
        <FormField rotulo="Disciplina *" para="er-disc" :erro="erros.disciplina"><DisciplinaSelect id="er-disc" v-model="f.disciplinaId" :concurso-id="concursoIds[0]" /></FormField>
        <FormField rotulo="Tópico" para="er-top"><TopicoSelect id="er-top" v-model="f.topicoId" :disciplina-id="f.disciplinaId" /></FormField>
        <FormField rotulo="Fonte" para="er-fonte"><input id="er-fonte" v-model="f.fonte" class="input" maxlength="120" placeholder="Ex.: plataforma, prova, ano" /></FormField>
        <FormField rotulo="Data do erro" para="er-data"><input id="er-data" v-model="f.data" type="date" class="input" /></FormField>
      </div>
      <FormField rotulo="Concursos associados" para="er-conc"><ConcursoMulti v-model="concursoIds" /></FormField>
      <FormField rotulo="Tags (separadas por vírgula)" para="er-tags"><input id="er-tags" v-model="f.tagsTexto" class="input" maxlength="200" placeholder="pegadinha, súmula, prazo" /></FormField>
    </form>
    <template #rodape>
      <button type="button" class="btn btn-outline" @click="emit('update:modelValue', false)">Cancelar</button>
      <button v-if="!editando && restantes && restantes > 1" type="button" class="btn btn-soft" @click="salvar(true)">Salvar e cadastrar próximo</button>
      <button type="submit" form="form-erro" class="btn btn-primary">Salvar erro</button>
    </template>
  </BaseModal>
</template>
