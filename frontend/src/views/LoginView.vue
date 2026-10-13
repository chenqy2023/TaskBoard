<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { errorText } from '@/api/http';
import LocaleSwitcher from '@/components/LocaleSwitcher.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const form = reactive({ username: '', password: '' });
const submitting = ref(false);

async function submit() {
  if (!form.username.trim() || !form.password) {
    message.warning(t('auth.needCredentials'));
    return;
  }
  submitting.value = true;
  try {
    await auth.login(form.username.trim(), form.password);
    message.success(t('auth.loginSuccess'));
    const redirect = route.query.redirect as string | undefined;
    await router.replace(redirect && redirect !== '/login' ? redirect : '/projects');
  } catch (error) {
    message.error(errorText(error, t('auth.loginFailed')));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-locale">
      <LocaleSwitcher tone="dark" />
    </div>

    <div class="login-card">
      <div class="login-cover">
        <span class="login-mark">{{ t('app.mark') }}</span>
        <span class="login-title">{{ t('app.name') }}</span>
      </div>

      <div class="login-body">
        <a-form layout="vertical" @submit.prevent="submit">
          <a-form-item :label="t('auth.username')">
            <a-input
              v-model:value="form.username"
              size="large"
              :placeholder="t('auth.usernamePlaceholder')"
              autocomplete="username"
              allow-clear
            >
              <template #prefix><UserOutlined /></template>
            </a-input>
          </a-form-item>

          <a-form-item :label="t('auth.password')">
            <a-input-password
              v-model:value="form.password"
              size="large"
              :placeholder="t('auth.passwordPlaceholder')"
              autocomplete="current-password"
              @press-enter="submit"
            >
              <template #prefix><LockOutlined /></template>
            </a-input-password>
          </a-form-item>

          <a-button
            class="login-submit"
            type="primary"
            size="large"
            block
            :loading="submitting"
            @click="submit"
          >
            {{ t('auth.login') }}
          </a-button>
        </a-form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background-color: var(--tk-bg);
  background-image:
    radial-gradient(700px 400px at 10% -6%, rgba(22, 119, 255, 0.18), transparent 62%),
    radial-gradient(560px 340px at 98% 106%, rgba(82, 196, 26, 0.14), transparent 62%),
    radial-gradient(rgba(9, 30, 66, 0.055) 1px, transparent 1px);
  background-repeat: no-repeat, no-repeat, repeat;
  background-size: auto, auto, 18px 18px;
}

.login-locale {
  position: absolute;
  top: 16px;
  right: 20px;
}

.login-card {
  width: 392px;
  background: var(--tk-surface);
  border: 1px solid var(--tk-hairline);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 20px 48px rgba(9, 30, 66, 0.18), 0 2px 8px rgba(9, 30, 66, 0.08);
  animation: login-rise 0.42s cubic-bezier(0.22, 0.68, 0.36, 1) both;
}

@keyframes login-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-card {
    animation: none;
  }
}

.login-cover {
  position: relative;
  height: 108px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 28px;
  background: linear-gradient(135deg, #0b3a8f 0%, #1677ff 58%, #40a9ff 100%);
  color: #fff;
  overflow: hidden;
}

.login-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.22) 1px, transparent 1px);
  background-size: 16px 16px;
  pointer-events: none;
}

.login-mark {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: none;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.login-title {
  position: relative;
  z-index: 1;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.24);
}

.login-body {
  padding: 26px 28px;
}

.login-body :deep(.ant-form-item) {
  margin-bottom: 18px;
}

.login-body :deep(.ant-form-item-label) {
  padding-bottom: 6px;
}

.login-body :deep(.ant-form-item-label > label) {
  font-size: 13px;
  color: var(--tk-ink-2);
}

.login-body :deep(.ant-input-affix-wrapper) {
  border-radius: var(--tk-radius-sm);
}

.login-submit {
  margin-top: 4px;
  height: 42px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.06em;
  border-radius: var(--tk-radius-sm);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.28);
}

.login-submit:hover {
  box-shadow: 0 6px 16px rgba(22, 119, 255, 0.34);
}
</style>
