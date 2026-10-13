<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { message, Modal } from 'ant-design-vue';
import { HeartOutlined, LogoutOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api';
import { errorText } from '@/api/http';
import { applyDocumentTitle } from '@/router';
import LocaleSwitcher from '@/components/LocaleSwitcher.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t, locale } = useI18n();

watch(locale, () => {
  applyDocumentTitle(route.meta.titleKey as string | undefined);
});

const navItems = computed(() => {
  const items: { key: string; label: string; to: string; icon?: unknown }[] = [
    { key: 'home', label: t('nav.projects'), to: '/' },
    { key: 'my', label: t('nav.myTasks'), to: '/my', icon: HeartOutlined },
  ];
  if (auth.isAdmin) {
    items.push({ key: 'users', label: t('nav.users'), to: '/users', icon: TeamOutlined });
  }
  return items;
});

const activeKey = computed(() => {
  if (route.path.startsWith('/my')) return 'my';
  if (route.path.startsWith('/users')) return 'users';
  return 'home';
});

const pwdOpen = ref(false);
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });
const pwdLoading = ref(false);

function logout() {
  Modal.confirm({
    title: t('auth.logoutConfirm'),
    okText: t('auth.logout'),
    cancelText: t('common.cancel'),
    onOk() {
      auth.logout();
      router.push({ name: 'login' });
    },
  });
}

async function submitPassword() {
  if (pwdForm.newPassword.length < 6) {
    message.warning(t('auth.passwordMin'));
    return;
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    message.warning(t('auth.passwordMismatch'));
    return;
  }
  pwdLoading.value = true;
  try {
    await authApi.changePassword(pwdForm.oldPassword, pwdForm.newPassword);
    message.success(t('auth.passwordChanged'));
    pwdOpen.value = false;
    pwdForm.oldPassword = '';
    pwdForm.newPassword = '';
    pwdForm.confirmPassword = '';
    auth.logout();
    router.push({ name: 'login' });
  } catch (error) {
    message.error(errorText(error, t('auth.changePasswordFailed')));
  } finally {
    pwdLoading.value = false;
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-inner">
        <router-link to="/" class="brand">
          <span class="brand-mark">{{ t('app.mark') }}</span>
          <span class="brand-text">{{ t('app.name') }}</span>
        </router-link>

        <nav class="header-nav">
          <router-link
            v-for="item in navItems"
            :key="item.key"
            :to="item.to"
            class="nav-item"
            :class="{ active: activeKey === item.key }"
          >
            <component :is="item.icon" v-if="item.icon" />
            {{ item.label }}
          </router-link>
        </nav>

        <div class="header-right">
          <LocaleSwitcher tone="light" />
          <a-dropdown>
            <a class="user-chip" @click.prevent>
              <UserOutlined />
              <span>{{ auth.user?.displayName }}</span>
              <a-tag :color="auth.isAdmin ? 'gold' : 'blue'" style="margin-left: 4px">
                {{ auth.isAdmin ? t('role.ADMIN') : t('role.MEMBER') }}
              </a-tag>
            </a>
            <template #overlay>
              <a-menu>
                <a-menu-item key="pwd" @click="pwdOpen = true">{{ t('auth.changePassword') }}</a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout" @click="logout">
                  <LogoutOutlined />
                  <span style="margin-left: 6px">{{ t('auth.logout') }}</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>
    </header>

    <main class="app-main">
      <router-view />
    </main>
  </div>

  <a-modal
    v-model:open="pwdOpen"
    :title="t('auth.changePassword')"
    :confirm-loading="pwdLoading"
    :ok-text="t('common.save')"
    :cancel-text="t('common.cancel')"
    @ok="submitPassword"
  >
    <a-form layout="vertical">
      <a-form-item :label="t('auth.oldPassword')" required>
        <a-input-password v-model:value="pwdForm.oldPassword" :placeholder="t('auth.oldPasswordPlaceholder')" />
      </a-form-item>
      <a-form-item :label="t('auth.newPassword')" required>
        <a-input-password v-model:value="pwdForm.newPassword" :placeholder="t('auth.newPasswordPlaceholder')" />
      </a-form-item>
      <a-form-item :label="t('auth.confirmPassword')" required>
        <a-input-password
          v-model:value="pwdForm.confirmPassword"
          :placeholder="t('auth.confirmPasswordPlaceholder')"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--tk-bg);
}

.app-header {
  flex: none;
  height: var(--tk-header-h);
  background: var(--tk-chrome);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.32);
}

.header-inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 20px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  flex: none;
  text-decoration: none;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--tk-radius-sm);
  background: var(--tk-brand);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  flex: none;
}

.brand-text {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.94);
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.nav-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--tk-radius-sm);
  color: rgba(255, 255, 255, 0.72);
  font-size: 14px;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font-weight: 600;
}

.header-right {
  margin-left: auto;
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.88);
  transition: color 0.15s;
}

.user-chip:hover {
  color: #fff;
}

.app-main {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
