<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import type { ProjectStatus, ProjectView } from '@/types';
import { projectsApi } from '@/api';
import { errorText } from '@/api/http';
import { PROJECT_STATUS_ORDER } from '@/utils/labels';
import { localizeDemoText } from '@/utils/demo-content';

const props = defineProps<{ open: boolean; project: ProjectView | null }>();
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'saved'): void;
}>();

const { t } = useI18n();

const form = reactive({
  name: '',
  description: '',
  status: 'ACTIVE' as ProjectStatus,
  startDate: undefined as dayjs.Dayjs | undefined,
  endDate: undefined as dayjs.Dayjs | undefined,
});

const saving = ref(false);
const isEdit = computed(() => !!props.project);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.name = localizeDemoText(props.project?.name) || '';
    form.description = localizeDemoText(props.project?.description) || '';
    form.status = props.project?.status ?? 'ACTIVE';
    form.startDate = props.project?.startDate ? dayjs(props.project.startDate) : undefined;
    form.endDate = props.project?.endDate ? dayjs(props.project.endDate) : undefined;
  },
);

async function submit() {
  if (!form.name.trim()) {
    message.warning(t('project.nameRequired'));
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      startDate: form.startDate ? form.startDate.format('YYYY-MM-DD') : null,
      endDate: form.endDate ? form.endDate.format('YYYY-MM-DD') : null,
    };
    if (props.project) await projectsApi.update(props.project.id, payload);
    else await projectsApi.create(payload);

    message.success(t('project.saved'));
    emit('saved');
    emit('update:open', false);
  } catch (error) {
    message.error(errorText(error, t('project.saveFailed')));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <a-modal
    :open="open"
    :title="isEdit ? t('project.formEdit') : t('project.formCreate')"
    :confirm-loading="saving"
    :ok-text="t('common.save')"
    :cancel-text="t('common.cancel')"
    width="560px"
    @ok="submit"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" style="margin-top: 8px">
      <a-form-item :label="t('project.name')" required>
        <a-input v-model:value="form.name" placeholder="R25C14" :maxlength="80" />
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item :label="t('project.startDate')">
            <a-date-picker
              v-model:value="form.startDate"
              style="width: 100%"
              :placeholder="t('task.datePlaceholder')"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item :label="t('project.endDate')">
            <a-date-picker
              v-model:value="form.endDate"
              style="width: 100%"
              :placeholder="t('task.datePlaceholder')"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item :label="t('common.status')">
        <a-radio-group v-model:value="form.status" button-style="solid">
          <a-radio-button v-for="value in PROJECT_STATUS_ORDER" :key="value" :value="value">
            {{ t(`labels.projectStatus.${value}`) }}
          </a-radio-button>
        </a-radio-group>
      </a-form-item>

      <a-form-item :label="t('project.description')">
        <a-textarea v-model:value="form.description" :rows="3" :maxlength="2000" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
