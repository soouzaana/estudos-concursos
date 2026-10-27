<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Ban, Undo2 } from 'lucide-vue-next'
import type { Atividade } from '@/types'
import { METODOS } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { dataEfetiva } from '@/services/cronograma'
import { questoesFiltradas, sessoesFiltradas, totaisQuestoes, totalSegundos } from '@/services/stats'
import { formatarData, formatarDataExtenso, formatarDuracao, formatarHora, hoje } from '@/utils/datas'
import { formatarPercentual } from '@/utils/validacao'
import { useAtividadeAcoes } from '@/composables/useAtividadeAcoes'
import { useToast } from '@/composables/useToast'
import AtividadeForm from '@/components/AtividadeForm.vue'
import AtividadeItem from '@/components/AtividadeItem.vue'
import ConcursoSelect from '@/components/ConcursoSelect.vue'
import MapaConsistencia from '@/components/MapaConsistencia.vue'
import StatCard from '@/components/StatCard.vue'

const dados = useDadosStore()
const route = useRoute()
const acoes = useAtividadeAcoes()
const toast = useToast()

const selecionada = ref<string>(typeof route.query.data === 'string' ? route.query.data : hoje())
const concursoId = ref<string | undefined>(undefined)

const filtro = computed(() => ({ de: selecionada.value, ate: selecionada.value, concursoId: concursoId.value }))
const sessoes = computed(() => sessoesFiltradas(dados.dadosStats, filtro.value).sort((a, b) => a.inicio - b.inicio))
const questoes = computed(() => questoesFiltradas(dados.dadosStats, filtro.value))
const totaisQ = computed(() => totaisQuestoes(questoes.value))
const atividades = computed(() =>
  dados.atividades.filter((a) => dataEfetiva(a) === selecionada.value && (!concursoId.value || a.concursoId === concursoId.value)).sort((a, b) => (a.horario ?? '99').localeCompare(b.horario ?? '99') || a.ordem - b.ordem)
)
const puladas = computed(() => atividades.value.filter((a) => a.status === 'pulada'))
const revisoes = computed(() => dados.revisoesCartao.filter((r) => r.data === selecionada.value))
const marcado = computed(() => dados.marcacoesDia.some((m) => m.data === selecionada.value))
const rotuloMetodo = (m: string) => METODOS.find((x) => x.valor === m)?.rotulo ?? m
const temAlgo = computed(() => sessoes.value.length || questoes.value.length || atividades.value.length || revisoes.value.length)

async function alternarMarcacao() {
  if (marcado.value) {
    await dados.removerMarcacaoDia(selecionada.value).catch(() => undefined)
    toast.info('Marcação removida.')
  } else {
    await dados.marcarDiaPulado(selecionada.value, 'Marcado manualmente').catch(() => undefined)
    toast.info('Dia marcado como pulado. Se houver registro de estudo, ele continua valendo.')
  }
}

const formAberto = ref(false)
const edicao = ref<Atividade | null>(null)
function editar(a: Atividade) {
  edicao.value = a
  formAberto.value = true
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="page-title hidden lg:block">Calendário</h1>
        <p class="text-sm text-muted">Toque em um dia para ver tudo o que foi planejado e realizado.</p>
      </div>
      <div class="w-full sm:w-64"><ConcursoSelect v-model="concursoId" incluir-todos :so-abertos="false" aria-label="Filtrar por concurso" /></div>
    </div>

    <div class="grid gap-5 lg:grid-cols-[420px_1fr]">
      <MapaConsistencia :concurso-id="concursoId" :selecionado="selecionada" interativo @selecionar="selecionada = $event" />

      <section class="space-y-4" aria-labelledby="t-dia-sel" aria-live="polite">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="t-dia-sel" class="text-base font-semibold capitalize">{{ formatarDataExtenso(selecionada) }}</h2>
          <button v-if="selecionada <= hoje()" type="button" class="btn btn-outline btn-sm" @click="alternarMarcacao">
            <component :is="marcado ? Undo2 : Ban" class="h-3.5 w-3.5" />{{ marcado ? 'Remover marcação de dia pulado' : 'Marcar dia como pulado' }}
          </button>
        </div>
        <p v-if="marcado" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:bg-rose-900/30 dark:text-rose-100">Este dia está marcado como pulado.</p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard rotulo="Tempo estudado" :valor="formatarDuracao(totalSegundos(sessoes))" :detalhe="`${sessoes.length} sessões`" />
          <StatCard rotulo="Questões" :valor="String(totaisQ.total)" :detalhe="formatarPercentual(totaisQ.aproveitamento)" />
          <StatCard rotulo="Acertos / erros" :valor="`${totaisQ.acertos} / ${totaisQ.erros}`" />
          <StatCard rotulo="Flashcards" :valor="String(revisoes.length)" detalhe="revisados" />
        </div>

        <p v-if="!temAlgo" class="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Nada registrado nem planejado neste dia.</p>

        <div v-if="atividades.length" class="space-y-2">
          <h3 class="section-title">Atividades ({{ atividades.length }}<template v-if="puladas.length">, {{ puladas.length }} pulada(s)</template>)</h3>
          <AtividadeItem v-for="a in atividades" :key="a.id" :atividade="a" mostrar-concurso @iniciar="acoes.iniciar" @concluir="acoes.concluir" @pular="acoes.pular" @reabrir="acoes.reabrir" @questoes="acoes.registrarQuestoes" @editar="editar" />
        </div>

        <div v-if="sessoes.length" class="space-y-2">
          <h3 class="section-title">Sessões de estudo</h3>
          <ul class="card divide-line">
            <li v-for="s in sessoes" :key="s.id" class="flex items-center gap-3 p-3 text-sm">
              <span class="h-8 w-1.5 shrink-0 rounded-full" :style="{ background: dados.corDisciplina(s.disciplinaId) }" />
              <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ dados.nomeDisciplina(s.disciplinaId) }}</p><p class="truncate text-xs text-muted">{{ formatarHora(s.inicio) }} · {{ rotuloMetodo(s.metodo) }} · {{ dados.nomeConcurso(s.concursoId) }}</p></div>
              <span class="font-semibold tabular-nums">{{ formatarDuracao(s.duracaoSeg) }}</span>
            </li>
          </ul>
        </div>

        <div v-if="questoes.length" class="space-y-2">
          <h3 class="section-title">Questões</h3>
          <ul class="card divide-line">
            <li v-for="b in questoes" :key="b.id" class="flex items-center gap-3 p-3 text-sm">
              <span class="h-8 w-1.5 shrink-0 rounded-full" :style="{ background: dados.corDisciplina(b.disciplinaId) }" />
              <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ dados.nomeDisciplina(b.disciplinaId) }}</p><p class="truncate text-xs text-muted">{{ b.fonte || 'Sem fonte' }} · {{ formatarData(b.data) }}</p></div>
              <span class="font-semibold tabular-nums">{{ b.acertos }}/{{ b.total }}</span>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <AtividadeForm v-model="formAberto" :atividade="edicao" />
  </div>
</template>
