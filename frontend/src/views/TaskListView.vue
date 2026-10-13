<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import type { Priority, TaskFilters, TaskStatus, TaskView, User, ProjectView } from '@/types';
import { tasksApi, usersApi, projectsApi } from '@/api';
import { errorText } from '@/api/http';
import { useRealtime, notifyRemoteChange } from '@/composables/useRealtime';
import {
  PRIORITY_ORDER,
  TASK_STATUS_ORDER,
  priorityColor,
  progressColor,
} from '@/utils/labels';
import { localizeDemoText } from '@/utils/demo-content';
import ProjectTabs from '@/components/ProjectTabs.vue';
import FilterBar from '@/components/FilterBar.vue';
import TaskFormModal from '@/components/TaskFormModal.vue';
import TaskDetailModal from '@/components/TaskDetailModal.vue';

const route = useRoute();
const { t, locale } = useI18n();
const projectId = computed(() => String(route.params.id ?? ''));

const project = ref<ProjectView | null>(null);
const items = ref<TaskView[]>([]);
const total = ref(0);
const users = ref<User[]>([]);
const loading = ref(false);
const selectedKeys = ref<string[]>([]);

const filters = ref<TaskFilters>({ keyword: '' });
const page = ref(1);
const pageSize = ref(20);
const sorter = ref<{ sortBy: string; order: 'asc' | 'desc' }>({ sortBy: 'sortIndex', order: 'asc' });

const formOpen = ref(false);
const editingTask = ref<TaskView | null>(null);
const detailOpen = ref(false);
const detailTask = ref<TaskView | null>(null);
const batchOpen = ref(false);
const batchForm = ref<{ assigneeId?: string | null; priority?: Priority; status?: TaskStatus }>({});

const selectedTasks = computed(() => items.value.filter((task) => selectedKeys.value.includes(task.id)));

function participantText(task: TaskView) {
  return task.participants.map((item) => item.displayName).join('、');
}

const columns = computed(() => {
  void locale.value;
  return [
    { title: t('task.title'), key: 'title', dataIndex: 'title', width: 240, sorter: true },
    { title: t('task.assignee'), key: 'assignee', width: 110 },
    { title: t('task.participants'), key: 'participants', width: 130 },
    { title: t('task.priority'), key: 'priority', dataIndex: 'priority', width: 100, sorter: true },
    { title: t('task.status'), key: 'status', dataIndex: 'status', width: 100, sorter: true },
    { title: t('task.progress'), key: 'progress', dataIndex: 'progress', width: 130, sorter: true },
    { title: t('task.plannedStart'), key: 'plannedStartDate', width: 110 },
    { title: t('task.plannedEnd'), key: 'plannedEndDate', dataIndex: 'plannedEndDate', width: 120, sorter: true },
    { title: t('task.actualEnd'), key: 'actualEndDate', width: 110 },
    { title: t('common.actions'), key: 'action', width: 90, fixed: 'right' as const },
  ];
});

async function load() {
  const id = projectId.value;
  if (!id) return;
  loading.value = true;
  try {
    const [projectData, result, userList] = await Promise.all([
      project.value ?? projectsApi.get(id),
      tasksApi.list(id, {
        ...filters.value,
        page: page.value,
        pageSize: pageSize.value,
        sortBy: sorter.value.sortBy,
        order: sorter.value.order,
      }),
      users.value.length ? Promise.resolve(users.value) : usersApi.list(),
    ]);
    project.value = projectData as ProjectView;
    items.value = result.items;
    total.value = result.total;
    users.value = userList;
    selectedKeys.value = selectedKeys.value.filter((key) => result.items.some((task) => task.id === key));
  } catch (error) {
    message.error(errorText(error, t('taskList.loadFailed')));
  } finally {
    loading.value = false;
  }
}

useRealtime(() => projectId.value, async (event) => {
  notifyRemoteChange(event);
  try {
    await load();
  } catch {
    /* 静默失败 */
  }
});

watch(filters, () => {
  page.value = 1;
  void load();
}, { deep: true });

watch([page, pageSize], () => void load());

watch(projectId, () => {
  project.value = null;
  page.value = 1;
  void load();
});

