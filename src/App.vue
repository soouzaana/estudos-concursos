<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { useDadosStore } from '@/stores/dados'
import { useCronometroStore } from '@/stores/cronometro'
import AppLayout from '@/layouts/AppLayout.vue'
import ToastHost from '@/components/ToastHost.vue'
import ConfirmHost from '@/components/ConfirmHost.vue'

const config = useConfiguracoesStore()
const dados = useDadosStore()
const cron = useCronometroStore()
const pronto = ref(false)

onMounted(async () => {
  await Promise.all([config.carregar(), dados.carregar(), cron.carregar()])
  pronto.value = true
})
</script>

<template>
  <div v-if="!pronto" class="flex min-h-[100dvh] items-center justify-center text-sm text-muted" role="status">Carregando seus estudos…</div>
  <AppLayout v-else />
  <ToastHost />
  <ConfirmHost />
</template>
