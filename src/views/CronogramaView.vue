<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { CalendarRange, ChevronLeft, ChevronRight, Download, History, Plus, Wand2 } from 'lucide-vue-next'
import type { Atividade } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { dataEfetiva, estaAberta, estaAtrasada, ordenarAtividades, type RegraSemanal } from '@/services/cronograma'
import {
  diaSemanaCurto, fimMes, fimSemana, formatarData, formatarDataCurta, formatarDataExtenso, formatarMesAno, hoje, inicioMes, inicioSemana,
  intervaloDias, nomesDiasCurtos, somarDias, somarMeses
} from '@/utils/datas'
import { useAtividadeAcoes } from '@/composables/useAtividadeAcoes'
import { useToast } from '@/composables/useToast'
import AtividadeForm from '@/components/AtividadeForm.vue'
import AtividadeItem from '@/components/AtividadeItem.vue'
import BaseModal from '@/components/BaseModal.vue'
import ConcursoSelect from '@/components/ConcursoSelect.vue'
import DisciplinaSelect from '@/components/DisciplinaSelect.vue'
import EmptyState from '@/components/EmptyState.vue'
import ExportarCronogramaModal from '@/components/ExportarCronogramaModal.vue'
import FormField from '@/components/FormField.vue'

type Modo = 'dia' | 'semana' | 'mes'
const dados = useDadosStore()
const config = useConfiguracoesStore()
const acoes = useAtividadeAcoes()
const toast = useToast()

const modo = ref<Modo>('semana')
const ancora = ref(hoje())
const concursoId = ref<string | undefined>(undefined)

const periodo = computed(() => {
  if (modo.value === 'dia') return { de: ancora.value, ate: ancora.value }
  if (modo.value === 'semana') return { de: inicioSemana(ancora.value), ate: fimSemana(ancora.value) }
  return { de: inicioSemana(inicioMes(ancora.value)), ate: fimSemana(fimMes(ancora.value)) }
})
const dias = computed(() => intervaloDias(periodo.value.de, periodo.value.ate))
const titulo = computed(() => {
  if (modo.value === 'dia') return formatarDataExtenso(ancora.value)
  if (modo.value === 'semana') return `${formatarDataCurta(periodo.value.de)} a ${formatarDataCurta(periodo.value.ate)}`
  return formatarMesAno(ancora.value)
})

const filtradas = computed(() => (concursoId.value ? dados.atividades.filter((a) => a.concursoId === concursoId.value) : dados.atividades))
const porDia = computed(() => {
  const m = new Map<string, Atividade[]>()
  for (const a of filtradas.value) {
    const d = dataEfetiva(a)
    if (d < periodo.value.de || d > periodo.value.ate) continue
    const l = m.get(d)
    if (l) l.push(a)
    else m.set(d, [a])
  }
  for (const [k, v] of m) m.set(k, ordenarAtividades(v))
  return m
})
const atrasadas = computed(() => filtradas.value.filter((a) => estaAtrasada(a, hoje())))
const total = computed(() => [...porDia.value.values()].reduce((t, l) => t + l.length, 0))

function mover(delta: number) {
  if (modo.value === 'dia') ancora.value = somarDias(ancora.value, delta)
  else if (modo.value === 'semana') ancora.value = somarDias(ancora.value, delta * 7)
  else ancora.value = somarMeses(ancora.value, delta)
}
function irParaDia(d: string) {
  ancora.value = d
  modo.value = 'dia'
}

/* ---- criar/editar ---- */
const formAberto = ref(false)
const edicao = ref<Atividade | null>(null)
const dataNova = ref<string | undefined>()
function nova(data?: string) {
  edicao.value = null
  dataNova.value = data ?? ancora.value
  formAberto.value = true
}
function editar(a: Atividade) {
  edicao.value = a
  formAberto.value = true
}

/* ---- atrasadas ---- */
async function reagendarAtrasadas() {
  const n = await dados.reagendarAtrasadasParaHoje(concursoId.value).catch(() => 0)
  toast.sucesso(n ? `${n} atividade(s) reagendada(s) para hoje.` : 'Nada para reagendar.')
}

