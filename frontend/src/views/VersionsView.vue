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
import type { VersionStatus, VersionView } from '@/types';
import { versionsApi } from '@/api';
import { errorText } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import {
  VERSION_STATUS_COLORS,
  VERSION_STATUS_LABELS,
  coverGradient,
  progressColor,
} from '@/utils/labels';
import VersionFormModal from '@/components/VersionFormModal.vue';

const router = useRouter();
const auth = useAuthStore();

const versions = ref<VersionView[]>([]);
const loading = ref(false);
const filters = reactive<{ status?: VersionStatus; keyword: string }>({ keyword: '' });

const formOpen = ref(false);
const editing = ref<VersionView | null>(null);

async function load() {
  loading.value = true;
  try {
    versions.value = await versionsApi.list({
      status: filters.status,
      keyword: filters.keyword.trim() || undefined,
    });
  } catch (error) {
    message.error(errorText(error, '加载版本列表失败'));
  } finally {
    loading.value = false;
  }
}

const filtering = computed(() => !!filters.status || !!filters.keyword.trim());

/** 概览压成一行文字，不再占一整条——首页以卡片墙为主 */
const overview = computed(() => {
  const list = versions.value;
  return {
    total: list.length,
    testing: list.filter((item) => item.status === 'TESTING').length,
    released: list.filter((item) => item.status === 'RELEASED').length,
    risky: list.filter((item) => (item.summary.byStatus?.BLOCKED ?? 0) > 0).length,
  };
});

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(version: VersionView) {
  editing.value = version;
  formOpen.value = true;
}

function openBoard(version: VersionView) {
  router.push({ name: 'board', params: { id: version.id } });
}

