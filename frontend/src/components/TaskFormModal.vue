<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import type { Priority, TaskStatus, TaskView, User } from '@/types';
import { tasksApi } from '@/api';
import { errorText } from '@/api/http';
import { PRIORITY_LABELS, PRIORITY_ORDER, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@/utils/labels';

const props = defineProps<{
  open: boolean;
  versionId: string;
  task: TaskView | null;
  users: User[];
  modules: string[];
  defaultStatus?: TaskStatus;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'saved', task: TaskView): void;
}>();

const form = reactive({
  title: '',
  module: '',
  assigneeId: undefined as string | undefined,
  priority: 'P2' as Priority,
  status: 'TODO' as TaskStatus,
  progress: 0,
  dueDate: undefined as dayjs.Dayjs | undefined,
  description: '',
});

const saving = ref(false);
const isEdit = computed(() => !!props.task);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    if (props.task) {
      form.title = props.task.title;
      form.module = props.task.module;
      form.assigneeId = props.task.assignee?.id;
      form.priority = props.task.priority;
      form.status = props.task.status;
      form.progress = props.task.progress;
      form.dueDate = props.task.dueDate ? dayjs(props.task.dueDate) : undefined;
      form.description = props.task.description ?? '';
    } else {
      form.title = '';
      form.module = '';
      form.assigneeId = undefined;
      form.priority = 'P2';
      form.status = props.defaultStatus ?? 'TODO';
      form.progress = 0;
      form.dueDate = undefined;
      form.description = '';
    }
  },
);

const moduleOptions = computed(() =>
  props.modules.map((value) => ({ value })),
);

const userOptions = computed(() =>
  props.users.map((user) => ({ value: user.id, label: `${user.displayName}（${user.username}）` })),
);

function filterByValue(input: string, option: { value?: string }) {
  return String(option.value ?? '').toLowerCase().includes(input.toLowerCase());
}

function filterByLabel(input: string, option: { label?: string }) {
  return String(option.label ?? '').toLowerCase().includes(input.toLowerCase());
}

const willForceDone = computed(() => form.status === 'DONE' && form.progress !== 100);

async function submit() {
  if (!form.title.trim()) {
    message.warning('请输入任务标题');
    return;
  }
  saving.value = true;
  try {
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      module: form.module.trim(),
      assigneeId: form.assigneeId ?? null,
      priority: form.priority,
      status: form.status,
      progress: form.status === 'DONE' ? 100 : form.progress,
      dueDate: form.dueDate ? form.dueDate.format('YYYY-MM-DD') : null,
      description: form.description.trim() || null,
    };

    const saved = props.task
      ? await tasksApi.update(props.task.id, payload)
      : await tasksApi.create({ ...payload, versionId: props.versionId });

    message.success(props.task ? '任务已更新' : '任务已创建');
    emit('saved', saved);
    emit('update:open', false);
  } catch (error) {
    message.error(errorText(error, '保存失败'));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <a-modal
    :open="open"
    :title="isEdit ? '编辑任务' : '新建任务'"
    :confirm-loading="saving"
    ok-text="保存"
    cancel-text="取消"
    width="640px"
    @ok="submit"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" style="margin-top: 8px">
      <a-form-item label="标题" required>
        <a-input v-model:value="form.title" placeholder="例如：登录模块功能测试" :maxlength="200" show-count />
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="模块">
            <a-auto-complete
              v-model:value="form.module"
              :options="moduleOptions"
              placeholder="自由填写或用过的模块，可留空"
              :filter-option="filterByValue"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="负责人">
            <a-select
              v-model:value="form.assigneeId"
              :options="userOptions"
              placeholder="未分配"
              allow-clear
              show-search
              :filter-option="filterByLabel"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item label="优先级">
            <a-select v-model:value="form.priority">
              <a-select-option v-for="p in PRIORITY_ORDER" :key="p" :value="p">
                {{ PRIORITY_LABELS[p] }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="状态">
            <a-select v-model:value="form.status">
              <a-select-option v-for="s in TASK_STATUS_ORDER" :key="s" :value="s">
                {{ TASK_STATUS_LABELS[s] }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="截止日期">
            <a-date-picker v-model:value="form.dueDate" style="width: 100%" placeholder="选择日期" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="进度">
        <a-slider v-model:value="form.progress" :min="0" :max="100" :disabled="form.status === 'DONE'" />
        <div v-if="willForceDone" class="hint">
          状态为「已完成」时进度会强制为 100%（保存后生效）
        </div>
      </a-form-item>

      <a-form-item label="描述">
        <a-textarea
          v-model:value="form.description"
          :rows="3"
          :maxlength="5000"
          placeholder="测试范围、前置条件、注意事项等"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.hint {
  font-size: 12px;
  color: #fa8c16;
}
</style>
