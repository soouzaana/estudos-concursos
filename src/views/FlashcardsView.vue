<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Archive, ArchiveRestore, Layers, Pencil, Play, Plus, Search, Trash2 } from 'lucide-vue-next'
import type { Cartao } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { ALGORITMO, ehNovo, estaVencido, formatarIntervalo } from '@/services/fsrs'
import { contarCartoes, filtrarCartoes, montarFila } from '@/services/fila'
import { confirmar } from '@/composables/useConfirm'
import CartaoForm from '@/components/CartaoForm.vue'
import ConcursoSelect from '@/components/ConcursoSelect.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatCard from '@/components/StatCard.vue'

const dados = useDadosStore()
const config = useConfiguracoesStore()
const router = useRouter()

const filtro = reactive({ concursoId: undefined as string | undefined, disciplinaId: undefined as string | undefined, topicoId: undefined as string | undefined, doCaderno: false, busca: '', arquivados: false })
const aba = ref<'todos' | 'hoje' | 'vencidos' | 'novos'>('todos')
const limite = ref(40)
watch(() => filtro.disciplinaId, () => (filtro.topicoId = undefined))

const agora = ref(Date.now())
const contagens = computed(() => contarCartoes(dados.cartoes, agora.value))
const topicosDoFiltro = computed(() => (filtro.disciplinaId ? dados.topicosDaDisciplina(filtro.disciplinaId, true) : []))
const filaHoje = computed(() => montarFila(dados.cartoes, dados.revisoesCartao, { ...filtro, novosPorDia: config.config.novosCartoesPorDia, modo: 'hoje', agora: agora.value }))

const lista = computed(() => {
  const base = filtrarCartoes(dados.cartoes, filtro, filtro.arquivados).filter((c) => c.arquivado === filtro.arquivados)
  const t = agora.value
  const filtrada = base.filter((c) => {
    if (aba.value === 'hoje') return c.proximaRevisao <= new Date(new Date(t).setHours(23, 59, 59, 999)).getTime()
    if (aba.value === 'vencidos') return estaVencido(c, t) && !ehNovo(c)
    if (aba.value === 'novos') return ehNovo(c)
    return true
  })
  return filtrada.sort((a, b) => a.proximaRevisao - b.proximaRevisao)
})

function estudar(modo: 'hoje' | 'vencidas') {
  agora.value = Date.now()
  router.push({
    path: '/flashcards/revisar',
    query: {
      modo, ...(filtro.concursoId ? { concurso: filtro.concursoId } : {}), ...(filtro.disciplinaId ? { disciplina: filtro.disciplinaId } : {}),
      ...(filtro.topicoId ? { topico: filtro.topicoId } : {}), ...(filtro.doCaderno ? { caderno: '1' } : {})
    }
  })
}

