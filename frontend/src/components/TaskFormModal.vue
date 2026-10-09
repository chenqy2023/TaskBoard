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
  defaultStatus?: TaskStatus;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'saved', task: TaskView): void;
}>();

const form = reactive({
  title: '',
  assigneeId: undefined as string | undefined,
  participantIds: [] as string[],
  priority: 'P2' as Priority,
  status: 'TODO' as TaskStatus,
  progress: 0,
  plannedStartDate: undefined as dayjs.Dayjs | undefined,
  plannedEndDate: undefined as dayjs.Dayjs | undefined,
  actualStartDate: undefined as dayjs.Dayjs | undefined,
  actualEndDate: undefined as dayjs.Dayjs | undefined,
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
      form.assigneeId = props.task.assignee?.id;
      form.participantIds = props.task.participants.map((item) => item.id);
      form.priority = props.task.priority;
      form.status = props.task.status;
      form.progress = props.task.progress;
      form.plannedStartDate = props.task.plannedStartDate ? dayjs(props.task.plannedStartDate) : undefined;
      form.plannedEndDate = props.task.plannedEndDate ? dayjs(props.task.plannedEndDate) : undefined;
      form.actualStartDate = props.task.actualStartDate ? dayjs(props.task.actualStartDate) : undefined;
      form.actualEndDate = props.task.actualEndDate ? dayjs(props.task.actualEndDate) : undefined;
      form.description = props.task.description ?? '';
    } else {
      form.title = '';
      form.assigneeId = undefined;
      form.participantIds = [];
      form.priority = 'P2';
      form.status = props.defaultStatus ?? 'TODO';
      form.progress = 0;
      form.plannedStartDate = undefined;
      form.plannedEndDate = undefined;
      form.actualStartDate = undefined;
      form.actualEndDate = undefined;
      form.description = '';
    }
  },
);

const userOptions = computed(() =>
  props.users.map((user) => ({ value: user.id, label: `${user.displayName}（${user.username}）` })),
);

/** 参与人里不重复放负责人，避免卡片上同一个人出现两次 */
const participantOptions = computed(() =>
  userOptions.value.filter((option) => option.value !== form.assigneeId),
);

function filterByLabel(input: string, option: { label?: string }) {
  return String(option.label ?? '').toLowerCase().includes(input.toLowerCase());
}

const willForceDone = computed(() => form.status === 'DONE' && form.progress !== 100);
const plannedRangeInvalid = computed(
  () => !!form.plannedStartDate && !!form.plannedEndDate && form.plannedStartDate.isAfter(form.plannedEndDate, 'day'),
);
const actualRangeInvalid = computed(
  () => !!form.actualStartDate && !!form.actualEndDate && form.actualStartDate.isAfter(form.actualEndDate, 'day'),
);

/** 选了负责人后，如果参与人里还有他，就自动摘掉，保持两栏语义不重叠 */
watch(
  () => form.assigneeId,
  (assigneeId) => {
    if (assigneeId && form.participantIds.includes(assigneeId)) {
      form.participantIds = form.participantIds.filter((id) => id !== assigneeId);
    }
  },
);

async function submit() {
  if (!form.title.trim()) {
    message.warning('请输入任务标题');
    return;
  }

  const progress = form.status === 'DONE' ? 100 : form.progress;
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    message.warning('进度只能填 0 到 100 之间的整数');
    return;
  }

  saving.value = true;
  try {
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      assigneeId: form.assigneeId ?? null,
      participantIds: form.participantIds,
      priority: form.priority,
      status: form.status,
      progress,
      plannedStartDate: form.plannedStartDate ? form.plannedStartDate.format('YYYY-MM-DD') : null,
      plannedEndDate: form.plannedEndDate ? form.plannedEndDate.format('YYYY-MM-DD') : null,
      actualStartDate: form.actualStartDate ? form.actualStartDate.format('YYYY-MM-DD') : null,
      actualEndDate: form.actualEndDate ? form.actualEndDate.format('YYYY-MM-DD') : null,
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
    width="680px"
    @ok="submit"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" style="margin-top: 8px">
      <a-form-item label="标题" required>
        <a-input v-model:value="form.title" placeholder="例如：登录模块功能测试" :maxlength="200" show-count />
      </a-form-item>

      <a-row :gutter="12">
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
        <a-col :span="12">
          <a-form-item label="参与人">
            <a-select
              v-model:value="form.participantIds"
              mode="multiple"
              :options="participantOptions"
              placeholder="可多选，留空表示无"
              allow-clear
              show-search
              :max-tag-count="3"
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
          <a-form-item label="进度（%）">
            <a-input-number
              v-model:value="form.progress"
              :min="0"
              :max="100"
              :precision="0"
              :step="5"
              :disabled="form.status === 'DONE'"
              style="width: 100%"
              placeholder="0-100 的整数"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <div v-if="willForceDone" class="hint">
        状态为「已完成」时进度会强制为 100%（保存后生效）
      </div>

      <a-divider orientation="left" style="margin: 8px 0 12px">
        <span class="divider-text">计划日期</span>
      </a-divider>
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="计划开始日期">
            <a-date-picker v-model:value="form.plannedStartDate" style="width: 100%" placeholder="选择日期" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="计划结束日期">
            <a-date-picker
              v-model:value="form.plannedEndDate"
              style="width: 100%"
              placeholder="选择日期"
              :status="plannedRangeInvalid ? 'error' : undefined"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <div v-if="plannedRangeInvalid" class="hint">计划开始日期晚于计划结束日期，请确认</div>

      <a-divider orientation="left" style="margin: 8px 0 12px">
        <span class="divider-text">实际日期</span>
      </a-divider>
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="实际开始日期">
            <a-date-picker v-model:value="form.actualStartDate" style="width: 100%" placeholder="选择日期" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="实际结束日期">
            <a-date-picker
              v-model:value="form.actualEndDate"
              style="width: 100%"
              placeholder="选择日期"
              :status="actualRangeInvalid ? 'error' : undefined"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <div v-if="actualRangeInvalid" class="hint">实际开始日期晚于实际结束日期，请确认</div>

      <a-form-item label="描述" style="margin-top: 16px">
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
  margin-bottom: 8px;
}

.divider-text {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}
</style>
