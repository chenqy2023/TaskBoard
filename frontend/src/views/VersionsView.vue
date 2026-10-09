<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { VersionStatus, VersionView } from '@/types';
import { versionsApi } from '@/api';
import { errorText } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { VERSION_STATUS_COLORS, VERSION_STATUS_LABELS } from '@/utils/labels';
import VersionProgress from '@/components/VersionProgress.vue';
import VersionFormModal from '@/components/VersionFormModal.vue';

const router = useRouter();
const auth = useAuthStore();

const versions = ref<VersionView[]>([]);
const loading = ref(false);
const filters = reactive<{ status?: VersionStatus; keyword: string }>({ keyword: '' });

const formOpen = ref(false);
const editing = ref<VersionView | null>(null);

const today = dayjs().format('YYYY-MM-DD');

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

function clearFilters() {
  filters.status = undefined;
  filters.keyword = '';
  void load();
}

/* ---------- 概览条：只统计当前列表，筛选时明确标出，不假装是全量 ---------- */
const overview = computed(() => {
  const list = versions.value;
  const testing = list.filter((item) => item.status === 'TESTING');
  const released = list.filter((item) => item.status === 'RELEASED');
  const archived = list.filter((item) => item.status === 'ARCHIVED').length;
  const taskTotal = list.reduce((sum, item) => sum + item.summary.total, 0);
  const blockedTasks = list.reduce((sum, item) => sum + (item.summary.byStatus?.BLOCKED ?? 0), 0);
  const riskyVersions = list.filter((item) => (item.summary.byStatus?.BLOCKED ?? 0) > 0).length;
  const avgOfTesting =
    testing.length === 0
      ? 0
      : Math.round(testing.reduce((sum, item) => sum + item.summary.avgProgress, 0) / testing.length);

  return { total: list.length, testing: testing.length, released: released.length, archived, taskTotal, blockedTasks, riskyVersions, avgOfTesting };
});

/* ---------- 测试周期：把两个日期表达成一段跨度，并标出已超计划 ---------- */
interface CycleInfo {
  text: string;
  hint: string;
  overdue: boolean;
}

function cycleOf(version: VersionView): CycleInfo {
  const start = version.testStartDate;
  const end = version.plannedReleaseDate;
  if (!start && !end) return { text: '未排期', hint: '未填提测与发布计划', overdue: false };

  const arrow = `${start ?? '待定'} → ${end ?? '待定'}`;
  if (start && end) {
    const days = dayjs(end).diff(dayjs(start), 'day');
    const overdue = version.status === 'TESTING' && end < today;
    return { text: arrow, hint: overdue ? `已超计划发布日 ${dayjs(today).diff(dayjs(end), 'day')} 天` : `计划 ${days} 天`, overdue };
  }
  if (start) {
    return { text: arrow, hint: `已进行 ${dayjs(today).diff(dayjs(start), 'day')} 天`, overdue: false };
  }
  return { text: arrow, hint: '未填提测日期', overdue: false };
}

/** 有阻塞任务的行标红，已超计划的标橙，让"哪个版本要出事"一眼可见 */
function rowClassName(version: VersionView) {
  if ((version.summary.byStatus?.BLOCKED ?? 0) > 0) return 'row-risk';
  if (cycleOf(version).overdue) return 'row-attention';
  return '';
}

