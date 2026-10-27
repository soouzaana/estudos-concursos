<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Archive, ArchiveRestore, CalendarClock, Landmark, Pencil, Plus, Search, Trash2 } from 'lucide-vue-next'
import type { Concurso, StatusConcurso } from '@/types'
import { SITUACOES_EDITAL, STATUS_CONCURSO } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { resumoConcurso } from '@/services/resumo'
import { formatarData, formatarDuracao, diffDias, hoje } from '@/utils/datas'
import { formatarPercentual } from '@/utils/validacao'
import { confirmar } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import ConcursoForm from '@/components/ConcursoForm.vue'
import EmptyState from '@/components/EmptyState.vue'
import ProgressBar from '@/components/ProgressBar.vue'

const dados = useDadosStore()
const toast = useToast()
const busca = ref('')
const filtroStatus = ref<StatusConcurso | 'todos' | 'ativos'>('ativos')
const formAberto = ref(false)
const editando = ref<Concurso | null>(null)

const lista = computed(() => {
  const q = busca.value.trim().toLowerCase()
  return dados.concursos
    .filter((c) => {
      if (filtroStatus.value === 'ativos' && c.status !== 'preparacao' && c.status !== 'pausado') return false
      if (filtroStatus.value !== 'ativos' && filtroStatus.value !== 'todos' && c.status !== filtroStatus.value) return false
      return !q || [c.nome, c.orgao, c.cargo, c.banca].some((t) => t.toLowerCase().includes(q))
    })
    .sort((a, b) => a.nome.localeCompare(b.nome))
})

const resumos = computed(() => new Map(lista.value.map((c) => [c.id, resumoConcurso(dados.dadosStats, c.id)])))
const rotuloStatus = (s: StatusConcurso) => STATUS_CONCURSO.find((x) => x.valor === s)?.rotulo ?? s
const rotuloEdital = (s: Concurso['situacaoEdital']) => SITUACOES_EDITAL.find((x) => x.valor === s)?.rotulo ?? s
const classeStatus = (s: StatusConcurso) => ({ preparacao: 'chip-ok', pausado: 'chip-warn', concluido: 'chip-info', arquivado: 'chip-muted' })[s]

