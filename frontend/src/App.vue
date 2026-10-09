<script setup lang="ts">
import { computed } from 'vue';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import dayjs from 'dayjs';

// 固定中文文案与时区展示，避免不同浏览器 locale 导致日期/分页文案不一致
dayjs.locale('zh-cn');

/**
 * 让 Ant Design Vue 的组件和我们的设计令牌对齐。
 * 之前这里只设了 locale，主题完全没定制，所以按钮/输入框/弹窗的圆角、
 * 主色、字体都和 main.css 里的令牌各走各的。
 *
 * 注意：colorPrimary / borderRadius 这类会被 AntDV 的色板算法派生的值
 * 必须是字面量（传 var() 会让派生色算不出来）；纯 CSS 值（字体栈）可以传 var()。
 */
const themeConfig = computed(() => ({
  token: {
    colorPrimary: '#1677ff', // 与 --tk-brand 一致
    colorLink: '#1677ff',
    // 三档都要显式给：小号控件（表格里的按钮、输入框）取的是 borderRadiusSM，
    // 只设 borderRadius 管不到它，会出现同页两种圆角
    borderRadius: 6, // 与 --tk-radius-sm 一致
    borderRadiusSM: 6,
    borderRadiusLG: 10, // 与 --tk-radius-md 一致
    colorBgLayout: '#f0f2f5', // 与 --tk-bg 一致
    colorBorderSecondary: '#f0f0f0', // 与 --tk-line 一致
    fontFamily: 'var(--tk-font-ui)',
    fontSize: 14,
  },
}));
</script>

<template>
  <a-config-provider :locale="zhCN" :theme="themeConfig">
    <router-view />
  </a-config-provider>
</template>
