<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import type { VersionStatus, VersionView } from '@/types';
import { versionsApi } from '@/api';
import { errorText } from '@/api/http';
import { VERSION_STATUS_LABELS } from '@/utils/labels';

const props = defineProps<{ open: boolean; version: VersionView | null }>();
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'saved'): void;
}>();

const form = reactive({
  name: '',
  description: '',
  status: 'TESTING' as VersionStatus,
  testStartDate: undefined as dayjs.Dayjs | undefined,
  plannedReleaseDate: undefined as dayjs.Dayjs | undefined,
});

const saving = ref(false);
const isEdit = computed(() => !!props.version);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.name = props.version?.name ?? '';
    form.description = props.version?.description ?? '';
    form.status = props.version?.status ?? 'TESTING';
    form.testStartDate = props.version?.testStartDate ? dayjs(props.version.testStartDate) : undefined;
    form.plannedReleaseDate = props.version?.plannedReleaseDate
      ? dayjs(props.version.plannedReleaseDate)
      : undefined;
  },
);

async function submit() {
  if (!form.name.trim()) {
    message.warning('请输入版本号');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      testStartDate: form.testStartDate ? form.testStartDate.format('YYYY-MM-DD') : null,
      plannedReleaseDate: form.plannedReleaseDate ? form.plannedReleaseDate.format('YYYY-MM-DD') : null,
    };
    if (props.version) await versionsApi.update(props.version.id, payload);
    else await versionsApi.create(payload);

    message.success(props.version ? '版本已更新' : '版本已创建');
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
    :title="isEdit ? '编辑版本' : '新建版本'"
    :confirm-loading="saving"
    ok-text="保存"
    cancel-text="取消"
    width="560px"
    @ok="submit"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical" style="margin-top: 8px">
      <a-form-item label="版本号" required>
        <a-input v-model:value="form.name" placeholder="例如：R25C14" :maxlength="80" />
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="提测日期">
            <a-date-picker v-model:value="form.testStartDate" style="width: 100%" placeholder="选择日期" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="计划发布日期">
            <a-date-picker v-model:value="form.plannedReleaseDate" style="width: 100%" placeholder="选择日期" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="版本状态">
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
