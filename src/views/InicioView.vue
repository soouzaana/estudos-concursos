<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CalendarClock, Landmark, Plus } from 'lucide-vue-next'
import type { Atividade } from '@/types'
import { SITUACOES_EDITAL } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { dataEfetiva, estaAtrasada } from '@/services/cronograma'
import { contarCartoes } from '@/services/fila'
import { resumoConcurso } from '@/services/resumo'
import { totaisQuestoes } from '@/services/stats'
import { diffDias, formatarData, formatarDataExtenso, formatarDuracao, hoje } from '@/utils/datas'
import { formatarPercentual } from '@/utils/validacao'
import { useAtividadeAcoes } from '@/composables/useAtividadeAcoes'
import AtividadeForm from '@/components/AtividadeForm.vue'
import AtividadeItem from '@/components/AtividadeItem.vue'
import EmptyState from '@/components/EmptyState.vue'
import MapaConsistencia from '@/components/MapaConsistencia.vue'
import ProgressBar from '@/components/ProgressBar.vue'

const dados = useDadosStore()
const config = useConfiguracoesStore()
const acoes = useAtividadeAcoes()
const data = hoje()

const sessoesHoje = computed(() => dados.sessoes.filter((s) => s.data === data))
const segHoje = computed(() => sessoesHoje.value.reduce((t, s) => t + s.duracaoSeg, 0))
const metaMin = computed(() => config.metaHoje.metaDiariaMin)
const pctMeta = computed(() => (metaMin.value > 0 ? Math.min(100, (segHoje.value / (metaMin.value * 60)) * 100) : null))
const questoesHoje = computed(() => totaisQuestoes(dados.questoes.filter((b) => b.data === data)))
const metaQuestoes = computed(() => config.metaHoje.metaQuestoesDia)
const ativHoje = computed(() => dados.atividades.filter((a) => dataEfetiva(a) === data))
const concluidasHoje = computed(() => ativHoje.value.filter((a) => a.status === 'concluida').length)
const pendentesHoje = computed(() => ativHoje.value.filter((a) => a.status === 'pendente' || a.status === 'em_andamento').length)
const atrasadas = computed(() => dados.atividades.filter((a) => estaAtrasada(a, data)).length)
const cartoesHoje = computed(() => contarCartoes(dados.cartoes).hoje)

const emAndamento = computed(() => dados.concursos.filter((c) => c.status === 'preparacao').sort((a, b) => (a.dataProva ?? '9999').localeCompare(b.dataProva ?? '9999')))
const resumos = computed(() => new Map(emAndamento.value.map((c) => [c.id, resumoConcurso(dados.dadosStats, c.id)])))
const rotuloEdital = (s: string) => SITUACOES_EDITAL.find((x) => x.valor === s)?.rotulo ?? s

const gruposHoje = computed(() => {
  const m = new Map<string, Atividade[]>()
  for (const a of ativHoje.value) m.set(a.concursoId, [...(m.get(a.concursoId) ?? []), a])
  return [...m.entries()].map(([id, lista]) => ({ id, nome: dados.nomeConcurso(id), lista: lista.sort((x, y) => (x.horario ?? '99').localeCompare(y.horario ?? '99') || x.ordem - y.ordem) }))
})

