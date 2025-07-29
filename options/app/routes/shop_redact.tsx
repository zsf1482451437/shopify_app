import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // 认证失败，可能是webhook签名无效
    return new Response("Webhook HMAC validation failed", { status: 401 });
  }

  switch (topic) {
    case "gdpr/shop_redact":
      // 当商店被删除时，您需要删除与该商店相关的所有数据
      console.log("删除商店数据:", shop, payload);

      // 在这里实现数据删除逻辑
      // 例如：删除数据库中与该商店相关的所有记录

      break;
    default:
      return new Response("无法处理的webhook主题", { status: 400 });
  }

  // 返回200状态码，表示webhook处理成功
  return new Response("Webhook处理成功", { status: 200 });
};
