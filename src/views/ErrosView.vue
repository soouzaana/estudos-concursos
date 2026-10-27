<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Archive, ArchiveRestore, CheckCircle2, ChevronDown, ChevronRight, History, Layers, NotebookPen, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-vue-next'
import type { Dificuldade, Erro, MotivoErro } from '@/types'
import { DIFICULDADES, MOTIVOS } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { formatarData } from '@/utils/datas'
import { confirmar } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/BaseModal.vue'
import ConcursoSelect from '@/components/ConcursoSelect.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErroForm from '@/components/ErroForm.vue'

const dados = useDadosStore()
const toast = useToast()

const filtro = reactive({
  concursoId: undefined as string | undefined, disciplinaId: undefined as string | undefined, topicoId: undefined as string | undefined,
  motivo: '' as MotivoErro | '', dificuldade: '' as Dificuldade | '', status: '' as '' | 'pendente' | 'revisado', busca: '', arquivados: false
})
const limite = ref(30)
const expandidos = ref<Set<string>>(new Set())
watch(() => filtro.disciplinaId, () => (filtro.topicoId = undefined))

const topicosDoFiltro = computed(() => (filtro.disciplinaId ? dados.topicosDaDisciplina(filtro.disciplinaId, true) : []))
const lista = computed(() => {
  const q = filtro.busca.trim().toLowerCase()
  return dados.erros
    .filter((e) => {
      if (e.arquivado !== filtro.arquivados) return false
      if (filtro.concursoId && !e.concursoIds.includes(filtro.concursoId)) return false
      if (filtro.disciplinaId && e.disciplinaId !== filtro.disciplinaId) return false
      if (filtro.topicoId && e.topicoId !== filtro.topicoId) return false
      if (filtro.motivo && e.motivo !== filtro.motivo) return false
      if (filtro.dificuldade && e.dificuldade !== filtro.dificuldade) return false
      if (filtro.status && e.statusRevisao !== filtro.status) return false
      if (q && ![e.enunciado, e.explicacao, e.fonte, e.respostaCorreta, ...e.tags, ...e.alternativas].some((t) => t.toLowerCase().includes(q))) return false
      return true
    })
    .sort((a, b) => (a.data === b.data ? b.criadoEm - a.criadoEm : a.data < b.data ? 1 : -1))
})
const pendentes = computed(() => dados.erros.filter((e) => !e.arquivado && e.statusRevisao === 'pendente').length)
const rotuloMotivo = (m: MotivoErro) => MOTIVOS.find((x) => x.valor === m)?.rotulo ?? m
const rotuloDif = (d: Dificuldade) => DIFICULDADES.find((x) => x.valor === d)?.rotulo ?? d
const temCartao = (id: string) => dados.cartoes.some((c) => c.origemErroId === id)
const fmtMomento = (ms: number) => new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function alternar(id: string) {
  const s = new Set(expandidos.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandidos.value = s
}

/* ---- form ---- */
const formAberto = ref(false)
const edicao = ref<Erro | null>(null)
function novo() {
  edicao.value = null
  formAberto.value = true
}
function editar(e: Erro) {
  edicao.value = e
  formAberto.value = true
}

/* ---- revisão ---- */
const revAberto = ref<Erro | null>(null)
const nota = ref('')
function abrirRevisao(e: Erro) {
  revAberto.value = e
  nota.value = ''
}
async function revisar() {
  if (!revAberto.value) return
  await dados.marcarErroRevisado(revAberto.value.id, nota.value.trim()).catch(() => undefined)
  toast.sucesso('Erro marcado como revisado.')
  revAberto.value = null
}
const histAberto = ref<Erro | null>(null)
const histAtual = computed(() => (histAberto.value ? dados.erros.find((e) => e.id === histAberto.value!.id) : undefined))

async function virarCartao(e: Erro) {
  const ja = temCartao(e.id)
  await dados.criarCartaoDeErro(e.id).catch(() => undefined)
  toast.sucesso(ja ? 'Este erro já tem um flashcard.' : 'Flashcard criado a partir do erro.')
}
async function arquivar(e: Erro) {
  await dados.arquivarErro(e.id, !e.arquivado).catch(() => undefined)
  toast.info(e.arquivado ? 'Erro restaurado.' : 'Erro arquivado.')
}
async function excluir(e: Erro) {
  const ok = await confirmar({ titulo: 'Excluir erro?', mensagem: 'O erro e seu histórico de revisões serão removidos. Flashcards criados a partir dele são mantidos. Considere arquivar em vez de excluir.', confirmar: 'Excluir', perigo: true })
  if (ok) await dados.excluirErro(e.id).catch(() => undefined)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="page-title hidden lg:block">Caderno de erros</h1>
        <p class="text-sm text-muted">{{ pendentes }} erro(s) aguardando revisão. Um erro associado a vários concursos aparece em cada caderno, sem duplicar conteúdo.</p>
      </div>
      <button type="button" class="btn btn-primary" @click="novo"><Plus class="h-4 w-4" />Novo erro</button>
    </div>

    <div class="space-y-2">
      <div class="relative">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input v-model="filtro.busca" type="search" class="input pl-9" placeholder="Pesquisar enunciado, explicação, tags…" aria-label="Pesquisar erros" />
      </div>
      <div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <ConcursoSelect v-model="filtro.concursoId" incluir-todos vazio="Caderno geral" :so-abertos="false" aria-label="Caderno por concurso" />
        <select v-model="filtro.disciplinaId" class="input" aria-label="Disciplina"><option :value="undefined">Todas as disciplinas</option><option v-for="d in dados.disciplinas" :key="d.id" :value="d.id">{{ d.nome }}</option></select>
        <select v-model="filtro.topicoId" class="input" :disabled="!filtro.disciplinaId" aria-label="Tópico"><option :value="undefined">Todos os tópicos</option><option v-for="t in topicosDoFiltro" :key="t.id" :value="t.id">{{ t.nome }}</option></select>
        <select v-model="filtro.motivo" class="input" aria-label="Motivo"><option value="">Todos os motivos</option><option v-for="m in MOTIVOS" :key="m.valor" :value="m.valor">{{ m.rotulo }}</option></select>
        <select v-model="filtro.dificuldade" class="input" aria-label="Dificuldade"><option value="">Qualquer dificuldade</option><option v-for="d in DIFICULDADES" :key="d.valor" :value="d.valor">{{ d.rotulo }}</option></select>
        <select v-model="filtro.status" class="input" aria-label="Status de revisão"><option value="">Pendentes e revisados</option><option value="pendente">Pendentes</option><option value="revisado">Revisados</option></select>
      </div>
      <label class="inline-flex min-h-[36px] items-center gap-2 text-sm text-muted"><input v-model="filtro.arquivados" type="checkbox" class="h-4 w-4" />Ver arquivados</label>
    </div>

    <EmptyState v-if="!dados.erros.length" titulo="Seu caderno de erros está vazio" texto="Ao registrar questões com erros, o app oferece cadastrá-los aqui. Você também pode adicionar manualmente.">
      <template #icone><NotebookPen class="h-6 w-6" /></template>
      <button type="button" class="btn btn-primary" @click="novo"><Plus class="h-4 w-4" />Novo erro</button>
    </EmptyState>
    <p v-else-if="!lista.length" class="py-6 text-center text-sm text-muted">Nenhum erro com esses filtros.</p>

    <ul v-else class="space-y-2">
      <li v-for="e in lista.slice(0, limite)" :key="e.id" class="card">
        <div class="flex items-start gap-2 p-3">
          <button type="button" class="btn-icon mt-0.5 shrink-0" :aria-expanded="expandidos.has(e.id)" :aria-label="expandidos.has(e.id) ? 'Recolher erro' : 'Expandir erro'" @click="alternar(e.id)">
            <component :is="expandidos.has(e.id) ? ChevronDown : ChevronRight" class="h-5 w-5" />
          </button>
          <div class="min-w-0 flex-1">
            <p class="text-sm" :class="expandidos.has(e.id) ? 'whitespace-pre-line' : 'line-clamp-2'">{{ e.enunciado }}</p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <span class="chip" :style="{ background: dados.corDisciplina(e.disciplinaId) + '22', color: dados.corDisciplina(e.disciplinaId) }">{{ dados.nomeDisciplina(e.disciplinaId) }}</span>
              <span v-if="e.topicoId" class="chip chip-muted">{{ dados.nomeTopico(e.topicoId) }}</span>
              <span class="chip chip-muted">{{ rotuloMotivo(e.motivo) }}</span>
              <span class="chip chip-muted">{{ rotuloDif(e.dificuldade) }}</span>
              <span class="chip" :class="e.statusRevisao === 'revisado' ? 'chip-ok' : 'chip-warn'">{{ e.statusRevisao === 'revisado' ? 'Revisado' : 'Pendente' }}</span>
              <span v-if="temCartao(e.id)" class="chip chip-info"><Layers class="h-3 w-3" />Flashcard</span>
            </div>
          </div>
        </div>
        <div v-if="expandidos.has(e.id)" class="space-y-2 border-t border-line p-3 pl-5 text-sm sm:pl-14">
          <ol v-if="e.alternativas.length" class="list-[upper-alpha] space-y-0.5 pl-5 text-muted"><li v-for="(a, i) in e.alternativas" :key="i">{{ a }}</li></ol>
          <p><span class="text-muted">Marcada:</span> {{ e.respostaMarcada || '—' }} · <span class="text-muted">Correta:</span> <strong>{{ e.respostaCorreta || '—' }}</strong></p>
          <p v-if="e.explicacao" class="whitespace-pre-line rounded-xl bg-line/40 p-3">{{ e.explicacao }}</p>
          <p class="text-xs text-muted">
            {{ formatarData(e.data) }}<template v-if="e.fonte"> · {{ e.fonte }}</template>
            <template v-if="e.concursoIds.length"> · {{ e.concursoIds.map((id) => dados.nomeConcurso(id)).join(', ') }}</template>
            <template v-if="e.tags.length"> · #{{ e.tags.join(' #') }}</template>
          </p>
        </div>
        <div class="flex flex-wrap gap-1.5 border-t border-line p-2 pl-3 sm:pl-14">
          <button v-if="e.statusRevisao === 'pendente'" type="button" class="btn btn-soft btn-sm" @click="abrirRevisao(e)"><CheckCircle2 class="h-3.5 w-3.5" />Marcar revisado</button>
          <button v-else type="button" class="btn btn-outline btn-sm" @click="dados.reabrirErro(e.id)"><RotateCcw class="h-3.5 w-3.5" />Reabrir</button>
          <button type="button" class="btn btn-outline btn-sm" :disabled="temCartao(e.id)" @click="virarCartao(e)"><Layers class="h-3.5 w-3.5" />{{ temCartao(e.id) ? 'Já é flashcard' : 'Virar flashcard' }}</button>
          <button type="button" class="btn btn-ghost btn-sm" @click="histAberto = e"><History class="h-3.5 w-3.5" />Revisões ({{ e.revisoes.length }})</button>
          <button type="button" class="btn btn-ghost btn-sm" @click="editar(e)"><Pencil class="h-3.5 w-3.5" />Editar</button>
          <button type="button" class="btn btn-ghost btn-sm" @click="arquivar(e)"><component :is="e.arquivado ? ArchiveRestore : Archive" class="h-3.5 w-3.5" />{{ e.arquivado ? 'Restaurar' : 'Arquivar' }}</button>
          <button type="button" class="btn btn-ghost btn-sm ml-auto text-red-600" aria-label="Excluir erro" @click="excluir(e)"><Trash2 class="h-3.5 w-3.5" /></button>
        </div>
      </li>
    </ul>
    <button v-if="lista.length > limite" type="button" class="btn btn-outline w-full" @click="limite += 30">Mostrar mais ({{ lista.length - limite }})</button>

    <ErroForm v-model="formAberto" :erro="edicao" />

    <BaseModal :model-value="!!revAberto" titulo="Marcar como revisado" largura="sm" @update:model-value="(v: boolean) => !v && (revAberto = null)">
      <label class="label" for="rev-nota">Anotação da revisão (opcional)</label>
      <textarea id="rev-nota" v-model="nota" class="input" maxlength="500" placeholder="O que ficou claro? O que ainda confunde?" />
      <template #rodape>
        <button type="button" class="btn btn-outline" @click="revAberto = null">Cancelar</button>
        <button type="button" class="btn btn-primary" @click="revisar">Registrar revisão</button>
      </template>
    </BaseModal>

    <BaseModal :model-value="!!histAberto" titulo="Histórico de revisões" largura="sm" @update:model-value="(v: boolean) => !v && (histAberto = null)">
      <p v-if="!histAtual?.revisoes.length" class="text-sm text-muted">Este erro ainda não foi revisado.</p>
      <ul v-else class="divide-line">
        <li v-for="(r, i) in [...histAtual.revisoes].reverse()" :key="i" class="py-2 text-sm"><p class="font-medium">{{ fmtMomento(r.em) }}</p><p v-if="r.nota" class="text-xs text-muted">{{ r.nota }}</p></li>
      </ul>
    </BaseModal>
  </div>
</template>
