<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { useConfiguracoesStore } from '@/stores/configuracoes'

use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const props = withDefaults(defineProps<{ option: EChartsOption; altura?: string; rotulo: string }>(), { altura: '240px' })
const config = useConfiguracoesStore()

const opcao = computed<EChartsOption>(() => {
  const escuro = config.modoAtual === 'escuro'
  const texto = escuro ? '#c9c5dc' : '#5a556e'
  const linha = escuro ? '#3a3650' : '#e8e4f4'
  return {
    color: config.coresDeGrafico,
    textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: texto },
    animationDuration: 400,
    ...props.option,
    // Eixos herdam cores do tema quando não definidos.
    ...(props.option.xAxis ? { xAxis: aplicarEixo(props.option.xAxis, texto, linha) } : {}),
    ...(props.option.yAxis ? { yAxis: aplicarEixo(props.option.yAxis, texto, linha) } : {})
  } as EChartsOption
})

function aplicarEixo(eixo: unknown, texto: string, linha: string): unknown {
  const um = (e: Record<string, unknown>) => ({
    ...e,
    axisLabel: { color: texto, ...(e.axisLabel as object) },
    axisLine: { lineStyle: { color: linha } },
    splitLine: { lineStyle: { color: linha } }
  })
  return Array.isArray(eixo) ? eixo.map((e) => um(e as Record<string, unknown>)) : um(eixo as Record<string, unknown>)
}
</script>

<template>
  <div role="img" :aria-label="rotulo" :style="{ height: altura }">
    <VChart :option="opcao" autoresize class="h-full w-full" />
  </div>
</template>
