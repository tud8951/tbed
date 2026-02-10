import { onRequestGet as __api_env_js_onRequestGet } from "D:\\code\\tbed\\functions\\api\\env.js"
import { onRequestGet as __api_images_js_onRequestGet } from "D:\\code\\tbed\\functions\\api\\images.js"
import { onRequestPost as __api_like_js_onRequestPost } from "D:\\code\\tbed\\functions\\api\\like.js"
import { onRequestPost as __api_upload_js_onRequestPost } from "D:\\code\\tbed\\functions\\api\\upload.js"

export const routes = [
    {
      routePath: "/api/env",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_env_js_onRequestGet],
    },
  {
      routePath: "/api/images",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_images_js_onRequestGet],
    },
  {
      routePath: "/api/like",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_like_js_onRequestPost],
    },
  {
      routePath: "/api/upload",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_upload_js_onRequestPost],
    },
  ]