<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { message } from 'ant-design-vue';
import { DownloadOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue';
import draggable from 'vuedraggable';
import type { TaskFilters, TaskStatus, TaskView, User, VersionSummary, VersionView } from '@/types';
import { taskIoApi, tasksApi, usersApi, versionsApi } from '@/api';
import { errorText } from '@/api/http';
import { useRealtime, notifyRemoteChange } from '@/composables/useRealtime';
import {
  TASK_STATUS_BAR_COLORS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
} from '@/utils/labels';
import ProgressSummary from '@/components/ProgressSummary.vue';
import VersionTabs from '@/components/VersionTabs.vue';
import FilterBar from '@/components/FilterBar.vue';
import TaskCard from '@/components/TaskCard.vue';
import TaskFormModal from '@/components/TaskFormModal.vue';
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue';
import ImportModal from '@/components/ImportModal.vue';

const route = useRoute();
const versionId = computed(() => String(route.params.id ?? ''));

const version = ref<VersionView | null>(null);
const summary = ref<VersionSummary | null>(null);
const columns = reactive<Record<TaskStatus, TaskView[]>>({
  TODO: [],
  IN_PROGRESS: [],
  BLOCKED: [],
  DONE: [],
});
const users = ref<User[]>([]);
const filters = ref<TaskFilters>({ keyword: '' });
const loading = ref(false);

const formOpen = ref(false);
const editingTask = ref<TaskView | null>(null);
const defaultStatus = ref<TaskStatus>('TODO');
const detailOpen = ref(false);
const detailTask = ref<TaskView | null>(null);
const importOpen = ref(false);

const dragSource = ref<{ task: TaskView; index: number } | null>(null);

const totalShown = computed(() => TASK_STATUS_ORDER.reduce((sum, s) => sum + columns[s].length, 0));

async function loadAll() {
  const id = versionId.value;
  if (!id) return;
  loading.value = true;
  try {
    const [versionData, summaryData, boardTasks, userList] = await Promise.all([
      versionsApi.get(id),
      versionsApi.summary(id),
      tasksApi.board(id, filters.value),
      usersApi.list(),
    ]);
    version.value = versionData;
    summary.value = summaryData;
    users.value = userList;

    for (const status of TASK_STATUS_ORDER) columns[status] = [];
    for (const task of boardTasks) columns[task.status].push(task);

    // 详情抽屉开着时同步最新数据
    if (detailTask.value) {
      detailTask.value = boardTasks.find((t) => t.id === detailTask.value!.id) ?? detailTask.value;
    }
  } catch (error) {
    message.error(errorText(error, '加载看板失败'));
  } finally {
    loading.value = false;
  }
}

async function loadTasksAndSummary() {
  const id = versionId.value;
  const [summaryData, boardTasks] = await Promise.all([
    versionsApi.summary(id),
    tasksApi.board(id, filters.value),
  ]);
  summary.value = summaryData;
  for (const status of TASK_STATUS_ORDER) columns[status] = [];
  for (const task of boardTasks) columns[task.status].push(task);
}

const { connected } = useRealtime(() => versionId.value, async (event) => {
  notifyRemoteChange(event);
  try {
    await loadTasksAndSummary();
  } catch {
    /* 静默失败：下一次轮询或手动刷新会补上 */
  }
});

watch(filters, () => {
  void loadTasksAndSummary().catch((error) => message.error(errorText(error, '筛选失败')));
}, { deep: true });

watch(versionId, () => {
  void loadAll();
});

function onDragStart(event: { from: HTMLElement; oldIndex?: number }) {
  const status = event.from.dataset.status as TaskStatus | undefined;
  const index = event.oldIndex ?? 0;
  if (!status) return;
  dragSource.value = { task: columns[status][index], index };
}

async function onDragEnd(event: { to: HTMLElement; newIndex?: number }) {
  const source = dragSource.value;
  dragSource.value = null;
  if (!source?.task) return;

  const targetStatus = event.to.dataset.status as TaskStatus | undefined;
  if (!targetStatus) return;

  const targetIndex = event.newIndex ?? 0;
  if (source.task.status === targetStatus && source.index === targetIndex) return;

  try {
    await tasksApi.move(source.task.id, targetStatus, targetIndex);
    await loadTasksAndSummary();
    if (targetStatus === 'DONE' && source.task.status !== 'DONE') {
      message.success(`「${source.task.title}」已完成，进度自动置为 100%`);
    }
  } catch (error) {
    message.error(errorText(error, '移动失败'));
    // 移动失败时以服务端数据为准，把界面回滚
    await loadTasksAndSummary().catch(() => undefined);
  }
}

function openCreate(status: TaskStatus) {
  editingTask.value = null;
  defaultStatus.value = status;
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

async function exportExcel() {
  try {
    await taskIoApi.download(versionId.value, `${version.value?.name ?? '任务'}-任务清单.xlsx`);
    message.success('已开始下载');
  } catch (error) {
    message.error(errorText(error, '导出失败'));
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="page">
    <VersionTabs v-if="version" :version="version" />

    <a-card size="small" style="margin: 8px 0 12px">
      <div class="summary-row">
        <ProgressSummary :summary="summary" show-status-breakdown />
        <div class="summary-side">
          <a-tag :color="connected ? 'green' : 'default'">
            {{ connected ? '实时同步中' : '实时未连接' }}
          </a-tag>
          <span class="text-muted">共 {{ totalShown }} 个任务</span>
        </div>
      </div>
    </a-card>

    <div class="toolbar board-toolbar">
      <FilterBar v-model:filters="filters" :users="users" />
      <div class="toolbar-right">
        <a-button size="small" :loading="loading" @click="loadAll">
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
        <a-button type="primary" size="small" @click="openCreate('TODO')">
          <PlusOutlined />
          新建任务
        </a-button>
      </div>
    </div>

    <a-spin :spinning="loading">
      <div class="board-scroll">
        <div v-for="status in TASK_STATUS_ORDER" :key="status" class="column">
          <div class="column-head" :style="{ borderTopColor: TASK_STATUS_BAR_COLORS[status] }">
            <span class="column-title">{{ TASK_STATUS_LABELS[status] }}</span>
            <a-tag class="column-count">{{ columns[status].length }}</a-tag>
            <a class="column-add" @click="openCreate(status)">
              <PlusOutlined />
            </a>
          </div>

          <draggable
            v-model="columns[status]"
            :data-status="status"
            group="tasks"
            item-key="id"
            class="column-body"
            ghost-class="card-ghost"
            :animation="150"
            @start="onDragStart"
            @end="onDragEnd"
          >
            <template #item="{ element }">
              <div>
                <TaskCard :task="element" @open="openDetail" @edit="openEdit" />
              </div>
            </template>
            <template #footer>
              <div v-if="columns[status].length === 0" class="column-empty">
                暂无任务，点右上角 + 或把卡片拖到这里
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </a-spin>

    <TaskFormModal
      v-model:open="formOpen"
      :version-id="versionId"
      :task="editingTask"
      :users="users"
      :default-status="defaultStatus"
      @saved="loadTasksAndSummary"
    />

    <TaskDetailDrawer
      v-model:open="detailOpen"
      :task="detailTask"
      @edit="openEdit"
      @changed="loadTasksAndSummary"
    />

    <ImportModal
      v-model:open="importOpen"
      :version-id="versionId"
      :version-name="version?.name ?? '版本'"
      @imported="loadAll"
    />
  </div>
</template>

<style scoped>
.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.summary-side {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.board-toolbar {
  justify-content: space-between;
  margin-bottom: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.column {
  width: 300px;
  flex: none;
  background: #fafafa;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 340px);
}

.column-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 3px solid #8c8c8c;
  border-radius: 8px 8px 0 0;
  background: #f5f5f5;
}

.column-title {
  font-weight: 600;
  font-size: 13px;
}

.column-count {
  margin-inline-end: 0;
}

.column-add {
  margin-left: auto;
  font-size: 14px;
}

.column-body {
  padding: 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 90px;
}

.column-empty {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  text-align: center;
  padding: 12px 6px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
}

:deep(.card-ghost) {
  opacity: 0.5;
  background: #e6f4ff;
}
</style>
