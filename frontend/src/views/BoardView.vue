<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import draggable from 'vuedraggable';
import type { TaskFilters, TaskStatus, TaskView, User, ProjectSummary, ProjectView } from '@/types';
import { tasksApi, usersApi, projectsApi } from '@/api';
import { errorText } from '@/api/http';
import { useRealtime, notifyRemoteChange } from '@/composables/useRealtime';
import {
  TASK_STATUS_BAR_COLORS,
  TASK_STATUS_ORDER,
  TASK_STATUS_TINTS,
} from '@/utils/labels';
import { localizeDemoText } from '@/utils/demo-content';
import ProgressSummary from '@/components/ProgressSummary.vue';
import ProjectTabs from '@/components/ProjectTabs.vue';
import FilterBar from '@/components/FilterBar.vue';
import TaskCard from '@/components/TaskCard.vue';
import TaskFormModal from '@/components/TaskFormModal.vue';
import TaskDetailModal from '@/components/TaskDetailModal.vue';

const route = useRoute();
const { t, locale } = useI18n();
const projectId = computed(() => String(route.params.id ?? ''));

const project = ref<ProjectView | null>(null);
const summary = ref<ProjectSummary | null>(null);
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

const dragSource = ref<{ task: TaskView; index: number } | null>(null);

/** 汇总条上的状态计数：既是读数也是快捷筛选入口，省得再去上面的下拉里选一次 */
const statusChips = computed(() => {
  void locale.value;
  return TASK_STATUS_ORDER.map((status) => ({
    status,
    label: t(`labels.taskStatus.${status}`),
    color: TASK_STATUS_BAR_COLORS[status],
    count: summary.value?.byStatus?.[status] ?? 0,
  }));
});

function toggleStatus(status?: TaskStatus) {
  filters.value = { ...filters.value, status };
}

/* 看板高度交给 CSS：.page--board 是 100vh 的纵向 flex，画布 flex:1 自动吃掉剩余高度。
   之前用 JS 按 innerHeight 算并监听 resize，问题是高度会停在旧值上——
   视口变化不一定派发 resize，页面滚动后 getBoundingClientRect().top 也会算错。
   纯 CSS 方案没有这些坑，任何重排都会自动跟上。 */

async function loadAll() {
  const id = projectId.value;
  if (!id) return;
  loading.value = true;
  try {
    const [projectData, summaryData, boardTasks, userList] = await Promise.all([
      projectsApi.get(id),
      projectsApi.summary(id),
      tasksApi.board(id, filters.value),
      usersApi.list(),
    ]);
    project.value = projectData;
    summary.value = summaryData;
    users.value = userList;

    for (const status of TASK_STATUS_ORDER) columns[status] = [];
    for (const task of boardTasks) columns[task.status].push(task);

    if (detailTask.value) {
      detailTask.value = boardTasks.find((t) => t.id === detailTask.value!.id) ?? detailTask.value;
    }
  } catch (error) {
    message.error(errorText(error, t('board.loadFailed')));
  } finally {
    loading.value = false;
  }
}

async function loadTasksAndSummary() {
  const id = projectId.value;
  const [summaryData, boardTasks] = await Promise.all([
    projectsApi.summary(id),
    tasksApi.board(id, filters.value),
  ]);
  summary.value = summaryData;
  for (const status of TASK_STATUS_ORDER) columns[status] = [];
  for (const task of boardTasks) columns[task.status].push(task);
}

useRealtime(() => projectId.value, async (event) => {
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
    void loadTasksAndSummary().catch((error) => message.error(errorText(error, t('board.filterFailed'))));
  },
  { deep: true },
);