function onTableChange(pagination: { current?: number; pageSize?: number }, _filters: unknown, sorterArg: unknown) {
  page.value = pagination.current ?? 1;
  pageSize.value = pagination.pageSize ?? 20;
  const sorterValue = Array.isArray(sorterArg) ? sorterArg[0] : sorterArg;
  const field = (sorterValue as { field?: string; order?: string })?.field;
  const order = (sorterValue as { order?: string })?.order;
  if (field && order) {
    sorter.value = { sortBy: field, order: order === 'ascend' ? 'asc' : 'desc' };
  } else {
    sorter.value = { sortBy: 'sortIndex', order: 'asc' };
  }
  void load();
}

function openCreate() {
  editingTask.value = null;
  formOpen.value = true;
}

function openEdit(task: TaskView) {
  editingTask.value = task;
  formOpen.value = true;
}

function openDetail(task: TaskView) {
  detailTask.value = task;
  detailOpen.value = true;
}

function removeTask(task: TaskView) {
  Modal.confirm({
    title: t('task.deleteTitle') + `「${localizeDemoText(task.title)}」`,
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    async onOk() {
      await tasksApi.remove(task.id);
      message.success(t('task.deleted'));
      detailOpen.value = false;
      await load();
    },
  });
}

/** 行内改状态/进度，直接落到后端再刷新 */
async function inlineUpdate(task: TaskView, patch: Record<string, unknown>) {
  try {
    await tasksApi.update(task.id, patch);
    await load();
  } catch (error) {
    message.error(errorText(error, t('taskList.updateFailed')));
    await load();
  }
}

async function submitBatch() {
  if (selectedKeys.value.length === 0) {
    message.warning(t('taskList.selectFirst'));
    return;
  }
  const payload: Record<string, unknown> = { ids: selectedKeys.value };
  if (batchForm.value.assigneeId !== undefined) payload.assigneeId = batchForm.value.assigneeId;
  if (batchForm.value.priority) payload.priority = batchForm.value.priority;
  if (batchForm.value.status) payload.status = batchForm.value.status;

  if (Object.keys(payload).length === 1) {
    message.warning(t('taskList.selectFields'));
    return;
  }
  try {
    const result = await tasksApi.batch(payload);
    message.success(t('taskList.batchSuccess', { n: result.updatedCount }));
    batchOpen.value = false;
    batchForm.value = {};
    selectedKeys.value = [];
    await load();
  } catch (error) {
    message.error(errorText(error, t('taskList.batchFailed')));
  }
}

onMounted(load);
</script>

