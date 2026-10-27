<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ modelValue: boolean; titulo: string; largura?: 'sm' | 'md' | 'lg'; persistente?: boolean }>(), {
  largura: 'md',
  persistente: false
})
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'fechou'): void }>()

const painel = ref<HTMLElement | null>(null)
let anterior: HTMLElement | null = null
const idTitulo = `modal-${Math.random().toString(36).slice(2, 8)}`

function fechar() {
  emit('update:modelValue', false)
  emit('fechou')
}

function focaveis(): HTMLElement[] {
  if (!painel.value) return []
  return Array.from(
    painel.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
  ).filter((el) => el.offsetParent !== null || el === document.activeElement)
}

function aoTeclar(e: KeyboardEvent) {
  if (e.key === 'Escape' && !props.persistente) {
    e.stopPropagation()
    fechar()
  } else if (e.key === 'Tab') {
    const f = focaveis()
    if (!f.length) return
    const primeiro = f[0]
    const ultimo = f[f.length - 1]
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primeiro.focus()
    }
  }
}

watch(
  () => props.modelValue,
  async (aberto) => {
    if (aberto) {
      anterior = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      await nextTick()
      const alvo = painel.value?.querySelector<HTMLElement>('[autofocus], input:not([type=hidden]), textarea, select') ?? painel.value
      alvo?.focus({ preventScroll: true })
    } else {
      document.body.style.overflow = ''
      anterior?.focus?.({ preventScroll: true })
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

const larguras = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center" @keydown="aoTeclar">
        <div class="absolute inset-0 bg-black/45 backdrop-blur-[1px]" @click="!persistente && fechar()" aria-hidden="true" />
        <div
          ref="painel"
          class="sheet-panel relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-card shadow-2xl outline-none sm:rounded-3xl"
          :class="larguras[largura]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="idTitulo"
          tabindex="-1"
        >
          <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 :id="idTitulo" class="text-base font-semibold">{{ titulo }}</h2>
            <button type="button" class="btn-icon -mr-2" aria-label="Fechar" @click="fechar"><X class="h-5 w-5" /></button>
          </header>
          <div class="overflow-y-auto px-5 py-4"><slot /></div>
          <footer v-if="$slots.rodape" class="safe-bottom flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
            <slot name="rodape" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
