<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'
import type { Concurso, SituacaoEdital, StatusConcurso } from '@/types'
import { SITUACOES_EDITAL, STATUS_CONCURSO } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { hoje } from '@/utils/datas'
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'
import FormField from './FormField.vue'

const props = defineProps<{ modelValue: boolean; concurso?: Concurso | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'salvo', c: Concurso): void }>()
const dados = useDadosStore()
const toast = useToast()

const f = reactive({
  nome: '', orgao: '', cargo: '', banca: '', situacaoEdital: 'sem_edital' as SituacaoEdital, dataProva: '', dataInicio: hoje(),
  metaSemanalHoras: 10, metaQuestoes: 100, observacoes: '', status: 'preparacao' as StatusConcurso
})
const disciplinaIds = ref<string[]>([])
const novaDisciplina = ref('')
const erros = reactive<{ nome?: string; meta?: string; datas?: string }>({})

watch(
  () => props.modelValue,
  (aberto) => {
    if (!aberto) return
    Object.assign(erros, { nome: undefined, meta: undefined, datas: undefined })
    novaDisciplina.value = ''
    const c = props.concurso
    if (c) {
      Object.assign(f, {
        nome: c.nome, orgao: c.orgao, cargo: c.cargo, banca: c.banca, situacaoEdital: c.situacaoEdital, dataProva: c.dataProva ?? '',
        dataInicio: c.dataInicio, metaSemanalHoras: c.metaSemanalHoras, metaQuestoes: c.metaQuestoes, observacoes: c.observacoes, status: c.status
      })
      disciplinaIds.value = dados.disciplinasDoConcurso(c.id).map((d) => d.id)
    } else {
      Object.assign(f, {
        nome: '', orgao: '', cargo: '', banca: '', situacaoEdital: 'sem_edital', dataProva: '', dataInicio: hoje(),
        metaSemanalHoras: 10, metaQuestoes: 100, observacoes: '', status: 'preparacao'
      })
      disciplinaIds.value = []
    }
  },
  { immediate: true }
)

const editando = computed(() => !!props.concurso)

function alternar(id: string) {
  disciplinaIds.value = disciplinaIds.value.includes(id) ? disciplinaIds.value.filter((x) => x !== id) : [...disciplinaIds.value, id]
}

async function adicionarNova() {
  const nome = novaDisciplina.value.trim()
  if (!nome) return
  try {
    const d = await dados.criarDisciplina(nome)
    if (!disciplinaIds.value.includes(d.id)) disciplinaIds.value = [...disciplinaIds.value, d.id]
    novaDisciplina.value = ''
  } catch {
    /* já notificado */
  }
}

function validar(): boolean {
  erros.nome = f.nome.trim() ? undefined : 'Informe o nome do concurso.'
  erros.meta = f.metaSemanalHoras >= 0 && f.metaQuestoes >= 0 && Number.isFinite(f.metaSemanalHoras) && Number.isFinite(f.metaQuestoes) ? undefined : 'As metas não podem ser negativas.'
  erros.datas = f.dataProva && f.dataInicio && f.dataProva < f.dataInicio ? 'A data da prova não pode ser anterior ao início dos estudos.' : undefined
  return !erros.nome && !erros.meta && !erros.datas
}

