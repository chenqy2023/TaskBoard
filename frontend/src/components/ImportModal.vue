<script setup lang="ts">
import { computed, ref } from 'vue';
import { message } from 'ant-design-vue';
import { InboxOutlined } from '@ant-design/icons-vue';
import type { FileType } from 'ant-design-vue/es/upload/interface';
import type { ImportPreview, Priority, TaskStatus } from '@/types';
import { taskIoApi } from '@/api';
import { errorText } from '@/api/http';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/utils/labels';

const props = defineProps<{ open: boolean; versionId: string; versionName: string }>();
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'imported'): void;
}>();

const preview = ref<ImportPreview | null>(null);
const parsing = ref(false);
const importing = ref(false);
const fileName = ref('');

const importableCount = computed(() => preview.value?.validCount ?? 0);
const canImport = computed(() => importableCount.value > 0);

function reset() {
  preview.value = null;
  fileName.value = '';
}

async function handleFile(file: FileType) {
  const raw = file as unknown as File;
  if (!raw || !raw.name) return false;
  fileName.value = raw.name;
  parsing.value = true;
  try {
    preview.value = await taskIoApi.preview(props.versionId, raw);
    if (preview.value.errorCount > 0) {
      message.warning(`有 ${preview.value.errorCount} 行存在问题，这些行不会被导入`);
    } else {
      message.success(`解析完成，共 ${preview.value.total} 行可导入`);
    }
  } catch (error) {
    message.error(errorText(error, '解析文件失败'));
    reset();
  } finally {
    parsing.value = false;
  }
  // 返回 false 阻止 a-upload 自己发请求，我们走自己的接口
  return false;
}

async function confirmImport() {
  if (!preview.value) return;
  const rows = preview.value.rows.filter((row) => row.parsed.errors.length === 0).map((row) => row.raw);
  importing.value = true;
  try {
    const result = await taskIoApi.confirm(props.versionId, rows);
    message.success(`已导入 ${result.createdCount} 个任务`);
    emit('imported');
    emit('update:open', false);
    reset();
  } catch (error) {
    message.error(errorText(error, '导入失败'));
  } finally {
    importing.value = false;
  }
}

async function downloadTemplate() {
  try {
    await taskIoApi.download(props.versionId, `${props.versionName}-任务清单.xlsx`);
    message.success('已下载当前任务清单，可据此整理后回传导入');
  } catch (error) {
    message.error(errorText(error, '下载失败'));
  }
}

function close() {
  emit('update:open', false);
  reset();
}
</script>

<template>
  <a-modal
    :open="open"
    title="批量导入任务"
    width="900px"
    :confirm-loading="importing"
    :ok-button-props="{ disabled: !canImport }"
    ok-text="确认导入"
    cancel-text="取消"
    @ok="confirmImport"
    @cancel="close"
  >
    <a-alert type="info" show-icon :closable="false" style="margin-bottom: 12px">
      <template #message>支持 .xlsx 文件，首行需包含「标题」列</template>
      <template #description>
        列名可用：标题（必填）、负责人、参与人、优先级、状态、进度、计划开始日期、计划结束日期、
        实际开始日期、实际结束日期、描述。负责人只能一个，参与人可多个（用「、」或逗号分隔）；<br />
        优先级填 <code>紧急</code>/<code>高</code>/<code>中</code>/<code>低</code>（也认 <code>P0~P3</code> 这类旧写法）；状态支持 <code>TODO</code>/<code>未开始</code> 等中英文写法。
        <a @click="downloadTemplate">下载当前任务清单作为模板</a>
      </template>
    </a-alert>

    <a-upload-dragger
      :file-list="[]"
      :max-count="1"
      accept=".xlsx"
      :before-upload="handleFile"
      :show-upload-list="false"
    >
      <p class="ant-upload-drag-icon"><InboxOutlined /></p>
      <p class="ant-upload-text">点击或拖拽 .xlsx 文件到这里</p>
      <p class="ant-upload-hint">解析后先预览校验结果，确认无误再写入</p>
    </a-upload-dragger>

    <a-spin :spinning="parsing" tip="正在解析……">
      <div v-if="preview" class="preview">
        <div class="preview-stat">
          <span>文件：<b>{{ fileName }}</b></span>
          <a-tag color="blue">共 {{ preview.total }} 行</a-tag>
          <a-tag color="green">可导入 {{ preview.validCount }} 行</a-tag>
          <a-tag v-if="preview.errorCount" color="red">错误 {{ preview.errorCount }} 行</a-tag>
          <a-tag v-if="preview.warningCount" color="orange">警告 {{ preview.warningCount }} 行</a-tag>
        </div>

        <a-table
          :data-source="preview.rows"
          :pagination="{ pageSize: 8, size: 'small', showSizeChanger: false }"
          size="small"
          row-key="rowNo"
          :scroll="{ y: 300 }"
        >
          <a-table-column title="行" data-index="rowNo" :width="50" />
          <a-table-column title="标题" :width="200">
            <template #default="{ record }">
              <span :class="{ 'text-danger': record.parsed.errors.length }">
                {{ record.raw.title || '（空）' }}
              </span>
            </template>
          </a-table-column>
          <a-table-column title="负责人" :width="90">
            <template #default="{ record }">{{ record.parsed.assigneeName || '未分配' }}</template>
          </a-table-column>
          <a-table-column title="参与人" :width="130">
            <template #default="{ record }">
              {{ record.parsed.participantNames.length ? record.parsed.participantNames.join('、') : '—' }}
            </template>
          </a-table-column>
          <a-table-column title="优先级" :width="80">
            <template #default="{ record }">
              {{ PRIORITY_LABELS[record.parsed.priority as Priority] }}
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="80">
            <template #default="{ record }">
              {{ TASK_STATUS_LABELS[record.parsed.status as TaskStatus] }}
            </template>
          </a-table-column>
          <a-table-column title="进度" :width="60">
            <template #default="{ record }">{{ record.parsed.progress }}%</template>
          </a-table-column>
          <a-table-column title="计划开始" :width="100">
            <template #default="{ record }">{{ record.parsed.plannedStartDate || '—' }}</template>
          </a-table-column>
          <a-table-column title="计划结束" :width="100">
            <template #default="{ record }">{{ record.parsed.plannedEndDate || '—' }}</template>
          </a-table-column>
          <a-table-column title="实际开始" :width="100">
            <template #default="{ record }">{{ record.parsed.actualStartDate || '—' }}</template>
          </a-table-column>
          <a-table-column title="实际结束" :width="100">
            <template #default="{ record }">{{ record.parsed.actualEndDate || '—' }}</template>
          </a-table-column>
          <a-table-column title="校验结果">
            <template #default="{ record }">
              <a-tag v-for="err in record.parsed.errors" :key="err" color="red">{{ err }}</a-tag>
              <a-tag v-for="warn in record.parsed.warnings" :key="warn" color="orange">{{ warn }}</a-tag>
              <span v-if="!record.parsed.errors.length && !record.parsed.warnings.length" class="text-muted">
                正常
              </span>
            </template>
          </a-table-column>
        </a-table>
      </div>
    </a-spin>
  </a-modal>
</template>

<style scoped>
.preview {
  margin-top: 16px;
}

.preview-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  font-size: 13px;
}
</style>
