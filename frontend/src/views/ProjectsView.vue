<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message, Modal } from 'ant-design-vue';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';
import type { ProjectStatus, ProjectView, TaskStatus, TaskView } from '@/types';
import { projectsApi, tasksApi } from '@/api';
import { errorText } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import {
  PROJECT_STATUS_ORDER,
  TASK_STATUS_ORDER,
  VERSION_STATUS_COLORS,
  progressColor,
} from '@/utils/labels';
import { localizeDemoText } from '@/utils/demo-content';
import ProjectFormModal from '@/components/ProjectFormModal.vue';

const router = useRouter();
const auth = useAuthStore();
const { t, locale } = useI18n();

const projects = ref<ProjectView[]>([]);
const loading = ref(false);
const filters = reactive<{ status?: ProjectStatus; keyword: string }>({ keyword: '' });

const formOpen = ref(false);
const editing = ref<ProjectView | null>(null);

const selectedId = ref<string | null>(null);
const previewTasks = ref<TaskView[]>([]);
const previewLoading = ref(false);

const selected = computed(() => projects.value.find((p) => p.id === selectedId.value) ?? null);

const filtering = computed(() => !!filters.status || !!filters.keyword.trim());

const blockedCount = computed(() => selected.value?.summary.byStatus?.BLOCKED ?? 0);

const statusOptions = computed(() => {
  void locale.value;
  return PROJECT_STATUS_ORDER.map((value) => ({
    value,
    label: t(`labels.projectStatus.${value}`),
  }));
});

const miniColumns = computed(() => {
  void locale.value;
  const groups: Record<TaskStatus, TaskView[]> = {
    TODO: [],
    IN_PROGRESS: [],
    BLOCKED: [],
    DONE: [],
  };
  for (const task of previewTasks.value) {
    groups[task.status]?.push(task);
  }
  return TASK_STATUS_ORDER.map((status) => ({
    status,
    label: t('labels.taskStatus.' + status),
    count: selected.value?.summary.byStatus?.[status] ?? groups[status].length,
    tasks: groups[status].slice(0, 3),
    more: Math.max(0, (selected.value?.summary.byStatus?.[status] ?? groups[status].length) - 3),
  }));
});

async function load() {
  loading.value = true;
  try {
    projects.value = await projectsApi.list({
      status: filters.status,
      keyword: filters.keyword.trim() || undefined,
    });
    if (selectedId.value && !projects.value.some((p) => p.id === selectedId.value)) {
      selectedId.value = projects.value[0]?.id ?? null;
    } else if (!selectedId.value && projects.value.length > 0) {
      selectedId.value = projects.value[0].id;
    }
  } catch (error) {
    message.error(errorText(error, t('project.loadFailed')));
  } finally {
    loading.value = false;
  }
}

async function loadPreview(projectId: string) {
  previewLoading.value = true;
  try {
    previewTasks.value = await tasksApi.board(projectId);
  } catch {
    previewTasks.value = [];
  } finally {
    previewLoading.value = false;
  }
}

watch(selectedId, (id) => {
  previewTasks.value = [];
  if (id) void loadPreview(id);
});

function selectProject(project: ProjectView) {
  selectedId.value = project.id;
}

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(project: ProjectView) {
  editing.value = project;
  formOpen.value = true;
}

function openBoard(project: ProjectView) {
  router.push({ name: 'board', params: { id: project.id } });
}

function openTasks(project: ProjectView) {
  router.push({ name: 'task-list', params: { id: project.id } });
}

function openStats(project: ProjectView) {
  router.push({ name: 'stats', params: { id: project.id } });
}

function remove(project: ProjectView) {
  Modal.confirm({
    title: t('project.deleteTitle', { name: localizeDemoText(project.name) }),
    content:
      project.summary.total > 0
        ? t('project.deleteWithTasks', { n: project.summary.total })
        : t('project.deleteEmpty'),
    okText: t('common.confirmDelete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    async onOk() {
      try {
        await projectsApi.remove(project.id, true);
        message.success(t('project.deleted'));
        if (selectedId.value === project.id) selectedId.value = null;
        await load();
      } catch (error) {
        message.error(errorText(error, t('project.deleteFailed')));
      }
    },
  });
}

async function onSaved() {
  const keepId = editing.value?.id ?? selectedId.value;
  await load();
  if (keepId && projects.value.some((p) => p.id === keepId)) {
    const same = selectedId.value === keepId;
    selectedId.value = keepId;
    if (same) void loadPreview(keepId);
  }
}

onMounted(load);
</script>