<template>
  <div class="page">
    <ProjectTabs v-if="project" :project="project" />

    <div class="toolbar list-toolbar">
      <FilterBar v-model:filters="filters" :users="users" />
      <div class="toolbar-right">
        <a-button size="small" :loading="loading" @click="load">
          <ReloadOutlined />
          {{ t('common.refresh') }}
        </a-button>
        <a-button type="primary" size="small" @click="openCreate">
          <PlusOutlined />
          {{ t('board.newTask') }}
        </a-button>
      </div>
    </div>

    <div v-if="selectedKeys.length" class="batch-bar">
      <span>{{ t('taskList.selected', { n: selectedKeys.length }) }}</span>
      <a-button size="small" type="primary" @click="batchOpen = true">{{ t('taskList.batchUpdate') }}</a-button>
      <a-button size="small" @click="selectedKeys = []">{{ t('taskList.clearSelection') }}</a-button>
    </div>

    <a-card :body-style="{ padding: 0 }">
      <a-table
        :data-source="items"
        :columns="columns"
        :loading="loading"
        row-key="id"
        size="middle"
        :scroll="{ x: 1200 }"
        :pagination="{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (total: number) => t('taskList.totalRows', { n: total }),
        }"
        :row-selection="{ selectedRowKeys: selectedKeys, onChange: (keys: string[]) => (selectedKeys = keys) }"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <a @click="openDetail(record)">{{ localizeDemoText(record.title) }}</a>
            <a-tag v-if="record.overdue" color="red" style="margin-left: 6px">{{ t('task.overdue') }}</a-tag>
          </template>

          <template v-else-if="column.key === 'participants'">
            <span v-if="record.participants.length" :title="participantText(record)">
              {{ participantText(record) }}
            </span>
            <span v-else class="text-muted">—</span>
          </template>

          <template v-else-if="column.key === 'assignee'">
            <a-select
              :value="record.assignee?.id"
              size="small"
              style="width: 100%"
              :placeholder="t('common.unassigned')"
              allow-clear
              :options="users.map((u: User) => ({ value: u.id, label: u.displayName }))"
              @update:value="(value: string | undefined) => inlineUpdate(record, { assigneeId: value ?? null })"
            />
          </template>

          <template v-else-if="column.key === 'priority'">
            <span :style="{ color: priorityColor(record.priority), fontWeight: 600 }">
              {{ t(`labels.priority.${record.priority}`) }}
            </span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-select
              :value="record.status"
              size="small"
              style="width: 100%"
              @update:value="(value: TaskStatus) => inlineUpdate(record, { status: value })"
            >
              <a-select-option v-for="s in TASK_STATUS_ORDER" :key="s" :value="s">
                {{ t(`labels.taskStatus.${s}`) }}
              </a-select-option>
            </a-select>
          </template>

          <template v-else-if="column.key === 'progress'">
            <div class="progress-cell">
              <a-progress
                :percent="record.progress"
                size="small"
                :stroke-color="progressColor(record.status, record.progress)"
                :show-info="false"
              />
              <span class="percent">{{ record.progress }}%</span>
            </div>
          </template>

          <template v-else-if="column.key === 'plannedStartDate'">
            <span class="text-muted">{{ record.plannedStartDate ?? '—' }}</span>
          </template>

          <template v-else-if="column.key === 'plannedEndDate'">
            <span :class="{ 'text-danger': record.overdue }">
              {{ record.plannedEndDate ?? '—' }}
              <template v-if="record.overdue">{{ t('task.overdueParen') }}</template>
            </span>
          </template>

          <template v-else-if="column.key === 'actualEndDate'">
            <span class="text-muted">{{ record.actualEndDate ?? '—' }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space size="small">
              <a @click="openEdit(record)">{{ t('common.edit') }}</a>
              <a class="text-danger" @click="removeTask(record)">{{ t('common.delete') }}</a>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty :description="t('taskList.empty')" />
        </template>
      </a-table>
    </a-card>

    <TaskFormModal
      v-model:open="formOpen"
      :project-id="projectId"
      :task="editingTask"
      :users="users"
      @saved="load"
    />

    <TaskDetailModal v-model:open="detailOpen" :task="detailTask" @edit="openEdit" @changed="load" />

    <a-modal v-model:open="batchOpen" :title="t('taskList.batchTitle')" :ok-text="t('taskList.batchApply')" :cancel-text="t('common.cancel')" @ok="submitBatch">
      <a-alert
        type="info"
        show-icon
        :closable="false"
        :message="t('taskList.batchHint', { n: selectedTasks.length })"
        style="margin-bottom: 12px"
      />
      <a-form layout="vertical">
        <a-form-item :label="t('task.assignee')">
          <a-select
            v-model:value="batchForm.assigneeId"
            :placeholder="t('taskList.noChange')"
            allow-clear
            :options="[
              { value: null, label: t('taskList.clearAssignee') },
              ...users.map((u: User) => ({ value: u.id, label: u.displayName })),
            ]"
          />
        </a-form-item>
        <a-form-item :label="t('task.priority')">
          <a-select v-model:value="batchForm.priority" :placeholder="t('taskList.noChange')" allow-clear
            :options="PRIORITY_ORDER.map((p) => ({ value: p, label: t(`labels.priority.${p}`) }))" />
        </a-form-item>
        <a-form-item :label="t('task.status')">
          <a-select v-model:value="batchForm.status" :placeholder="t('taskList.noChange')" allow-clear
            :options="TASK_STATUS_ORDER.map((s) => ({ value: s, label: t(`labels.taskStatus.${s}`) }))" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.list-toolbar {
  justify-content: space-between;
  margin-bottom: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--tk-brand-tint);
  border: 1px solid var(--tk-brand-tint-border);
  border-radius: var(--tk-radius-sm);
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 13px;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-cell :deep(.ant-progress) {
  flex: 1;
  margin: 0;
  min-width: 60px;
}

.percent {
  font-size: 12px;
  color: var(--tk-ink-3);
}
</style>
