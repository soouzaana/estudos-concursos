<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Lightbulb, TrendingDown, TrendingUp } from 'lucide-vue-next'
import type { EChartsOption } from 'echarts'
import { useDadosStore } from '@/stores/dados'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import {
  calcularIndicadores, compararDisciplinas, consistenciaPorPeriodo, desempenhoPorDisciplina, gerarInsights, horasPorPeriodo, periodosComparaveis,
  questoesPorPeriodo, topicosMaisDificeis, type FiltroStats
} from '@/services/stats'
import { fimMes, fimSemana, formatarData, formatarDuracao, hoje, inicioMes, inicioSemana, somarDias, somarMeses, formatarMesAno, formatarDataCurta } from '@/utils/datas'
import { formatarPercentual } from '@/utils/validacao'
import ChartBase from '@/components/ChartBase.vue'
import ConcursoSelect from '@/components/ConcursoSelect.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatCard from '@/components/StatCard.vue'

type Preset = 'semana' | 'mes' | 'custom'
const dados = useDadosStore()
const config = useConfiguracoesStore()

const preset = ref<Preset>('semana')
const ancora = ref(hoje())
const custom = reactive({ de: somarDias(hoje(), -29), ate: hoje() })
const concursoId = ref<string | undefined>(undefined)
const disciplinaId = ref<string | undefined>(undefined)

const periodo = computed(() => {
  if (preset.value === 'semana') return { de: inicioSemana(ancora.value), ate: fimSemana(ancora.value) }
  if (preset.value === 'mes') return { de: inicioMes(ancora.value), ate: fimMes(ancora.value) }
  return custom.de <= custom.ate ? { de: custom.de, ate: custom.ate } : { de: custom.ate, ate: custom.de }
})
const filtro = computed<FiltroStats>(() => ({ ...periodo.value, concursoId: concursoId.value, disciplinaId: disciplinaId.value }))
const tituloPeriodo = computed(() => (preset.value === 'mes' ? formatarMesAno(ancora.value) : `${formatarDataCurta(periodo.value.de)} a ${formatarDataCurta(periodo.value.ate)}`))
const emAndamento = computed(() => periodo.value.ate > hoje())
watch(preset, () => (ancora.value = hoje()))

function mover(d: number) {
  ancora.value = preset.value === 'semana' ? somarDias(ancora.value, d * 7) : somarMeses(ancora.value, d)
}

const ind = computed(() => calcularIndicadores(dados.dadosStats, filtro.value, config.config, hoje()))
const desemp = computed(() => desempenhoPorDisciplina(dados.dadosStats, filtro.value).sort((a, b) => b.segundos - a.segundos))
const topicos = computed(() => topicosMaisDificeis(dados.dadosStats, filtro.value))
const insights = computed(() => gerarInsights(dados.dadosStats, filtro.value, config.config, hoje()))
const comparacao = computed(() => {
  const p = periodosComparaveis(filtro.value, hoje())
  return p ? { p, linhas: compararDisciplinas(dados.dadosStats, p) } : null
})
const horasSerie = computed(() => horasPorPeriodo(dados.dadosStats, filtro.value))
const questoesSerie = computed(() => questoesPorPeriodo(dados.dadosStats, filtro.value))
const consSemana = computed(() => consistenciaPorPeriodo(dados.dadosStats, filtro.value, config.config, hoje(), 'semana'))
const consMes = computed(() => consistenciaPorPeriodo(dados.dadosStats, filtro.value, config.config, hoje(), 'mes'))
const temDados = computed(() => ind.value.segundos > 0 || ind.value.questoes.total > 0)