<template>
  <div class="page page--home">
    <div class="home-inner">
      <div class="layout">
        <!-- 左：项目列表 -->
        <aside class="list-pane">
          <div class="pane-h">
            <div class="pane-h-top">
              <h1 class="pane-title">{{ t('project.title') }}</h1>
              <a-button type="primary" size="small" @click="openCreate">
                <template #icon><PlusOutlined /></template>
                {{ t('project.create') }}
              </a-button>
            </div>
            <div class="pane-tools">
              <a-input
                v-model:value="filters.keyword"
                :placeholder="t('project.searchPlaceholder')"
                allow-clear
                size="small"
                @press-enter="load"
              >
                <template #prefix><SearchOutlined class="text-muted" /></template>
              </a-input>
              <a-select
                v-model:value="filters.status"
                :placeholder="t('project.statusPlaceholder')"
                allow-clear
                size="small"
                style="width: 100px; flex: none"
                :options="statusOptions"
                @change="load"
              />
              <a-tooltip :title="t('common.refresh')">
                <a-button size="small" :loading="loading" @click="load">
                  <ReloadOutlined />
                </a-button>
              </a-tooltip>
            </div>
          </div>

          <a-spin :spinning="loading">
            <div class="rows">
              <button
                v-for="project in projects"
                :key="project.id"
                type="button"
                class="row"
                :class="{ active: project.id === selectedId }"
                @click="selectProject(project)"
              >
                <div class="row-name">{{ localizeDemoText(project.name) }}</div>
                <div class="row-sub">
                  <span>
                    {{ t(`labels.projectStatus.${project.status}`) }} ·
                    {{ t('project.rowCompletion', { rate: project.summary.completionRate }) }}
                  </span>
                  <span
                    v-if="(project.summary.byStatus?.BLOCKED ?? 0) > 0"
                    class="row-blocked"
                  >
                    {{ t('project.rowBlocked', { n: project.summary.byStatus.BLOCKED }) }}
                  </span>
                  <span v-else class="row-muted">{{ t('project.rowTasks', { n: project.summary.total }) }}</span>
                </div>
              </button>

              <div v-if="projects.length === 0 && !loading" class="list-empty">
                {{ filtering ? t('project.emptyFiltered') : t('project.empty') }}
              </div>
            </div>
          </a-spin>
        </aside>

        <!-- 右：选中项目预览 -->
        <section class="detail-pane">
          <div v-if="selected" class="detail">
            <div class="kicker">{{ t('project.preview') }}</div>
            <div class="detail-head">
              <h2 class="detail-name">{{ localizeDemoText(selected.name) }}</h2>
              <a-tag :color="VERSION_STATUS_COLORS[selected.status]">
                {{ t(`labels.projectStatus.${selected.status}`) }}
              </a-tag>
            </div>
            <p class="detail-desc">
              {{ localizeDemoText(selected.description?.trim()) || t('project.noDescription') }}
            </p>

            <div class="stats">
              <div class="stat">
                <div class="lab">{{ t('project.tasks') }}</div>
                <div class="val num">{{ selected.summary.total }}</div>
              </div>
              <div class="stat">
                <div class="lab">{{ t('project.avgProgress') }}</div>
                <div class="val num">{{ selected.summary.avgProgress }}%</div>
              </div>
              <div class="stat">
                <div class="lab">{{ t('project.completionRate') }}</div>
                <div class="val num">{{ selected.summary.completionRate }}%</div>
              </div>
              <div class="stat" :class="{ bad: blockedCount > 0 }">
                <div class="lab">{{ t('project.blocked') }}</div>
                <div class="val num">{{ blockedCount }}</div>
              </div>
            </div>

            <div class="progress-wrap">
              <div class="progress-lab">
                <span>{{ t('project.overallProgress') }}</span>
                <span class="num">
                  {{ selected.startDate ?? t('common.pending') }} → {{ selected.endDate ?? t('common.pending') }}
                </span>
              </div>
              <a-progress
                :percent="selected.summary.avgProgress"
                :stroke-color="progressColor('IN_PROGRESS', selected.summary.avgProgress)"
                :show-info="false"
                size="small"
              />
            </div>

            <div class="actions">
              <a-button type="primary" @click="openBoard(selected)">{{ t('project.openBoard') }}</a-button>
              <a-button @click="openTasks(selected)">{{ t('project.openTasks') }}</a-button>
              <a-button @click="openStats(selected)">{{ t('project.openStats') }}</a-button>
              <template v-if="auth.isAdmin">
                <a-button @click="openEdit(selected)">
                  <template #icon><EditOutlined /></template>
                  {{ t('common.edit') }}
                </a-button>
                <a-button danger @click="remove(selected)">
                  <template #icon><DeleteOutlined /></template>
                  {{ t('common.delete') }}
                </a-button>
              </template>
            </div>

            <div class="mini-board">
              <h3>{{ t('project.miniBoard') }}</h3>
              <a-spin :spinning="previewLoading">
                <div class="cols">
                  <div v-for="col in miniColumns" :key="col.status" class="mcol">
                    <div
                      class="mcol-t"
                      :class="{
                        danger: col.status === 'BLOCKED',
                        success: col.status === 'DONE',
                      }"
                    >
                      {{ col.label }} · {{ col.count }}
                    </div>
                    <div
                      v-for="task in col.tasks"
                      :key="task.id"
                      class="mtask"
                      :title="localizeDemoText(task.title)"
                    >
                      {{ localizeDemoText(task.title) }}
                    </div>
                    <div v-if="col.tasks.length === 0 && col.count === 0" class="mcol-empty">
                      {{ t('common.empty') }}
                    </div>
                    <div v-else-if="col.more > 0" class="mcol-more">{{ t('common.more', { n: col.more }) }}</div>
                  </div>
                </div>
              </a-spin>
            </div>
          </div>

          <div v-else class="detail-empty">
            <p>{{ loading ? t('common.loading') : t('project.selectHint') }}</p>
            <a-button v-if="!loading && projects.length === 0" type="primary" @click="openCreate">
              {{ t('project.createFirst') }}
            </a-button>
          </div>
        </section>
      </div>
    </div>

    <ProjectFormModal v-model:open="formOpen" :project="editing" @saved="onSaved" />
  </div>
