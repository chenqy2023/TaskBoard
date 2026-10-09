import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { authApi } from '@/api';
import { TOKEN_KEY } from '@/api/http';
import type { User } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) ?? '');
  const user = ref<User | null>(null);
  const loading = ref(false);

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  function setToken(value: string) {
    token.value = value;
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function login(username: string, password: string) {
    loading.value = true;
    try {
      const result = await authApi.login(username, password);
      setToken(result.accessToken);
      user.value = result.user;
      return result.user;
    } finally {
      loading.value = false;
    }
  }

  /** 刷新页面后用 token 换回用户信息；失败说明 token 已失效 */
  async function fetchMe() {
    if (!token.value) return null;
    try {
      user.value = await authApi.me();
      return user.value;
    } catch {
      setToken('');
      user.value = null;
      return null;
    }
  }

  function logout() {
    setToken('');
    user.value = null;
  }

  return { token, user, loading, isLoggedIn, isAdmin, login, fetchMe, logout, setToken };
});
