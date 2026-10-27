<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import type { BlocoQuestoes, Erro } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { totaisQuestoes } from '@/services/stats'
import { calcularAproveitamento, calcularErros, formatarPercentual, validarQuestoes } from '@/utils/validacao'
import { formatarData, hoje } from '@/utils/datas'
import { confirmar } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/BaseModal.vue'
import ConcursoMulti from '@/components/ConcursoMulti.vue'
import ConcursoSelect from '@/components/ConcursoSelect.vue'
import DisciplinaSelect from '@/components/DisciplinaSelect.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErroForm from '@/components/ErroForm.vue'
import FormField from '@/components/FormField.vue'
import StatCard from '@/components/StatCard.vue'
import TopicoSelect from '@/components/TopicoSelect.vue'

const dados = useDadosStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()

/* ---- lista e filtros ---- */
const filtro = reactive({ concursoId: undefined as string | undefined, disciplinaId: undefined as string | undefined, de: '', ate: '' })
const limite = ref(30)
const lista = computed(() =>
  dados.questoes
    .filter(
      (b) =>
        (!filtro.concursoId || b.concursoIds.includes(filtro.concursoId)) && (!filtro.disciplinaId || b.disciplinaId === filtro.disciplinaId) &&
        (!filtro.de || b.data >= filtro.de) && (!filtro.ate || b.data <= filtro.ate)
    )
    .sort((a, b) => (a.data === b.data ? b.criadoEm - a.criadoEm : a.data < b.data ? 1 : -1))
)
const totais = computed(() => totaisQuestoes(lista.value))

/* ---- formulário ---- */
const aberto = ref(false)
const editando = ref<BlocoQuestoes | null>(null)
const f = reactive({
  data: hoje(), disciplinaId: undefined as string | undefined, topicoId: undefined as string | undefined, fonte: '', total: 10,
  acertos: 0, observacoes: ''
})
const concursoIds = ref<string[]>([])
const erros = ref<string[]>([])
const errosCalc = computed(() => calcularErros(Number(f.total) || 0, Number(f.acertos) || 0))
const aprov = computed(() => calcularAproveitamento(Number(f.acertos) || 0, Number(f.total) || 0))
watch(() => f.disciplinaId, (n, o) => {
  if (o !== undefined && n !== o) f.topicoId = undefined
}, { flush: 'sync' })

function novo(pre: { concurso?: string; disciplina?: string; topico?: string } = {}) {
  editando.value = null
  Object.assign(f, { data: hoje(), disciplinaId: pre.disciplina, topicoId: pre.topico, fonte: '', total: 10, acertos: 0, observacoes: '' })
  concursoIds.value = pre.concurso ? [pre.concurso] : []
  erros.value = []
  aberto.value = true
  if (pre.topico) f.topicoId = pre.topico
}
function editar(b: BlocoQuestoes) {
  editando.value = b
  Object.assign(f, { data: b.data, disciplinaId: b.disciplinaId, topicoId: b.topicoId, fonte: b.fonte, total: b.total, acertos: b.acertos, observacoes: b.observacoes })
  concursoIds.value = [...b.concursoIds]
  erros.value = []
  aberto.value = true
}

/* ---- erros do bloco ---- */
const erroAberto = ref(false)
const erroInicial = ref<Partial<Erro>>({})
const erroRestantes = ref(0)
const erroBloco = ref<BlocoQuestoes | null>(null)

