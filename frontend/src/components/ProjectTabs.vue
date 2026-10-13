<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { CalendarOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { ProjectView } from '@/types';
import { VERSION_STATUS_COLORS } from '@/utils/labels';
import { localizeDemoText } from '@/utils/demo-content';

const props = defineProps<{ project: ProjectView }>();
const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();

const activeKey = computed(() => {
  if (route.name === 'board') return 'board';
  if (route.name === 'task-list') return 'tasks';
  if (route.name === 'stats') return 'stats';
  return 'board';
});

function go(key: string) {
  router.push({
    name: key === 'board' ? 'board' : key === 'tasks' ? 'task-list' : 'stats',
    params: { id: props.project.id },
  });
}

const dateRange = computed(() => {
  void locale.value;
  const start = props.project.startDate;
  const end = props.project.endDate;
  if (!start && !end) return null;
  const fmt = (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD') : t('common.pending'));
  return `${fmt(start)} ~ ${fmt(end)}`;
});
</script>

<template>
  <div class="project-head">
    <div class="project-title">
      <router-link to="/projects" class="back">{{ t('projectTabs.allProjects') }}</router-link>
      <a-divider type="vertical" />
      <span class="name">{{ localizeDemoText(project.name) }}</span>
      <a-tag :color="VERSION_STATUS_COLORS[project.status]">
        {{ t(`labels.projectStatus.${project.status}`) }}
      </a-tag>
      <span v-if="dateRange" class="text-muted dates">
        <CalendarOutlined />
        {{ dateRange }}
      </span>
    </div>
    <a-tabs :active-key="activeKey" size="small" @change="(key: string | number) => go(String(key))">
      <a-tab-pane key="board" :tab="t('projectTabs.board')" />
      <a-tab-pane key="tasks" :tab="t('projectTabs.tasks')" />
      <a-tab-pane key="stats" :tab="t('projectTabs.stats')" />
    </a-tabs>
  </div>
</template>

<style scoped>
.project-head {
  margin-bottom: 4px;
}

.project-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.project-title .name {
  font-size: 20px;
  font-weight: 600;
}

.project-title .dates {
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
