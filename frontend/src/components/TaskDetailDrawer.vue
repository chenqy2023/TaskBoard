<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';
import type { ActivityView, CommentView, TaskView } from '@/types';
import { commentsApi, tasksApi } from '@/api';
import { errorText } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import {
  ACTIVITY_ACTION_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
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

const canEdit = computed(() => {
  if (!props.task) return false;
  if (auth.isAdmin) return true;
  return props.task.createdBy?.id === auth.user?.id || props.task.assignee?.id === auth.user?.id;
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
  <a-drawer
    :open="open"
    :width="560"
    :body-style="{ paddingBottom: '16px' }"
    @close="emit('update:open', false)"
  >
    <template #title>
      <div class="drawer-title">
        <span>{{ task?.title ?? '任务详情' }}</span>
        <a-tag v-if="task" :color="TASK_STATUS_COLORS[task.status]">
          {{ TASK_STATUS_LABELS[task.status] }}
        </a-tag>
      </div>
    </template>

    <a-spin :spinning="loading">
      <template v-if="task">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="优先级">
            <span :style="{ color: priorityColor(task.priority), fontWeight: 600 }">
              {{ PRIORITY_LABELS[task.priority] }}
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="模块">{{ task.module || '—' }}</a-descriptions-item>
          <a-descriptions-item label="负责人">
            <UserOutlined />
            {{ task.assignee?.displayName ?? '未分配' }}
          </a-descriptions-item>
          <a-descriptions-item label="截止日期">
            <span :class="{ 'text-danger': task.overdue }">
              <ClockCircleOutlined />
              {{ task.dueDate ?? '未设置' }}
              <template v-if="task.overdue">（已逾期）</template>
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="创建人">{{ task.createdBy?.displayName ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ dayjs(task.createdAt).format('YYYY-MM-DD HH:mm') }}
          </a-descriptions-item>
          <a-descriptions-item label="进度" :span="2">
            <a-progress
              :percent="task.progress"
              :stroke-color="progressColor(task.status, task.progress)"
            />
          </a-descriptions-item>
          <a-descriptions-item v-if="task.description" label="描述" :span="2">
            <div class="description">{{ task.description }}</div>
          </a-descriptions-item>
        </a-descriptions>

        <div class="actions">
          <a-button v-if="canEdit" size="small" @click="emit('edit', task)">
            <EditOutlined />
            编辑
          </a-button>
          <a-button v-if="canDelete" size="small" danger @click="removeTask">
            <DeleteOutlined />
            删除
          </a-button>
          <span v-if="!canEdit" class="text-muted" style="font-size: 12px">
            只能修改自己创建或自己负责的任务
          </span>
        </div>

        <a-divider orientation="left" style="margin: 16px 0 12px">评论（{{ comments.length }}）</a-divider>

        <div v-if="comments.length === 0" class="text-muted empty">还没有评论</div>
        <div v-for="comment in comments" :key="comment.id" class="comment">
          <div class="comment-head">
            <b>{{ comment.author.displayName }}</b>
            <span class="text-muted">{{ dayjs(comment.createdAt).format('MM-DD HH:mm') }}</span>
            <a
              v-if="comment.author.id === auth.user?.id || auth.isAdmin"
              class="text-danger"
              @click="removeComment(comment)"
            >
              删除
            </a>
          </div>
          <div class="comment-body">{{ comment.body }}</div>
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

        <a-divider orientation="left" style="margin: 16px 0 12px">操作日志</a-divider>
        <a-timeline v-if="activities.length" class="timeline">
          <a-timeline-item v-for="item in activities" :key="item.id" :color="item.action === 'TASK_DELETED' ? 'red' : 'blue'">
            <div class="log-line">
              <b>{{ item.actor.displayName }}</b>
              {{ ACTIVITY_ACTION_LABELS[item.action] ?? item.action }}
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
      </template>
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 24px;
}

.description {
  white-space: pre-wrap;
  word-break: break-word;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.empty {
  font-size: 12px;
  padding: 4px 0;
}

.comment {
  padding: 8px 10px;
  background: #fafafa;
  border-radius: 6px;
  margin-bottom: 8px;
}

.comment-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 4px;
}

.comment-head a {
  margin-left: auto;
  font-size: 12px;
}

.comment-body {
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-editor {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  margin-top: 8px;
}

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
</style>
