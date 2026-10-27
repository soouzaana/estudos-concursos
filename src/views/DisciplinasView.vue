<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, ChevronRight, CornerDownRight, Pencil, Plus, Trash2, Undo2 } from 'lucide-vue-next'
import type { Disciplina, StatusProgresso, Topico } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { coresDisciplina } from '@/utils/cores'
import { confirmar } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import FormField from '@/components/FormField.vue'

const dados = useDadosStore()
const toast = useToast()
const STATUS: { valor: StatusProgresso; rotulo: string }[] = [
  { valor: 'nao_iniciado', rotulo: 'Não iniciada' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'concluido', rotulo: 'Concluída' }
]
const rotuloStatus = (s: StatusProgresso) => STATUS.find((x) => x.valor === s)?.rotulo ?? s
const classeStatus = (s: StatusProgresso) => ({ nao_iniciado: 'chip-muted', em_andamento: 'chip-info', concluido: 'chip-ok' })[s]

const mostrarArquivadas = ref(false)
const expandidas = ref<Set<string>>(new Set())
const lista = computed(() => (mostrarArquivadas.value ? dados.disciplinas.filter((d) => d.arquivada) : dados.disciplinasAtivas))
const temArquivadas = computed(() => dados.disciplinas.some((d) => d.arquivada))

/* ---- formulário de disciplina ---- */
const aberto = ref(false)
const editando = ref<Disciplina | null>(null)
const f = reactive({ nome: '', descricao: '', cor: '#7c3aed', status: 'nao_iniciado' as StatusProgresso, observacoes: '' })
const erroNome = ref('')

function nova() {
  editando.value = null
  Object.assign(f, { nome: '', descricao: '', cor: coresDisciplina()[dados.disciplinas.length % 12], status: 'nao_iniciado', observacoes: '' })
  erroNome.value = ''
  aberto.value = true
}
function editar(d: Disciplina) {
  editando.value = d
  Object.assign(f, { nome: d.nome, descricao: d.descricao, cor: d.cor, status: d.status, observacoes: d.observacoes })
  erroNome.value = ''
  aberto.value = true
}
async function salvar() {
  const nome = f.nome.trim()
  if (!nome) {
    erroNome.value = 'Informe o nome da disciplina.'
    return
  }
  const duplicada = dados.disciplinas.find((d) => !d.arquivada && d.id !== editando.value?.id && d.nome.trim().toLowerCase() === nome.toLowerCase())
  if (duplicada) {
    erroNome.value = 'Já existe uma disciplina com esse nome. Reutilize-a nos concursos em vez de duplicar.'
    return
  }
  try {
    if (editando.value) await dados.atualizarDisciplina({ ...editando.value, nome, descricao: f.descricao.trim(), cor: f.cor, status: f.status, observacoes: f.observacoes.trim() })
    else await dados.criarDisciplina(nome, undefined, { descricao: f.descricao.trim(), cor: f.cor, status: f.status, observacoes: f.observacoes.trim() })
    toast.sucesso('Disciplina salva.')
    aberto.value = false
  } catch {
    /* já notificado */
  }
}
async function excluir(d: Disciplina) {
  const tem = await dados.temHistoricoDisciplina(d.id)
  const ok = await confirmar({
    titulo: `Excluir "${d.nome}"?`,
    mensagem: tem
      ? 'Esta disciplina possui registros (atividades, sessões, questões, erros ou flashcards). Ela será arquivada: sai dos seletores e dos concursos, mas todo o histórico é preservado.'
      : 'Esta disciplina não possui registros e será removida junto com seus tópicos.',
    confirmar: tem ? 'Arquivar' : 'Excluir',
    perigo: !tem
  })
  if (!ok) return
  await dados.excluirDisciplina(d.id).catch(() => undefined)
  toast.info(tem ? 'Disciplina arquivada; o histórico foi mantido.' : 'Disciplina excluída.')
}
async function mover(id: string, delta: number) {
  const ids = dados.disciplinasAtivas.map((d) => d.id)
  const i = ids.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  await dados.reordenarDisciplinas(ids).catch(() => undefined)
}

