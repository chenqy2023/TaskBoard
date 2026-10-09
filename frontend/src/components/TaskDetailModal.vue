<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  ProfileOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue';
import type { ActivityView, CommentView, TaskView } from '@/types';
import { commentsApi, tasksApi } from '@/api';
import { errorText } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import {
  PRIORITY_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  activityTitle,
  avatarColor,
  avatarInitial,
  describeActivityValue,
  priorityColor,
  progressColor,
} from '@/utils/labels';

const props = defineProps<{ open: boolean; task: TaskView | null }>();
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'edit', task: TaskView): void;
  (e: 'changed'): void;
}>();

const auth = useAuthStore();
const comments = ref<CommentView[]>([]);
const activities = ref<ActivityView[]>([]);
const draft = ref('');
const submitting = ref(false);
const loading = ref(false);

/** 窄屏时收一点宽度，但不做移动端布局（本项目只保证桌面端） */
const modalWidth = computed(() => Math.min(1040, Math.max(760, window.innerWidth - 120)));

const canEdit = computed(() => {
  if (!props.task) return false;
  if (auth.isAdmin) return true;
  return (
    props.task.createdBy?.id === auth.user?.id ||
    props.task.assignee?.id === auth.user?.id ||
    props.task.participants.some((item) => item.id === auth.user?.id)
  );
});

const canDelete = computed(() => {
  if (!props.task) return false;
  return auth.isAdmin || props.task.createdBy?.id === auth.user?.id;
});

async function load(taskId: string) {
  loading.value = true;
  try {
    const [commentList, activityList] = await Promise.all([
      commentsApi.list(taskId),
      commentsApi.activities(taskId),
    ]);
    comments.value = commentList;
    activities.value = activityList;
  } catch (error) {
    message.error(errorText(error, '加载任务详情失败'));
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.open, props.task?.id] as const,
  ([open, id]) => {
    if (open && id) {
      draft.value = '';
      void load(id);
    }
  },
  { immediate: true },
);

async function submitComment() {
  if (!props.task || !draft.value.trim()) return;
  submitting.value = true;
  try {
    const created = await commentsApi.create(props.task.id, draft.value.trim());
    comments.value = [...comments.value, created];
    draft.value = '';
    emit('changed');
  } catch (error) {
    message.error(errorText(error, '发表评论失败'));
  } finally {
    submitting.value = false;
  }
}

function removeComment(comment: CommentView) {
  Modal.confirm({
    title: '删除这条评论？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await commentsApi.remove(comment.id);
        comments.value = comments.value.filter((item) => item.id !== comment.id);
        emit('changed');
      } catch (error) {
        message.error(errorText(error, '删除评论失败'));
      }
    },
  });
}

function removeTask() {
  if (!props.task) return;
  Modal.confirm({
    title: '确认删除该任务？',
    content: '删除后任务会从看板移除（记录保留在操作日志中）。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await tasksApi.remove(props.task!.id);
        message.success('任务已删除');
        emit('update:open', false);
        emit('changed');
      } catch (error) {
        message.error(errorText(error, '删除失败'));
      }
    },
  });
}
</script>

