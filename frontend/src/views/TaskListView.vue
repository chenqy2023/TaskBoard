<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { message, Modal } from 'ant-design-vue';
import { DownloadOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue';
import type { Priority, TaskFilters, TaskStatus, TaskView, User, VersionView } from '@/types';
import { taskIoApi, tasksApi, usersApi, versionsApi } from '@/api';
import { errorText } from '@/api/http';
import { useRealtime, notifyRemoteChange } from '@/composables/useRealtime';
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  priorityColor,
  progressColor,
} from '@/utils/labels';
import VersionTabs from '@/components/VersionTabs.vue';
import FilterBar from '@/components/FilterBar.vue';
import TaskFormModal from '@/components/TaskFormModal.vue';
import TaskDetailModal from '@/components/TaskDetailModal.vue';
import ImportModal from '@/components/ImportModal.vue';

const route = useRoute();
const versionId = computed(() => String(route.params.id ?? ''));

const version = ref<VersionView | null>(null);
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
const importOpen = ref(false);
const batchOpen = ref(false);
const batchForm = ref<{ assigneeId?: string | null; priority?: Priority; status?: TaskStatus }>({});

const selectedTasks = computed(() => items.value.filter((task) => selectedKeys.value.includes(task.id)));

function participantText(task: TaskView) {
  return task.participants.map((item) => item.displayName).join('、');
}

const columns = [
  { title: '标题', key: 'title', dataIndex: 'title', width: 240, sorter: true },
  { title: '负责人', key: 'assignee', width: 110 },
  { title: '参与人', key: 'participants', width: 130 },
  { title: '优先级', key: 'priority', dataIndex: 'priority', width: 100, sorter: true },
  { title: '状态', key: 'status', dataIndex: 'status', width: 100, sorter: true },
  { title: '进度', key: 'progress', dataIndex: 'progress', width: 130, sorter: true },
  { title: '计划开始', key: 'plannedStartDate', width: 110 },
  { title: '计划结束', key: 'plannedEndDate', dataIndex: 'plannedEndDate', width: 120, sorter: true },
  { title: '实际结束', key: 'actualEndDate', width: 110 },
  { title: '操作', key: 'action', width: 90, fixed: 'right' as const },
];

async function load() {
  const id = versionId.value;
  if (!id) return;
  loading.value = true;
  try {
    const [versionData, result, userList] = await Promise.all([
      version.value ?? versionsApi.get(id),
      tasksApi.list(id, {
        ...filters.value,
        page: page.value,
        pageSize: pageSize.value,
        sortBy: sorter.value.sortBy,
        order: sorter.value.order,
      }),
      users.value.length ? Promise.resolve(users.value) : usersApi.list(),
    ]);
    version.value = versionData as VersionView;
    items.value = result.items;
    total.value = result.total;
    users.value = userList;
    selectedKeys.value = selectedKeys.value.filter((key) => result.items.some((task) => task.id === key));
  } catch (error) {
    message.error(errorText(error, '加载任务列表失败'));
  } finally {
    loading.value = false;
  }
}

