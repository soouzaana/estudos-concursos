<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Download, FileImage, FileText } from 'lucide-vue-next'
import BaseModal from './BaseModal.vue'
import FormField from './FormField.vue'
import ConcursoSelect from './ConcursoSelect.vue'
import { useDadosStore } from '@/stores/dados'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { CAPACIDADE_PADRAO, intervaloDoPeriodo, montarPlanner, nomeBase, selecionarAtividades, validarOpcoes, type OpcoesExportacao, type PeriodoExport } from '@/services/exportacao'
import { baixarArquivo, criarPdf, renderizarPlanner, type ImagemPagina } from '@/services/exportarPlanner'
import { gerarTokens } from '@/services/tema'
import { hoje, formatarData } from '@/utils/datas'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ modelValue: boolean; concursoPadrao?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const dados = useDadosStore()
const config = useConfiguracoesStore()
const toast = useToast()

const f = reactive({
  concursoId: undefined as string | undefined,
  periodo: 'semana' as PeriodoExport,
  de: '',
  ate: '',
  horarios: true,
  metas: true,
  status: true,
  formato: 'pdf' as 'pdf' | 'png',
  orientacao: 'retrato' as 'retrato' | 'paisagem',
  aparencia: 'claro' as 'claro' | 'escuro'
})
const gerando = ref(false)
const erroGeracao = ref('')
const resultado = ref<{ nome: string; dataUrl: string }[]>([])

function iniciar() {
  f.concursoId = props.concursoPadrao
  f.periodo = 'semana'
  Object.assign(f, intervaloDoPeriodo('semana', hoje()))
  erroGeracao.value = ''
  resultado.value = []
}
watch(() => props.modelValue, (aberto) => aberto && iniciar(), { immediate: true })

function trocarPeriodo(p: PeriodoExport) {
  f.periodo = p
  Object.assign(f, intervaloDoPeriodo(p, f.de || hoje()))
}

const erro = computed(() => validarOpcoes(f))
const opcoes = computed<OpcoesExportacao>(() => ({ ...f }))
const dadosPlanner = computed(() => ({
  concursos: dados.concursos,
  disciplinas: dados.disciplinas,
  topicos: dados.topicos,
  atividades: dados.atividades,
  metas: config.config.metas
}))
const quantidade = computed(() => (erro.value ? 0 : selecionarAtividades(dadosPlanner.value, f).length))

async function gerar() {
  if (erro.value || gerando.value) return
  gerando.value = true
  erroGeracao.value = ''
  resultado.value = []
  try {
    const tokens = gerarTokens(config.config.paleta, config.config.corPersonalizada, f.aparencia)
    const geradoEm = formatarData(hoje())
    const base = nomeBase(f, dados.concursos)
    const a4 = f.formato === 'pdf' ? f.orientacao : undefined
    let capacidade = CAPACIDADE_PADRAO[f.orientacao]
    // Se alguma página estourar (textos longos), reduz a capacidade e repagina até nada ficar cortado.
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      const paginas = montarPlanner(opcoes.value, dadosPlanner.value, capacidade)
      const { imagens, cortado } = await renderizarPlanner({ paginas, tokens, geradoEm, a4 })
      if (cortado) {
        capacidade -= 2
        if (capacidade < 4) throw new Error('Não foi possível ajustar o conteúdo às páginas.')
        continue
      }
      await entregar(imagens, base)
      return
    }
    throw new Error('Não foi possível ajustar o conteúdo às páginas.')
  } catch (e) {
    erroGeracao.value = `Não foi possível gerar o arquivo: ${(e as Error).message}`
  } finally {
    gerando.value = false
  }
}