const opHoras = computed<EChartsOption>(() => ({
  grid: { left: 36, right: 8, top: 16, bottom: 28 },
  tooltip: { trigger: 'axis', valueFormatter: (v) => `${Number(v).toFixed(1).replace('.', ',')} h` },
  xAxis: { type: 'category', data: horasSerie.value.map((p) => p.rotulo), axisLabel: { interval: 'auto' } },
  yAxis: { type: 'value', name: 'h', minInterval: 0.5 },
  series: [{ type: 'bar', data: horasSerie.value.map((p) => Math.round(p.valor * 100) / 100), itemStyle: { borderRadius: [4, 4, 0, 0] } }]
}))
const opQuestoes = computed<EChartsOption>(() => ({
  grid: { left: 36, right: 8, top: 28, bottom: 28 },
  tooltip: { trigger: 'axis' },
  legend: { top: 0, textStyle: { fontSize: 11 } },
  xAxis: { type: 'category', data: questoesSerie.value.map((p) => p.rotulo) },
  yAxis: { type: 'value', minInterval: 1 },
  series: [
    { name: 'Acertos', type: 'bar', stack: 'q', data: questoesSerie.value.map((p) => p.acertos), itemStyle: { color: '#10b981' } },
    { name: 'Erros', type: 'bar', stack: 'q', data: questoesSerie.value.map((p) => p.erros), itemStyle: { color: '#f43f5e', borderRadius: [4, 4, 0, 0] } }
  ]
}))
const opEvolucao = computed<EChartsOption>(() => ({
  grid: { left: 40, right: 12, top: 16, bottom: 28 },
  tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null || v === '-' ? 'sem questões' : `${Number(v).toFixed(0)}%`) },
  xAxis: { type: 'category', data: questoesSerie.value.map((p) => p.rotulo) },
  yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
  series: [{ type: 'line', connectNulls: true, smooth: false, symbolSize: 7, data: questoesSerie.value.map((p) => (p.aproveitamento === null ? null : Math.round(p.aproveitamento))) }]
}))
const comQuestoes = computed(() => desemp.value.filter((d) => d.total > 0))
const opDisciplinas = computed<EChartsOption>(() => ({
  grid: { left: 8, right: 36, top: 8, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => `${Number(v).toFixed(0)}%` },
  xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
  yAxis: { type: 'category', inverse: true, data: comQuestoes.value.map((d) => d.nome) },
  series: [{ type: 'bar', label: { show: true, position: 'right', formatter: '{c}%' }, data: comQuestoes.value.map((d) => Math.round(d.aproveitamento ?? 0)), itemStyle: { borderRadius: [0, 4, 4, 0] } }]
}))
const comTempo = computed(() => desemp.value.filter((d) => d.segundos > 0))
const opTempo = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item', formatter: (p) => `${(p as { name: string }).name}: ${formatarDuracao(Number((p as { value: number }).value))} (${(p as { percent: number }).percent}%)` },
  legend: { bottom: 0, textStyle: { fontSize: 11 } },
  series: [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '42%'], label: { show: false }, data: comTempo.value.map((d) => ({ name: d.nome, value: d.segundos })) }]
}))
const opConsistencia = (serie: typeof consSemana.value): EChartsOption => ({
  grid: { left: 40, right: 8, top: 16, bottom: 28 },
  tooltip: { trigger: 'axis', valueFormatter: (v) => (v == null ? '—' : `${Number(v).toFixed(0)}%`) },
  xAxis: { type: 'category', data: serie.map((p) => p.rotulo + (p.parcial ? '*' : '')) },
  yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
  series: [{ type: 'bar', data: serie.map((p) => (p.percentual === null ? null : Math.round(p.percentual))), itemStyle: { borderRadius: [4, 4, 0, 0] } }]
})
const temParcial = computed(() => [...consSemana.value, ...consMes.value].some((p) => p.parcial))