async function salvar() {
  const v = validarQuestoes({ data: f.data, concursoIds: concursoIds.value, disciplinaId: f.disciplinaId ?? '', total: Number(f.total), acertos: Number(f.acertos), fonte: f.fonte })
  erros.value = v.erros
  if (!v.ok) return
  try {
    const bloco = await dados.salvarBloco({
      id: editando.value?.id, data: f.data, concursoIds: [...concursoIds.value], disciplinaId: f.disciplinaId!, topicoId: f.topicoId, fonte: f.fonte.trim(),
      total: Number(f.total), acertos: Number(f.acertos), observacoes: f.observacoes.trim()
    })
    aberto.value = false
    toast.sucesso('Bloco de questões salvo.')
    const nErros = calcularErros(bloco.total, bloco.acertos)
    const jaCadastrados = dados.erros.filter((e) => e.blocoId === bloco.id).length
    const faltam = nErros - jaCadastrados
    if (faltam > 0) {
      const ok = await confirmar({
        titulo: 'Cadastrar os erros no caderno?',
        mensagem: `Você errou ${nErros} questão(ões) neste bloco${jaCadastrados ? ` (${jaCadastrados} já no caderno)` : ''}. Quer registrar ${faltam === 1 ? 'a que falta' : 'as que faltam'} agora? Disciplina, tópico, concursos e fonte já vão preenchidos.`,
        confirmar: 'Cadastrar agora',
        cancelar: 'Depois'
      })
      if (ok) abrirErroDoBloco(bloco, faltam)
    }
  } catch {
    /* já notificado */
  }
}
function abrirErroDoBloco(b: BlocoQuestoes, restantes: number) {
  erroBloco.value = b
  erroRestantes.value = restantes
  erroInicial.value = { blocoId: b.id, disciplinaId: b.disciplinaId, topicoId: b.topicoId, concursoIds: [...b.concursoIds], fonte: b.fonte, data: b.data }
  erroAberto.value = true
}
function aoSalvarErro(_: Erro, continuar: boolean) {
  erroRestantes.value = Math.max(0, erroRestantes.value - 1)
  if (continuar && erroBloco.value) {
    // reabre o formulário limpo, mantendo o contexto do bloco
    erroAberto.value = false
    setTimeout(() => (erroAberto.value = true), 0)
  }
}

async function excluir(b: BlocoQuestoes) {
  const ok = await confirmar({ titulo: 'Excluir bloco de questões?', mensagem: `${b.total} questões em ${formatarData(b.data)} deixarão de contar nas estatísticas. Erros já cadastrados no caderno são mantidos.`, confirmar: 'Excluir', perigo: true })
  if (ok) await dados.excluirBloco(b.id).catch(() => undefined)
}