<template>
  <a-modal
    :open="open"
    :width="modalWidth"
    :footer="null"
    centered
    :body-style="{ padding: 0 }"
    :destroy-on-close="false"
    @cancel="emit('update:open', false)"
  >
    <div v-if="task" class="detail">
      <!-- 头部：标题为主体，状态与优先级跟在后面 -->
      <header class="detail-head">
        <div class="detail-title-row">
          <h3 class="detail-title">{{ task.title }}</h3>
          <a-tag :color="TASK_STATUS_COLORS[task.status]" class="detail-status">
            {{ TASK_STATUS_LABELS[task.status] }}
          </a-tag>
        </div>

        <!-- 大写微标签做字段分组，一眼分清每个区块在读什么 -->
        <div class="meta-grid">
          <div class="meta">
            <div class="micro">负责人</div>
            <div class="meta-body">
              <template v-if="task.assignee">
                <span class="avatar" :style="{ background: avatarColor(task.assignee.displayName) }">
                  {{ avatarInitial(task.assignee.displayName) }}
                </span>
                <span class="meta-text">{{ task.assignee.displayName }}</span>
              </template>
              <span v-else class="meta-muted">未分配</span>
            </div>
          </div>

          <div class="meta">
            <div class="micro">参与人</div>
            <div class="meta-body">
              <template v-if="task.participants.length">
                <span
                  v-for="person in task.participants"
                  :key="person.id"
                  class="avatar"
                  :style="{ background: avatarColor(person.displayName) }"
                  :title="person.displayName"
                >
                  {{ avatarInitial(person.displayName) }}
                </span>
              </template>
              <span v-else class="meta-muted">无</span>
            </div>
          </div>

          <div class="meta">
            <div class="micro">优先级</div>
            <div class="meta-body">
              <span
                class="priority-pill"
                :style="{
                  color: '#fff',
                  background: priorityColor(task.priority),
                }"
              >
                {{ PRIORITY_LABELS[task.priority] }}
              </span>
            </div>
          </div>

          <div class="meta">
            <div class="micro">进度</div>
            <div class="meta-body progress-body">
              <a-progress
                :percent="task.progress"
                size="small"
                :stroke-color="progressColor(task.status, task.progress)"
                :show-info="false"
              />
              <span class="meta-text num">{{ task.progress }}%</span>
            </div>
          </div>
        </div>
      </header>

      <div class="detail-body">
        <!-- 左侧：描述 / 评论 / 操作日志 -->
        <main class="detail-main">
          <section v-if="task.description" class="block">
            <div class="block-title">
              <ProfileOutlined />
              描述
            </div>
            <div class="description">{{ task.description }}</div>
          </section>

          <section class="block">
            <div class="block-title">
              <MessageOutlined />
              评论
              <span v-if="comments.length" class="block-count num">{{ comments.length }}</span>
            </div>

            <div v-if="comments.length === 0" class="text-muted empty">还没有评论</div>
            <div v-for="comment in comments" :key="comment.id" class="comment">
              <span class="avatar avatar-sm" :style="{ background: avatarColor(comment.author.displayName) }">
                {{ avatarInitial(comment.author.displayName) }}
              </span>
              <div class="comment-main">
                <div class="comment-head">
                  <b>{{ comment.author.displayName }}</b>
                  <span class="text-muted">{{ dayjs(comment.createdAt).format('MM-DD HH:mm') }}</span>
                  <a
                    v-if="comment.author.id === auth.user?.id || auth.isAdmin"
                    class="text-danger comment-del"
                    @click="removeComment(comment)"
                  >
                    删除
                  </a>
                </div>
                <div class="comment-body">{{ comment.body }}</div>
              </div>
            </div>

            <div class="comment-editor">
              <a-textarea
                v-model:value="draft"
                :rows="2"
                :maxlength="2000"
                placeholder="补充测试结论、阻塞原因、联调进展……（Ctrl+Enter 发送）"
                @keydown.ctrl.enter="submitComment"
              />
              <a-button type="primary" size="small" :loading="submitting" @click="submitComment">
                发表评论
              </a-button>
            </div>
          </section>

          <section class="block">
            <div class="block-title">
              <UnorderedListOutlined />
              操作日志
            </div>
            <a-timeline v-if="activities.length" class="timeline">
              <a-timeline-item
                v-for="item in activities"
                :key="item.id"
                :color="item.action === 'TASK_DELETED' ? 'red' : 'blue'"
              >
                <div class="log-line">
                  <b>{{ item.actor.displayName }}</b>
                  {{ activityTitle(item.action, item.field) }}
                  <template v-if="item.field && item.field !== 'content' && item.field !== 'body'">
                    <span class="text-muted">
                      {{ describeActivityValue(item.field, item.fromValue) }}
                      →
                      {{ describeActivityValue(item.field, item.toValue) }}
                    </span>
                  </template>
                  <span v-else-if="item.toValue" class="text-muted">{{ item.toValue }}</span>
                </div>
                <div class="text-muted log-time">{{ dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') }}</div>
              </a-timeline-item>
            </a-timeline>
            <div v-else class="text-muted empty">暂无操作记录</div>
          </section>
        </main>

        <!-- 右侧：动作与日期信息，位置固定不随左侧滚动 -->
        <aside class="detail-rail">
          <div class="rail-group">
            <div class="micro rail-title">操作</div>
            <a-button v-if="canEdit" block size="small" @click="emit('edit', task)">
              <EditOutlined />
              编辑任务
            </a-button>
            <a-button v-if="canDelete" block size="small" danger @click="removeTask">
              <DeleteOutlined />
              删除任务
            </a-button>
            <div v-if="!canEdit" class="text-muted rail-hint">
              只能修改自己创建、负责或参与的任务
            </div>
          </div>

          <div class="rail-group">
            <div class="micro rail-title">
              <CalendarOutlined />
              计划日期
            </div>
            <div class="rail-row">
              <span class="rail-key">开始</span>
              <span class="rail-val num">{{ task.plannedStartDate ?? '—' }}</span>
            </div>
            <div class="rail-row">
              <span class="rail-key">结束</span>
              <span class="rail-val num" :class="{ 'text-danger': task.overdue }">
                {{ task.plannedEndDate ?? '—' }}
                <template v-if="task.overdue">（已逾期）</template>
              </span>
            </div>
          </div>

          <div class="rail-group">
            <div class="micro rail-title">
              <CalendarOutlined />
              实际日期
            </div>
            <div class="rail-row">
              <span class="rail-key">开始</span>
              <span class="rail-val num">{{ task.actualStartDate ?? '—' }}</span>
            </div>
            <div class="rail-row">
              <span class="rail-key">结束</span>
              <span class="rail-val num">{{ task.actualEndDate ?? '—' }}</span>
            </div>
          </div>

          <div class="rail-group">
            <div class="micro rail-title">基本信息</div>
            <div v-if="task.version" class="rail-row">
              <span class="rail-key">版本</span>
              <span class="rail-val">{{ task.version.name }}</span>
            </div>
            <div class="rail-row">
              <span class="rail-key">创建人</span>
              <span class="rail-val">{{ task.createdBy?.displayName ?? '—' }}</span>
            </div>
            <div class="rail-row">
              <span class="rail-key">创建时间</span>
              <span class="rail-val num">{{ dayjs(task.createdAt).format('YYYY-MM-DD HH:mm') }}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <div v-else class="detail-loading">
      <a-spin />
    </div>
  </a-modal>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
}

/* ---------- 头部 ---------- */
.detail-head {
  flex: none;
  padding: 18px 48px 16px 24px; /* 右侧留出 Ant 的关闭按钮 */
  border-bottom: 1px solid var(--tk-line);
}

.detail-title-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.detail-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
  word-break: break-word;
}

