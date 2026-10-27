<script setup lang="ts">
defineProps<{ rotulo: string; valor: string; detalhe?: string }>()
</script>

<template>
  <div class="card card-pad">
    <p class="text-xs font-medium text-muted">{{ rotulo }}</p>
    <p class="mt-1 text-2xl font-semibold tracking-tight">{{ valor }}</p>
    <p v-if="detalhe" class="mt-0.5 text-xs text-muted">{{ detalhe }}</p>
    <slot />
  </div>
</template>
