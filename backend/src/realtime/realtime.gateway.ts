import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { RealtimeService, versionRoom } from './realtime.service';

interface SocketAuth {
  token?: string;
  versionId?: string;
}

/**
 * 实时通道：/ws 命名空间，按 versionId 进房间。
 * 连接时校验 JWT；未认证的连接直接断开，避免看板数据被匿名订阅。
 */
@WebSocketGateway({ namespace: '/ws', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server) {
    this.realtime.setServer(server);
    this.logger.log('实时通道已就绪 (/ws)');
  }

  handleConnection(client: Socket) {
    const auth = (client.handshake.auth ?? {}) as SocketAuth;
    if (!auth.token) {
      client.disconnect(true);
      return;
    }
    try {
      this.jwt.verify(auth.token);
    } catch {
      client.disconnect(true);
      return;
    }

    if (auth.versionId) void client.join(versionRoom(auth.versionId));
  }

  @SubscribeMessage('subscribe')
  onSubscribe(@ConnectedSocket() client: Socket, @MessageBody() versionId: string) {
    if (typeof versionId !== 'string' || !versionId) return { ok: false };
    void client.join(versionRoom(versionId));
    return { ok: true, room: versionRoom(versionId) };
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() versionId: string) {
    if (typeof versionId === 'string' && versionId) void client.leave(versionRoom(versionId));
    return { ok: true };
  }
}
