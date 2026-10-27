<script setup lang="ts">
import { computed } from 'vue'
import { estadoConfirmacao, responderConfirmacao } from '@/composables/useConfirm'
import BaseModal from './BaseModal.vue'

const aberto = computed({
  get: () => estadoConfirmacao.aberto,
  set: (v: boolean) => {
    if (!v) responderConfirmacao(false)
  }
})
const p = computed(() => estadoConfirmacao.pedido)
</script>

<template>
  <BaseModal v-model="aberto" :titulo="p?.titulo ?? ''" largura="sm">
    <p class="whitespace-pre-line text-sm leading-relaxed text-muted">{{ p?.mensagem }}</p>
    <template #rodape>
      <button type="button" class="btn btn-outline" @click="responderConfirmacao(false)">{{ p?.cancelar ?? 'Cancelar' }}</button>
      <button type="button" class="btn" :class="p?.perigo ? 'btn-danger' : 'btn-primary'" @click="responderConfirmacao(true)">
        {{ p?.confirmar ?? 'Confirmar' }}
      </button>
    </template>
  </BaseModal>
</template>