.detail-status {
  flex: none;
  margin-top: 4px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.meta {
  min-width: 0;
}

/* 大写微标签：小字号 + 字距，把字段名和内容在视觉上分开 */
.micro {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--tk-ink-3);
  margin-bottom: 6px;
}

.meta-body {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 22px;
  flex-wrap: wrap;
}

.meta-text {
  font-size: 13px;
  color: var(--tk-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-muted {
  font-size: 13px;
  color: var(--tk-ink-4);
}

.progress-body :deep(.ant-progress) {
  flex: 1;
  margin: 0;
  min-width: 48px;
}

.priority-pill {
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  padding: 0 8px;
  border-radius: var(--tk-radius-pill);
}

.avatar {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  box-shadow: 0 0 0 1.5px #fff;
  user-select: none;
}

.avatar-sm {
  width: 26px;
  height: 26px;
  font-size: 12px;
}

/* ---------- 主体：左侧滚动，右侧固定 ---------- */
.detail-body {
  display: flex;
  height: min(72vh, 720px);
}

.detail-main {
  flex: 1 1 auto;
  min-width: 0;
  overflow-y: auto;
  padding: 18px 24px 24px;
}

.detail-rail {
  flex: none;
  width: 268px;
  overflow-y: auto;
  padding: 18px 20px 24px;
  border-left: 1px solid var(--tk-line);
  background: var(--tk-panel);
}

.rail-group + .rail-group {
  margin-top: 20px;
}

.rail-title {
  display: flex;
  align-items: center;
  gap: 5px;
}

.rail-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
}

.rail-key {
  flex: none;
  width: 52px;
  color: var(--tk-ink-3);
}

.rail-val {
  color: var(--tk-ink-2);
  word-break: break-word;
}

.rail-hint {
  font-size: 12px;
  line-height: 1.5;
}

/* ---------- 区块 ---------- */
.block + .block {
  margin-top: 22px;
}

.block-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tk-ink-2);
  margin-bottom: 10px;
}

.block-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--tk-ink-3);
  background: #eef0f3;
  border-radius: var(--tk-radius-pill);
  padding: 0 7px;
  line-height: 17px;
}

.description {
  font-size: 13px;
  line-height: 1.7;
  color: var(--tk-ink-2);
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--tk-panel);
  border-radius: var(--tk-radius-sm);
  padding: 12px 14px;
}

.empty {
  font-size: 12px;
  padding: 2px 0;
}

/* ---------- 评论 ---------- */
.comment {
  display: flex;
  gap: 9px;
  margin-bottom: 12px;
}

.comment-main {
  flex: 1;
  min-width: 0;
}

.comment-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 3px;
}

.comment-del {
  margin-left: auto;
  font-size: 12px;
}

.comment-body {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--tk-ink);
}

.comment-editor {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  margin-top: 6px;
}

/* ---------- 日志 ---------- */
.timeline {
  padding-top: 4px;
}

.log-line {
  font-size: 13px;
  word-break: break-word;
}

.log-time {
  font-size: 12px;
}

.detail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}
</style>
