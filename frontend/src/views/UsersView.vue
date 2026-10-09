<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import type { Role, User } from '@/types';
import { usersApi } from '@/api';
import { errorText } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const users = ref<User[]>([]);
const loading = ref(false);
const includeInactive = ref(false);

const formOpen = ref(false);
const editing = ref<User | null>(null);
const saving = ref(false);

const form = reactive({
  username: '',
  displayName: '',
  role: 'MEMBER' as Role,
  password: '',
});

const resetOpen = ref(false);
const resetTarget = ref<User | null>(null);
const resetPassword = ref('');

const columns = [
  { title: '姓名', key: 'displayName', width: 160 },
  { title: '登录账号', key: 'username', width: 160 },
  { title: '角色', key: 'role', width: 100 },
  { title: '状态', key: 'active', width: 90 },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const },
];

const activeCount = computed(() => users.value.filter((user) => user.active).length);

async function load() {
  loading.value = true;
  try {
    users.value = await usersApi.list(includeInactive.value);
  } catch (error) {
    message.error(errorText(error, '加载成员失败'));
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.username = '';
  form.displayName = '';
  form.role = 'MEMBER';
  form.password = '';
  formOpen.value = true;
}

function openEdit(user: User) {
  editing.value = user;
  form.displayName = user.displayName;
  form.role = user.role;
  formOpen.value = true;
}

async function submit() {
  if (!editing.value) {
    if (!form.username.trim() || !form.displayName.trim()) {
      message.warning('请填写登录账号和姓名');
      return;
    }
    if (form.password.length < 6) {
      message.warning('初始密码至少 6 位');
      return;
    }
  } else if (!form.displayName.trim()) {
    message.warning('请填写姓名');
    return;
  }

  saving.value = true;
  try {
    if (editing.value) {
      await usersApi.update(editing.value.id, {
        displayName: form.displayName.trim(),
        role: form.role,
      });
      message.success('成员信息已更新');
    } else {
      await usersApi.create({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        role: form.role,
        password: form.password,
      });
      message.success('成员已创建');
    }
    formOpen.value = false;
    await load();
  } catch (error) {
    message.error(errorText(error, '保存失败'));
  } finally {
    saving.value = false;
  }
}

async function toggleActive(user: User) {
  try {
    await usersApi.update(user.id, { active: !user.active });
    message.success(user.active ? '已停用该账号' : '已启用该账号');
    await load();
  } catch (error) {
    message.error(errorText(error, '操作失败'));
  }
}

function openReset(user: User) {
  resetTarget.value = user;
  resetPassword.value = '';
  resetOpen.value = true;
}

async function submitReset() {
  if (!resetTarget.value) return;
  if (resetPassword.value.length < 6) {
    message.warning('新密码至少 6 位');
    return;
  }
  try {
    await usersApi.resetPassword(resetTarget.value.id, resetPassword.value);
    message.success(`已重置 ${resetTarget.value.displayName} 的密码`);
    resetOpen.value = false;
  } catch (error) {
    message.error(errorText(error, '重置失败'));
  }
}

function remove(user: User) {
  Modal.confirm({
    title: `删除成员 ${user.displayName}？`,
    content: '该成员名下任务的负责人会被清空，任务本身保留。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await usersApi.remove(user.id);
        message.success('成员已删除');
        await load();
      } catch (error) {
        message.error(errorText(error, '删除失败'));
      }
    },
  });
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">成员管理</h2>
        <p class="page-subtitle">
          共 {{ users.length }} 个账号，其中 {{ activeCount }} 个启用中。成员可管理任务，管理员还能管理版本与成员。
        </p>
      </div>
      <div class="toolbar">
        <a-checkbox v-model:checked="includeInactive" @change="load">显示已停用</a-checkbox>
        <a-button @click="load">
          <ReloadOutlined />
          刷新
        </a-button>
        <a-button type="primary" @click="openCreate">
          <PlusOutlined />
          新增成员
        </a-button>
      </div>
    </div>

    <a-card :body-style="{ padding: 0 }">
      <a-table
        :data-source="users"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 15, hideOnSinglePage: true, showSizeChanger: false }"
        :scroll="{ x: 900 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'displayName'">
            <b>{{ record.displayName }}</b>
            <a-tag v-if="record.id === auth.user?.id" color="blue" style="margin-left: 6px">我</a-tag>
          </template>

          <template v-else-if="column.key === 'role'">
            <a-tag :color="record.role === 'ADMIN' ? 'gold' : 'default'">
              {{ record.role === 'ADMIN' ? '管理员' : '成员' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'active'">
            <a-badge :status="record.active ? 'success' : 'default'" :text="record.active ? '启用' : '停用'" />
          </template>

          <template v-else-if="column.key === 'createdAt'">
            <span class="text-muted">{{ record.createdAt?.slice(0, 10) ?? '—' }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space size="small">
              <a @click="openEdit(record)">编辑</a>
              <a @click="openReset(record)">重置密码</a>
              <a v-if="record.id !== auth.user?.id" @click="toggleActive(record)">
                {{ record.active ? '停用' : '启用' }}
              </a>
              <a
                v-if="record.id !== auth.user?.id"
                class="text-danger"
                @click="remove(record)"
              >
                删除
              </a>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="formOpen"
      :title="editing ? '编辑成员' : '新增成员'"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form layout="vertical" style="margin-top: 8px">
        <a-form-item label="登录账号" required>
          <a-input
            v-model:value="form.username"
            :disabled="!!editing"
            placeholder="英文/数字，登录用"
            :maxlength="50"
          />
        </a-form-item>
        <a-form-item label="姓名" required>
          <a-input v-model:value="form.displayName" placeholder="真实姓名，看板上显示这个" :maxlength="50" />
        </a-form-item>
        <a-form-item label="角色">
          <a-radio-group v-model:value="form.role" button-style="solid">
            <a-radio-button value="MEMBER">成员</a-radio-button>
            <a-radio-button value="ADMIN">管理员</a-radio-button>
          </a-radio-group>
          <div class="text-muted hint">管理员可管理版本、成员和所有任务</div>
        </a-form-item>
        <a-form-item v-if="!editing" label="初始密码" required>
          <a-input-password v-model:value="form.password" placeholder="至少 6 位，可让成员登录后自行修改" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="resetOpen"
      :title="`重置 ${resetTarget?.displayName ?? ''} 的密码`"
      ok-text="重置"
      cancel-text="取消"
      @ok="submitReset"
    >
      <a-alert type="warning" show-icon :closable="false" message="重置后请把新密码告知本人，建议其登录后立即修改" style="margin-bottom: 12px" />
      <a-input-password v-model:value="resetPassword" placeholder="新密码，至少 6 位" />
    </a-modal>
  </div>
</template>

<style scoped>
.hint {
  font-size: 12px;
  margin-top: 4px;
}
</style>
