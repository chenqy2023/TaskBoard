import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

export const versionRoom = (versionId: string) => `version:${versionId}`;

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

  /** 广播给正在看该版本看板的人；没人订阅时静默跳过 */
  emitToVersion(versionId: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(versionRoom(versionId)).emit(event, payload);
  }

  get online(): boolean {
    return !!this.server;
  }
}
