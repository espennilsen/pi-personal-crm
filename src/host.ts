/**
 * Host interface — what pi-crm-personal expects from the host application.
 *
 * This is a minimal contract that any Pi agent must satisfy to use this CRM.
 * Host apps (like Hannah) should implement these interfaces or provide adapters.
 */

import type { Database } from "better-sqlite3";
import type { IncomingMessage, ServerResponse } from "node:http";

// ── Database Module ─────────────────────────────────────────────

/**
 * DB module interface for host's plugin system.
 * Each extension provides migrations and initialization logic.
 */
export interface DbModule {
	/** Unique module name (used as key in module_versions table) */
	readonly name: string;
	/** Ordered list of SQL migration strings. Each runs once, tracked by index. */
	readonly migrations: string[];
	/** Called after migrations are applied. Set up prepared statements here. */
	init?(db: Database): void;
}

// ── Server Registration ─────────────────────────────────────────

/**
 * Web route handler signature.
 */
export type WebRouteHandler = (
	req: IncomingMessage,
	res: ServerResponse,
	url: URL,
) => void | Promise<void>;

/**
 * Minimal server interface for registering CRM routes.
 * Host provides these methods to allow extensions to register themselves.
 */
export interface HostServer {
	/**
	 * Register a custom API route.
	 * @param method HTTP method (GET, POST, PATCH, DELETE)
	 * @param path Route path (e.g. "/api/crm/contacts")
	 * @param handler Request handler
	 */
	addWebRoute(method: string, path: string, handler: WebRouteHandler): void;

	/**
	 * Register an extension so other modules can access it.
	 * @param name Extension name (e.g. "crm")
	 * @param extension The extension API object
	 */
	registerExtension(name: string, extension: unknown): void;

	/**
	 * Retrieve a registered extension by name.
	 * @param name Extension name
	 * @returns The extension API or undefined
	 */
	getExtension<T = unknown>(name: string): T | undefined;
}

// ── Configuration ───────────────────────────────────────────────

/**
 * CRM-specific configuration (read from host's config file).
 */
export interface CrmConfig {
	/** Whether to enable Telegram reminders for birthdays/anniversaries */
	reminders?: {
		enabled?: boolean;
		/** Channel to send reminders to (default: "telegram") */
		channel?: string;
	};
}

// ── Utilities ───────────────────────────────────────────────────

/**
 * Read request body as string.
 */
export async function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
		req.on("error", reject);
	});
}

/**
 * Send JSON response.
 */
export function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(data));
}
