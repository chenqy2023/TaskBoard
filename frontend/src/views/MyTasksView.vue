<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { Priority, TaskStatus, TaskView, User } from '@/types';
import { tasksApi, usersApi } from '@/api';
import { errorText } from '@/api/http';
import {
  SEMANTIC,
  TASK_STATUS_BAR_COLORS,
  TASK_STATUS_COLORS,
  priorityColor,
  progressColor,
} from '@/utils/labels';
import { localizeDemoText } from '@/utils/demo-content';
import TaskDetailModal from '@/components/TaskDetailModal.vue';
import TaskFormModal from '@/components/TaskFormModal.vue';

const router = useRouter();
const tasks = ref<TaskView[]>([]);
const users = ref<User[]>([]);
const { t, locale } = useI18n();
const loading = ref(false);
const detailOpen = ref(false);
const detailTask = ref<TaskView | null>(null);
const formOpen = ref(false);
const editingTask = ref<TaskView | null>(null);

const groups = computed(() => {
  void locale.value;
  const today = dayjs().format('YYYY-MM-DD');
  const overdue: TaskView[] = [];
  const soon: TaskView[] = [];
  const normal: TaskView[] = [];
  const noDue: TaskView[] = [];

  for (const task of tasks.value) {
    if (!task.plannedEndDate) {
      noDue.push(task);
    } else if (task.plannedEndDate < today) {
      overdue.push(task);
    } else if (dayjs(task.plannedEndDate).diff(dayjs(today), 'day') <= 3) {
      soon.push(task);
    } else {
      normal.push(task);
    }
  }

  return [
    { key: 'overdue', title: t('myTasks.groupOverdue'), color: SEMANTIC.danger, tasks: overdue },
    { key: 'soon', title: t('myTasks.groupSoon'), color: SEMANTIC.warn, tasks: soon },
    { key: 'normal', title: t('myTasks.groupNormal'), color: SEMANTIC.brand, tasks: normal },
    { key: 'noDue', title: t('myTasks.groupNoDue'), color: TASK_STATUS_BAR_COLORS.TODO, tasks: noDue },
  ].filter((group) => group.tasks.length > 0);
});

async function load() {
  loading.value = true;
  try {
    const [list, userList] = await Promise.all([tasksApi.my(), usersApi.list()]);
    tasks.value = list;
    users.value = userList;
  } catch (error) {
    message.error(errorText(error, t('myTasks.loadFailed')));
  } finally {
    loading.value = false;
  }
}

function openDetail(task: TaskView) {
  detailTask.value = task;
  detailOpen.value = true;
}

async function openProject(task: TaskView) {
  if (task.project) await router.push({ name: 'board', params: { id: task.project.id } });
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ t('nav.myTasks') }}</h2>
        <p class="page-subtitle">{{ t('myTasks.subtitle') }}</p>
      </div>
      <a-button :loading="loading" @click="load">
        <ReloadOutlined />
        {{ t('common.refresh') }}
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="tasks.length === 0" :description="t('myTasks.empty')" />

      <a-card v-for="group in groups" :key="group.key" size="small" style="margin-bottom: 12px">
        <template #title>
          <span class="group-dot" :style="{ background: group.color }" />
          {{ group.title }}
          <a-tag style="margin-left: 6px">{{ group.tasks.length }}</a-tag>
        </template>

        <a-list :data-source="group.tasks" size="small">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta>
                <template #title>
                  <a @click="openDetail(item)">{{ localizeDemoText(item.title) }}</a>
                  <a-tag v-if="item.project" style="margin-left: 8px" @click="openProject(item)">
                    {{ localizeDemoText(item.project.name) }}
                  </a-tag>
                </template>
                <template #description>
                  <span class="text-muted">
                    <a-tag :color="item.isAssignee ? 'blue' : 'default'" style="margin-right: 6px">
                      {{ item.isAssignee ? t('myTasks.asAssignee') : t('myTasks.asParticipant') }}
                    </a-tag>
                    {{ t('myTasks.plannedEnd', { date: item.plannedEndDate ?? t('myTasks.unset') }) }}
                  </span>
                </template>
              </a-list-item-meta>

              <template #actions>
                <a-tag :color="TASK_STATUS_COLORS[item.status as TaskStatus]">
                  {{ t(`labels.taskStatus.${item.status}`) }}
                </a-tag>
                <span :style="{ color: priorityColor(item.priority as Priority), fontWeight: 600 }">
                  {{ t(`labels.priority.${item.priority}`) }}
                </span>
                <div class="mini-progress">
                  <a-progress
                    :percent="item.progress"
                    size="small"
                    :stroke-color="progressColor(item.status, item.progress)"
                    :show-info="false"
                  />
                  <span class="percent">{{ item.progress }}%</span>
                </div>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </a-card>
    </a-spin>

    <TaskDetailModal v-model:open="detailOpen" :task="detailTask" @changed="load" @edit="(task) => { editingTask = task; formOpen = true; }" />
    <TaskFormModal
      v-model:open="formOpen"
      :project-id="editingTask?.projectId ?? ''"
      :task="editingTask"
      :users="users"
      @saved="load"
    />
  </div>
</template>

<style scoped>
.group-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.mini-progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 120px;
}

.mini-progress :deep(.ant-progress) {
  margin: 0;
}

.percent {
  font-size: 12px;
  color: var(--tk-ink-3);
}
</style>
