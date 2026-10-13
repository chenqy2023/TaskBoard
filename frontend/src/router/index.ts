import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { registerDocumentTitleRefresh, tGlobal } from '@/i18n';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, titleKey: 'route.login' },
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
        meta: { titleKey: 'route.projects' },
      },
      {
        path: 'projects/:id/board',
        name: 'board',
        component: () => import('@/views/BoardView.vue'),
        meta: { titleKey: 'route.board' },
      },
      {
        path: 'projects/:id/tasks',
        name: 'task-list',
        component: () => import('@/views/TaskListView.vue'),
        meta: { titleKey: 'route.taskList' },
      },
      {
        path: 'projects/:id/stats',
        name: 'stats',
        component: () => import('@/views/StatsView.vue'),
        meta: { titleKey: 'route.stats' },
      },
      {
        path: 'my',
        name: 'my-tasks',
        component: () => import('@/views/MyTasksView.vue'),
        meta: { titleKey: 'route.myTasks' },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/UsersView.vue'),
        meta: { titleKey: 'route.users', adminOnly: true },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/projects' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export function applyDocumentTitle(titleKey?: string) {
  if (titleKey) {
    document.title = tGlobal('app.titleSuffix', { title: tGlobal(titleKey) });
  } else {
    document.title = tGlobal('app.name');
  }
}

registerDocumentTitleRefresh(() => {
  applyDocumentTitle(router.currentRoute.value.meta.titleKey as string | undefined);
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta.public) return true;

  if (!auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

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
  applyDocumentTitle(to.meta.titleKey as string | undefined);
});
