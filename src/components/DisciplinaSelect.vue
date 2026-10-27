<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useDadosStore } from '@/stores/dados'
import { useToast } from '@/composables/useToast'

const props = withDefaults(
  defineProps<{ modelValue?: string; concursoId?: string; permiteVazio?: boolean; rotuloVazio?: string; id?: string; incluirArquivadaId?: string }>(),
  { permiteVazio: false, rotuloVazio: 'Selecione…' }
)
const emit = defineEmits<{ (e: 'update:modelValue', v: string | undefined): void }>()
const dados = useDadosStore()
const toast = useToast()

const NOVA = '__nova__'
const criando = ref(false)
const nome = ref('')

/** Disciplinas do concurso (se informado) vêm primeiro; as demais ficam em outro grupo. */
const doConcurso = computed(() => (props.concursoId ? dados.disciplinasDoConcurso(props.concursoId) : []))
const outras = computed(() => {
  const ids = new Set(doConcurso.value.map((d) => d.id))
  return dados.disciplinasAtivas.filter((d) => !ids.has(d.id))
})
const arquivadaAtual = computed(() => {
  const id = props.incluirArquivadaId ?? props.modelValue
  const d = id ? dados.disciplinaPorId.get(id) : undefined
  return d?.arquivada ? d : undefined
})

function aoMudar(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (v === NOVA) {
    criando.value = true
    ;(e.target as HTMLSelectElement).value = props.modelValue ?? ''
    return
  }
  emit('update:modelValue', v || undefined)
}

async function criar() {
  if (!nome.value.trim()) return
  try {
    const d = await dados.criarDisciplina(nome.value, props.concursoId)
    emit('update:modelValue', d.id)
    nome.value = ''
    criando.value = false
    toast.sucesso(`Disciplina "${d.nome}" cadastrada.`)
  } catch {
    /* erro já notificado pelo store */
  }
}
</script>

<template>
  <div class="space-y-2">
    <select :id="id" class="input" :value="modelValue ?? ''" @change="aoMudar">
      <option v-if="permiteVazio" value="">{{ rotuloVazio }}</option>
      <option v-else value="" disabled>{{ rotuloVazio }}</option>
      <option v-if="arquivadaAtual" :value="arquivadaAtual.id">{{ arquivadaAtual.nome }} (arquivada)</option>
      <optgroup v-if="doConcurso.length" label="Deste concurso">
        <option v-for="d in doConcurso" :key="d.id" :value="d.id">{{ d.nome }}</option>
      </optgroup>
      <optgroup v-if="outras.length" :label="doConcurso.length ? 'Outras disciplinas' : 'Disciplinas'">
        <option v-for="d in outras" :key="d.id" :value="d.id">{{ d.nome }}</option>
      </optgroup>
      <option :value="NOVA">＋ Nova disciplina…</option>
    </select>
    <form v-if="criando" class="flex gap-2" @submit.prevent="criar">
      <input v-model="nome" class="input" placeholder="Nome da nova disciplina" autofocus maxlength="80" aria-label="Nome da nova disciplina" />
      <button type="submit" class="btn btn-primary shrink-0" :disabled="!nome.trim()"><Plus class="h-4 w-4" />Criar</button>
      <button type="button" class="btn btn-ghost shrink-0" @click="criando = false">Cancelar</button>
    </form>
  </div>
</template>