function remove(version: VersionView) {
  Modal.confirm({
    title: `删除版本 ${version.name}？`,
    content:
      version.summary.total > 0
        ? `该版本下有 ${version.summary.total} 个任务，删除会一并删除这些任务及其评论、日志，且不可恢复。`
        : '该版本下没有任务。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await versionsApi.remove(version.id, true);
        message.success('版本已删除');
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
          <h2 class="home-title">版本</h2>
          <p class="home-summary">
            共 <b class="num">{{ overview.total }}</b> 个版本 ·
            测试中 <b class="num">{{ overview.testing }}</b> ·
            已发布 <b class="num">{{ overview.released }}</b> ·
            <span :class="{ risky: overview.risky > 0 }">
              需关注 <b class="num">{{ overview.risky }}</b>
            </span>
            <span v-if="filtering" class="filter-note">（当前为筛选结果）</span>
          </p>
        </div>

        <div class="home-tools">
          <a-input
            v-model:value="filters.keyword"
            placeholder="搜索版本号"
            allow-clear
            style="width: 190px"
            @press-enter="load"
          >
            <template #prefix><SearchOutlined class="text-muted" /></template>
          </a-input>
          <a-select
            v-model:value="filters.status"
            placeholder="版本状态"
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
            v-for="version in versions"
            :key="version.id"
            class="vcard"
            @click="openBoard(version)"
          >
            <!-- 封面：按版本号稳定取一个渐变，版本名压在封面上 -->
            <div class="vcard-cover" :style="{ background: coverGradient(version.name) }">
              <span class="vcard-count num" :title="`${version.summary.total} 个任务`">
                {{ version.summary.total }}
              </span>
              <span class="vcard-name">{{ version.name }}</span>

              <a-dropdown v-if="auth.isAdmin" :trigger="['click']">
                <button class="vcard-more" type="button" title="更多操作" @click.stop>
                  <MoreOutlined />
                </button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="edit" @click="openEdit(version)">
                      <EditOutlined />
                      <span style="margin-left: 6px">编辑版本</span>
                    </a-menu-item>
                    <a-menu-item key="delete" danger @click="remove(version)">
                      <DeleteOutlined />
                      <span style="margin-left: 6px">删除版本</span>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>

            <div class="vcard-body">
              <div class="vcard-row">
                <a-tag :color="VERSION_STATUS_COLORS[version.status]" class="vcard-status">
                  {{ VERSION_STATUS_LABELS[version.status] }}
                </a-tag>
                <span class="vcard-rate">
                  完成率 <b class="num">{{ version.summary.completionRate }}%</b>
                  <span class="text-muted num">（{{ version.summary.done }}/{{ version.summary.total }}）</span>
                </span>
              </div>

              <div class="vcard-progress">
                <a-progress
                  :percent="version.summary.avgProgress"
                  size="small"
                  :stroke-color="progressColor('IN_PROGRESS', version.summary.avgProgress)"
                  :show-info="false"
                />
                <span class="vcard-avg num">{{ version.summary.avgProgress }}%</span>
              </div>

              <div class="vcard-dates num">
                <span>{{ version.testStartDate ?? '待定' }}</span>
                <span class="sep">→</span>
                <span>{{ version.plannedReleaseDate ?? '待定' }}</span>
              </div>
            </div>
          </article>

          <!-- 建版本入口做成网格里的最后一张卡，和参考稿一致 -->
          <button class="vcard vcard-new" type="button" @click="openCreate">
            <span class="vcard-new-icon"><PlusOutlined /></span>
            <span class="vcard-new-text">创建版本</span>
          </button>
        </div>

        <div v-if="versions.length === 0 && !loading" class="home-empty">
          {{ filtering ? '没有符合筛选条件的版本' : '还没有版本，点上面「创建版本」开始' }}
        </div>
      </a-spin>
    </div>

    <VersionFormModal v-model:open="formOpen" :version="editing" @saved="load" />
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
  color: #fff;
}

.home-summary {
  margin: 6px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.66);
}

.home-summary b {
  color: #fff;
  font-weight: 600;
}

.home-summary .risky,
.home-summary .risky b {
  color: #ff9c9c;
}

.filter-note {
  color: rgba(255, 255, 255, 0.45);
}

.home-empty {
  margin-top: 20px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

/* ---------- 卡片墙 ---------- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
  gap: 16px;
}

.vcard {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 0;
  border-radius: var(--tk-radius-md);
  background: #fff;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(8, 20, 32, 0.28);
  transition: transform 0.16s, box-shadow 0.16s;
}

.vcard:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(8, 20, 32, 0.38);
}

.vcard-cover {
  position: relative;
  height: 96px;
  padding: 12px 14px;
  display: flex;
  align-items: flex-end;
}

.vcard-name {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  word-break: break-word;
}

/* 任务数徽章压在封面右上角 */
.vcard-count {
  position: absolute;
  top: 10px;
  right: 12px;
  min-width: 22px;
  padding: 0 6px;
  border-radius: var(--tk-radius-sm);
  background: rgba(0, 0, 0, 0.42);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  line-height: 19px;
  text-align: center;
}

/* 管理操作在悬停时才出现，平时不干扰看封面 */
.vcard-more {
  position: absolute;
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

.vcard:hover .vcard-more,
.vcard-more:focus-visible {
  opacity: 1;
}

.vcard-more:hover {
  background: rgba(0, 0, 0, 0.55);
}

.vcard-body {
  padding: 10px 14px 12px;
}

.vcard-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.vcard-status {
  margin-inline-end: 0;
  flex: none;
}

.vcard-rate {
  font-size: 12px;
  color: var(--tk-ink-2);
  white-space: nowrap;
}

.vcard-rate b {
  color: var(--tk-ink);
  font-weight: 600;
}

.vcard-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.vcard-progress :deep(.ant-progress) {
  flex: 1;
  margin: 0;
  min-width: 0;
}

.vcard-avg {
  font-size: 12px;
  color: var(--tk-ink-3);
  flex: none;
}

.vcard-dates {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  font-size: 12px;
  color: var(--tk-ink-2);
}

.vcard-dates .sep {
  color: var(--tk-ink-4);
}

/* 末尾的「创建版本」卡 */
.vcard-new {
  min-height: 178px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px dashed rgba(255, 255, 255, 0.28);
  box-shadow: none;
  color: #fff;
}

.vcard-new:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.5);
}

.vcard-new-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.55);
  font-size: 17px;
}

.vcard-new-text {
  font-size: 14px;
  font-weight: 600;
}
</style>
