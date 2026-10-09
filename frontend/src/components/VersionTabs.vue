<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CalendarOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { VersionView } from '@/types';
import { VERSION_STATUS_COLORS, VERSION_STATUS_LABELS } from '@/utils/labels';

const props = defineProps<{ version: VersionView }>();
const route = useRoute();
const router = useRouter();

const activeKey = computed(() => {
  if (route.name === 'board') return 'board';
  if (route.name === 'task-list') return 'tasks';
  if (route.name === 'stats') return 'stats';
  return 'board';
});

function go(key: string) {
  router.push({ name: key === 'board' ? 'board' : key === 'tasks' ? 'task-list' : 'stats', params: { id: props.version.id } });
}

const dateRange = computed(() => {
  const start = props.version.testStartDate;
  const end = props.version.plannedReleaseDate;
  if (!start && !end) return null;
  const fmt = (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD') : '待定');
  return `${fmt(start)} ~ ${fmt(end)}`;
});
</script>

<template>
  <div class="version-head">
    <div class="version-title">
      <router-link to="/versions" class="back">全部版本</router-link>
      <a-divider type="vertical" />
      <span class="name">{{ version.name }}</span>
      <a-tag :color="VERSION_STATUS_COLORS[version.status]">
        {{ VERSION_STATUS_LABELS[version.status] }}
      </a-tag>
      <span v-if="dateRange" class="text-muted dates">
        <CalendarOutlined />
        {{ dateRange }}
      </span>
    </div>
    <a-tabs :active-key="activeKey" size="small" @change="(key: string | number) => go(String(key))">
      <a-tab-pane key="board" tab="看板" />
      <a-tab-pane key="tasks" tab="任务列表" />
      <a-tab-pane key="stats" tab="统计" />
    </a-tabs>
  </div>
</template>

<style scoped>
.version-head {
  margin-bottom: 4px;
}

.version-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.version-title .name {
  font-size: 20px;
  font-weight: 600;
}

.version-title .dates {
  font-size: 12px;
  margin-left: 4px;
}

.back {
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
}

:deep(.ant-tabs) {
  margin-bottom: 0;
}
</style>
