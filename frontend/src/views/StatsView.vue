<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { message } from 'ant-design-vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import type { ProjectStats, ProjectView } from '@/types';
import { statsApi, projectsApi } from '@/api';
import { errorText } from '@/api/http';
import ProjectTabs from '@/components/ProjectTabs.vue';
import ProgressSummary from '@/components/ProgressSummary.vue';
import EChart from '@/components/EChart.vue';
import type { EChartsOption } from 'echarts';
import { PRIORITY_COLORS, SEMANTIC, TASK_STATUS_BAR_COLORS } from '@/utils/labels';

const route = useRoute();
const projectId = computed(() => String(route.params.id ?? ''));

const project = ref<ProjectView | null>(null);
const stats = ref<ProjectStats | null>(null);
const loading = ref(false);

const statusOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} 个（{d}%）' },
  legend: { bottom: 0, icon: 'circle' },
  series: [
    {
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      label: { formatter: '{b}\n{c}' },
      data: (stats.value?.byStatus ?? [])
        .filter((item) => item.count > 0)
        .map((item) => ({
          name: item.label,
          value: item.count,
          itemStyle: { color: TASK_STATUS_BAR_COLORS[item.status] },
        })),
    },
  ],
}));

const priorityOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
  xAxis: { type: 'value', minInterval: 1 },
  yAxis: {
    type: 'category',
    data: (stats.value?.byPriority ?? []).map((item) => item.label).reverse(),
  },
  series: [
    {
      type: 'bar',
      barWidth: 18,
      label: { show: true, position: 'right' },
      data: (stats.value?.byPriority ?? [])
        .map((item) => ({ value: item.count, itemStyle: { color: PRIORITY_COLORS[item.priority] } }))
        .reverse(),
    },
  ],
}));

const assigneeOption = computed<EChartsOption>(() => {
  const rows = stats.value?.byAssignee ?? [];
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, data: ['任务数', '平均进度'] },
    grid: { left: 8, right: 16, top: 24, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: rows.map((item) => item.label), axisLabel: { interval: 0, rotate: rows.length > 6 ? 25 : 0 } },
    yAxis: [
      { type: 'value', name: '任务数', minInterval: 1 },
      { type: 'value', name: '进度%', max: 100, min: 0 },
    ],
    series: [
      { name: '任务数', type: 'bar', barWidth: 20, data: rows.map((item) => item.total), itemStyle: { color: SEMANTIC.brand } },
      {
        name: '平均进度',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 7,
        data: rows.map((item) => item.avgProgress),
        itemStyle: { color: SEMANTIC.warn },
      },
    ],
  };
});

async function load() {
  const id = projectId.value;
  if (!id) return;
  loading.value = true;
  try {
    const [projectData, statsData] = await Promise.all([projectsApi.get(id), statsApi.byProject(id)]);
    project.value = projectData;
    stats.value = statsData;
  } catch (error) {
    message.error(errorText(error, '加载统计失败'));
  } finally {
    loading.value = false;
  }
}

watch(projectId, load);
onMounted(load);
</script>

<template>
  <div class="page">
    <ProjectTabs v-if="project" :project="project" />

    <div class="toolbar" style="margin: 8px 0 12px">
      <a-button size="small" :loading="loading" @click="load">
        <ReloadOutlined />
        刷新
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <a-card size="small" title="总体进度" style="margin-bottom: 12px">
        <ProgressSummary :summary="stats?.summary ?? null" show-status-breakdown />
      </a-card>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-card size="small" title="状态分布">
            <EChart v-if="stats" :option="statusOption" />
          </a-card>
        </a-col>
        <a-col :span="12">
          <a-card size="small" title="优先级分布">
            <EChart v-if="stats" :option="priorityOption" />
          </a-card>
        </a-col>
      </a-row>

      <a-card size="small" title="各负责人任务数与平均进度" style="margin-top: 12px">
        <EChart v-if="stats" :option="assigneeOption" height="320px" />
      </a-card>
    </a-spin>
  </div>
</template>