async function salvar() {
  if (!validar()) return
  try {
    const c = await dados.salvarConcurso(
      {
        id: props.concurso?.id, nome: f.nome.trim(), orgao: f.orgao.trim(), cargo: f.cargo.trim(), banca: f.banca.trim(),
        situacaoEdital: f.situacaoEdital, dataProva: f.dataProva || undefined, dataInicio: f.dataInicio || hoje(),
        metaSemanalHoras: Number(f.metaSemanalHoras), metaQuestoes: Number(f.metaQuestoes), observacoes: f.observacoes.trim(), status: f.status
      },
      disciplinaIds.value
    )
    toast.sucesso(editando.value ? 'Concurso atualizado.' : 'Concurso criado.')
    emit('salvo', c)
    emit('update:modelValue', false)
  } catch {
    /* já notificado */
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" :titulo="editando ? 'Editar concurso' : 'Novo concurso'" largura="lg" @update:model-value="emit('update:modelValue', $event)">
    <form id="form-concurso" class="space-y-3" @submit.prevent="salvar">
      <FormField rotulo="Nome do concurso *" para="co-nome" :erro="erros.nome"><input id="co-nome" v-model="f.nome" class="input" maxlength="120" placeholder="Ex.: TJ-RO 2026" autofocus /></FormField>
      <div class="grid gap-3 sm:grid-cols-2">
        <FormField rotulo="Órgão" para="co-orgao"><input id="co-orgao" v-model="f.orgao" class="input" maxlength="120" /></FormField>
        <FormField rotulo="Cargo" para="co-cargo"><input id="co-cargo" v-model="f.cargo" class="input" maxlength="120" /></FormField>
        <FormField rotulo="Banca organizadora" para="co-banca"><input id="co-banca" v-model="f.banca" class="input" maxlength="80" /></FormField>
        <FormField rotulo="Situação do edital" para="co-edital">
          <select id="co-edital" v-model="f.situacaoEdital" class="input"><option v-for="s in SITUACOES_EDITAL" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option></select>
        </FormField>
        <FormField rotulo="Início dos estudos" para="co-inicio"><input id="co-inicio" v-model="f.dataInicio" type="date" class="input" /></FormField>
        <FormField rotulo="Data da prova (opcional)" para="co-prova" :erro="erros.datas"><input id="co-prova" v-model="f.dataProva" type="date" class="input" /></FormField>
        <FormField rotulo="Meta semanal (horas)" para="co-meta-h" :erro="erros.meta"><input id="co-meta-h" v-model.number="f.metaSemanalHoras" type="number" min="0" step="0.5" inputmode="decimal" class="input" /></FormField>
        <FormField rotulo="Meta de questões (total)" para="co-meta-q"><input id="co-meta-q" v-model.number="f.metaQuestoes" type="number" min="0" inputmode="numeric" class="input" /></FormField>
        <FormField v-if="editando" rotulo="Situação do estudo" para="co-status">
          <select id="co-status" v-model="f.status" class="input"><option v-for="s in STATUS_CONCURSO" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option></select>
        </FormField>
      </div>

      <fieldset>
        <legend class="label">Disciplinas deste concurso</legend>
        <div v-if="dados.disciplinasAtivas.length" class="flex flex-wrap gap-2">
          <button
            v-for="d in dados.disciplinasAtivas" :key="d.id" type="button"
            class="inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 text-xs font-medium transition"
            :class="disciplinaIds.includes(d.id) ? 'border-brand-500 bg-brand-100 text-accent dark:bg-brand-900/50' : 'border-line text-muted hover:bg-line/40'"
            :aria-pressed="disciplinaIds.includes(d.id)" @click="alternar(d.id)"
          >
            <span class="h-2.5 w-2.5 rounded-full" :style="{ background: d.cor }" />{{ d.nome }}
          </button>
        </div>
        <p v-else class="text-xs text-muted">Nenhuma disciplina cadastrada ainda. Crie a primeira abaixo.</p>
        <div class="mt-2 flex gap-2">
          <input v-model="novaDisciplina" class="input" placeholder="Nova disciplina (ex.: Direito Constitucional)" maxlength="80" aria-label="Nova disciplina" @keydown.enter.prevent="adicionarNova" />
          <button type="button" class="btn btn-soft shrink-0" :disabled="!novaDisciplina.trim()" @click="adicionarNova"><Plus class="h-4 w-4" />Criar</button>
        </div>
        <p class="mt-1 text-xs text-muted">Disciplinas são compartilhadas: a mesma pode estar em vários concursos sem duplicar cadastro.</p>
      </fieldset>

      <FormField rotulo="Observações" para="co-obs"><textarea id="co-obs" v-model="f.observacoes" class="input" maxlength="2000" /></FormField>
    </form>
    <template #rodape>
      <div class="flex w-full justify-end gap-2 sm:pr-12">
        <button type="button" class="btn btn-outline" @click="emit('update:modelValue', false)">Cancelar</button>
        <button type="submit" form="form-concurso" class="btn btn-primary">Salvar concurso</button>
      </div>
    </template>
  </BaseModal>
</template>