function novo() {
  editando.value = null
  formAberto.value = true
}
function editar(c: Concurso) {
  editando.value = c
  formAberto.value = true
}
async function arquivar(c: Concurso) {
  const arquivar = c.status !== 'arquivado'
  await dados.alterarStatusConcurso(c.id, arquivar ? 'arquivado' : 'preparacao').catch(() => undefined)
  toast.info(arquivar ? 'Concurso arquivado. Ele continua no histórico.' : 'Concurso reativado.')
}
async function excluir(c: Concurso) {
  const ok = await confirmar({
    titulo: `Excluir "${c.nome}"?`,
    mensagem:
      'O cronograma deste concurso será removido. O histórico de estudo (sessões, questões, erros e flashcards) é preservado, apenas sem a associação com este concurso.\n\nSe preferir manter tudo, arquive o concurso em vez de excluir.',
    confirmar: 'Excluir',
    perigo: true
  })
  if (!ok) return
  await dados.excluirConcurso(c.id).catch(() => undefined)
  toast.sucesso('Concurso excluído.')
}
const diasParaProva = (c: Concurso) => (c.dataProva ? diffDias(c.dataProva, hoje()) : null)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="page-title hidden lg:block">Concursos</h1>
        <p class="text-sm text-muted">Cada concurso tem estatísticas próprias; disciplinas podem ser compartilhadas.</p>
      </div>
      <button type="button" class="btn btn-primary" @click="novo"><Plus class="h-4 w-4" />Novo concurso</button>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row">
      <div class="relative flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input v-model="busca" type="search" class="input pl-9" placeholder="Buscar por nome, órgão, cargo ou banca" aria-label="Buscar concursos" />
      </div>
      <select v-model="filtroStatus" class="input sm:w-56" aria-label="Filtrar por situação">
        <option value="ativos">Em preparação e pausados</option>
        <option value="todos">Todos (inclui histórico)</option>
        <option v-for="s in STATUS_CONCURSO" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option>
      </select>
    </div>

    <EmptyState v-if="!dados.concursos.length" titulo="Cadastre seu primeiro concurso" texto="Informe órgão, cargo, banca e metas. Depois vincule disciplinas e monte o cronograma.">
      <template #icone><Landmark class="h-6 w-6" /></template>
      <button type="button" class="btn btn-primary" @click="novo"><Plus class="h-4 w-4" />Novo concurso</button>
    </EmptyState>
    <EmptyState v-else-if="!lista.length" titulo="Nenhum concurso encontrado" texto="Ajuste a busca ou o filtro de situação para ver o histórico." />

    <ul v-else class="grid gap-3 lg:grid-cols-2">
      <li v-for="c in lista" :key="c.id" class="card card-pad flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <RouterLink :to="`/concursos/${c.id}`" class="block truncate text-base font-semibold hover:underline">{{ c.nome }}</RouterLink>
            <p class="truncate text-xs text-muted">{{ [c.orgao, c.cargo, c.banca].filter(Boolean).join(' · ') || 'Sem detalhes informados' }}</p>
          </div>
          <span class="chip shrink-0" :class="classeStatus(c.status)">{{ rotuloStatus(c.status) }}</span>
        </div>
        <div class="flex flex-wrap gap-1.5 text-xs">
          <span class="chip chip-accent">{{ rotuloEdital(c.situacaoEdital) }}</span>
          <span v-if="c.dataProva" class="chip chip-muted"><CalendarClock class="h-3 w-3" />Prova {{ formatarData(c.dataProva) }}<template v-if="diasParaProva(c)! >= 0"> · {{ diasParaProva(c) }} d</template></span>
        </div>
        <div>
          <div class="mb-1 flex justify-between text-xs text-muted">
            <span>Cronograma</span>
            <span>{{ resumos.get(c.id)!.progresso.concluidas }}/{{ resumos.get(c.id)!.progresso.total }} concluídas</span>
          </div>
          <ProgressBar :valor="resumos.get(c.id)!.progresso.percentual" :rotulo="`Progresso do cronograma de ${c.nome}`" />
        </div>
        <dl class="grid grid-cols-3 gap-2 text-center text-xs">
          <div class="rounded-xl bg-line/40 p-2"><dt class="text-muted">Estudado</dt><dd class="text-sm font-semibold">{{ formatarDuracao(resumos.get(c.id)!.segundos) }}</dd></div>
          <div class="rounded-xl bg-line/40 p-2"><dt class="text-muted">Questões</dt><dd class="text-sm font-semibold">{{ resumos.get(c.id)!.questoes.total }}</dd></div>
          <div class="rounded-xl bg-line/40 p-2"><dt class="text-muted">Acertos</dt><dd class="text-sm font-semibold">{{ formatarPercentual(resumos.get(c.id)!.questoes.aproveitamento) }}</dd></div>
        </dl>
        <div class="flex flex-wrap gap-2 border-t border-line pt-3">
          <RouterLink :to="`/concursos/${c.id}`" class="btn btn-soft btn-sm">Abrir</RouterLink>
          <button type="button" class="btn btn-outline btn-sm" @click="editar(c)"><Pencil class="h-3.5 w-3.5" />Editar</button>
          <button type="button" class="btn btn-outline btn-sm" @click="arquivar(c)">
            <component :is="c.status === 'arquivado' ? ArchiveRestore : Archive" class="h-3.5 w-3.5" />{{ c.status === 'arquivado' ? 'Reativar' : 'Arquivar' }}
          </button>
          <button type="button" class="btn btn-ghost btn-sm ml-auto text-red-600" :aria-label="`Excluir ${c.nome}`" @click="excluir(c)"><Trash2 class="h-3.5 w-3.5" /></button>
        </div>
      </li>
    </ul>

    <ConcursoForm v-model="formAberto" :concurso="editando" />
  </div>
</template>
