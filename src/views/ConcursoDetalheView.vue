<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Unlink } from 'lucide-vue-next'
import type { Atividade } from '@/types'
import { SITUACOES_EDITAL, STATUS_CONCURSO } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { dataEfetiva, ordenarAtividades, estaAberta } from '@/services/cronograma'
import { resumoConcurso } from '@/services/resumo'
import { desempenhoPorDisciplina } from '@/services/stats'
import { formatarData, formatarDuracao } from '@/utils/datas'
import { formatarPercentual } from '@/utils/validacao'
import { confirmar } from '@/composables/useConfirm'
import { useAtividadeAcoes } from '@/composables/useAtividadeAcoes'
import AtividadeForm from '@/components/AtividadeForm.vue'
import AtividadeItem from '@/components/AtividadeItem.vue'
import ConcursoForm from '@/components/ConcursoForm.vue'
import EmptyState from '@/components/EmptyState.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import StatCard from '@/components/StatCard.vue'

const route = useRoute()
const dados = useDadosStore()
const acoes = useAtividadeAcoes()

const concurso = computed(() => dados.concursoPorId.get(String(route.params.id)))
const resumo = computed(() => (concurso.value ? resumoConcurso(dados.dadosStats, concurso.value.id) : null))
const disciplinas = computed(() => (concurso.value ? dados.disciplinasDoConcurso(concurso.value.id) : []))
const desempenho = computed(() =>
  concurso.value ? desempenhoPorDisciplina(dados.dadosStats, { de: '0000-01-01', ate: '9999-12-31', concursoId: concurso.value.id }) : []
)
const abertas = computed(() => ordenarAtividades(dados.atividades.filter((a) => a.concursoId === concurso.value?.id && estaAberta(a))).slice(0, 6))
const puladas = computed(() => dados.atividades.filter((a) => a.concursoId === concurso.value?.id && a.status === 'pulada').length)

const editarAberto = ref(false)
const atividadeAberta = ref(false)
const atividadeEdicao = ref<Atividade | null>(null)
const rotuloEdital = computed(() => SITUACOES_EDITAL.find((s) => s.valor === concurso.value?.situacaoEdital)?.rotulo)
const rotuloStatus = computed(() => STATUS_CONCURSO.find((s) => s.valor === concurso.value?.status)?.rotulo)