/* ---- tópicos ---- */
const novoTopico = reactive<Record<string, string>>({})
const subtopicoDe = ref<string | null>(null)
const subtopicoNome = ref('')
const topicoEdit = ref<string | null>(null)
const topicoEditNome = ref('')

function arvore(disciplinaId: string) {
  const todos = dados.topicosDaDisciplina(disciplinaId)
  const saida: { t: Topico; nivel: number; irmaos: Topico[] }[] = []
  const visitar = (pai: string | undefined, nivel: number) => {
    const irmaos = todos.filter((t) => t.parentId === pai)
    irmaos.forEach((t) => {
      saida.push({ t, nivel, irmaos })
      visitar(t.id, nivel + 1)
    })
  }
  visitar(undefined, 0)
  return saida
}
function alternar(id: string) {
  const s = new Set(expandidas.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandidas.value = s
}
async function adicionarTopico(disciplinaId: string) {
  const nome = (novoTopico[disciplinaId] ?? '').trim()
  if (!nome) return
  await dados.criarTopico(disciplinaId, nome).catch(() => undefined)
  novoTopico[disciplinaId] = ''
}
async function adicionarSub(disciplinaId: string) {
  if (!subtopicoDe.value || !subtopicoNome.value.trim()) return
  await dados.criarTopico(disciplinaId, subtopicoNome.value, subtopicoDe.value).catch(() => undefined)
  subtopicoNome.value = ''
  subtopicoDe.value = null
}
async function renomear(t: Topico) {
  const nome = topicoEditNome.value.trim()
  if (nome && nome !== t.nome) await dados.atualizarTopico({ ...t, nome }).catch(() => undefined)
  topicoEdit.value = null
}
async function statusTopico(t: Topico, status: StatusProgresso) {
  await dados.atualizarTopico({ ...t, status }).catch(() => undefined)
}
async function moverTopico(t: Topico, irmaos: Topico[], delta: number) {
  const ids = irmaos.map((x) => x.id)
  const i = ids.indexOf(t.id)
  const j = i + delta
  if (j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  await dados.reordenarTopicos(ids).catch(() => undefined)
}
async function excluirTopico(t: Topico) {
  const ok = await confirmar({
    titulo: `Excluir "${t.nome}"?`,
    mensagem: 'Subtópicos serão removidos junto. Tópicos que já têm registros (sessões, questões, erros…) são arquivados para preservar o histórico.',
    confirmar: 'Excluir',
    perigo: true
  })
  if (ok) await dados.excluirTopico(t.id).catch(() => undefined)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="page-title hidden lg:block">Disciplinas</h1>
        <p class="text-sm text-muted">Cadastre uma vez e use em vários concursos. Organize tópicos e subtópicos.</p>
      </div>
      <div class="flex gap-2">
        <button v-if="temArquivadas" type="button" class="btn btn-outline" @click="mostrarArquivadas = !mostrarArquivadas">{{ mostrarArquivadas ? 'Ver ativas' : 'Ver arquivadas' }}</button>
        <button type="button" class="btn btn-primary" @click="nova"><Plus class="h-4 w-4" />Nova disciplina</button>
      </div>
    </div>

    <EmptyState v-if="!lista.length" :titulo="mostrarArquivadas ? 'Nenhuma disciplina arquivada' : 'Nenhuma disciplina cadastrada'" :texto="mostrarArquivadas ? '' : 'Comece pelas matérias do edital: Português, Direito Constitucional, Raciocínio Lógico…'">
      <template #icone><BookOpen class="h-6 w-6" /></template>
      <button v-if="!mostrarArquivadas" type="button" class="btn btn-primary" @click="nova"><Plus class="h-4 w-4" />Nova disciplina</button>
    </EmptyState>

    <ul v-else class="space-y-3">
      <li v-for="(d, i) in lista" :key="d.id" class="card">
        <div class="flex items-center gap-2 p-3 sm:p-4">
          <button type="button" class="btn-icon" :aria-expanded="expandidas.has(d.id)" :aria-label="`${expandidas.has(d.id) ? 'Recolher' : 'Expandir'} tópicos de ${d.nome}`" @click="alternar(d.id)">
            <component :is="expandidas.has(d.id) ? ChevronDown : ChevronRight" class="h-5 w-5" />
          </button>
          <span class="h-4 w-4 shrink-0 rounded-full" :style="{ background: d.cor }" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ d.nome }}</p>
            <p class="truncate text-xs text-muted">
              {{ dados.concursosDaDisciplina(d.id).map((c) => c.nome).join(', ') || 'Sem concurso vinculado' }} · {{ dados.topicosDaDisciplina(d.id).length }} tópicos
            </p>
          </div>
          <span class="chip hidden sm:inline-flex" :class="classeStatus(d.status)">{{ rotuloStatus(d.status) }}</span>
          <template v-if="!d.arquivada">
            <button type="button" class="btn-icon hidden sm:inline-flex" :disabled="i === 0" :aria-label="`Subir ${d.nome}`" @click="mover(d.id, -1)"><ArrowUp class="h-4 w-4" /></button>
            <button type="button" class="btn-icon hidden sm:inline-flex" :disabled="i === lista.length - 1" :aria-label="`Descer ${d.nome}`" @click="mover(d.id, 1)"><ArrowDown class="h-4 w-4" /></button>
            <button type="button" class="btn-icon" :aria-label="`Editar ${d.nome}`" @click="editar(d)"><Pencil class="h-4 w-4" /></button>
            <button type="button" class="btn-icon" :aria-label="`Excluir ${d.nome}`" @click="excluir(d)"><Trash2 class="h-4 w-4" /></button>
          </template>
          <button v-else type="button" class="btn btn-outline btn-sm" @click="dados.restaurarDisciplina(d.id)"><Undo2 class="h-3.5 w-3.5" />Restaurar</button>
        </div>

        <div v-if="expandidas.has(d.id)" class="space-y-2 border-t border-line p-3 sm:p-4">
          <p v-if="d.descricao" class="text-sm text-muted">{{ d.descricao }}</p>
          <p v-if="d.observacoes" class="whitespace-pre-line text-xs text-muted">{{ d.observacoes }}</p>
          <ul class="divide-line">
            <li v-for="n in arvore(d.id)" :key="n.t.id" class="py-1.5" :style="{ paddingLeft: n.nivel * 20 + 'px' }">
              <div class="flex items-center gap-1.5">
                <CornerDownRight v-if="n.nivel" class="h-3.5 w-3.5 shrink-0 text-muted" />
                <form v-if="topicoEdit === n.t.id" class="flex flex-1 gap-2" @submit.prevent="renomear(n.t)">
                  <input v-model="topicoEditNome" class="input min-h-[36px] py-1" maxlength="120" :aria-label="`Renomear ${n.t.nome}`" autofocus />
                  <button type="submit" class="btn btn-soft btn-sm">OK</button>
                </form>
                <template v-else>
                  <span class="min-w-0 flex-1 truncate text-sm">{{ n.t.nome }}</span>
                  <select class="input min-h-[32px] w-auto py-0.5 text-xs" :value="n.t.status" :aria-label="`Status de ${n.t.nome}`" @change="statusTopico(n.t, ($event.target as HTMLSelectElement).value as StatusProgresso)">
                    <option v-for="s in STATUS" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option>
                  </select>
                  <button type="button" class="btn-icon h-8 w-8" :aria-label="`Subir ${n.t.nome}`" @click="moverTopico(n.t, n.irmaos, -1)"><ArrowUp class="h-3.5 w-3.5" /></button>
                  <button type="button" class="btn-icon h-8 w-8" :aria-label="`Descer ${n.t.nome}`" @click="moverTopico(n.t, n.irmaos, 1)"><ArrowDown class="h-3.5 w-3.5" /></button>
                  <button type="button" class="btn-icon h-8 w-8" :aria-label="`Adicionar subtópico em ${n.t.nome}`" @click="subtopicoDe = n.t.id; subtopicoNome = ''"><Plus class="h-3.5 w-3.5" /></button>
                  <button type="button" class="btn-icon h-8 w-8" :aria-label="`Renomear ${n.t.nome}`" @click="topicoEdit = n.t.id; topicoEditNome = n.t.nome"><Pencil class="h-3.5 w-3.5" /></button>
                  <button type="button" class="btn-icon h-8 w-8" :aria-label="`Excluir ${n.t.nome}`" @click="excluirTopico(n.t)"><Trash2 class="h-3.5 w-3.5" /></button>
                </template>
              </div>
              <form v-if="subtopicoDe === n.t.id" class="mt-1.5 flex gap-2 pl-5" @submit.prevent="adicionarSub(d.id)">
                <input v-model="subtopicoNome" class="input min-h-[36px] py-1" placeholder="Novo subtópico" maxlength="120" aria-label="Nome do subtópico" autofocus />
                <button type="submit" class="btn btn-soft btn-sm" :disabled="!subtopicoNome.trim()">Adicionar</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="subtopicoDe = null">Cancelar</button>
              </form>
            </li>
          </ul>
          <p v-if="!arvore(d.id).length" class="text-xs text-muted">Nenhum tópico ainda. Adicione os conteúdos do edital abaixo.</p>
          <form v-if="!d.arquivada" class="flex gap-2 pt-1" @submit.prevent="adicionarTopico(d.id)">
            <input v-model="novoTopico[d.id]" class="input" placeholder="Novo tópico (ex.: Princípios fundamentais)" maxlength="120" :aria-label="`Novo tópico de ${d.nome}`" />
            <button type="submit" class="btn btn-soft shrink-0" :disabled="!(novoTopico[d.id] ?? '').trim()"><Plus class="h-4 w-4" />Tópico</button>
          </form>
        </div>
      </li>
    </ul>

    <BaseModal v-model="aberto" :titulo="editando ? 'Editar disciplina' : 'Nova disciplina'">
      <form id="form-disc" class="space-y-3" @submit.prevent="salvar">
        <FormField rotulo="Nome *" para="di-nome" :erro="erroNome"><input id="di-nome" v-model="f.nome" class="input" maxlength="80" autofocus /></FormField>
        <FormField rotulo="Descrição (opcional)" para="di-desc"><input id="di-desc" v-model="f.descricao" class="input" maxlength="200" /></FormField>
        <FormField rotulo="Status de progresso" para="di-status">
          <select id="di-status" v-model="f.status" class="input"><option v-for="s in STATUS" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option></select>
        </FormField>
        <fieldset>
          <legend class="label">Cor</legend>
          <div class="flex flex-wrap gap-2">
            <button v-for="c in coresDisciplina()" :key="c" type="button" class="h-8 w-8 rounded-full border-2 transition" :class="f.cor === c ? 'border-ink scale-110' : 'border-transparent'" :style="{ background: c }" :aria-label="`Cor ${c}`" :aria-pressed="f.cor === c" @click="f.cor = c" />
          </div>
        </fieldset>
        <FormField rotulo="Observações" para="di-obs"><textarea id="di-obs" v-model="f.observacoes" class="input" maxlength="2000" /></FormField>
      </form>
      <template #rodape>
        <button type="button" class="btn btn-outline" @click="aberto = false">Cancelar</button>
        <button type="submit" form="form-disc" class="btn btn-primary">Salvar</button>
      </template>
    </BaseModal>
  </div>
</template>
