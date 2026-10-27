<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { MetodoEstudo, Sessao } from '@/types'
import { METODOS } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { criarSessaoManual, validarSessaoManual } from '@/services/cronometro'
import { estaAberta } from '@/services/cronograma'
import { formatarHora, hoje } from '@/utils/datas'
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'
import ConcursoSelect from './ConcursoSelect.vue'
import DisciplinaSelect from './DisciplinaSelect.vue'
import FormField from './FormField.vue'
import TopicoSelect from './TopicoSelect.vue'

const props = defineProps<{ modelValue: boolean; sessao?: Sessao | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const dados = useDadosStore()
const config = useConfiguracoesStore()
const toast = useToast()

const f = reactive({
  data: hoje(), inicio: '08:00', duracaoMin: 50, concursoId: undefined as string | undefined, disciplinaId: undefined as string | undefined,
  topicoId: undefined as string | undefined, atividadeId: undefined as string | undefined, metodo: 'teoria' as MetodoEstudo, observacoes: ''
})
const erros = reactive<{ lista: string[] }>({ lista: [] })
const editando = computed(() => !!props.sessao)
const atividadesAbertas = computed(() =>
  dados.atividades.filter((a) => (!f.concursoId || a.concursoId === f.concursoId) && (estaAberta(a) || a.id === f.atividadeId))
)

watch(
  () => props.modelValue,
  (aberto) => {
    if (!aberto) return
    erros.lista = []
    const s = props.sessao
    if (s) {
      Object.assign(f, {
        data: s.data, inicio: formatarHora(s.inicio), duracaoMin: Math.round((s.duracaoSeg / 60) * 100) / 100, concursoId: s.concursoId,
        disciplinaId: s.disciplinaId, topicoId: s.topicoId, atividadeId: s.atividadeId, metodo: s.metodo, observacoes: s.observacoes
      })
    } else {
      Object.assign(f, {
        data: hoje(), inicio: formatarHora(Date.now()), duracaoMin: config.config.tempoPadraoSessaoMin, concursoId: undefined,
        disciplinaId: undefined, topicoId: undefined, atividadeId: undefined, metodo: 'teoria', observacoes: ''
      })
    }
  },
  { immediate: true }
)
watch(() => f.disciplinaId, (n, o) => {
  if (o !== undefined && n !== o) f.topicoId = undefined
}, { flush: 'sync' })

async function salvar() {
  const entrada = { ...f, observacoes: f.observacoes.trim() }
  erros.lista = validarSessaoManual(entrada)
  if (erros.lista.length) return
  const nova = criarSessaoManual(entrada)
  try {
    if (props.sessao) await dados.salvarSessao({ ...nova, id: props.sessao.id, criadoEm: props.sessao.criadoEm, manual: props.sessao.manual })
    else await dados.salvarSessao(nova)
    toast.sucesso(editando.value ? 'Sessão atualizada.' : 'Sessão registrada.')
    emit('update:modelValue', false)
  } catch {
    /* já notificado */
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" :titulo="editando ? 'Editar sessão' : 'Registrar sessão manualmente'" @update:model-value="emit('update:modelValue', $event)">
    <form id="form-sessao" class="space-y-3" @submit.prevent="salvar">
      <div class="grid grid-cols-3 gap-3">
        <FormField rotulo="Data" para="se-data"><input id="se-data" v-model="f.data" type="date" class="input" /></FormField>
        <FormField rotulo="Início" para="se-ini"><input id="se-ini" v-model="f.inicio" type="time" class="input" /></FormField>
        <FormField rotulo="Duração (min)" para="se-dur"><input id="se-dur" v-model.number="f.duracaoMin" type="number" min="1" step="1" inputmode="numeric" class="input" /></FormField>
      </div>
      <FormField rotulo="Concurso" para="se-conc"><ConcursoSelect id="se-conc" v-model="f.concursoId" /></FormField>
      <FormField rotulo="Disciplina" para="se-disc"><DisciplinaSelect id="se-disc" v-model="f.disciplinaId" :concurso-id="f.concursoId" permite-vazio rotulo-vazio="Sem disciplina" /></FormField>
      <FormField rotulo="Tópico" para="se-top"><TopicoSelect id="se-top" v-model="f.topicoId" :disciplina-id="f.disciplinaId" /></FormField>
      <FormField v-if="atividadesAbertas.length" rotulo="Atividade do cronograma (opcional)" para="se-ativ">
        <select id="se-ativ" v-model="f.atividadeId" class="input">
          <option :value="undefined">Nenhuma</option>
          <option v-for="a in atividadesAbertas" :key="a.id" :value="a.id">{{ a.dataPlanejada.split('-').reverse().slice(0, 2).join('/') }} · {{ dados.nomeDisciplina(a.disciplinaId) }}</option>
        </select>
      </FormField>
      <FormField rotulo="Método" para="se-met"><select id="se-met" v-model="f.metodo" class="input"><option v-for="m in METODOS" :key="m.valor" :value="m.valor">{{ m.rotulo }}</option></select></FormField>
      <FormField rotulo="Observações" para="se-obs"><textarea id="se-obs" v-model="f.observacoes" class="input" maxlength="1000" /></FormField>
      <ul v-if="erros.lista.length" class="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-900/30 dark:text-rose-100" role="alert"><li v-for="e in erros.lista" :key="e">{{ e }}</li></ul>
    </form>
    <template #rodape>
      <button type="button" class="btn btn-outline" @click="emit('update:modelValue', false)">Cancelar</button>
      <button type="submit" form="form-sessao" class="btn btn-primary">Salvar sessão</button>
    </template>
  </BaseModal>
</template>
