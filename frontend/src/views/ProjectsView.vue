<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message, Modal } from 'ant-design-vue';
import {
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';
import type { ProjectStatus, ProjectView } from '@/types';
import { projectsApi } from '@/api';
import { errorText } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import {
  VERSION_STATUS_COLORS,
  VERSION_STATUS_LABELS,
  coverGradient,
  progressColor,
} from '@/utils/labels';
import ProjectFormModal from '@/components/ProjectFormModal.vue';

const router = useRouter();
const auth = useAuthStore();

const projects = ref<ProjectView[]>([]);
const loading = ref(false);
const filters = reactive<{ status?: ProjectStatus; keyword: string }>({ keyword: '' });

const formOpen = ref(false);
const editing = ref<ProjectView | null>(null);

async function load() {
  loading.value = true;
  try {
    projects.value = await projectsApi.list({
      status: filters.status,
      keyword: filters.keyword.trim() || undefined,
    });
  } catch (error) {
    message.error(errorText(error, '加载项目列表失败'));
  } finally {
    loading.value = false;
  }
}

const filtering = computed(() => !!filters.status || !!filters.keyword.trim());

/** 概览压成一行文字，不再占一整条——首页以卡片墙为主 */
const overview = computed(() => {
  const list = projects.value;
  return {
    total: list.length,
    testing: list.filter((item) => item.status === 'ACTIVE').length,
    released: list.filter((item) => item.status === 'DONE').length,
    risky: list.filter((item) => (item.summary.byStatus?.BLOCKED ?? 0) > 0).length,
  };
});

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

function remove(project: ProjectView) {
  Modal.confirm({
    title: `删除项目 ${project.name}？`,
    content:
      project.summary.total > 0
        ? `该项目下有 ${project.summary.total} 个任务，删除会一并删除这些任务及其评论、日志，且不可恢复。`
        : '该项目下没有任务。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await projectsApi.remove(project.id, true);
        message.success('项目已删除');
        await load();
      } catch (error) {
        message.error(errorText(error, '删除失败'));
      }
    },
  });
}

onMounted(load);
</script>

<template>
  <div class="page page--home">
    <div class="home-inner">
      <div class="home-head">
        <div>
          <h2 class="home-title">项目</h2>
          <p class="home-summary">
            共 <b class="num">{{ overview.total }}</b> 个项目 ·
            进行中 <b class="num">{{ overview.testing }}</b> ·
            已完成 <b class="num">{{ overview.released }}</b> ·
            <span :class="{ risky: overview.risky > 0 }">
              需关注 <b class="num">{{ overview.risky }}</b>
            </span>
            <span v-if="filtering" class="filter-note">（当前为筛选结果）</span>
          </p>
        </div>

        <div class="home-tools">
          <a-input
            v-model:value="filters.keyword"
            placeholder="搜索项目名称"
            allow-clear
            style="width: 190px"
            @press-enter="load"
          >
            <template #prefix><SearchOutlined class="text-muted" /></template>
          </a-input>
          <a-select
            v-model:value="filters.status"
            placeholder="项目状态"
            allow-clear
            style="width: 130px"
            :options="Object.entries(VERSION_STATUS_LABELS).map(([value, label]) => ({ value, label }))"
            @change="load"
          />
          <a-tooltip title="刷新">
            <a-button :loading="loading" @click="load">
              <ReloadOutlined />
            </a-button>
          </a-tooltip>
        </div>
      </div>

      <a-spin :spinning="loading">
        <div class="card-grid">
          <article
            v-for="project in projects"
            :key="project.id"
            class="pcard"
            @click="openBoard(project)"
          >
            <!-- 封面：按项目名称稳定取一个渐变，项目名压在封面上 -->
            <div class="pcard-cover" :style="{ background: coverGradient(project.name) }">
              <span class="pcard-count num" :title="`${project.summary.total} 个任务`">
                {{ project.summary.total }}
              </span>
              <span class="pcard-name">{{ project.name }}</span>

              <a-dropdown v-if="auth.isAdmin" :trigger="['click']">
                <button class="pcard-more" type="button" title="更多操作" @click.stop>
                  <MoreOutlined />
                </button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="edit" @click="openEdit(project)">
                      <EditOutlined />
                      <span style="margin-left: 6px">编辑项目</span>
                    </a-menu-item>
                    <a-menu-item key="delete" danger @click="remove(project)">
                      <DeleteOutlined />
                      <span style="margin-left: 6px">删除项目</span>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>

            <div class="pcard-body">
              <div class="pcard-row">
                <a-tag :color="VERSION_STATUS_COLORS[project.status]" class="pcard-status">
                  {{ VERSION_STATUS_LABELS[project.status] }}
                </a-tag>
                <span class="pcard-rate">
                  完成率 <b class="num">{{ project.summary.completionRate }}%</b>
                  <span class="text-muted num">（{{ project.summary.done }}/{{ project.summary.total }}）</span>
                </span>
              </div>

              <div class="pcard-progress">
                <a-progress
                  :percent="project.summary.avgProgress"
                  size="small"
                  :stroke-color="progressColor('IN_PROGRESS', project.summary.avgProgress)"
                  :show-info="false"
                />
                <span class="pcard-avg num">{{ project.summary.avgProgress }}%</span>
              </div>

              <div class="pcard-dates num">
                <span>{{ project.startDate ?? '待定' }}</span>
                <span class="sep">→</span>
                <span>{{ project.endDate ?? '待定' }}</span>
              </div>
            </div>
          </article>

          <!-- 建项目入口做成网格里的最后一张卡，和参考稿一致 -->
          <button class="pcard pcard-new" type="button" @click="openCreate">
            <span class="pcard-new-icon"><PlusOutlined /></span>
            <span class="pcard-new-text">创建项目</span>
          </button>
        </div>

        <div v-if="projects.length === 0 && !loading" class="home-empty">
          {{ filtering ? '没有符合筛选条件的项目' : '还没有项目，点上面「创建项目」开始' }}
        </div>
      </a-spin>
    </div>

    <ProjectFormModal v-model:open="formOpen" :project="editing" @saved="load" />
  </div>
