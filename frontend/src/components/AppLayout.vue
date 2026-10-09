<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message, Modal } from 'ant-design-vue';
import { HeartOutlined, LogoutOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api';
import { errorText } from '@/api/http';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

/**
 * 导航直接在顶栏里，不再有左侧栏——
 * 首页是项目卡片墙，进到某个项目后再用项目内的页签切换看板/列表/统计。
 */
const navItems = computed(() => {
  const items: { key: string; label: string; to: string; icon?: unknown }[] = [
    { key: 'home', label: '项目', to: '/' },
    { key: 'my', label: '我的待办', to: '/my', icon: HeartOutlined },
  ];
  if (auth.isAdmin) {
    items.push({ key: 'users', label: '成员管理', to: '/users', icon: TeamOutlined });
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
    title: '确认退出登录？',
    okText: '退出',
    cancelText: '取消',
    onOk() {
      auth.logout();
      router.push({ name: 'login' });
    },
  });
}

async function submitPassword() {
  if (pwdForm.newPassword.length < 6) {
    message.warning('新密码至少 6 位');
    return;
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    message.warning('两次输入的新密码不一致');
    return;
  }
  pwdLoading.value = true;
  try {
    await authApi.changePassword(pwdForm.oldPassword, pwdForm.newPassword);
    message.success('密码已修改，请用新密码重新登录');
    pwdOpen.value = false;
    pwdForm.oldPassword = '';
    pwdForm.newPassword = '';
    pwdForm.confirmPassword = '';
    auth.logout();
    router.push({ name: 'login' });
  } catch (error) {
    message.error(errorText(error, '修改密码失败'));
  } finally {
    pwdLoading.value = false;
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-inner">
        <!-- 点品牌名回首页（项目卡片墙），替代原来侧栏的「项目管理」入口 -->
        <router-link to="/" class="brand">
          <span class="brand-mark">TK</span>
          <span class="brand-text">任务看板</span>
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
          <a-dropdown>
            <a class="user-chip" @click.prevent>
              <UserOutlined />
              <span>{{ auth.user?.displayName }}</span>
              <a-tag :color="auth.isAdmin ? 'gold' : 'blue'" style="margin-left: 4px">
                {{ auth.isAdmin ? '管理员' : '成员' }}
              </a-tag>
            </a>
            <template #overlay>
              <a-menu>
                <a-menu-item key="pwd" @click="pwdOpen = true">修改密码</a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout" @click="logout">
                  <LogoutOutlined />
                  <span style="margin-left: 6px">退出登录</span>
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
    title="修改密码"
    :confirm-loading="pwdLoading"
    ok-text="保存"
    cancel-text="取消"
    @ok="submitPassword"
  >
    <a-form layout="vertical">
      <a-form-item label="原密码" required>
        <a-input-password v-model:value="pwdForm.oldPassword" placeholder="请输入原密码" />
      </a-form-item>
      <a-form-item label="新密码" required>
        <a-input-password v-model:value="pwdForm.newPassword" placeholder="至少 6 位" />
      </a-form-item>
      <a-form-item label="确认新密码" required>
        <a-input-password v-model:value="pwdForm.confirmPassword" placeholder="再次输入新密码" />
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

/* 顶栏导航：项目 / 我的待办 / 成员管理 */
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
