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
  TASK_STATUS_TINTS,
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

/** 汇总条上的状态计数：既是读数也是快捷筛选入口，省得再去上面的下拉里选一次 */
const statusChips = computed(() =>
  TASK_STATUS_ORDER.map((status) => ({
    status,
    label: TASK_STATUS_LABELS[status],
    color: TASK_STATUS_BAR_COLORS[status],
    count: summary.value?.byStatus?.[status] ?? 0,
  })),
);

function toggleStatus(status?: TaskStatus) {
  filters.value = { ...filters.value, status };
}

/* 看板高度交给 CSS：.page--board 是 100vh 的纵向 flex，画布 flex:1 自动吃掉剩余高度。
   之前用 JS 按 innerHeight 算并监听 resize，问题是高度会停在旧值上——
   视口变化不一定派发 resize，页面滚动后 getBoundingClientRect().top 也会算错。
   纯 CSS 方案没有这些坑，任何重排都会自动跟上。 */

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
    /* 静默失败：手动刷新或下一次事件会补上 */
  }
});

watch(
  filters,
  () => {
    void loadTasksAndSummary().catch((error) => message.error(errorText(error, '筛选失败')));
  },
  { deep: true },
);

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
  <div class="page page--board">
    <VersionTabs v-if="version" :version="version" />

    <a-card size="small" class="tk-surface" style="margin: 8px 0 12px">
      <div class="summary-row">
        <ProgressSummary :summary="summary" />

        <div class="status-chips">
          <span class="status-chip" :class="{ active: !filters.status }" @click="toggleStatus(undefined)">
            全部
            <b class="count num">{{ summary?.total ?? 0 }}</b>
          </span>
          <a-tooltip
            v-for="chip in statusChips"
            :key="chip.status"
            :title="`只看「${chip.label}」的任务`"
          >
            <span
              class="status-chip"
              :class="{
                active: filters.status === chip.status,
                dim: chip.count === 0 && filters.status !== chip.status,
              }"
              @click="toggleStatus(filters.status === chip.status ? undefined : chip.status)"
            >
              <i class="dot" :style="{ background: chip.color }" />
              {{ chip.label }}
              <b class="count num">{{ chip.count }}</b>
            </span>
          </a-tooltip>
        </div>
      </div>
    </a-card>

    <div class="toolbar board-toolbar">
      <FilterBar v-model:filters="filters" :users="users" hide-status />
      <div class="toolbar-right">
        <a-tooltip :title="connected ? '他人改动会实时推送到这里' : '实时通道未连接，改动需手动刷新'">
          <span class="sync-state" :class="{ on: connected }">
            <i class="dot" />
            {{ connected ? '实时同步中' : '实时未连接' }}
          </span>
        </a-tooltip>
        <span class="text-muted count-hint">当前 {{ totalShown }} 个任务</span>
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

    <div class="board-zone">
      <a-spin :spinning="loading">
        <div class="board-canvas">
        <div class="board-scroll">
          <div
            v-for="status in TASK_STATUS_ORDER"
            :key="status"
            class="column"
            :style="{ borderTopColor: TASK_STATUS_BAR_COLORS[status] }"
          >
            <div class="column-head" :style="{ background: TASK_STATUS_TINTS[status] }">
              <i class="dot" :style="{ background: TASK_STATUS_BAR_COLORS[status] }" />
              <span class="column-title">{{ TASK_STATUS_LABELS[status] }}</span>
              <span class="column-count num">{{ columns[status].length }}</span>
              <a-tooltip :title="`在「${TASK_STATUS_LABELS[status]}」新建任务`">
                <a class="column-add" @click="openCreate(status)">
                  <PlusOutlined />
                </a>
              </a-tooltip>
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
        </div>
      </a-spin>
    </div>

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
/* 看板页撑满视口：标题区/汇总卡/工具栏按内容高度，画布吃掉剩余高度。
   纯 CSS，无需监听视口变化，重排后自动正确。 */
.page--board {
  display: flex;
  flex-direction: column;
  /* 必须给一个确定高度，flex:1 才有剩余空间可分。
     减掉顶栏高度，否则会比内容区高出 56px 而多出一条页面滚动条。 */
  height: calc(100vh - var(--tk-header-h));
}

.page--board > *:not(.board-zone) {
  flex: none;
}

.board-zone {
  flex: 1 1 auto;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

/* a-spin 不转发外部 class，且内部还套着两层，用 :deep 把弹性一路传下去，
   否则画布拿不到剩余高度 */
.board-zone :deep(.ant-spin-nested-loading),
.board-zone :deep(.ant-spin-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.board-canvas {
  flex: 1 1 auto;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.status-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.board-toolbar {
  justify-content: space-between;
  margin-bottom: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sync-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--tk-ink-3);
  white-space: nowrap;
  cursor: help;
}

.sync-state .dot {
  background: var(--tk-ink-4);
}

.sync-state.on {
  color: var(--tk-success);
}

.sync-state.on .dot {
  background: var(--tk-success);
  box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.14);
}

.count-hint {
  font-size: 12px;
  white-space: nowrap;
}

/* 列：画布上浮起的面板。四列等分内容区宽度，容器不够时收到 268px 再横向滚动。
   不设 max-width——上限由 .page 的 --tk-content-max 统一控制。
   状态色放在列框自身的上边框上，作为这一列的标识色（对应列头色带）；
   放在列头里会因父级边框而左右各内缩 1px，色条压不到列外沿。
   overflow: hidden 让列头的淡底被列的圆角裁掉，四角与色带完全对齐。 */
.column {
  flex: 1 1 0;
  min-width: 268px;
  background: var(--tk-panel);
  border: 0;
  border-top: 3px solid var(--tk-ink-4);
  border-radius: var(--tk-radius-md);
  box-shadow: var(--tk-shadow-panel);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.column-head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  background: var(--tk-line);
  flex: none;
}

.column-title {
  font-weight: 600;
  font-size: 13px;
}

.column-count {
  font-size: 12px;
  color: var(--tk-ink-3);
  font-weight: 600;
}

.column-add {
  margin-left: auto;
  font-size: 14px;
}

.column-body {
  padding: 8px 10px 10px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.column-empty {
  font-size: 12px;
  color: var(--tk-ink-4);
  text-align: center;
  padding: 14px 6px;
  border: 1px dashed rgba(9, 30, 66, 0.16);
  border-radius: var(--tk-radius-sm);
  background: rgba(255, 255, 255, 0.56);
}

:deep(.card-ghost) {
  opacity: 0.5;
  background: #e6f4ff;
}
</style>
