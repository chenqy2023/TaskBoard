<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';

const props = withDefaults(defineProps<{ option: echarts.EChartsOption; height?: string }>(), {
  height: '280px',
});

const container = ref<HTMLDivElement>();
let chart: echarts.ECharts | null = null;

function render() {
  if (!container.value) return;
  if (!chart) chart = echarts.init(container.value);
  chart.setOption(props.option, true);
}

function resize() {
  chart?.resize();
}

onMounted(() => {
  render();
  window.addEventListener('resize', resize);
});

watch(() => props.option, render, { deep: true });

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="container" :style="{ height, width: '100%' }" />
</template>