function editarAtividade(a: Atividade) {
  atividadeEdicao.value = a
  atividadeAberta.value = true
}
async function mover(i: number, delta: number) {
  if (!concurso.value) return
  const ids = disciplinas.value.map((d) => d.id)
  const j = i + delta
  if (j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  await dados.reordenarDisciplinasDoConcurso(concurso.value.id, ids).catch(() => undefined)
}
async function desvincular(id: string) {
  if (!concurso.value) return
  const ok = await confirmar({
    titulo: 'Remover disciplina do concurso?',
    mensagem: 'A disciplina continua cadastrada e seu histórico é mantido; ela só deixa de fazer parte deste concurso.',
    confirmar: 'Remover'
  })
  if (ok) await dados.desvincularDisciplina(concurso.value.id, id).catch(() => undefined)
}
const dadoDisc = (id: string) => desempenho.value.find((d) => d.disciplinaId === id)
</script>

<template>
  <div v-if="!concurso" class="space-y-4">
    <EmptyState titulo="Concurso não encontrado" texto="Ele pode ter sido excluído.">
      <RouterLink to="/concursos" class="btn btn-primary">Voltar para concursos</RouterLink>
    </EmptyState>
  </div>
  <div v-else class="space-y-5">
    <RouterLink to="/concursos" class="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft class="h-4 w-4" />Concursos</RouterLink>
    <header class="card card-pad flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="page-title">{{ concurso.nome }}</h1>
        <p class="text-sm text-muted">{{ [concurso.orgao, concurso.cargo, concurso.banca].filter(Boolean).join(' · ') }}</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <span class="chip chip-accent">{{ rotuloStatus }}</span>
          <span class="chip chip-muted">{{ rotuloEdital }}</span>
          <span class="chip chip-muted">Início {{ formatarData(concurso.dataInicio) }}</span>
          <span v-if="concurso.dataProva" class="chip chip-muted">Prova {{ formatarData(concurso.dataProva) }}</span>
        </div>
        <p v-if="concurso.observacoes" class="mt-3 whitespace-pre-line text-sm text-muted">{{ concurso.observacoes }}</p>
      </div>
      <button type="button" class="btn btn-outline" @click="editarAberto = true"><Pencil class="h-4 w-4" />Editar</button>
    </header>

    <section v-if="resumo" class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo do concurso">
      <StatCard rotulo="Horas estudadas" :valor="formatarDuracao(resumo.segundos)" :detalhe="`Meta semanal: ${concurso.metaSemanalHoras} h`" />
      <StatCard rotulo="Questões" :valor="String(resumo.questoes.total)" :detalhe="concurso.metaQuestoes ? `Meta: ${concurso.metaQuestoes}` : undefined" />
      <StatCard rotulo="Aproveitamento" :valor="formatarPercentual(resumo.questoes.aproveitamento)" :detalhe="`${resumo.questoes.acertos} acertos · ${resumo.questoes.erros} erros`" />
      <StatCard rotulo="Cronograma" :valor="`${resumo.progresso.concluidas}/${resumo.progresso.total}`" :detalhe="`${resumo.progresso.pendentes + resumo.progresso.emAndamento} abertas · ${puladas} puladas`">
        <ProgressBar class="mt-2" :valor="resumo.progresso.percentual" rotulo="Progresso do cronograma" />
      </StatCard>
    </section>

    <div class="grid gap-5 lg:grid-cols-2">
      <section class="card card-pad space-y-3" aria-labelledby="t-disc">
        <h2 id="t-disc" class="section-title">Disciplinas do concurso</h2>
        <EmptyState v-if="!disciplinas.length" titulo="Nenhuma disciplina vinculada" texto="Edite o concurso para escolher disciplinas existentes ou criar novas." />
        <ul v-else class="divide-line">
          <li v-for="(d, i) in disciplinas" :key="d.id" class="flex items-center gap-2 py-2.5">
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ background: d.cor }" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ d.nome }}</p>
              <p class="text-xs text-muted">
                {{ formatarDuracao(dadoDisc(d.id)?.segundos ?? 0) }} · {{ dadoDisc(d.id)?.total ?? 0 }} questões ·
                {{ formatarPercentual(dadoDisc(d.id)?.aproveitamento ?? null) }}
              </p>
            </div>
            <button type="button" class="btn-icon" :disabled="i === 0" :aria-label="`Subir ${d.nome}`" @click="mover(i, -1)"><ArrowUp class="h-4 w-4" /></button>
            <button type="button" class="btn-icon" :disabled="i === disciplinas.length - 1" :aria-label="`Descer ${d.nome}`" @click="mover(i, 1)"><ArrowDown class="h-4 w-4" /></button>
            <button type="button" class="btn-icon" :aria-label="`Remover ${d.nome} do concurso`" @click="desvincular(d.id)"><Unlink class="h-4 w-4" /></button>
          </li>
        </ul>
      </section>

      <section class="space-y-3" aria-labelledby="t-prox">
        <div class="flex items-center justify-between">
          <h2 id="t-prox" class="section-title">Próximas atividades</h2>
          <RouterLink to="/cronograma" class="text-xs font-medium text-accent hover:underline">Ver cronograma</RouterLink>
        </div>
        <EmptyState v-if="!abertas.length" titulo="Nada pendente" texto="Monte a sequência de estudos na tela Cronograma." />
        <div v-else class="space-y-2">
          <AtividadeItem
            v-for="a in abertas" :key="a.id" :atividade="a" compacto
            @iniciar="acoes.iniciar" @concluir="acoes.concluir" @pular="acoes.pular" @reabrir="acoes.reabrir" @questoes="acoes.registrarQuestoes" @editar="editarAtividade"
          />
        </div>
        <p v-if="abertas.length" class="text-xs text-muted">Próxima data: {{ formatarData(dataEfetiva(abertas[0])) }}</p>
      </section>
    </div>

    <ConcursoForm v-model="editarAberto" :concurso="concurso" />
    <AtividadeForm v-model="atividadeAberta" :atividade="atividadeEdicao" :concurso-padrao="concurso.id" />
  </div>
</template>
