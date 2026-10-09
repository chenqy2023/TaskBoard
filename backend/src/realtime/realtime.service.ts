import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

export const projectRoom = (projectId: string) => `project:${projectId}`;

/**
 * 把 Socket.IO server 抽出来单独持有，业务服务只依赖这个类，
 * 避免 TasksService 与 Gateway 之间产生循环依赖。
 */
@Injectable()
export class RealtimeService {
  private server?: Server;

  setServer(server: Server) {
    this.server = server;
  }

  /** 广播给正在看该项目看板的人；没人订阅时静默跳过 */
  emitToProject(projectId: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(projectRoom(projectId)).emit(event, payload);
  }

  get online(): boolean {
    return !!this.server;
  }
}
