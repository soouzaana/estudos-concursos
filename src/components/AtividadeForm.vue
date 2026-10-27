<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { Atividade, Prioridade } from '@/types'
import { PRIORIDADES } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { hoje } from '@/utils/datas'
import { confirmar } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'
import ConcursoSelect from './ConcursoSelect.vue'
import DisciplinaSelect from './DisciplinaSelect.vue'
import FormField from './FormField.vue'
import TopicoSelect from './TopicoSelect.vue'

const props = defineProps<{ modelValue: boolean; atividade?: Atividade | null; concursoPadrao?: string; dataPadrao?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const dados = useDadosStore()
const config = useConfiguracoesStore()
const toast = useToast()

const f = reactive({
  concursoId: undefined as string | undefined,
  disciplinaId: undefined as string | undefined,
  topicoId: undefined as string | undefined,
  data: hoje(),
  horario: '',
  duracaoMin: 60,
  questoesPrevistas: 0,
  prioridade: 'media' as Prioridade,
  observacoes: ''
})
const erros = reactive<{ concurso?: string; disciplina?: string; data?: string; duracao?: string }>({})
const editando = computed(() => !!props.atividade)

watch(
  () => props.modelValue,
  (aberto) => {
    if (!aberto) return
    Object.assign(erros, { concurso: undefined, disciplina: undefined, data: undefined, duracao: undefined })
    const a = props.atividade
    if (a) {
      Object.assign(f, {
        concursoId: a.concursoId, disciplinaId: a.disciplinaId, topicoId: a.topicoId, data: a.dataPlanejada, horario: a.horario ?? '',
        duracaoMin: a.duracaoMin, questoesPrevistas: a.questoesPrevistas, prioridade: a.prioridade, observacoes: a.observacoes
      })
    } else {
      Object.assign(f, {
        concursoId: props.concursoPadrao, disciplinaId: undefined, topicoId: undefined, data: props.dataPadrao ?? hoje(), horario: '',
        duracaoMin: config.config.duracaoPadraoAtividadeMin, questoesPrevistas: 0, prioridade: 'media', observacoes: ''
      })
    }
  },
  { immediate: true }
)
watch(() => f.disciplinaId, (novo, antigo) => {
  if (antigo !== undefined && novo !== antigo) f.topicoId = undefined
}, { flush: 'sync' })

function validar(): boolean {
  erros.concurso = f.concursoId ? undefined : 'Escolha o concurso desta atividade.'
  erros.disciplina = f.disciplinaId ? undefined : 'Escolha a disciplina.'
  erros.data = /^\d{4}-\d{2}-\d{2}$/.test(f.data) ? undefined : 'Informe uma data válida.'
  erros.duracao = Number.isFinite(f.duracaoMin) && f.duracaoMin > 0 && f.duracaoMin <= 1440 ? undefined : 'Informe uma duração entre 1 e 1440 minutos.'
  return !erros.concurso && !erros.disciplina && !erros.data && !erros.duracao
}

async function salvar() {
  if (!validar()) return
  const base = {
    concursoId: f.concursoId!, disciplinaId: f.disciplinaId!, topicoId: f.topicoId, horario: f.horario || undefined,
    duracaoMin: Math.round(f.duracaoMin), questoesPrevistas: Math.max(0, Math.round(f.questoesPrevistas || 0)), prioridade: f.prioridade, observacoes: f.observacoes.trim()
  }
  try {
    if (props.atividade) {
      await dados.atualizarAtividade({ ...props.atividade, ...base, dataPlanejada: f.data })
      toast.sucesso('Atividade atualizada. O histórico de sessões não foi alterado.')
    } else {
      await dados.criarAtividade({ ...base, dataPlanejada: f.data })
      toast.sucesso('Atividade adicionada ao cronograma.')
    }
    emit('update:modelValue', false)
  } catch {
    /* já notificado */
  }
}

async function excluir() {
  if (!props.atividade) return
  const ok = await confirmar({
    titulo: 'Excluir atividade?',
    mensagem: 'A atividade sai do cronograma. As sessões de estudo já registradas continuam no histórico e nas estatísticas. A exclusão fica registrada no histórico do cronograma.',
    confirmar: 'Excluir',
    perigo: true
  })
  if (!ok) return
  await dados.excluirAtividade(props.atividade).catch(() => undefined)
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseModal :model-value="modelValue" :titulo="editando ? 'Editar atividade' : 'Nova atividade'" @update:model-value="emit('update:modelValue', $event)">
    <form id="form-atividade" class="space-y-3" @submit.prevent="salvar">
      <FormField rotulo="Concurso" para="at-concurso" :erro="erros.concurso">
        <ConcursoSelect id="at-concurso" v-model="f.concursoId" vazio="Selecione…" />
      </FormField>
      <FormField rotulo="Disciplina" para="at-disciplina" :erro="erros.disciplina">
        <DisciplinaSelect id="at-disciplina" v-model="f.disciplinaId" :concurso-id="f.concursoId" />
      </FormField>
      <FormField rotulo="Tópico (opcional)" para="at-topico">
        <TopicoSelect id="at-topico" v-model="f.topicoId" :disciplina-id="f.disciplinaId" />
      </FormField>
      <div class="grid grid-cols-2 gap-3">
        <FormField rotulo="Data planejada" para="at-data" :erro="erros.data"><input id="at-data" v-model="f.data" type="date" class="input" /></FormField>
        <FormField rotulo="Horário (opcional)" para="at-hora"><input id="at-hora" v-model="f.horario" type="time" class="input" /></FormField>
        <FormField rotulo="Duração prevista (min)" para="at-dur" :erro="erros.duracao"><input id="at-dur" v-model.number="f.duracaoMin" type="number" min="1" max="1440" inputmode="numeric" class="input" /></FormField>
        <FormField rotulo="Questões previstas" para="at-q"><input id="at-q" v-model.number="f.questoesPrevistas" type="number" min="0" inputmode="numeric" class="input" /></FormField>
      </div>
      <FormField rotulo="Prioridade" para="at-prio">
        <select id="at-prio" v-model="f.prioridade" class="input"><option v-for="p in PRIORIDADES" :key="p.valor" :value="p.valor">{{ p.rotulo }}</option></select>
      </FormField>
      <FormField rotulo="Observações" para="at-obs"><textarea id="at-obs" v-model="f.observacoes" class="input" maxlength="1000" /></FormField>
      <p v-if="editando && atividade && atividade.dataPlanejada !== f.data" class="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
        Alterar a data planejada edita o plano. Para apenas adiar, use "Reagendar" — assim a data original fica preservada no histórico.
      </p>
    </form>
    <template #rodape>
      <button v-if="editando" type="button" class="btn btn-ghost mr-auto text-red-600" @click="excluir">Excluir</button>
      <button type="button" class="btn btn-outline" @click="emit('update:modelValue', false)">Cancelar</button>
      <button type="submit" form="form-atividade" class="btn btn-primary">Salvar</button>
    </template>
  </BaseModal>
</template>
