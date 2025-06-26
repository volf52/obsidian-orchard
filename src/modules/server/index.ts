import { Scalar } from "@scalar/hono-api-reference"
import { Hono } from "hono"
import { bearerAuth } from "hono/bearer-auth"

export const initRouter = (apiKey: string) => {
  const app = new Hono()
  const apiRouter = initApiRouter()

  return app
    .get("/", Scalar({ url: "/" }))
    .get("/health", (c) => c.json({ status: "ok" }))
    .use("/api", bearerAuth({ token: apiKey }))
    .route("/api", apiRouter)
}

const initApiRouter = () => {
  const apiRouter = new Hono()

  return apiRouter
}