const formAberto = ref(false)
const edicao = ref<Cartao | null>(null)
const inicial = ref<Partial<Cartao>>({})
function novo() {
  edicao.value = null
  inicial.value = { disciplinaId: filtro.disciplinaId, topicoId: filtro.topicoId, concursoIds: filtro.concursoId ? [filtro.concursoId] : [] }
  formAberto.value = true
}
function editar(c: Cartao) {
  edicao.value = c
  formAberto.value = true
}
async function arquivar(c: Cartao) {
  await dados.atualizarCartao({ ...c, arquivado: !c.arquivado }).catch(() => undefined)
}
async function excluir(c: Cartao) {
  const ok = await confirmar({ titulo: 'Excluir flashcard?', mensagem: 'O cartão e seu histórico de revisões serão removidos. Para pausar sem perder o histórico, arquive.', confirmar: 'Excluir', perigo: true })
  if (ok) await dados.excluirCartao(c.id).catch(() => undefined)
}
const quando = (c: Cartao) => {
  if (ehNovo(c)) return 'Novo'
  const dif = c.proximaRevisao - agora.value
  return dif <= 0 ? 'Vencido' : `em ${formatarIntervalo(dif)}`
}
const nomeAba = { todos: 'Todos', hoje: 'Hoje', vencidos: 'Vencidos', novos: 'Novos' } as const
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="page-title hidden lg:block">Flashcards</h1>
        <p class="text-sm text-muted">Repetição espaçada com {{ ALGORITMO }}.</p>
      </div>
      <button type="button" class="btn btn-primary" @click="novo"><Plus class="h-4 w-4" />Novo cartão</button>
    </div>

    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo dos flashcards">
      <StatCard rotulo="Para hoje" :valor="String(contagens.hoje)" detalhe="inclui vencidos e novos" />
      <StatCard rotulo="Vencidos" :valor="String(contagens.vencidas)" />
      <StatCard rotulo="Novos" :valor="String(contagens.novos)" :detalhe="`limite diário: ${config.config.novosCartoesPorDia}`" />
      <StatCard rotulo="Do caderno de erros" :valor="String(contagens.doCaderno)" :detalhe="`${contagens.total} cartões no total`" />
    </section>

    <section class="card card-pad flex flex-wrap items-center gap-3" aria-label="Estudar">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">{{ filaHoje.length }} cartão(ões) na fila de hoje{{ filtro.concursoId || filtro.disciplinaId || filtro.topicoId || filtro.doCaderno ? ' (com os filtros atuais)' : '' }}</p>
        <p class="text-xs text-muted">Filtre abaixo por concurso, disciplina ou tópico para estudar só uma parte.</p>
      </div>
      <button type="button" class="btn btn-primary" :disabled="!filaHoje.length" @click="estudar('hoje')"><Play class="h-4 w-4" />Estudar hoje</button>
      <button type="button" class="btn btn-outline" :disabled="!contagens.vencidas" @click="estudar('vencidas')">Só vencidos</button>
    </section>

    <div class="space-y-2">
      <div class="relative">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input v-model="filtro.busca" type="search" class="input pl-9" placeholder="Pesquisar frente, verso ou tags" aria-label="Pesquisar cartões" />
      </div>
      <div class="grid gap-2 sm:grid-cols-3">
        <ConcursoSelect v-model="filtro.concursoId" incluir-todos :so-abertos="false" aria-label="Cartões por concurso" />
        <select v-model="filtro.disciplinaId" class="input" aria-label="Disciplina"><option :value="undefined">Todas as disciplinas</option><option v-for="d in dados.disciplinas" :key="d.id" :value="d.id">{{ d.nome }}</option></select>
        <select v-model="filtro.topicoId" class="input" :disabled="!filtro.disciplinaId" aria-label="Tópico"><option :value="undefined">Todos os tópicos</option><option v-for="t in topicosDoFiltro" :key="t.id" :value="t.id">{{ t.nome }}</option></select>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-xl border border-line bg-card p-1" role="tablist" aria-label="Filtro por vencimento">
          <button v-for="(r, k) in nomeAba" :key="k" type="button" role="tab" :aria-selected="aba === k" class="min-h-[36px] rounded-lg px-3 text-sm font-medium transition" :class="aba === k ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink'" @click="aba = k">{{ r }}</button>
        </div>
        <label class="inline-flex min-h-[36px] items-center gap-2 text-sm text-muted"><input v-model="filtro.doCaderno" type="checkbox" class="h-4 w-4" />Só do caderno de erros</label>
        <label class="inline-flex min-h-[36px] items-center gap-2 text-sm text-muted"><input v-model="filtro.arquivados" type="checkbox" class="h-4 w-4" />Arquivados</label>
      </div>
    </div>

    <EmptyState v-if="!dados.cartoes.length" titulo="Nenhum flashcard ainda" texto="Crie cartões manualmente ou transforme erros do caderno em flashcards. O app agenda as revisões para você.">
      <template #icone><Layers class="h-6 w-6" /></template>
      <button type="button" class="btn btn-primary" @click="novo"><Plus class="h-4 w-4" />Novo cartão</button>
      <RouterLink to="/erros" class="btn btn-outline">Ir ao caderno de erros</RouterLink>
    </EmptyState>
    <p v-else-if="!lista.length" class="py-6 text-center text-sm text-muted">Nenhum cartão nesta visão.</p>
    <ul v-else class="card divide-line">
      <li v-for="c in lista.slice(0, limite)" :key="c.id" class="flex items-start gap-3 p-3">
        <div class="min-w-0 flex-1">
          <p class="line-clamp-2 text-sm font-medium">{{ c.frente }}</p>
          <p class="line-clamp-1 text-xs text-muted">{{ c.verso }}</p>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <span v-if="c.disciplinaId" class="chip chip-muted">{{ dados.nomeDisciplina(c.disciplinaId) }}</span>
            <span v-if="c.topicoId" class="chip chip-muted">{{ dados.nomeTopico(c.topicoId) }}</span>
            <span v-if="c.origemErroId" class="chip chip-info">Do caderno</span>
            <span v-for="id in c.concursoIds" :key="id" class="chip chip-accent">{{ dados.nomeConcurso(id) }}</span>
            <span class="chip" :class="ehNovo(c) ? 'chip-info' : estaVencido(c, agora) ? 'chip-warn' : 'chip-ok'">{{ quando(c) }}</span>
          </div>
        </div>
        <div class="flex shrink-0">
          <button type="button" class="btn-icon" aria-label="Editar cartão" @click="editar(c)"><Pencil class="h-4 w-4" /></button>
          <button type="button" class="btn-icon" :aria-label="c.arquivado ? 'Restaurar cartão' : 'Arquivar cartão'" @click="arquivar(c)"><component :is="c.arquivado ? ArchiveRestore : Archive" class="h-4 w-4" /></button>
          <button type="button" class="btn-icon" aria-label="Excluir cartão" @click="excluir(c)"><Trash2 class="h-4 w-4" /></button>
        </div>
      </li>
    </ul>
    <button v-if="lista.length > limite" type="button" class="btn btn-outline w-full" @click="limite += 40">Mostrar mais ({{ lista.length - limite }})</button>

    <CartaoForm v-model="formAberto" :cartao="edicao" :inicial="inicial" />
  </div>
</template>
