import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';

interface MockPrisma {
  user: Record<string, jest.Mock>;
  task: Record<string, jest.Mock>;
  $transaction: (fn: (tx: MockPrisma) => unknown) => Promise<unknown>;
}

/** 只桩出被调用的方法，保持测试聚焦在权限规则本身 */
function createService(overrides: {
  findUnique?: jest.Mock;
  count?: jest.Mock;
  update?: jest.Mock;
  delete?: jest.Mock;
  updateMany?: jest.Mock;
}) {
  const prisma: MockPrisma = {
    user: {
      findUnique: overrides.findUnique ?? jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: overrides.update ?? jest.fn(),
      delete: overrides.delete ?? jest.fn(),
      count: overrides.count ?? jest.fn().mockResolvedValue(1),
    },
    task: { updateMany: overrides.updateMany ?? jest.fn() },
    $transaction: jest.fn((fn: (tx: MockPrisma) => unknown) => Promise.resolve(fn(prisma))),
  };
  const authService = { findAuthUser: jest.fn() };
  const service = new UsersService(prisma as never, authService as never);
  return { service, prisma };
}

const admin = { id: 'admin-1', username: 'admin', displayName: '管理员', role: Role.ADMIN };
const member = { id: 'member-1', username: 'lisi', displayName: '李四', role: Role.MEMBER };

describe('成员管理的自我保护规则', () => {
  it('管理员不能把自己降级为成员', async () => {
    const { service } = createService({
      findUnique: jest.fn().mockResolvedValue({ ...admin, passwordHash: 'x', active: true }),
    });

    await expect(service.update(admin.id, { role: Role.MEMBER }, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('管理员不能停用自己', async () => {
    const { service } = createService({
      findUnique: jest.fn().mockResolvedValue({ ...admin, passwordHash: 'x', active: true }),
    });

    await expect(service.update(admin.id, { active: false }, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('不能删除自己的账号', async () => {
    const { service } = createService({
      findUnique: jest.fn().mockResolvedValue({ ...admin, passwordHash: 'x', active: true }),
    });

    await expect(service.remove(admin.id, admin)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('不能把最后一个启用管理员降级', async () => {
    const { service } = createService({
      // 目标是另一个管理员，避免命中"不能改自己"那条规则
      findUnique: jest
        .fn()
        .mockResolvedValue({ ...admin, id: 'admin-2', passwordHash: 'x', active: true }),
      count: jest.fn().mockResolvedValue(0),
    });

    await expect(
      service.update('admin-2', { role: Role.MEMBER }, admin),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('还有其他管理员时允许降级', async () => {
    const update = jest.fn().mockResolvedValue({ ...admin, id: 'admin-2', role: Role.MEMBER });
    const { service } = createService({
      findUnique: jest
        .fn()
        .mockResolvedValue({ ...admin, id: 'admin-2', passwordHash: 'x', active: true }),
      count: jest.fn().mockResolvedValue(1),
      update,
    });

    await service.update('admin-2', { role: Role.MEMBER }, admin);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: Role.MEMBER }) }),
    );
  });

  it('普通成员之间的修改不受管理员规则限制', async () => {
    const update = jest.fn().mockResolvedValue({ ...member, displayName: '李四四' });
    const { service } = createService({
      findUnique: jest.fn().mockResolvedValue({ ...member, passwordHash: 'x', active: true }),
      update,
    });

    await service.update(member.id, { displayName: '李四四' }, admin);
    expect(update).toHaveBeenCalled();
  });

  it('用户不存在时抛 404', async () => {
    const { service } = createService({ findUnique: jest.fn().mockResolvedValue(null) });

    await expect(service.update('missing', { displayName: 'x' }, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('删除成员时把其名下任务的负责人置空，任务本身保留', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const remove = jest.fn().mockResolvedValue({ id: member.id });
    const { service } = createService({
      findUnique: jest.fn().mockResolvedValue({ ...member, passwordHash: 'x', active: true }),
      updateMany,
      delete: remove,
    });

    await service.remove(member.id, admin);

    expect(updateMany).toHaveBeenCalledWith({
      where: { assigneeId: member.id },
      data: { assigneeId: null },
    });
    expect(remove).toHaveBeenCalled();
  });
});