/* ---- histórico ---- */
const histAberto = ref(false)
const historico = computed(() =>
  dados.historicoCronograma
    .filter((e) => !concursoId.value || e.concursoId === concursoId.value)
    .sort((a, b) => b.em - a.em)
    .slice(0, 200)
)
const ROTULO_EVENTO: Record<string, string> = {
  criada: 'Criada', editada: 'Editada', iniciada: 'Iniciada', concluida: 'Concluída', pulada: 'Pulada', reagendada: 'Reagendada', reaberta: 'Reaberta', excluida: 'Excluída'
}
const fmtMomento = (ms: number) => new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
function descAtividade(id: string) {
  const a = dados.atividadePorId(id)
  return a ? `${dados.nomeDisciplina(a.disciplinaId)} (${formatarData(a.dataPlanejada)})` : 'Atividade removida'
}

/* ---- gerador de sequência ---- */
const genAberto = ref(false)
const gen = reactive({ concursoId: undefined as string | undefined, dataInicio: hoje(), semanas: 4 })
const regras = ref<(RegraSemanal & { chave: number })[]>([])
let seq = 0
const NOMES_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
function abrirGerador() {
  gen.concursoId = concursoId.value
  gen.dataInicio = hoje()
  gen.semanas = 4
  regras.value = []
  genAberto.value = true
}
function addRegra() {
  const usados = new Set(regras.value.map((r) => r.diaSemana))
  const livre = config.config.diasDisponiveis.find((d) => !usados.has(d)) ?? 1
  regras.value.push({ chave: ++seq, diaSemana: livre, disciplinaId: '', duracaoMin: config.config.duracaoPadraoAtividadeMin, questoesPrevistas: 0 })
}
const erroGen = computed(() => {
  if (!gen.concursoId) return 'Escolha o concurso.'
  if (!regras.value.length) return 'Adicione ao menos uma regra semanal.'
  if (regras.value.some((r) => !r.disciplinaId)) return 'Escolha a disciplina de cada regra.'
  if (!(gen.semanas >= 1 && gen.semanas <= 52)) return 'Use entre 1 e 52 semanas.'
  return ''
})
async function gerar() {
  if (erroGen.value || !gen.concursoId) return
  const n = await dados
    .gerarCronograma({
      concursoId: gen.concursoId, dataInicio: gen.dataInicio, semanas: gen.semanas,
      regras: regras.value.map(({ chave, ...r }) => ({ ...r, horario: r.horario || undefined }))
    })
    .catch(() => -1)
  if (n >= 0) {
    toast.sucesso(`${n} atividades criadas.`)
    genAberto.value = false
    concursoId.value = gen.concursoId
    ancora.value = gen.dataInicio
  }
}

