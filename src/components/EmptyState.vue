<script setup lang="ts">
defineProps<{ titulo: string; texto?: string }>()
</script>

<template>
  <div class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
    <div v-if="$slots.icone" class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100/70 text-accent dark:bg-brand-900/40"><slot name="icone" /></div>
    <h3 class="text-sm font-semibold">{{ titulo }}</h3>
    <p v-if="texto" class="max-w-sm text-sm leading-relaxed text-muted">{{ texto }}</p>
    <div v-if="$slots.default" class="mt-1 flex flex-wrap justify-center gap-2"><slot /></div>
  </div>
</template>
