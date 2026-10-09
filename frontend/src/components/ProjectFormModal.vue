<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import type { ProjectStatus, ProjectView } from '@/types';
import { projectsApi } from '@/api';
import { errorText } from '@/api/http';
import { VERSION_STATUS_LABELS } from '@/utils/labels';

const props = defineProps<{ open: boolean; project: ProjectView | null }>();
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'saved'): void;
}>();

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
    form.name = props.project?.name ?? '';
    form.description = props.project?.description ?? '';
    form.status = props.project?.status ?? 'ACTIVE';
    form.startDate = props.project?.startDate ? dayjs(props.project.startDate) : undefined;
    form.endDate = props.project?.endDate
      ? dayjs(props.project.endDate)
      : undefined;
  },
);

async function submit() {
  if (!form.name.trim()) {
    message.warning('请输入项目名称');
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

    message.success(props.project ? '项目已更新' : '项目已创建');
    emit('saved');
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
    :title="isEdit ? '编辑项目' : '新建项目'"
    :confirm-loading="saving"
    ok-text="保存"
    cancel-text="取消"
    width="560px"
    @ok="submit"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" style="margin-top: 8px">
      <a-form-item label="项目名称" required>
        <a-input v-model:value="form.name" placeholder="例如：R25C14" :maxlength="80" />
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="开始日期">
            <a-date-picker v-model:value="form.startDate" style="width: 100%" placeholder="选择日期" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="结束日期">
            <a-date-picker v-model:value="form.endDate" style="width: 100%" placeholder="选择日期" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="项目状态">
        <a-radio-group v-model:value="form.status" button-style="solid">
          <a-radio-button v-for="(label, value) in VERSION_STATUS_LABELS" :key="value" :value="value">
            {{ label }}
          </a-radio-button>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="说明">
        <a-textarea
          v-model:value="form.description"
          :rows="3"
          :maxlength="2000"
          placeholder="本次测试的范围、重点、发布批次等"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
