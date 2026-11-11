import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { createStatsAuthorizer } from "./stats.ts";

export const registerStatsEvents = (server: Server, token: string) => {
    const isAuthorized = createStatsAuthorizer(token);
    const sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 });
    const alive = new WeakSet<WebSocket>();

    server.on("upgrade", (request, socket, head) => {
        if (request.url !== "/internal/stats/events") {
            socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
            return;
        }
        if (!isAuthorized(request.headers.authorization)) {
            socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
            return;
        }
        sockets.handleUpgrade(request, socket, head, connection => {
            alive.add(connection);
            connection.on("pong", () => alive.add(connection));
            connection.on("error", () => connection.terminate());
        });
    });

    const heartbeat = setInterval(() => {
        for (const connection of sockets.clients) {
            if (!alive.delete(connection)) connection.terminate();
            else if (connection.readyState === WebSocket.OPEN) connection.ping();
        }
    }, 30_000).unref();
    server.once("close", () => {
        clearInterval(heartbeat);
        for (const connection of sockets.clients) connection.terminate();
        sockets.close();
    });

    return (userId: string) => {
        for (const connection of sockets.clients) {
            if (connection.readyState === WebSocket.OPEN) connection.send(userId);
        }
    };
};