</template>

<style scoped>
/* 首页沿用看板那套深色工作区，卡片浮在上面 */
.page--home {
  /* 深色底要通栏：.page 自带 max-width 与居中，这里必须放开，
     否则两侧会露出浅色页面底。限宽交给内部的 .home-inner */
  max-width: none;
  min-height: calc(100vh - var(--tk-header-h));
  padding: 26px 20px 48px;
  background: var(--tk-canvas);
}

.home-inner {
  max-width: var(--tk-board-max);
  margin: 0 auto;
}

.home-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.home-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--tk-ink);
}

.home-summary {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--tk-ink-3);
}

.home-summary b {
  color: var(--tk-ink);
  font-weight: 600;
}

.home-summary .risky,
.home-summary .risky b {
  color: var(--tk-danger);
}

.filter-note {
  color: var(--tk-ink-4);
}

.home-empty {
  margin-top: 20px;
  font-size: 13px;
  color: var(--tk-ink-3);
}

/* ---------- 卡片墙 ---------- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
  gap: 16px;
}

.pcard {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 0;
  border: 1px solid var(--tk-hairline);
  border-radius: var(--tk-radius-md);
  background: #fff;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  box-shadow: var(--tk-shadow-card);
  transition: transform 0.16s, box-shadow 0.16s;
}

.pcard:hover {
  transform: translateY(-2px);
  box-shadow: var(--tk-shadow-card-hover);
}

.pcard-cover {
  position: relative;
  height: 96px;
  padding: 12px 14px;
  display: flex;
  align-items: flex-end;
}

/* 自下而上的暗色蒙版：让白色项目名在任何一张渐变上都够清晰 */
.pcard-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0) 62%);
  pointer-events: none;
}

.pcard-name {
  position: relative;
  z-index: 1;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  word-break: break-word;
}

/* 任务数徽章压在封面右上角 */
.pcard-count {
  position: absolute;
  z-index: 1;
  top: 10px;
  right: 12px;
  min-width: 22px;
  padding: 0 6px;
  border-radius: var(--tk-radius-sm);
  background: rgba(0, 0, 0, 0.46);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  line-height: 19px;
  text-align: center;
}

/* 管理操作在悬停时才出现，平时不干扰看封面 */
.pcard-more {
  position: absolute;
  z-index: 1;
  top: 8px;
  left: 8px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--tk-radius-sm);
  background: rgba(0, 0, 0, 0.34);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.pcard:hover .pcard-more,
.pcard-more:focus-visible {
  opacity: 1;
}

.pcard-more:hover {
  background: rgba(0, 0, 0, 0.55);
}

.pcard-body {
  padding: 10px 14px 12px;
}

.pcard-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pcard-status {
  margin-inline-end: 0;
  flex: none;
}

.pcard-rate {
  font-size: 12px;
  color: var(--tk-ink-2);
  white-space: nowrap;
}

.pcard-rate b {
  color: var(--tk-ink);
  font-weight: 600;
}

.pcard-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.pcard-progress :deep(.ant-progress) {
  flex: 1;
  margin: 0;
  min-width: 0;
}

.pcard-avg {
  font-size: 12px;
  color: var(--tk-ink-3);
  flex: none;
}

.pcard-dates {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  font-size: 12px;
  color: var(--tk-ink-2);
}

.pcard-dates .sep {
  color: var(--tk-ink-4);
}

/* 末尾的「创建项目」卡 */
.pcard-new {
  min-height: 178px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #fff;
  border: 1px dashed rgba(9, 30, 66, 0.3);
  box-shadow: none;
  color: var(--tk-ink-2);
}

.pcard-new:hover {
  background: #fff;
  border-color: var(--tk-brand);
  color: var(--tk-brand);
}

.pcard-new-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid currentColor;
  font-size: 17px;
  opacity: 0.8;
}

.pcard-new-text {
  font-size: 14px;
  font-weight: 600;
}
</style>
