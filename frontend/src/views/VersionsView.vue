<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import type { VersionStatus, VersionView } from '@/types';
import { versionsApi } from '@/api';
import { errorText } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { VERSION_STATUS_COLORS, VERSION_STATUS_LABELS } from '@/utils/labels';
import ProgressSummary from '@/components/ProgressSummary.vue';
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

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(version: VersionView) {
  editing.value = version;
  formOpen.value = true;
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

function openBoard(version: VersionView) {
  router.push({ name: 'board', params: { id: version.id } });
}

const columns = [
  { title: '版本', key: 'name', width: 260 },
  { title: '状态', key: 'status', width: 90 },
  { title: '测试进度', key: 'summary', width: 300 },
  { title: '提测 / 计划发布', key: 'dates', width: 180 },
  { title: '说明', key: 'description', ellipsis: true },
  { title: '操作', key: 'action', width: 120, fixed: 'right' as const },
];

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
          style="width: 180px"
          @press-enter="load"
        />
        <a-select
          v-model:value="filters.status"
          placeholder="版本状态"
          allow-clear
          style="width: 130px"
          :options="Object.entries(VERSION_STATUS_LABELS).map(([value, label]) => ({ value, label }))"
          @change="load"
        />
        <a-button @click="load">
          <ReloadOutlined />
          刷新
        </a-button>
        <a-button type="primary" @click="openCreate">
          <PlusOutlined />
          新建版本
        </a-button>
      </div>
    </div>

    <a-card :body-style="{ padding: 0 }">
      <a-table
        :data-source="versions"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }"
        :scroll="{ x: 1100 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a class="version-name" @click="openBoard(record)">{{ record.name }}</a>
            <div class="text-muted creator">创建人：{{ record.createdBy?.displayName ?? '—' }}</div>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="VERSION_STATUS_COLORS[record.status as VersionStatus]">
              {{ VERSION_STATUS_LABELS[record.status as VersionStatus] }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'summary'">
            <ProgressSummary :summary="record.summary" compact show-status-breakdown />
          </template>

          <template v-else-if="column.key === 'dates'">
            <div class="text-muted">{{ record.testStartDate ?? '—' }}</div>
            <div class="text-muted">{{ record.plannedReleaseDate ?? '—' }}</div>
          </template>

          <template v-else-if="column.key === 'description'">
            <span class="text-muted">{{ record.description || '—' }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space size="small">
              <a @click="openBoard(record)">看板</a>
              <a @click="openEdit(record)">编辑</a>
              <a v-if="auth.isAdmin" class="text-danger" @click="remove(record)">删除</a>
            </a-space>
          </template>
        </template>

        <template #emptyText>
          <a-empty :description="filters.keyword || filters.status ? '没有符合条件的版本' : '还没有版本，先新建一个吧'">
            <a-button v-if="!filters.keyword && !filters.status" type="primary" @click="openCreate">
              新建版本
            </a-button>
          </a-empty>
        </template>
      </a-table>
    </a-card>

    <VersionFormModal v-model:open="formOpen" :version="editing" @saved="load" />
  </div>
</template>

<style scoped>
.version-name {
  font-size: 15px;
  font-weight: 600;
}

.creator {
  font-size: 12px;
}
</style>