const formAberto = ref(false)
const edicao = ref<Atividade | null>(null)
function editar(a: Atividade) {
  edicao.value = a
  formAberto.value = true
}
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="page-title">Olá! Vamos estudar?</h1>
      <p class="text-sm capitalize text-muted">{{ formatarDataExtenso(data) }}</p>
    </header>

    <!-- Resumo diário -->
    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo de hoje">
      <div class="card card-pad col-span-2 lg:col-span-2">
        <p class="text-xs font-medium text-muted">Horas estudadas hoje</p>
        <p class="mt-1 text-3xl font-semibold tracking-tight">{{ formatarDuracao(segHoje) }}</p>
        <div class="mt-2"><ProgressBar :valor="pctMeta" rotulo="Progresso da meta diária" /></div>
        <p class="mt-1.5 text-xs text-muted">
          <template v-if="metaMin > 0">Meta de hoje: {{ formatarDuracao(metaMin * 60) }} · {{ Math.round(pctMeta ?? 0) }}%<template v-if="(pctMeta ?? 0) >= 100"> — meta batida!</template></template>
          <template v-else>Sem meta diária definida (ajuste em Configurações).</template>
        </p>
      </div>
      <div class="card card-pad">
        <p class="text-xs font-medium text-muted">Questões</p>
        <p class="mt-1 text-2xl font-semibold">{{ questoesHoje.total }}<span v-if="metaQuestoes" class="text-sm font-normal text-muted"> / {{ metaQuestoes }}</span></p>
        <p class="mt-0.5 text-xs text-muted">{{ questoesHoje.acertos }} acertos · {{ questoesHoje.erros }} erros · {{ formatarPercentual(questoesHoje.aproveitamento) }}</p>
      </div>
      <div class="card card-pad">
        <p class="text-xs font-medium text-muted">Atividades</p>
        <p class="mt-1 text-2xl font-semibold">{{ ativHoje.length }}</p>
        <p class="mt-0.5 text-xs text-muted">{{ concluidasHoje }} concluídas · {{ pendentesHoje }} pendentes</p>
      </div>
      <RouterLink to="/flashcards" class="card card-pad col-span-2 flex items-center justify-between transition hover:bg-line/30 lg:col-span-4">
        <span class="text-sm"><strong>{{ cartoesHoje }}</strong> flashcard(s) para revisar hoje</span>
        <span class="text-xs font-medium text-accent">Abrir flashcards →</span>
      </RouterLink>
    </section>

    <EmptyState v-if="!dados.concursos.length" titulo="Comece cadastrando seu primeiro concurso" texto="Depois vincule as disciplinas e monte a sequência de estudos. O painel de hoje será preenchido automaticamente.">
      <template #icone><Landmark class="h-6 w-6" /></template>
      <RouterLink to="/concursos" class="btn btn-primary"><Plus class="h-4 w-4" />Cadastrar concurso</RouterLink>
    </EmptyState>

    <!-- Matéria do dia -->
    <section v-if="dados.concursos.length" class="space-y-3" aria-labelledby="t-dia">
      <div class="flex items-center justify-between">
        <h2 id="t-dia" class="section-title">Matéria do dia</h2>
        <RouterLink to="/cronograma" class="text-xs font-medium text-accent hover:underline">Abrir cronograma</RouterLink>
      </div>
      <p v-if="atrasadas" class="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">{{ atrasadas }} atividade(s) de dias anteriores seguem abertas — veja no <RouterLink to="/cronograma" class="font-medium underline">cronograma</RouterLink> para concluir, pular ou reagendar.</p>
      <EmptyState v-if="!gruposHoje.length" titulo="Nenhuma atividade planejada para hoje" texto="Você pode estudar livremente pelo cronômetro ou adicionar atividades ao cronograma.">
        <RouterLink to="/estudos" class="btn btn-soft">Estudo livre</RouterLink>
        <RouterLink to="/cronograma" class="btn btn-outline">Planejar</RouterLink>
      </EmptyState>
      <div v-for="g in gruposHoje" :key="g.id" class="space-y-2">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ g.nome }}</h3>
        <AtividadeItem
          v-for="a in g.lista" :key="a.id" :atividade="a" compacto
          @iniciar="acoes.iniciar" @concluir="acoes.concluir" @pular="acoes.pular" @reabrir="acoes.reabrir" @questoes="acoes.registrarQuestoes" @editar="editar"
        />
      </div>
    </section>

    <!-- Concursos em andamento -->
    <section v-if="emAndamento.length" class="space-y-3" aria-labelledby="t-conc">
      <h2 id="t-conc" class="section-title">Concursos em andamento</h2>
      <div class="grid gap-3 lg:grid-cols-2">
        <RouterLink v-for="c in emAndamento" :key="c.id" :to="`/concursos/${c.id}`" class="card card-pad block space-y-3 transition hover:shadow-md">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate font-semibold">{{ c.nome }}</p>
              <p class="truncate text-xs text-muted">{{ [c.orgao, c.cargo].filter(Boolean).join(' · ') || '—' }}</p>
            </div>
            <span class="chip chip-accent shrink-0">{{ rotuloEdital(c.situacaoEdital) }}</span>
          </div>
          <p v-if="c.dataProva" class="flex items-center gap-1 text-xs text-muted"><CalendarClock class="h-3.5 w-3.5" />Prova em {{ formatarData(c.dataProva) }}<template v-if="diffDias(c.dataProva, data) >= 0"> ({{ diffDias(c.dataProva, data) }} dias)</template></p>
          <div>
            <div class="mb-1 flex justify-between text-xs text-muted"><span>Cronograma</span><span>{{ Math.round(resumos.get(c.id)!.progresso.percentual ?? 0) }}%</span></div>
            <ProgressBar :valor="resumos.get(c.id)!.progresso.percentual" :rotulo="`Progresso de ${c.nome}`" />
          </div>
          <dl class="grid grid-cols-3 gap-2 text-center text-xs">
            <div><dt class="text-muted">Horas</dt><dd class="font-semibold">{{ formatarDuracao(resumos.get(c.id)!.segundos) }}</dd></div>
            <div><dt class="text-muted">Questões</dt><dd class="font-semibold">{{ resumos.get(c.id)!.questoes.total }}</dd></div>
            <div><dt class="text-muted">Acertos</dt><dd class="font-semibold">{{ formatarPercentual(resumos.get(c.id)!.questoes.aproveitamento) }}</dd></div>
          </dl>
          <p class="truncate border-t border-line pt-2 text-xs text-muted">
            Próxima:
            <template v-if="resumos.get(c.id)!.proxima"><strong class="text-ink">{{ dados.nomeDisciplina(resumos.get(c.id)!.proxima!.disciplinaId) }}</strong> · {{ formatarData(dataEfetiva(resumos.get(c.id)!.proxima!)) }}</template>
            <template v-else>nenhuma atividade programada</template>
          </p>
        </RouterLink>
      </div>
    </section>

    <MapaConsistencia />
    <AtividadeForm v-model="formAberto" :atividade="edicao" />
  </div>
</template>