onMounted(() => {
  if (route.query.novo) {
    novo({ concurso: route.query.concurso as string | undefined, disciplina: route.query.disciplina as string | undefined, topico: route.query.topico as string | undefined })
    router.replace({ path: '/questoes' })
  }
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="page-title hidden lg:block">Questões</h1>
        <p class="text-sm text-muted">Registre blocos de questões; erros = total − acertos, calculado automaticamente.</p>
      </div>
      <button type="button" class="btn btn-primary" @click="novo()"><Plus class="h-4 w-4" />Registrar questões</button>
    </div>

    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Totais do filtro atual">
      <StatCard rotulo="Resolvidas" :valor="String(totais.total)" />
      <StatCard rotulo="Acertos" :valor="String(totais.acertos)" />
      <StatCard rotulo="Erros" :valor="String(totais.erros)" />
      <StatCard rotulo="Aproveitamento" :valor="formatarPercentual(totais.aproveitamento)" detalhe="acertos ÷ total" />
    </section>

    <div class="grid gap-2 sm:grid-cols-4">
      <ConcursoSelect v-model="filtro.concursoId" incluir-todos :so-abertos="false" aria-label="Filtrar por concurso" />
      <select v-model="filtro.disciplinaId" class="input" aria-label="Filtrar por disciplina"><option :value="undefined">Todas as disciplinas</option><option v-for="d in dados.disciplinas" :key="d.id" :value="d.id">{{ d.nome }}</option></select>
      <input v-model="filtro.de" type="date" class="input" aria-label="De" />
      <input v-model="filtro.ate" type="date" class="input" aria-label="Até" />
    </div>

    <EmptyState v-if="!dados.questoes.length" titulo="Nenhuma questão registrada" texto="Depois de resolver questões, registre aqui o total e os acertos. Você pode cadastrar os erros no caderno em seguida.">
      <template #icone><ListChecks class="h-6 w-6" /></template>
      <button type="button" class="btn btn-primary" @click="novo()"><Plus class="h-4 w-4" />Registrar questões</button>
    </EmptyState>
    <p v-else-if="!lista.length" class="py-6 text-center text-sm text-muted">Nenhum registro com esses filtros.</p>
    <ul v-else class="card divide-line">
      <li v-for="b in lista.slice(0, limite)" :key="b.id" class="flex items-center gap-3 p-3">
        <span class="h-9 w-1.5 shrink-0 rounded-full" :style="{ background: dados.corDisciplina(b.disciplinaId) }" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ dados.nomeDisciplina(b.disciplinaId) }}<span v-if="b.topicoId" class="font-normal text-muted"> · {{ dados.nomeTopico(b.topicoId) }}</span></p>
          <p class="truncate text-xs text-muted">{{ formatarData(b.data) }}<template v-if="b.fonte"> · {{ b.fonte }}</template><template v-if="b.concursoIds.length"> · {{ b.concursoIds.map((id) => dados.nomeConcurso(id)).join(', ') }}</template></p>
        </div>
        <div class="text-right text-xs">
          <p class="text-sm font-semibold tabular-nums">{{ b.acertos }}/{{ b.total }}</p>
          <p class="text-muted">{{ formatarPercentual(calcularAproveitamento(b.acertos, b.total)) }}</p>
        </div>
        <button v-if="b.total - b.acertos > dados.erros.filter((e) => e.blocoId === b.id).length" type="button" class="btn btn-soft btn-sm hidden sm:inline-flex" @click="abrirErroDoBloco(b, b.total - b.acertos - dados.erros.filter((e) => e.blocoId === b.id).length)">+ Erros</button>
        <button type="button" class="btn-icon" aria-label="Editar bloco" @click="editar(b)"><Pencil class="h-4 w-4" /></button>
        <button type="button" class="btn-icon" aria-label="Excluir bloco" @click="excluir(b)"><Trash2 class="h-4 w-4" /></button>
      </li>
    </ul>
    <button v-if="lista.length > limite" type="button" class="btn btn-outline w-full" @click="limite += 30">Mostrar mais</button>

    <BaseModal v-model="aberto" :titulo="editando ? 'Editar bloco de questões' : 'Registrar questões'">
      <form id="form-bloco" class="space-y-3" @submit.prevent="salvar">
        <FormField rotulo="Data" para="qu-data"><input id="qu-data" v-model="f.data" type="date" class="input" /></FormField>
        <FormField rotulo="Disciplina *" para="qu-disc"><DisciplinaSelect id="qu-disc" v-model="f.disciplinaId" :concurso-id="concursoIds[0]" /></FormField>
        <FormField rotulo="Tópico" para="qu-top"><TopicoSelect id="qu-top" v-model="f.topicoId" :disciplina-id="f.disciplinaId" /></FormField>
        <FormField rotulo="Concursos associados" para="qu-conc" dica="Se marcar mais de um, o bloco aparece em cada concurso, mas é contado uma única vez no geral."><ConcursoMulti v-model="concursoIds" /></FormField>
        <FormField rotulo="Fonte ou plataforma" para="qu-fonte"><input id="qu-fonte" v-model="f.fonte" class="input" maxlength="120" /></FormField>
        <div class="grid grid-cols-2 gap-3">
          <FormField rotulo="Total de questões *" para="qu-total"><input id="qu-total" v-model.number="f.total" type="number" min="1" step="1" inputmode="numeric" class="input" /></FormField>
          <FormField rotulo="Acertos *" para="qu-ac"><input id="qu-ac" v-model.number="f.acertos" type="number" min="0" step="1" inputmode="numeric" class="input" /></FormField>
        </div>
        <div class="flex items-center justify-between rounded-xl bg-line/40 px-3 py-2 text-sm" aria-live="polite">
          <span>Erros: <strong>{{ errosCalc }}</strong></span>
          <span>Aproveitamento: <strong>{{ formatarPercentual(aprov) }}</strong></span>
        </div>
        <FormField rotulo="Observações" para="qu-obs"><textarea id="qu-obs" v-model="f.observacoes" class="input" maxlength="1000" /></FormField>
        <ul v-if="erros.length" class="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-900/30 dark:text-rose-100" role="alert"><li v-for="e in erros" :key="e">{{ e }}</li></ul>
      </form>
      <template #rodape>
        <button type="button" class="btn btn-outline" @click="aberto = false">Cancelar</button>
        <button type="submit" form="form-bloco" class="btn btn-primary">Salvar</button>
      </template>
    </BaseModal>

    <ErroForm v-model="erroAberto" :inicial="erroInicial" :restantes="erroRestantes" @salvo="aoSalvarErro" />
  </div>
</template>
