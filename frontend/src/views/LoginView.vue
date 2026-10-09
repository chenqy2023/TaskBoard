<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { errorText } from '@/api/http';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const form = reactive({ username: '', password: '' });
const submitting = ref(false);

async function submit() {
  if (!form.username.trim() || !form.password) {
    message.warning('请输入账号和密码');
    return;
  }
  submitting.value = true;
  try {
    await auth.login(form.username.trim(), form.password);
    message.success('登录成功');
    const redirect = route.query.redirect as string | undefined;
    await router.replace(redirect && redirect !== '/login' ? redirect : '/projects');
  } catch (error) {
    message.error(errorText(error, '账号或密码错误'));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-head">
        <div class="logo">TK</div>
        <h1>任务看板</h1>
        <p class="text-muted">项目测试进度与任务管理</p>
      </div>

      <a-form layout="vertical" @submit.prevent="submit">
        <a-form-item label="账号">
          <a-input v-model:value="form.username" size="large" placeholder="登录账号" allow-clear>
            <template #prefix><UserOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item label="密码">
          <a-input-password v-model:value="form.password" size="large" placeholder="密码" @press-enter="submit">
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>
        <a-button type="primary" size="large" block :loading="submitting" @click="submit">
          登 录
        </a-button>
      </a-form>

      <p class="login-tip text-muted">
        首次部署的初始账号由 <code>ADMIN_INITIAL_PASSWORD</code> 决定，登录后请及时修改密码。
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--tk-brand-tint) 0%, var(--tk-bg) 45%, var(--tk-success-tint) 100%);
}

.login-card {
  width: 380px;
  background: var(--tk-surface);
  border-radius: var(--tk-radius-md);
  padding: 32px 32px 24px;
  box-shadow: var(--tk-shadow-panel);
}

.login-head {
  text-align: center;
  margin-bottom: 20px;
}

.login-head h1 {
  font-size: 20px;
  margin: 12px 0 4px;
}

.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--tk-radius-md);
  background: var(--tk-brand);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
}

.login-tip {
  font-size: 12px;
  margin: 16px 0 0;
  line-height: 1.6;
}
</style>