const { connected } = useRealtime(() => versionId.value, async (event) => {
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

watch(versionId, () => {
  version.value = null;
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
    title: `删除任务「${task.title}」？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await tasksApi.remove(task.id);
      message.success('任务已删除');
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
    message.error(errorText(error, '更新失败'));
    await load();
  }
}

async function submitBatch() {
  if (selectedKeys.value.length === 0) {
    message.warning('请先勾选任务');
    return;
  }
  const payload: Record<string, unknown> = { ids: selectedKeys.value };
  if (batchForm.value.assigneeId !== undefined) payload.assigneeId = batchForm.value.assigneeId;
  if (batchForm.value.priority) payload.priority = batchForm.value.priority;
  if (batchForm.value.status) payload.status = batchForm.value.status;

  if (Object.keys(payload).length === 1) {
    message.warning('请至少选择一项要修改的内容');
    return;
  }
  try {
    const result = await tasksApi.batch(payload);
    message.success(`已更新 ${result.updatedCount} 个任务`);
    batchOpen.value = false;
    batchForm.value = {};
    selectedKeys.value = [];
    await load();
  } catch (error) {
    message.error(errorText(error, '批量更新失败'));
  }
}

async function exportExcel() {
  await taskIoApi.download(versionId.value, `${version.value?.name ?? '任务'}-任务清单.xlsx`);
  message.success('已开始下载');
}

onMounted(load);
</script>

<template>
  <div class="page">
    <VersionTabs v-if="version" :version="version" />

    <div class="toolbar list-toolbar">
      <FilterBar v-model:filters="filters" :users="users" />
      <div class="toolbar-right">
        <a-tag :color="connected ? 'green' : 'default'">{{ connected ? '实时同步中' : '实时未连接' }}</a-tag>
        <a-button size="small" :loading="loading" @click="load">
          <ReloadOutlined />
          刷新
        </a-button>
        <a-button size="small" @click="exportExcel">
          <DownloadOutlined />
          导出
        </a-button>
        <a-button size="small" @click="importOpen = true">
          <UploadOutlined />
          导入
        </a-button>
        <a-button type="primary" size="small" @click="openCreate">
          <PlusOutlined />
          新建任务
        </a-button>
      </div>
    </div>

    <div v-if="selectedKeys.length" class="batch-bar">
      <span>已选 <b>{{ selectedKeys.length }}</b> 个任务</span>
      <a-button size="small" type="primary" @click="batchOpen = true">批量修改</a-button>
      <a-button size="small" @click="selectedKeys = []">取消选择</a-button>
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
          showTotal: (total: number) => `共 ${total} 条`,
        }"
        :row-selection="{ selectedRowKeys: selectedKeys, onChange: (keys: string[]) => (selectedKeys = keys) }"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <a @click="openDetail(record)">{{ record.title }}</a>
            <a-tag v-if="record.overdue" color="red" style="margin-left: 6px">逾期</a-tag>
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
              placeholder="未分配"
              allow-clear
              :options="users.map((u: User) => ({ value: u.id, label: u.displayName }))"
              @update:value="(value: string | undefined) => inlineUpdate(record, { assigneeId: value ?? null })"
            />
          </template>

          <template v-else-if="column.key === 'priority'">
            <span :style="{ color: priorityColor(record.priority), fontWeight: 600 }">
              {{ PRIORITY_LABELS[record.priority as Priority] }}
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
                {{ TASK_STATUS_LABELS[s] }}
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
              <template v-if="record.overdue">（逾期）</template>
            </span>
          </template>

          <template v-else-if="column.key === 'actualEndDate'">
            <span class="text-muted">{{ record.actualEndDate ?? '—' }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space size="small">
              <a @click="openEdit(record)">编辑</a>
              <a class="text-danger" @click="removeTask(record)">删除</a>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="没有符合条件的任务" />
        </template>
      </a-table>
    </a-card>

    <TaskFormModal
      v-model:open="formOpen"
      :version-id="versionId"
      :task="editingTask"
      :users="users"
      @saved="load"
    />

    <TaskDetailModal v-model:open="detailOpen" :task="detailTask" @edit="openEdit" @changed="load" />

    <ImportModal
      v-model:open="importOpen"
      :version-id="versionId"
      :version-name="version?.name ?? '版本'"
      @imported="load"
    />

    <a-modal v-model:open="batchOpen" title="批量修改任务" ok-text="应用" cancel-text="取消" @ok="submitBatch">
      <a-alert
        type="info"
        show-icon
        :closable="false"
        :message="`将对已选的 ${selectedTasks.length} 个任务生效，只填需要修改的项`"
        style="margin-bottom: 12px"
      />
      <a-form layout="vertical">
        <a-form-item label="负责人">
          <a-select
            v-model:value="batchForm.assigneeId"
            placeholder="不修改"
            allow-clear
            :options="[
              { value: null, label: '清空负责人' },
              ...users.map((u: User) => ({ value: u.id, label: u.displayName })),
            ]"
          />
        </a-form-item>
        <a-form-item label="优先级">
          <a-select v-model:value="batchForm.priority" placeholder="不修改" allow-clear
            :options="PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="batchForm.status" placeholder="不修改" allow-clear
            :options="TASK_STATUS_ORDER.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))" />
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