const columns = [
  { title: '版本', key: 'name', dataIndex: 'name', width: 258, sorter: (a: VersionView, b: VersionView) => a.name.localeCompare(b.name, 'zh-Hans-CN') },
  { title: '状态', key: 'status', dataIndex: 'status', width: 96 },
  {
    title: '测试进度',
    key: 'summary',
    width: 356,
    sorter: (a: VersionView, b: VersionView) => a.summary.avgProgress - b.summary.avgProgress,
  },
  {
    title: '提测 → 计划发布',
    key: 'cycle',
    width: 250,
    sorter: (a: VersionView, b: VersionView) =>
      (a.testStartDate ?? '9999').localeCompare(b.testStartDate ?? '9999'),
  },
  { title: '说明', key: 'description', width: 226, ellipsis: true },
  { title: '操作', key: 'action', width: 152, fixed: 'right' as const },
];

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
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">版本管理</h2>
        <p class="page-subtitle">每个版本一个测试看板，进度由该版本下任务的平均进度与完成率汇总</p>
      </div>
      <div class="toolbar">
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
        <a-button :loading="loading" @click="load">
          <ReloadOutlined />
          刷新
        </a-button>
        <a-button type="primary" @click="openCreate">
          <PlusOutlined />
          新建版本
        </a-button>
      </div>
    </div>

    <div class="stat-strip">
      <div class="stat">
        <div class="stat-label">版本总数</div>
        <div class="stat-value">
          {{ overview.total }}<span class="unit">个</span>
        </div>
        <div class="stat-hint">{{ filtering ? '当前筛选结果' : `共 ${overview.taskTotal} 个任务` }}</div>
      </div>

      <div class="stat">
        <div class="stat-label">
          <i class="dot" style="background: var(--tk-brand)" />
          测试中
        </div>
        <div class="stat-value">
          {{ overview.testing }}<span class="unit">个</span>
        </div>
        <div class="stat-hint">平均进度 {{ overview.avgOfTesting }}%</div>
      </div>

      <div class="stat">
        <div class="stat-label">
          <i class="dot" style="background: var(--tk-success)" />
          已发布
        </div>
        <div class="stat-value">
          {{ overview.released }}<span class="unit">个</span>
        </div>
        <div class="stat-hint">已归档 {{ overview.archived }} 个</div>
      </div>

      <div class="stat">
        <div class="stat-label">
          <i
            class="dot"
            :style="{ background: overview.blockedTasks ? 'var(--tk-danger)' : 'var(--tk-ink-4)' }"
          />
          需要关注
        </div>
        <div class="stat-value" :class="{ 'text-danger': overview.blockedTasks > 0 }">
          {{ overview.riskyVersions }}<span class="unit">个</span>
        </div>
        <div class="stat-hint">
          {{ overview.blockedTasks > 0 ? `阻塞 ${overview.blockedTasks} 个任务` : '暂无阻塞任务' }}
        </div>
      </div>
    </div>

    <a-card class="tk-surface" :body-style="{ padding: 0 }">
      <a-table
        :data-source="versions"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :row-class-name="rowClassName"
        :pagination="{
          pageSize: 10,
          showSizeChanger: false,
          hideOnSinglePage: true,
          showTotal: (total: number) => `共 ${total} 个版本`,
        }"
        :scroll="{ x: 1340 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a class="version-name" @click="openBoard(record)">{{ record.name }}</a>
            <div class="version-meta text-muted">
              {{ record.createdBy?.displayName ?? '—' }} · {{ record.createdAt.slice(0, 10) }}
            </div>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="VERSION_STATUS_COLORS[record.status as VersionStatus]">
              {{ VERSION_STATUS_LABELS[record.status as VersionStatus] }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'summary'">
            <VersionProgress :summary="record.summary" />
          </template>

          <template v-else-if="column.key === 'cycle'">
            <div class="cycle">
              <div class="cycle-range num">
                {{ cycleOf(record).text }}
              </div>
              <div
                class="cycle-hint"
                :class="cycleOf(record).overdue ? 'text-danger' : 'text-muted'"
              >
                {{ cycleOf(record).hint }}
              </div>
            </div>
          </template>

          <template v-else-if="column.key === 'description'">
            <span v-if="record.description" :title="record.description" class="text-muted">
              {{ record.description }}
            </span>
            <span v-else class="text-muted">—</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a @click="openBoard(record)">看板</a>
              <a @click="openEdit(record)">编辑</a>
              <a v-if="auth.isAdmin" class="text-danger" @click="remove(record)">删除</a>
            </div>
          </template>
        </template>

        <template #emptyText>
          <a-empty
            :description="filtering ? '没有符合筛选条件的版本' : '还没有版本，先建一个开始记录测试进度'"
          >
            <a-button v-if="filtering" @click="clearFilters">清除筛选</a-button>
            <a-button v-else type="primary" @click="openCreate">新建版本</a-button>
          </a-empty>
        </template>
      </a-table>
    </a-card>

    <VersionFormModal v-model:open="formOpen" :version="editing" @saved="load" />
  </div>
</template>

<style scoped>
.version-name {
  display: inline-block;
  font-family: var(--tk-num);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0.01em;
  line-height: 20px;
}

.version-meta {
  font-size: 12px;
  margin-top: 2px;
}

.cycle {
  line-height: 1.5;
}

.cycle-range {
  font-size: 13px;
  color: var(--tk-ink-2);
  white-space: nowrap;
}

.cycle-hint {
  font-size: 12px;
}

/* 操作列：给足宽度并禁止折行，避免"看板"被挤成竖排两字 */
.row-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
  flex-wrap: nowrap;
}

.row-actions a {
  flex: none;
}
</style>
