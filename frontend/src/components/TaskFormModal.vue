<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import type { Priority, TaskStatus, TaskView, User } from '@/types';
import { tasksApi } from '@/api';
import { errorText } from '@/api/http';
import { PRIORITY_ORDER, TASK_STATUS_ORDER } from '@/utils/labels';
import { localizeDemoText } from '@/utils/demo-content';

const props = defineProps<{
  open: boolean;
  projectId: string;
  task: TaskView | null;
  users: User[];
  defaultStatus?: TaskStatus;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'saved', task: TaskView): void;
}>();

const { t } = useI18n();

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
      form.title = localizeDemoText(props.task.title);
      form.assigneeId = props.task.assignee?.id;
      form.participantIds = props.task.participants.map((item) => item.id);
      form.priority = props.task.priority;
      form.status = props.task.status;
      form.progress = props.task.progress;
      form.plannedStartDate = props.task.plannedStartDate ? dayjs(props.task.plannedStartDate) : undefined;
      form.plannedEndDate = props.task.plannedEndDate ? dayjs(props.task.plannedEndDate) : undefined;
      form.actualStartDate = props.task.actualStartDate ? dayjs(props.task.actualStartDate) : undefined;
      form.actualEndDate = props.task.actualEndDate ? dayjs(props.task.actualEndDate) : undefined;
      form.description = localizeDemoText(props.task.description) || '';
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
    message.warning(t('task.titleRequired'));
    return;
  }

  const progress = form.status === 'DONE' ? 100 : form.progress;
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    message.warning(t('task.progressInvalid'));
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
      : await tasksApi.create({ ...payload, projectId: props.projectId });

    message.success(props.task ? t('task.updated') : t('task.created'));
    emit('saved', saved);
    emit('update:open', false);
  } catch (error) {
    message.error(errorText(error, t('task.saveFailed')));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <a-modal
    :open="open"
    :title="isEdit ? t('task.editTitle') : t('task.createTitle')"
    :confirm-loading="saving"
    :ok-text="t('common.save')"
    :cancel-text="t('common.cancel')"
    width="720px"
    centered
    destroy-on-close
    :body-style="{ padding: '0' }"
    @ok="submit"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" class="task-form" @submit.prevent="submit">
      <!-- 标题单独成块：唯一必填，视觉权重最高 -->
      <section class="form-block form-block--title">
        <a-form-item :label="t('task.title')" required class="title-item">
          <a-input
            v-model:value="form.title"
            size="large"
            :placeholder="t('task.titlePlaceholder')"
            :maxlength="200"
            show-count
            allow-clear
          />
        </a-form-item>
      </section>

      <section class="form-block">
        <div class="block-label">{{ t('task.peopleBlock') }}</div>
        <div class="field-grid field-grid--2">
          <a-form-item :label="t('task.assignee')">
            <a-select
              v-model:value="form.assigneeId"
              :options="userOptions"
              :placeholder="t('common.unassigned')"
              allow-clear
              show-search
              :filter-option="filterByLabel"
            />
          </a-form-item>
          <a-form-item :label="t('task.participants')">
            <a-select
              v-model:value="form.participantIds"
              mode="multiple"
              :options="participantOptions"
              :placeholder="t('task.participantsPlaceholder')"
              allow-clear
              show-search
              :max-tag-count="3"
              :filter-option="filterByLabel"
            />
          </a-form-item>
        </div>
      </section>

      <section class="form-block">
        <div class="block-label">{{ t('task.execBlock') }}</div>
        <div class="field-grid field-grid--3">
          <a-form-item :label="t('task.priority')">
            <a-select v-model:value="form.priority">
              <a-select-option v-for="p in PRIORITY_ORDER" :key="p" :value="p">
                {{ t(`labels.priority.${p}`) }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="t('task.status')">
            <a-select v-model:value="form.status">
              <a-select-option v-for="s in TASK_STATUS_ORDER" :key="s" :value="s">
                {{ t(`labels.taskStatus.${s}`) }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="t('task.progress')">
            <a-input-number
              v-model:value="form.progress"
              :min="0"
              :max="100"
              :precision="0"
              :step="5"
              :disabled="form.status === 'DONE'"
              class="progress-input"
              :placeholder="t('task.progressPlaceholder')"
            >
              <template #addonAfter>%</template>
            </a-input-number>
          </a-form-item>
        </div>
        <p v-if="willForceDone" class="hint" role="status">
          {{ t('task.forceDoneHint') }}
        </p>
      </section>

      <section class="form-block form-block--dates">
        <div class="block-label">{{ t('task.datesBlock') }}</div>
        <div class="date-panels">
          <div class="date-panel">
            <div class="date-panel-title">{{ t('task.plannedPanel') }}</div>
            <div class="field-grid field-grid--2">
              <a-form-item :label="t('task.startShort')">
                <a-date-picker
                  v-model:value="form.plannedStartDate"
                  class="full-width"
                  :placeholder="t('task.datePlaceholder')"
                />
              </a-form-item>
              <a-form-item :label="t('task.endShort')">
                <a-date-picker
                  v-model:value="form.plannedEndDate"
                  class="full-width"
                  :placeholder="t('task.datePlaceholder')"
                  :status="plannedRangeInvalid ? 'error' : undefined"
                />
              </a-form-item>
            </div>
            <p v-if="plannedRangeInvalid" class="hint" role="alert">{{ t('task.rangeInvalid') }}</p>
          </div>

          <div class="date-panel date-panel--secondary">
            <div class="date-panel-title">{{ t('task.actualPanel') }}</div>
            <div class="field-grid field-grid--2">
              <a-form-item :label="t('task.startShort')">
                <a-date-picker
                  v-model:value="form.actualStartDate"
                  class="full-width"
                  :placeholder="t('task.datePlaceholder')"
                />
              </a-form-item>
              <a-form-item :label="t('task.endShort')">
                <a-date-picker
                  v-model:value="form.actualEndDate"
                  class="full-width"
                  :placeholder="t('task.datePlaceholder')"
                  :status="actualRangeInvalid ? 'error' : undefined"
                />
              </a-form-item>
            </div>
            <p v-if="actualRangeInvalid" class="hint" role="alert">{{ t('task.rangeInvalid') }}</p>
          </div>
        </div>
      </section>

      <section class="form-block form-block--last">
        <div class="block-label">{{ t('task.description') }}</div>
        <a-form-item class="desc-item">
          <a-textarea
            v-model:value="form.description"
            :rows="3"
            :maxlength="5000"
            :placeholder="t('task.descPlaceholder')"
            :auto-size="{ minRows: 3, maxRows: 6 }"
          />
        </a-form-item>
      </section>
    </a-form>
  </a-modal>
</template>

<style scoped>
.task-form {
  padding: 4px 24px 8px;
  max-height: min(72vh, 680px);
  overflow-y: auto;
}

.form-block {
  padding: 14px 0 4px;
  border-top: 1px solid var(--tk-line);
}

.form-block--title {
  border-top: 0;
  padding-top: 8px;
}

.form-block--last {
  padding-bottom: 4px;
}

/* 与任务详情弹窗同一套 micro 分区标签，保证扫视语言一致 */
.block-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--tk-ink-3);
  margin-bottom: 10px;
}

.field-grid {
  display: grid;
  gap: 0 14px;
}

.field-grid--2 {
  grid-template-columns: 1fr 1fr;
}

.field-grid--3 {
  grid-template-columns: 1fr 1fr 1fr;
}

.task-form :deep(.ant-form-item) {
  margin-bottom: 12px;
}

.task-form :deep(.ant-form-item-label) {
  padding-bottom: 4px;
}

.task-form :deep(.ant-form-item-label > label) {
  font-size: 13px;
  color: var(--tk-ink-2);
}

.title-item :deep(.ant-input-affix-wrapper-lg),
.title-item :deep(.ant-input-lg) {
  font-size: 15px;
  font-weight: 500;
}

.desc-item {
  margin-bottom: 0 !important;
}

.progress-input {
  width: 100%;
}

.full-width {
  width: 100%;
}

/* 计划 / 实际并排，避免两条 divider 纵向堆叠占高 */
.date-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.date-panel {
  padding: 12px 14px 2px;
  border: 1px solid var(--tk-hairline);
  border-radius: var(--tk-radius-sm);
  background: var(--tk-panel);
}

.date-panel--secondary {
  background: #fafbfc;
}

.date-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--tk-ink-2);
  margin-bottom: 8px;
}

.date-panel :deep(.ant-form-item) {
  margin-bottom: 10px;
}

.hint {
  margin: -2px 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--tk-warn);
}

@media (max-width: 640px) {
  .field-grid--2,
  .field-grid--3,
  .date-panels {
    grid-template-columns: 1fr;
  }
}
</style>