</template>

<style scoped>
.page--home {
  max-width: none;
  min-height: calc(100vh - var(--tk-header-h));
  padding: 14px 20px 24px;
  background: var(--tk-canvas);
}

.home-inner {
  max-width: var(--tk-board-max);
  margin: 0 auto;
  height: calc(100vh - var(--tk-header-h) - 38px);
}

.layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 14px;
  height: 100%;
  min-height: 0;
}

.list-pane,
.detail-pane {
  background: #fff;
  border: 1px solid var(--tk-hairline);
  border-radius: var(--tk-radius-md);
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--tk-shadow-card);
}

.pane-h {
  flex: none;
  padding: 12px 14px;
  border-bottom: 1px solid var(--tk-line);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pane-h-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pane-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  flex: 1;
  color: var(--tk-ink);
}

.pane-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rows {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
}

.row {
  display: block;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid var(--tk-line);
  border-left: 3px solid transparent;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}

.row:hover {
  background: #fafbfc;
}

.row.active {
  background: #e6f4ff;
  border-left-color: var(--tk-brand);
}

.row-name {
  font-weight: 650;
  font-size: 14px;
  color: var(--tk-ink);
  margin-bottom: 4px;
  word-break: break-word;
}

.row-sub {
  font-size: 12px;
  color: var(--tk-ink-3);
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.row-blocked {
  color: var(--tk-danger);
  flex: none;
}

.row-muted {
  flex: none;
}

.list-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--tk-ink-3);
}

.detail {
  flex: 1;
  overflow-y: auto;
  padding: 20px 22px 28px;
}

.kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--tk-ink-3);
  margin-bottom: 8px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.detail-name {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--tk-ink);
  word-break: break-word;
}

.detail-desc {
  color: var(--tk-ink-3);
  font-size: 13px;
  margin: 0 0 18px;
  line-height: 1.5;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 18px;
}

.stat {
  background: var(--tk-panel);
  border-radius: var(--tk-radius-sm);
  padding: 12px;
}

.stat .lab {
  font-size: 11px;
  color: var(--tk-ink-3);
  margin-bottom: 4px;
}

.stat .val {
  font-size: 22px;
  font-weight: 650;
  color: var(--tk-ink);
}

.stat.bad .val {
  color: var(--tk-danger);
}

.progress-wrap {
  margin-bottom: 18px;
}

.progress-lab {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--tk-ink-2);
  margin-bottom: 8px;
  gap: 12px;
}

.progress-wrap :deep(.ant-progress) {
  margin: 0;
  line-height: 1;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mini-board {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--tk-line);
}

.mini-board h3 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tk-ink-2);
}

.cols {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.mcol {
  background: var(--tk-panel);
  border-radius: var(--tk-radius-sm);
  padding: 10px;
  min-height: 120px;
}

.mcol-t {
  font-size: 11px;
  font-weight: 700;
  color: var(--tk-ink-3);
  margin-bottom: 8px;
}

.mcol-t.danger {
  color: var(--tk-danger);
}

.mcol-t.success {
  color: var(--tk-success);
}

.mtask {
  background: #fff;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  margin-bottom: 6px;
  border: 1px solid var(--tk-hairline);
  line-height: 1.35;
  color: var(--tk-ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mcol-empty,
.mcol-more {
  font-size: 11px;
  color: var(--tk-ink-4);
  padding: 2px 0;
}

.detail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--tk-ink-3);
  font-size: 14px;
}

.detail-empty p {
  margin: 0;
}

@media (max-width: 960px) {
  .home-inner {
    height: auto;
  }

  .layout {
    grid-template-columns: 1fr;
    height: auto;
  }

  .list-pane {
    max-height: 360px;
  }

  .stats,
  .cols {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