const exportAberto = ref(false)
const nomesDias = nomesDiasCurtos()
const naoTemConcurso = computed(() => !dados.concursos.length)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="page-title hidden lg:block">Cronograma</h1>
        <p class="text-sm text-muted">Sequência de estudos. Pular ou reagendar nunca apaga o histórico.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-outline" @click="histAberto = true"><History class="h-4 w-4" />Histórico</button>
        <button type="button" class="btn btn-outline" :disabled="!dados.atividades.length" @click="exportAberto = true"><Download class="h-4 w-4" />Exportar cronograma</button>
        <button type="button" class="btn btn-outline" :disabled="naoTemConcurso" @click="abrirGerador"><Wand2 class="h-4 w-4" />Gerar sequência</button>
        <button type="button" class="btn btn-primary" :disabled="naoTemConcurso" @click="nova()"><Plus class="h-4 w-4" />Atividade</button>
      </div>
    </div>

    <EmptyState v-if="naoTemConcurso" titulo="Cadastre um concurso primeiro" texto="O cronograma é montado por concurso, com as disciplinas vinculadas a ele.">
      <template #icone><CalendarRange class="h-6 w-6" /></template>
      <RouterLink to="/concursos" class="btn btn-primary">Ir para Concursos</RouterLink>
    </EmptyState>

    <template v-else>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div class="inline-flex rounded-xl border border-line bg-card p-1" role="tablist" aria-label="Visualização">
          <button v-for="m in (['dia', 'semana', 'mes'] as Modo[])" :key="m" type="button" role="tab" :aria-selected="modo === m" class="min-h-[36px] rounded-lg px-4 text-sm font-medium capitalize transition" :class="modo === m ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink'" @click="modo = m">
            {{ m === 'dia' ? 'Diária' : m === 'semana' ? 'Semanal' : 'Mensal' }}
          </button>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" class="btn-icon" aria-label="Período anterior" @click="mover(-1)"><ChevronLeft class="h-5 w-5" /></button>
          <button type="button" class="btn btn-outline btn-sm" @click="ancora = hoje()">Hoje</button>
          <button type="button" class="btn-icon" aria-label="Próximo período" @click="mover(1)"><ChevronRight class="h-5 w-5" /></button>
          <span class="ml-1 text-sm font-semibold capitalize" aria-live="polite">{{ titulo }}</span>
        </div>
        <div class="sm:ml-auto sm:w-64"><ConcursoSelect v-model="concursoId" incluir-todos :so-abertos="false" aria-label="Filtrar por concurso" /></div>
      </div>

      <div v-if="atrasadas.length" class="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100" role="status">
        <p class="flex-1">{{ atrasadas.length }} atividade(s) ficaram para trás. Sem pressa: você escolhe se reagenda, pula ou conclui cada uma.</p>
        <button v-if="config.config.atrasadas === 'oferecer_reagendar'" type="button" class="btn btn-sm btn-outline" @click="reagendarAtrasadas">Reagendar tudo para hoje</button>
      </div>

      <!-- Diária -->
      <section v-if="modo === 'dia'" aria-label="Atividades do dia" class="space-y-2">
        <EmptyState v-if="!total" titulo="Nenhuma atividade neste dia" texto="Adicione uma atividade ou gere uma sequência semanal.">
          <button type="button" class="btn btn-primary" @click="nova(ancora)"><Plus class="h-4 w-4" />Adicionar atividade</button>
        </EmptyState>
        <AtividadeItem
          v-for="a in porDia.get(ancora) ?? []" :key="a.id" :atividade="a" mostrar-concurso
          @iniciar="acoes.iniciar" @concluir="acoes.concluir" @pular="acoes.pular" @reabrir="acoes.reabrir" @questoes="acoes.registrarQuestoes" @editar="editar"
        />
      </section>

      <!-- Semanal -->
      <section v-else-if="modo === 'semana'" aria-label="Atividades da semana" class="grid gap-3 lg:grid-cols-7">
        <div v-for="d in dias" :key="d" class="card flex flex-col gap-2 p-3" :class="d === hoje() ? 'ring-2 ring-brand-500' : ''">
          <button type="button" class="flex items-baseline justify-between text-left" @click="irParaDia(d)" :aria-label="`Abrir ${formatarDataExtenso(d)}`">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted">{{ diaSemanaCurto(d) }}</span>
            <span class="text-sm font-semibold">{{ formatarDataCurta(d) }}</span>
          </button>
          <ul class="space-y-1.5">
            <li v-for="a in porDia.get(d) ?? []" :key="a.id">
              <button type="button" class="w-full rounded-xl border border-line p-2 text-left text-xs transition hover:bg-line/40" :class="a.status === 'concluida' ? 'bg-emerald-50 dark:bg-emerald-900/20' : a.status === 'pulada' ? 'opacity-70' : ''" @click="irParaDia(d)">
                <span class="mb-0.5 flex items-center gap-1.5 font-semibold"><span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: dados.corDisciplina(a.disciplinaId) }" /><span class="truncate" :class="a.status === 'pulada' ? 'line-through' : ''">{{ dados.nomeDisciplina(a.disciplinaId) }}</span></span>
                <span class="block truncate text-muted">{{ a.horario ? a.horario + ' · ' : '' }}{{ a.duracaoMin }} min · {{ a.status === 'concluida' ? 'ok' : a.status === 'pulada' ? 'pulada' : estaAberta(a) ? (estaAtrasada(a, hoje()) ? 'atrasada' : 'pendente') : '' }}</span>
              </button>
            </li>
          </ul>
          <p v-if="!(porDia.get(d) ?? []).length" class="py-2 text-center text-xs text-muted">—</p>
          <button type="button" class="btn btn-ghost btn-sm mt-auto" :aria-label="`Adicionar atividade em ${formatarDataCurta(d)}`" @click="nova(d)"><Plus class="h-3.5 w-3.5" /></button>
        </div>
      </section>

      <!-- Mensal -->
      <section v-else aria-label="Atividades do mês">
        <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted"><span v-for="n in nomesDias" :key="n">{{ n }}</span></div>
        <div class="mt-1 grid grid-cols-7 gap-1">
          <button
            v-for="d in dias" :key="d" type="button" class="flex min-h-[64px] flex-col rounded-xl border border-line bg-card p-1.5 text-left transition hover:bg-line/40 sm:min-h-[92px]"
            :class="[d === hoje() ? 'ring-2 ring-brand-500' : '', d < inicioMes(ancora) || d > fimMes(ancora) ? 'opacity-45' : '']" :aria-label="`${formatarDataExtenso(d)}: ${(porDia.get(d) ?? []).length} atividades`" @click="irParaDia(d)"
          >
            <span class="text-xs font-semibold">{{ Number(d.slice(8)) }}</span>
            <span class="mt-1 hidden flex-col gap-0.5 sm:flex">
              <span v-for="a in (porDia.get(d) ?? []).slice(0, 3)" :key="a.id" class="truncate rounded px-1 text-[10px] leading-4 text-white" :class="a.status === 'pulada' ? 'line-through opacity-70' : ''" :style="{ background: dados.corDisciplina(a.disciplinaId) }">{{ dados.nomeDisciplina(a.disciplinaId) }}</span>
              <span v-if="(porDia.get(d) ?? []).length > 3" class="text-[10px] text-muted">+{{ (porDia.get(d) ?? []).length - 3 }}</span>
            </span>
            <span class="mt-auto flex gap-0.5 sm:hidden"><span v-for="a in (porDia.get(d) ?? []).slice(0, 4)" :key="a.id" class="h-1.5 w-1.5 rounded-full" :style="{ background: dados.corDisciplina(a.disciplinaId) }" /></span>
          </button>
        </div>
      </section>
    </template>

    <AtividadeForm v-model="formAberto" :atividade="edicao" :concurso-padrao="concursoId" :data-padrao="dataNova" />
    <ExportarCronogramaModal v-model="exportAberto" :concurso-padrao="concursoId" />

    <BaseModal v-model="histAberto" titulo="Histórico de alterações do cronograma" largura="lg">
      <p v-if="!historico.length" class="text-sm text-muted">Nenhuma alteração registrada ainda.</p>
      <ul v-else class="divide-line">
        <li v-for="e in historico" :key="e.id" class="py-2.5 text-sm">
          <div class="flex flex-wrap items-center gap-2"><span class="chip chip-accent">{{ ROTULO_EVENTO[e.tipo] ?? e.tipo }}</span><span class="font-medium">{{ descAtividade(e.atividadeId) }}</span></div>
          <p class="mt-0.5 text-xs text-muted">{{ e.detalhe }} · {{ dados.nomeConcurso(e.concursoId) }} · {{ fmtMomento(e.em) }}</p>
        </li>
      </ul>
    </BaseModal>

    <BaseModal v-model="genAberto" titulo="Gerar sequência de estudos" largura="lg">
      <form id="form-gen" class="space-y-3" @submit.prevent="gerar">
        <p class="text-sm text-muted">Defina o que estudar em cada dia da semana; o app cria as atividades para as próximas semanas. Você pode editar, pular ou reagendar cada uma depois.</p>
        <div class="grid gap-3 sm:grid-cols-3">
          <FormField rotulo="Concurso" para="g-conc"><ConcursoSelect id="g-conc" v-model="gen.concursoId" vazio="Selecione…" /></FormField>
          <FormField rotulo="Começar em" para="g-ini"><input id="g-ini" v-model="gen.dataInicio" type="date" class="input" /></FormField>
          <FormField rotulo="Semanas" para="g-sem"><input id="g-sem" v-model.number="gen.semanas" type="number" min="1" max="52" class="input" /></FormField>
        </div>
        <div class="space-y-2">
          <div v-for="(r, i) in regras" :key="r.chave" class="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[120px_1fr_90px_110px_auto]">
            <select v-model.number="r.diaSemana" class="input" :aria-label="`Dia da semana da regra ${i + 1}`"><option v-for="(n, k) in NOMES_DIAS" :key="k" :value="k">{{ n }}</option></select>
            <DisciplinaSelect v-model="r.disciplinaId" :concurso-id="gen.concursoId" rotulo-vazio="Disciplina…" />
            <input v-model.number="r.duracaoMin" type="number" min="5" class="input" :aria-label="`Duração em minutos da regra ${i + 1}`" placeholder="min" />
            <input v-model="r.horario" type="time" class="input" :aria-label="`Horário da regra ${i + 1}`" />
            <button type="button" class="btn btn-ghost text-red-600" @click="regras.splice(i, 1)">Remover</button>
          </div>
          <button type="button" class="btn btn-soft" @click="addRegra"><Plus class="h-4 w-4" />Adicionar dia</button>
        </div>
        <p v-if="erroGen && regras.length" class="text-xs text-rose-600" role="alert">{{ erroGen }}</p>
      </form>
      <template #rodape>
        <button type="button" class="btn btn-outline" @click="genAberto = false">Cancelar</button>
        <button type="submit" form="form-gen" class="btn btn-primary" :disabled="!!erroGen">Criar atividades</button>
      </template>
    </BaseModal>
  </div>
</template>
