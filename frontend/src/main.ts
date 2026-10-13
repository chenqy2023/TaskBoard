import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import 'ant-design-vue/dist/reset.css';
import '@/styles/main.css';
import App from '@/App.vue';
import { router } from '@/router';
import { i18n, detectLocale } from '@/i18n';

dayjs.locale(detectLocale() === 'en' ? 'en' : 'zh-cn');

const app = createApp(App);
app.use(createPinia());
app.use(i18n);
app.use(router);
app.use(Antd);
app.mount('#app');
