import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/components/AppLayout.vue'),
    children: [
      { path: '', redirect: '/projects' },
      {
        path: 'projects',
        name: 'projects',
        component: () => import('@/views/ProjectsView.vue'),
        meta: { title: '项目管理' },
      },
      {
        path: 'projects/:id/board',
        name: 'board',
        component: () => import('@/views/BoardView.vue'),
        meta: { title: '看板' },
      },
      {
        path: 'projects/:id/tasks',
        name: 'task-list',
        component: () => import('@/views/TaskListView.vue'),
        meta: { title: '任务列表' },
      },
      {
        path: 'projects/:id/stats',
        name: 'stats',
        component: () => import('@/views/StatsView.vue'),
        meta: { title: '统计' },
      },
      {
        path: 'my',
        name: 'my-tasks',
        component: () => import('@/views/MyTasksView.vue'),
        meta: { title: '我的待办' },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/UsersView.vue'),
        meta: { title: '成员管理', adminOnly: true },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/projects' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta.public) return true;

  if (!auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  // 刷新页面后 store 是空的，先换回用户信息再判断权限
  if (!auth.user) {
    const user = await auth.fetchMe();
    if (!user) return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.adminOnly && !auth.isAdmin) {
    return { name: 'projects' };
  }
  return true;
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? '';
  document.title = title ? `${title} · 任务看板` : '任务看板';
});
