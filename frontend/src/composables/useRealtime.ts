import { onBeforeUnmount, ref, watch } from 'vue';
import { io, type Socket } from 'socket.io-client';
import { message } from 'ant-design-vue';
import { TOKEN_KEY } from '@/api/http';

export interface RealtimeEvent {
  event: string;
  payload: Record<string, unknown>;
}

/**
 * 订阅某个版本的实时变更。
 * 收到任何事件只做一件事：让调用方重新拉取数据。
 * 不在这里做增量合并——服务端算出的进度/排序才是唯一事实来源，
 * 合并逻辑一旦和服务端口径不一致，看板就会显示错数。
 */
export function useRealtime(versionId: () => string | undefined, onRefresh: (event: RealtimeEvent) => void) {
  const socket = ref<Socket | null>(null);
  const connected = ref(false);
  let debounceTimer: number | undefined;

  const EVENTS = [
    'task.created',
    'task.updated',
    'task.moved',
    'task.deleted',
    'task.batch-updated',
    'comment.created',
    'comment.deleted',
  ];

  function schedule(event: RealtimeEvent) {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => onRefresh(event), 300);
  }

  function connect(id: string | undefined) {
    disconnect();
    if (!id) return;

    const base = import.meta.env.VITE_WS_URL || undefined;
    const instance = base
      ? io(`${base}/ws`, { auth: { token: localStorage.getItem(TOKEN_KEY), versionId: id }, transports: ['websocket', 'polling'] })
      : io('/ws', { auth: { token: localStorage.getItem(TOKEN_KEY), versionId: id }, transports: ['websocket', 'polling'] });

    instance.on('connect', () => {
      connected.value = true;
      instance.emit('subscribe', id);
    });
    instance.on('disconnect', () => {
      connected.value = false;
    });
    instance.on('connect_error', () => {
      connected.value = false;
    });
    for (const event of EVENTS) {
      instance.on(event, (payload: Record<string, unknown>) => schedule({ event, payload }));
    }
    socket.value = instance;
  }

  function disconnect() {
    if (socket.value) {
      socket.value.removeAllListeners();
      socket.value.disconnect();
      socket.value = null;
    }
    connected.value = false;
  }

  watch(versionId, (id) => connect(id), { immediate: true });
  onBeforeUnmount(disconnect);

  return { connected, disconnect };
}

/** 实时事件里带的操作人，用来提示「谁改了什么」 */
export function notifyRemoteChange(event: RealtimeEvent) {
  const by = event.payload?.by as string | undefined;
  const map: Record<string, string> = {
    'task.created': '新建了任务',
    'task.updated': '修改了任务',
    'task.moved': '调整了任务状态',
    'task.deleted': '删除了任务',
    'task.batch-updated': '批量更新了任务',
    'comment.created': '发表了评论',
    'comment.deleted': '删除了评论',
  };
  const action = map[event.event];
  if (by && action) message.info(`${by} ${action}，看板已刷新`, 2);
}
