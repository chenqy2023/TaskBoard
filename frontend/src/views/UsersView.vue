<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import type { Role, User } from '@/types';
import { usersApi } from '@/api';
import { errorText } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const users = ref<User[]>([]);
const { t, locale } = useI18n();
const loading = ref(false);

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

const columns = computed(() => {
  void locale.value;
  return [
    { title: t('users.displayName'), key: 'displayName', width: 160 },
    { title: t('users.username'), key: 'username', dataIndex: 'username', width: 160 },
    { title: t('users.role'), key: 'role', width: 100 },
    { title: t('users.createdAt'), key: 'createdAt', width: 180 },
    { title: t('common.actions'), key: 'action', width: 200, fixed: 'right' as const },
  ];
});

async function load() {
  loading.value = true;
  try {
    users.value = await usersApi.list();
  } catch (error) {
    message.error(errorText(error, t('users.loadFailed')));
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
      message.warning(t('users.needUsernameName'));
      return;
    }
    if (form.password.length < 6) {
      message.warning(t('users.passwordMin'));
      return;
    }
  } else if (!form.displayName.trim()) {
    message.warning(t('users.needName'));
    return;
  }

  saving.value = true;
  try {
    if (editing.value) {
      await usersApi.update(editing.value.id, {
        displayName: form.displayName.trim(),
        role: form.role,
      });
      message.success(t('users.updated'));
    } else {
      await usersApi.create({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        role: form.role,
        password: form.password,
      });
      message.success(t('users.created'));
    }
    formOpen.value = false;
    await load();
  } catch (error) {
    message.error(errorText(error, t('users.saveFailed')));
  } finally {
    saving.value = false;
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
    message.warning(t('auth.passwordMin'));
    return;
  }
  try {
    await usersApi.resetPassword(resetTarget.value.id, resetPassword.value);
    message.success(t('users.resetSuccess', { name: resetTarget.value.displayName }));
    resetOpen.value = false;
  } catch (error) {
    message.error(errorText(error, t('users.resetFailed')));
  }
}

function remove(user: User) {
  Modal.confirm({
    title: t('users.deleteTitle', { name: user.displayName }),
    content: t('users.deleteContent'),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    async onOk() {
      try {
        await usersApi.remove(user.id);
        message.success(t('users.deleted'));
        await load();
      } catch (error) {
        message.error(errorText(error, t('users.deleteFailed')));
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
        <h2 class="page-title">{{ t('nav.users') }}</h2>
        <p class="page-subtitle">
          {{ t('users.summary', { total: users.length }) }}
        </p>
      </div>
      <div class="toolbar">
        <a-button @click="load">
          <ReloadOutlined />
          {{ t('common.refresh') }}
        </a-button>
        <a-button type="primary" @click="openCreate">
          <PlusOutlined />
          {{ t('users.create') }}
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
            <a-tag v-if="record.id === auth.user?.id" color="blue" style="margin-left: 6px">{{ t('users.me') }}</a-tag>
          </template>

          <template v-else-if="column.key === 'username'">
            <span class="text-muted">{{ record.username }}</span>
          </template>

          <template v-else-if="column.key === 'role'">
            <a-tag :color="record.role === 'ADMIN' ? 'gold' : 'default'">
              {{ record.role === 'ADMIN' ? t('role.ADMIN') : t('role.MEMBER') }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            <span class="text-muted">{{ record.createdAt?.slice(0, 10) ?? '—' }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space size="small">
              <a @click="openEdit(record)">{{ t('common.edit') }}</a>
              <a @click="openReset(record)">{{ t('users.resetPassword') }}</a>
              <a
                v-if="record.id !== auth.user?.id"
                class="text-danger"
                @click="remove(record)"
              >
                {{ t('common.delete') }}
              </a>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="formOpen"
      :title="editing ? t('users.edit') : t('users.create')"
      :confirm-loading="saving"
      :ok-text="t('common.save')"
      :cancel-text="t('common.cancel')"
      @ok="submit"
    >
      <a-form layout="vertical" style="margin-top: 8px">
        <a-form-item :label="t('users.username')" required>
          <a-input
            v-model:value="form.username"
            :disabled="!!editing"
            :placeholder="t('users.usernamePlaceholder')"
            :maxlength="50"
          />
        </a-form-item>
        <a-form-item :label="t('users.displayName')" required>
          <a-input v-model:value="form.displayName" :placeholder="t('users.namePlaceholder')" :maxlength="50" />
        </a-form-item>
        <a-form-item :label="t('users.role')">
          <a-radio-group v-model:value="form.role" button-style="solid">
            <a-radio-button value="MEMBER">{{ t('role.MEMBER') }}</a-radio-button>
            <a-radio-button value="ADMIN">{{ t('role.ADMIN') }}</a-radio-button>
          </a-radio-group>
          <div class="text-muted hint">{{ t('users.adminHint') }}</div>
        </a-form-item>
        <a-form-item v-if="!editing" :label="t('users.initialPassword')" required>
          <a-input-password v-model:value="form.password" :placeholder="t('users.passwordPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="resetOpen"
      :title="t('users.resetTitle', { name: resetTarget?.displayName ?? '' })"
      :ok-text="t('users.resetOk')"
      :cancel-text="t('common.cancel')"
      @ok="submitReset"
    >
      <a-alert type="warning" show-icon :closable="false" :message="t('users.resetAlert')" style="margin-bottom: 12px" />
      <a-input-password v-model:value="resetPassword" :placeholder="t('users.resetPlaceholder')" />
    </a-modal>
  </div>
</template>

<style scoped>
.hint {
  font-size: 12px;
  margin-top: 4px;
}
</style>
