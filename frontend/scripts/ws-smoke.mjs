/**
 * 实时通道冒烟：验证 Socket.IO 能穿过 nginx（含 Upgrade 头）。
 *
 * 用法（在 frontend 目录下执行，用的是 frontend 已装的 socket.io-client）：
 *   node scripts/ws-smoke.mjs                                   # 默认 http://localhost:8080
 *   node scripts/ws-smoke.mjs http://localhost:3000             # 直连后端，对比用
 *
 * 关键点：只允许 websocket 传输，不接受 polling 降级——
 * 因为 nginx 少配 Upgrade 头时 Socket.IO 会静默退化成轮询，
 * 接口全通但"实时同步"没反应，这种问题必须显式测出来。
 */
import { io } from 'socket.io-client';

const base = (process.argv[2] ?? 'http://localhost:8080').replace(/\/$/, '');
const api = `${base}/api`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? '通过' : '失败'}] ${name}${ok || !detail ? '' : ` —— ${detail}`}`);
}

async function call(method, path, token, body) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, data: parsed };
}

const login = await call('POST', '/auth/login', null, {
  username: process.env.ADMIN_USERNAME ?? 'admin',
  password: process.env.ADMIN_INITIAL_PASSWORD ?? 'Admin@123456',
});
if (!login.data?.accessToken) {
  console.error('登录失败，无法继续：', login.status, login.data);
  process.exit(1);
}
const token = login.data.accessToken;
console.log(`实时通道冒烟 -> ${base}\n`);

const projectName = `WS-SMOKE-${Date.now()}`;
const created = await call('POST', '/projects', token, { name: projectName });
const projectId = created.data?.id;
check('建立测试项目', !!projectId, `状态 ${created.status}`);

const socket = io(`${base}/ws`, {
  auth: { token, projectId },
  transports: ['websocket'],
  reconnection: false,
  timeout: 8000,
});

const received = [];
socket.onAny((event, payload) => received.push({ event, payload }));

const connected = await new Promise((resolve) => {
  socket.on('connect', () => resolve(true));
  socket.on('connect_error', (error) => {
    console.log(`    connect_error: ${error.message}`);
    resolve(false);
  });
  setTimeout(() => resolve(false), 8000);
});

check('WebSocket 握手成功（未降级为轮询）', connected, `实际 transports=${socket.io.engine?.transport?.name ?? 'none'}`);
check('传输协议确实是 websocket', socket.io?.engine?.transport?.name === 'websocket');

// 服务端广播需要房间，显式订阅一次更稳
socket.emit('subscribe', projectId);
await new Promise((r) => setTimeout(r, 500));

const taskCreated = await call('POST', '/tasks', token, {
  projectId,
  title: '实时同步验证任务',
  priority: 'P1',
  plannedEndDate: '2026-10-31',
});
check('通过接口新建任务', taskCreated.status === 201, `状态 ${taskCreated.status}`);

const taskId = taskCreated.data?.id;
const gotEvent = await new Promise((resolve) => {
  const deadline = Date.now() + 6000;
  const timer = setInterval(() => {
    const hit = received.find((item) => item.event === 'task.created' && item.payload?.task?.id === taskId);
    if (hit) {
      clearInterval(timer);
      resolve(hit);
    } else if (Date.now() > deadline) {
      clearInterval(timer);
      resolve(null);
    }
  }, 200);
});
check('收到 task.created 推送', !!gotEvent, `收到的事件：${[...new Set(received.map((r) => r.event))].join(', ') || '（无）'}`);
check('推送载荷带操作人', !!gotEvent?.payload?.by);

const moved = await call('PATCH', `/tasks/${taskId}/status`, token, { status: 'DONE', targetIndex: 0 });
check('拖拽接口可调用', moved.status === 200, `状态 ${moved.status}`);
const gotMoved = await new Promise((resolve) => {
  const deadline = Date.now() + 6000;
  const timer = setInterval(() => {
    const hit = received.find((item) => item.event === 'task.moved' && item.payload?.task?.id === taskId);
    if (hit) {
      clearInterval(timer);
      resolve(hit);
    } else if (Date.now() > deadline) {
      clearInterval(timer);
      resolve(null);
    }
  }, 200);
});
check('收到 task.moved 推送', !!gotMoved);
check('拖到已完成进度为 100', gotMoved?.payload?.task?.progress === 100, `实际 ${gotMoved?.payload?.task?.progress}`);

socket.disconnect();
await call('DELETE', `/projects/${projectId}?force=true`, token);

const failed = results.filter((item) => !item.ok);
console.log(`\n结果：通过 ${results.length - failed.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