watch(projectId, () => {
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
      message.success(t('board.taskDone', { title: localizeDemoText(source.task.title) }));
    }
  } catch (error) {
    message.error(errorText(error, t('board.moveFailed')));
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

onMounted(loadAll);
</script>

<template>
  <div class="page page--board">
    <div class="board-canvas">
      <!-- 控制区浮在画布上：项目信息 + 进度汇总 + 筛选工具，做成一条磨砂横条 -->
      <div class="board-chrome">
        <ProjectTabs v-if="project" :project="project" />

        <div class="summary-row">
          <ProgressSummary :summary="summary" />

          <div class="status-chips">
            <span class="status-chip" :class="{ active: !filters.status }" @click="toggleStatus(undefined)">
              {{ t('board.filterAll') }}
              <b class="count num">{{ summary?.total ?? 0 }}</b>
            </span>
            <a-tooltip
              v-for="chip in statusChips"
              :key="chip.status"
              :title="t('board.filterOnly', { label: chip.label })"
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

        <div class="toolbar board-toolbar">
          <FilterBar v-model:filters="filters" :users="users" hide-status />
          <div class="toolbar-right">
            <a-button size="small" :loading="loading" @click="loadAll">
              <ReloadOutlined />
              {{ t('common.refresh') }}
            </a-button>
            <a-button type="primary" size="small" @click="openCreate('TODO')">
              <PlusOutlined />
              {{ t('board.newTask') }}
            </a-button>
          </div>
        </div>
      </div>

      <div class="board-strip">
        <a-spin :spinning="loading">
          <div class="board-scroll">
          <div
            v-for="status in TASK_STATUS_ORDER"
            :key="status"
            class="column"
          >
            <div class="column-head">
              <i class="dot" :style="{ background: TASK_STATUS_BAR_COLORS[status] }" />
              <span class="column-title">{{ t(`labels.taskStatus.${status}`) }}</span>
              <span
                class="column-count num"
                :style="{ background: TASK_STATUS_TINTS[status], color: TASK_STATUS_BAR_COLORS[status] }"
              >
                {{ columns[status].length }}
              </span>
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
                  {{ t('board.dropHere') }}
                </div>
              </template>
            </draggable>

            <button class="column-add-row" type="button" @click="openCreate(status)">
              <PlusOutlined />
              {{ t('board.newTask') }}
            </button>
            </div>
          </div>
        </a-spin>
      </div>
    </div>

    <TaskFormModal
      v-model:open="formOpen"
      :project-id="projectId"
      :task="editingTask"
      :users="users"
      :default-status="defaultStatus"
      @saved="loadTasksAndSummary"
    />

    <TaskDetailModal
      v-model:open="detailOpen"
      :task="detailTask"
      @edit="openEdit"
      @changed="loadTasksAndSummary"
    />
  </div>
</template>

<style scoped>
/* ===== 看板页 = 一整块工作区 =====
   整页通栏铺渐变，控件磨砂浮在上面，列是高对比浮层。
   高度用纯 CSS 撑满（page--board 给确定高度，画布 flex:1），不依赖任何 JS 测量。 */
.page--board {
  padding: 0;
  max-width: none;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--tk-header-h));
}

.board-canvas {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 20px 20px;
  background: var(--tk-canvas);
  overflow: hidden;
}

/* 控制条：浅色底上就是一张普通白卡 */
.board-chrome {
  flex: none;
  width: 100%;
  max-width: var(--tk-board-max);
  margin: 0 auto;
  padding: 10px 14px 12px;
  border-radius: var(--tk-radius-md);
  background: #fff;
  border: 1px solid var(--tk-hairline);
  box-shadow: var(--tk-shadow-card);
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
  margin-top: 10px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 看板带：占满剩余高度，横向滚动 */
.board-strip {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.board-strip :deep(.ant-spin-nested-loading),
.board-strip :deep(.ant-spin-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.board-scroll {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 12px;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  /* 居中并限宽：超宽屏下左右对称地留出画布，而不是把空白全堆在右侧 */
  width: 100%;
  max-width: var(--tk-board-max);
  margin: 0 auto;
}

.board-scroll::-webkit-scrollbar {
  height: 10px;
}

.board-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.board-scroll::-webkit-scrollbar-thumb {
  background: rgba(9, 30, 66, 0.18);
  border-radius: var(--tk-radius-pill);
}

.board-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(9, 30, 66, 0.32);
}

/* ===== 列：画布上浮起的面板 ===== */
.column {
  flex: 1 1 0;
  min-width: 272px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
  border: 1px solid var(--tk-hairline);
  border-radius: var(--tk-radius-md);
  box-shadow: var(--tk-shadow-column);
  overflow: hidden;
}

.column-head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 11px 12px;
  background: var(--tk-panel);
  border-bottom: 1px solid var(--tk-hairline);
  flex: none;
}

.column-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--tk-ink);
}

.column-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--tk-ink-3);
  border-radius: var(--tk-radius-pill);
  padding: 0 7px;
  line-height: 18px;
}

.column-body {
  padding: 8px 10px 4px;
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
  background: rgba(9, 30, 66, 0.03);
}

/* 列底部的「新建任务」行 */
.column-add-row {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  border-top: 1px solid var(--tk-hairline);
  background: transparent;
  color: var(--tk-ink-3);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.column-add-row:hover {
  background: rgba(9, 30, 66, 0.05);
  color: var(--tk-brand);
}

:deep(.card-ghost) {
  opacity: 0.5;
  background: #e6f4ff;
}
</style>
