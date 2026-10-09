<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import dayjs from 'dayjs';

// 固定中文文案与时区展示，避免不同浏览器 locale 导致日期/分页文案不一致
dayjs.locale('zh-cn');
</script>

<template>
  <a-config-provider :locale="zhCN">
    <router-view />
  </a-config-provider>
</template>
