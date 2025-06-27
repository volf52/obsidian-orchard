import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export const initRouter = (apiKey: string) => {
	const app = new Hono();
	const apiRouter = initApiRouter();

	return (
		app
			// Middleware
			.use("*", logger())
			.use(
				"*",
				cors({
					origin: "*",
					allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
					allowHeaders: ["Content-Type", "Authorization"],
				}),
			)

			// .get("/", Scalar({ url: "/" }))
			.get("/health", (c) =>
				c.json({
					status: "ok",
					timestamp: new Date().toISOString(),
				}),
			)

			// Protected API routes
			.use(
				"/api/*",
				bearerAuth({
					token: apiKey,
				}),
			)
			.route("/api", apiRouter)
	);
};

const initApiRouter = () => {
	const apiRouter = new Hono();

	apiRouter.get("/status", (c) =>
		c.json({
			status: "API is running",
			timestamp: new Date().toISOString(),
			version: "1.0.0",
		}),
	);

	return apiRouter;
};