const fmtDelta = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(0)} p.p.`)
const fmtDeltaTempo = (s: number) => `${s > 0 ? '+' : s < 0 ? '−' : ''}${formatarDuracao(Math.abs(s))}`
const classeInsight = { atencao: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-50', positivo: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-50', neutro: 'border-line bg-card' }
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="page-title hidden lg:block">Desempenho</h1>
      <p class="text-sm text-muted">Indicadores calculados a partir dos seus registros reais. Períodos em andamento não são comparados como se estivessem completos.</p>
    </div>

    <!-- Filtros -->
    <section class="card card-pad space-y-3" aria-label="Filtros">
      <div class="flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-xl border border-line bg-card p-1" role="tablist" aria-label="Período">
          <button v-for="p in (['semana', 'mes', 'custom'] as Preset[])" :key="p" type="button" role="tab" :aria-selected="preset === p" class="min-h-[36px] rounded-lg px-3 text-sm font-medium transition" :class="preset === p ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink'" @click="preset = p">
            {{ p === 'semana' ? 'Semanal' : p === 'mes' ? 'Mensal' : 'Personalizado' }}
          </button>
        </div>
        <div v-if="preset !== 'custom'" class="flex items-center gap-1">
          <button type="button" class="btn-icon" aria-label="Período anterior" @click="mover(-1)"><ChevronLeft class="h-5 w-5" /></button>
          <span class="min-w-[120px] text-center text-sm font-semibold capitalize">{{ tituloPeriodo }}</span>
          <button type="button" class="btn-icon" aria-label="Próximo período" @click="mover(1)"><ChevronRight class="h-5 w-5" /></button>
        </div>
        <div v-else class="flex items-center gap-2">
          <input v-model="custom.de" type="date" class="input w-auto" aria-label="Data inicial" /><span class="text-muted">a</span><input v-model="custom.ate" type="date" class="input w-auto" aria-label="Data final" />
        </div>
        <span v-if="emAndamento" class="chip chip-info">Período em andamento</span>
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        <ConcursoSelect v-model="concursoId" incluir-todos :so-abertos="false" aria-label="Concurso" />
        <select v-model="disciplinaId" class="input" aria-label="Disciplina"><option :value="undefined">Todas as disciplinas</option><option v-for="d in dados.disciplinas" :key="d.id" :value="d.id">{{ d.nome }}</option></select>
      </div>
    </section>

    <!-- Indicadores -->
    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores gerais">
      <StatCard rotulo="Horas estudadas" :valor="formatarDuracao(ind.segundos)" :detalhe="ind.metaSegundos ? `Meta do período: ${formatarDuracao(ind.metaSegundos)}` : 'Sem meta definida'" />
      <StatCard rotulo="Média diária" :valor="formatarDuracao(ind.mediaDiariaSeg)" :detalhe="`${ind.diasDecorridos} dia(s) decorridos`" />
      <StatCard rotulo="Dias estudados" :valor="String(ind.diasEstudados)" :detalhe="`${ind.diasPulados} dia(s) pulado(s)`" />
      <StatCard rotulo="Consistência" :valor="formatarPercentual(ind.consistencia)" :detalhe="`${ind.diasPrevistosEstudados} de ${ind.diasPrevistos} dias disponíveis`" />
      <StatCard rotulo="Questões" :valor="String(ind.questoes.total)" :detalhe="ind.metaQuestoes ? `Meta do período: ${ind.metaQuestoes}` : undefined" />
      <StatCard rotulo="Acertos / erros" :valor="`${ind.questoes.acertos} / ${ind.questoes.erros}`" />
      <StatCard rotulo="Aproveitamento" :valor="formatarPercentual(ind.questoes.aproveitamento)" detalhe="acertos ÷ total" />
      <StatCard rotulo="Erros pendentes" :valor="String(ind.errosPendentes)" detalhe="de revisão no caderno" />
      <StatCard rotulo="Flashcards revisados" :valor="String(ind.flashcardsRevisados)" />
      <StatCard rotulo="Revisões vencidas" :valor="String(ind.revisoesVencidas)" detalhe="agora" />
    </section>

    <EmptyState v-if="!temDados" titulo="Sem registros neste período" texto="Estude, registre questões ou mude o período para ver gráficos e análises." />

    <template v-else>
      <!-- Análise -->
      <section v-if="insights.length" class="space-y-2" aria-labelledby="t-ins">
        <h2 id="t-ins" class="section-title flex items-center gap-1.5"><Lightbulb class="h-4 w-4" />Análise dos seus dados</h2>
        <ul class="grid gap-2 lg:grid-cols-2">
          <li v-for="i in insights" :key="i.id" class="rounded-2xl border p-3 text-sm" :class="classeInsight[i.tom]">
            <p class="font-semibold">{{ i.titulo }}</p><p class="mt-0.5 text-xs opacity-90">{{ i.detalhe }}</p>
          </li>
        </ul>
      </section>

      <!-- Gráficos -->
      <section class="grid gap-4 lg:grid-cols-2" aria-label="Gráficos">
        <div class="card card-pad"><h2 class="section-title mb-2">Horas estudadas</h2><ChartBase :option="opHoras" rotulo="Gráfico de barras: horas estudadas por período" /></div>
        <div class="card card-pad"><h2 class="section-title mb-2">Questões por período</h2><ChartBase :option="opQuestoes" rotulo="Gráfico de barras empilhadas: acertos e erros por período" /></div>
        <div class="card card-pad"><h2 class="section-title mb-2">Evolução do aproveitamento</h2><ChartBase :option="opEvolucao" rotulo="Gráfico de linha: aproveitamento por período" /></div>
        <div class="card card-pad">
          <h2 class="section-title mb-2">Aproveitamento por disciplina</h2>
          <p v-if="!comQuestoes.length" class="py-10 text-center text-sm text-muted">Nenhuma questão registrada no período.</p>
          <ChartBase v-else :option="opDisciplinas" :altura="`${Math.max(180, comQuestoes.length * 38 + 20)}px`" rotulo="Gráfico de barras: aproveitamento por disciplina" />
        </div>
        <div class="card card-pad"><h2 class="section-title mb-2">Distribuição do tempo</h2><p v-if="!comTempo.length" class="py-10 text-center text-sm text-muted">Nenhum tempo registrado.</p><ChartBase v-else :option="opTempo" altura="280px" rotulo="Gráfico de pizza: distribuição do tempo por disciplina" /></div>
        <div class="card card-pad">
          <h2 class="section-title mb-2">Consistência semanal</h2><ChartBase :option="opConsistencia(consSemana)" rotulo="Gráfico de barras: consistência semanal" />
        </div>
        <div class="card card-pad lg:col-span-2">
          <h2 class="section-title mb-2">Consistência mensal</h2><ChartBase :option="opConsistencia(consMes)" altura="200px" rotulo="Gráfico de barras: consistência mensal" />
          <p v-if="temParcial" class="mt-2 text-xs text-muted">* período ainda em andamento: o percentual considera apenas os dias já decorridos.</p>
        </div>
      </section>

      <!-- Por disciplina -->
      <section class="card" aria-labelledby="t-disc">
        <h2 id="t-disc" class="section-title p-4 pb-2">Desempenho por disciplina</h2>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[560px] text-left text-sm">
            <thead class="text-xs text-muted"><tr><th class="px-4 py-2 font-medium">Disciplina</th><th class="px-2 py-2 font-medium">Tempo</th><th class="px-2 py-2 font-medium">Questões</th><th class="px-2 py-2 font-medium">Erros</th><th class="px-2 py-2 font-medium">Aproveit.</th><th class="px-4 py-2 font-medium">No caderno</th></tr></thead>
            <tbody class="divide-y divide-line">
              <tr v-for="d in desemp" :key="d.disciplinaId ?? 'sem'">
                <td class="px-4 py-2 font-medium">{{ d.nome }}</td><td class="px-2 py-2 tabular-nums">{{ formatarDuracao(d.segundos) }}</td><td class="px-2 py-2 tabular-nums">{{ d.total }}</td>
                <td class="px-2 py-2 tabular-nums">{{ d.erros }}</td><td class="px-2 py-2 tabular-nums">{{ formatarPercentual(d.aproveitamento) }}</td><td class="px-4 py-2 tabular-nums">{{ d.errosCaderno }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="topicos.length" class="card card-pad" aria-labelledby="t-top">
        <h2 id="t-top" class="section-title">Tópicos com maior dificuldade</h2>
        <p class="mb-2 text-xs text-muted">Apenas tópicos com pelo menos 5 questões no período.</p>
        <ul class="divide-line">
          <li v-for="t in topicos" :key="t.topicoId" class="flex items-center justify-between gap-3 py-2 text-sm">
            <span class="min-w-0"><span class="block truncate font-medium">{{ t.nome }}</span><span class="block truncate text-xs text-muted">{{ t.disciplina }} · {{ t.acertos }}/{{ t.total }} · {{ t.errosCaderno }} no caderno</span></span>
            <span class="chip chip-bad">{{ formatarPercentual(t.aproveitamento) }}</span>
          </li>
        </ul>
      </section>

      <!-- Comparação -->
      <section v-if="comparacao" class="card" aria-labelledby="t-comp">
        <div class="p-4 pb-2">
          <h2 id="t-comp" class="section-title">Comparação com o período anterior</h2>
          <p class="text-xs text-muted">
            {{ formatarData(comparacao.p.atual.de) }}–{{ formatarData(comparacao.p.atual.ate) }} × {{ formatarData(comparacao.p.anterior.de) }}–{{ formatarData(comparacao.p.anterior.ate) }}
            <template v-if="comparacao.p.parcial"> · período em andamento: ambos limitados a {{ comparacao.p.dias }} dia(s) para uma comparação justa.</template>
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[560px] text-left text-sm">
            <thead class="text-xs text-muted"><tr><th class="px-4 py-2 font-medium">Disciplina</th><th class="px-2 py-2 font-medium">Tempo (atual)</th><th class="px-2 py-2 font-medium">Variação</th><th class="px-2 py-2 font-medium">Aproveit. (atual)</th><th class="px-4 py-2 font-medium">Variação</th></tr></thead>
            <tbody class="divide-y divide-line">
              <tr v-for="l in comparacao.linhas" :key="l.disciplinaId ?? 'sem'">
                <td class="px-4 py-2 font-medium">{{ l.nome }}</td>
                <td class="px-2 py-2 tabular-nums">{{ formatarDuracao(l.atual?.segundos ?? 0) }}</td>
                <td class="px-2 py-2 tabular-nums">{{ fmtDeltaTempo(l.deltaSegundos) }}</td>
                <td class="px-2 py-2 tabular-nums">{{ formatarPercentual(l.atual?.aproveitamento ?? null) }}</td>
                <td class="px-4 py-2 tabular-nums"><span class="inline-flex items-center gap-1"><TrendingUp v-if="(l.deltaAproveitamento ?? 0) > 0" class="h-3.5 w-3.5 text-emerald-600" /><TrendingDown v-else-if="(l.deltaAproveitamento ?? 0) < 0" class="h-3.5 w-3.5 text-rose-600" />{{ fmtDelta(l.deltaAproveitamento) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