async function entregar(imagens: ImagemPagina[], base: string) {
  if (f.formato === 'pdf') {
    const blob = await criarPdf(imagens, f.orientacao, base)
    baixarArquivo(blob, `${base}.pdf`)
    toast.sucesso(`PDF gerado com ${imagens.length} página(s).`)
  } else {
    resultado.value = imagens.map((img, i) => ({ nome: `${base}${imagens.length > 1 ? `-parte-${i + 1}` : ''}.png`, dataUrl: img.dataUrl }))
    resultado.value.forEach((r, i) => setTimeout(() => baixarArquivo(r.dataUrl, r.nome), i * 350))
    toast.sucesso(`${imagens.length} imagem(ns) PNG gerada(s).`)
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" titulo="Exportar cronograma" largura="md" @update:model-value="emit('update:modelValue', $event)">
    <form class="space-y-4" @submit.prevent="gerar">
      <FormField rotulo="Concurso" para="ex-conc"><ConcursoSelect id="ex-conc" v-model="f.concursoId" incluir-todos :so-abertos="false" /></FormField>

      <div>
        <p class="label">Período</p>
        <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de período">
          <button v-for="p in ([['dia', 'Diário'], ['semana', 'Semanal'], ['mes', 'Mensal']] as const)" :key="p[0]" type="button" role="radio" :aria-checked="f.periodo === p[0]" class="btn btn-outline btn-sm" :class="f.periodo === p[0] && 'ring-2 ring-brand-500'" @click="trocarPeriodo(p[0])">{{ p[1] }}</button>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <FormField rotulo="Data inicial" para="ex-de"><input id="ex-de" v-model="f.de" type="date" class="input" /></FormField>
        <FormField rotulo="Data final" para="ex-ate"><input id="ex-ate" v-model="f.ate" type="date" class="input" /></FormField>
      </div>
      <p v-if="erro" class="text-xs text-rose-600 dark:text-rose-300" role="alert">{{ erro }}</p>
      <p v-else class="text-xs text-muted" aria-live="polite">{{ quantidade }} atividade(s) neste período.</p>

      <fieldset class="space-y-2">
        <legend class="label">Incluir</legend>
        <label class="flex min-h-[36px] items-center gap-2 text-sm"><input v-model="f.horarios" type="checkbox" class="h-4 w-4" />Horários</label>
        <label class="flex min-h-[36px] items-center gap-2 text-sm"><input v-model="f.metas" type="checkbox" class="h-4 w-4" />Metas e resumo do período</label>
        <label class="flex min-h-[36px] items-center gap-2 text-sm"><input v-model="f.status" type="checkbox" class="h-4 w-4" />Status e legenda</label>
      </fieldset>

      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <p class="label">Formato</p>
          <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Formato do arquivo">
            <button type="button" role="radio" :aria-checked="f.formato === 'pdf'" class="btn btn-outline btn-sm" :class="f.formato === 'pdf' && 'ring-2 ring-brand-500'" @click="f.formato = 'pdf'"><FileText class="h-4 w-4" />PDF</button>
            <button type="button" role="radio" :aria-checked="f.formato === 'png'" class="btn btn-outline btn-sm" :class="f.formato === 'png' && 'ring-2 ring-brand-500'" @click="f.formato = 'png'"><FileImage class="h-4 w-4" />PNG</button>
          </div>
        </div>
        <FormField v-if="f.formato === 'pdf'" rotulo="Orientação (A4)" para="ex-ori">
          <select id="ex-ori" v-model="f.orientacao" class="input"><option value="retrato">Retrato</option><option value="paisagem">Paisagem</option></select>
        </FormField>
        <FormField rotulo="Aparência" para="ex-apa" dica="Claro economiza tinta ao imprimir.">
          <select id="ex-apa" v-model="f.aparencia" class="input"><option value="claro">Claro</option><option value="escuro">Escuro</option></select>
        </FormField>
      </div>
      <p class="text-xs text-muted">O planner usa a cor do seu tema. No PDF o texto é gravado como imagem de alta resolução (não é selecionável). Nada é enviado para fora do seu dispositivo.</p>

      <p v-if="erroGeracao" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:bg-rose-900/30 dark:text-rose-100" role="alert">{{ erroGeracao }}</p>

      <ul v-if="resultado.length" class="space-y-1 text-sm" aria-label="Imagens geradas">
        <li v-for="r in resultado" :key="r.nome" class="flex items-center justify-between gap-2">
          <span class="truncate">{{ r.nome }}</span>
          <a :href="r.dataUrl" :download="r.nome" class="btn btn-soft btn-sm">Baixar de novo</a>
        </li>
      </ul>
    </form>
    <template #rodape>
      <button type="button" class="btn btn-ghost" @click="emit('update:modelValue', false)">Fechar</button>
      <button type="button" class="btn btn-primary" :disabled="!!erro || gerando || quantidade === 0" @click="gerar"><Download class="h-4 w-4" />{{ gerando ? 'Gerando…' : `Exportar ${f.formato.toUpperCase()}` }}</button>
    </template>
  </BaseModal>
</template>
