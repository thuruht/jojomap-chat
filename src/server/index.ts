import {
	type Connection,
	Server,
	type WSMessage,
	routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";

export interface Env {
	DB: any;
	ASSETS: any;
}

export class Chat extends Server<Env> {
	static options = { hibernate: true };

	messages = [] as ChatMessage[];

	broadcastMessage(message: Message, exclude?: string[]) {
		this.broadcast(JSON.stringify(message), exclude);
	}

	onStart() {
		// create the messages table if it doesn't exist
		this.ctx.storage.sql.exec(
			`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, sender TEXT, ciphertext TEXT, iv TEXT, timestamp TEXT)`,
		);

		// load the messages from the database
		this.messages = this.ctx.storage.sql
			.exec(`SELECT * FROM messages`)
			.toArray() as ChatMessage[];
	}

	async onConnect(connection: Connection) {
		const url = new URL(connection.url || "http://localhost");
		const sessionToken = url.searchParams.get("session");

		if (!sessionToken) {
			connection.close(1008, "Session missing");
			return;
		}

		// Authenticate via shared D1 DB
		const session = await this.env.DB.prepare(`
			SELECT u.username 
			FROM sessions s
			JOIN users u ON s.user_id = u.id
			WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
		`).bind(sessionToken).first();

		if (!session) {
			connection.close(1008, "Unauthorized");
			return;
		}

		// Attach username to connection state if needed
		connection.setState({ username: session.username });

		connection.send(
			JSON.stringify({
				type: "all",
				messages: this.messages,
			} satisfies Message),
		);
	}

	saveMessage(message: ChatMessage) {
		const existingMessage = this.messages.find((m) => m.id === message.id);
		if (!existingMessage) {
			this.messages.push(message);
		}

		this.ctx.storage.sql.exec(
			`INSERT INTO messages (id, sender, ciphertext, iv, timestamp) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT (id) DO NOTHING`,
			message.id,
			message.sender,
			message.ciphertext,
			message.iv,
			message.timestamp,
		);
	}

	onMessage(connection: Connection, message: WSMessage) {
		const parsed = JSON.parse(message as string) as Message;
		if (parsed.type === "add") {
			const username = (connection.state as any)?.username;
			// Ensure sender matches authenticated username
			if (username !== parsed.sender) {
				return;
			}
			
			this.saveMessage(parsed);
			this.broadcast(message);
		}
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		
		// Map the custom chat.domain.com/[room] to the PartyServer routing
		const pathParts = url.pathname.split("/").filter(Boolean);
		if (pathParts.length === 1 && !url.pathname.startsWith("/parties/")) {
			const room = pathParts[0];
			// Rewrite internal URL to PartyServer format: /parties/chat/[room]
			const newUrl = new URL(`/parties/chat/${room}${url.search}`, url.origin);
			return (await routePartykitRequest(new Request(newUrl, request), env as any)) || new Response("Not found", { status: 404 });
		}

		return (await routePartykitRequest(request, env as any)) || new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
