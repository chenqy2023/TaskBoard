<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message, Modal } from 'ant-design-vue';
import {
  AppstoreOutlined,
  HeartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api';
import { errorText } from '@/api/http';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const collapsed = ref(false);

const selectedKeys = computed(() => {
  if (route.path.startsWith('/versions')) return ['versions'];
  if (route.path.startsWith('/my')) return ['my'];
  if (route.path.startsWith('/users')) return ['users'];
  return [];
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
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible :trigger="null" theme="dark" width="200">
      <div class="brand">
        <span class="brand-mark">TK</span>
        <span v-if="!collapsed" class="brand-text">测试任务看板</span>
      </div>
      <a-menu v-model:selectedKeys="selectedKeys" theme="dark" mode="inline">
        <a-menu-item key="versions" @click="router.push('/versions')">
          <AppstoreOutlined />
          <span>版本管理</span>
        </a-menu-item>
        <a-menu-item key="my" @click="router.push('/my')">
          <HeartOutlined />
          <span>我的待办</span>
        </a-menu-item>
        <a-menu-item v-if="auth.isAdmin" key="users" @click="router.push('/users')">
          <TeamOutlined />
          <span>成员管理</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="app-header">
        <!-- 顶栏底色通栏，内容按同一内容区上限居中，保证用户名与页面右边缘对齐 -->
        <div class="header-inner">
          <div class="header-left">
            <component
              :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined"
              class="collapse-trigger"
              @click="collapsed = !collapsed"
            />
            <span class="header-title">{{ route.meta.title }}</span>
          </div>
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
      </a-layout-header>

      <a-layout-content>
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>

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
.brand {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  color: #fff;
  overflow: hidden;
  white-space: nowrap;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #1677ff;
  font-weight: 700;
  font-size: 13px;
  flex: none;
}

.brand-text {
  font-size: 15px;
  font-weight: 600;
}

.app-header {
  background: #fff;
  padding: 0;
  height: 56px;
  line-height: 56px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.header-inner {
  max-width: var(--tk-content-max);
  margin: 0 auto;
  padding: 0 20px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-trigger {
  font-size: 18px;
  cursor: pointer;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(0, 0, 0, 0.88);
}
</style>
