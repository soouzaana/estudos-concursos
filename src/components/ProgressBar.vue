<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ valor: number | null; cor?: string; altura?: string; rotulo?: string }>(), { altura: 'h-2' })
const pct = computed(() => Math.min(100, Math.max(0, props.valor ?? 0)))
</script>

<template>
  <div class="w-full overflow-hidden rounded-full bg-line" :class="altura" role="progressbar" :aria-valuenow="Math.round(pct)" aria-valuemin="0" aria-valuemax="100" :aria-label="rotulo ?? 'Progresso'">
    <div class="h-full rounded-full transition-all duration-500" :class="cor ? '' : 'bg-brand-500'" :style="{ width: pct + '%', background: cor }" />
  </div>
</template>
