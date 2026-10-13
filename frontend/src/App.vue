<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import enUS from 'ant-design-vue/es/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';

const { locale } = useI18n();

const antdLocale = computed(() => (locale.value === 'en' ? enUS : zhCN));

watch(
  locale,
  (value) => {
    dayjs.locale(value === 'en' ? 'en' : 'zh-cn');
  },
  { immediate: true },
);

/**
 * 让 Ant Design Vue 的组件和我们的设计令牌对齐。
 * colorPrimary / borderRadius 必须是字面量（传 var() 会让派生色算不出来）；
 * 纯 CSS 值（字体栈）可以传 var()。
 */
const themeConfig = computed(() => ({
  token: {
    colorPrimary: '#1677ff',
    colorLink: '#1677ff',
    borderRadius: 6,
    borderRadiusSM: 6,
    borderRadiusLG: 10,
    colorBgLayout: '#f0f2f5',
    colorBorderSecondary: '#f0f0f0',
    fontFamily: 'var(--tk-font-ui)',
    fontSize: 14,
  },
}));
</script>

<template>
  <a-config-provider :locale="antdLocale" :theme="themeConfig">
    <router-view :key="String(locale)" />
  </a-config-provider>
</template>
