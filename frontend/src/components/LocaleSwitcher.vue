<script setup lang="ts">
import { computed } from 'vue';
import { GlobalOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { setAppLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';

const props = withDefaults(
  defineProps<{
    /** 顶栏深色底用 light；登录页浅色底用 dark */
    tone?: 'light' | 'dark';
  }>(),
  { tone: 'light' },
);

const { locale, t } = useI18n();

const options = computed(() =>
  SUPPORTED_LOCALES.map((item) => ({
    value: item.value,
    label: t(item.labelKey),
  })),
);

function onChange(value: unknown) {
  const next = value as AppLocale;
  setAppLocale(next);
  dayjs.locale(next === 'zh-CN' ? 'zh-cn' : 'en');
}
</script>

<template>
  <div class="locale-switcher" :class="[`tone-${props.tone}`]">
    <GlobalOutlined class="locale-icon" aria-hidden="true" />
    <a-select
      :value="locale"
      :options="options"
      size="small"
      :bordered="false"
      :dropdown-match-select-width="false"
      :suffix-icon="null"
      @change="onChange"
    />
  </div>
</template>

<style scoped>
.locale-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 118px;
}

.locale-icon {
  font-size: 14px;
  flex-shrink: 0;
  line-height: 1;
}

.locale-switcher :deep(.ant-select) {
  flex: 1;
  min-width: 0;
}

.tone-light {
  color: rgba(255, 255, 255, 0.88);
}

.tone-light :deep(.ant-select-selector) {
  color: rgba(255, 255, 255, 0.88) !important;
  background: transparent !important;
  padding-inline: 0 !important;
}

.tone-light :deep(.ant-select-selection-item) {
  color: rgba(255, 255, 255, 0.88);
}

.tone-dark {
  color: var(--tk-ink-2);
}

.tone-dark :deep(.ant-select-selector) {
  color: var(--tk-ink-2) !important;
  background: transparent !important;
  padding-inline: 0 !important;
}
</style>
