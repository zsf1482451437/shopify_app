import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    return new Response("Webhook HMAC validation failed", { status: 401 });
  }

  switch (topic) {
    case "gdpr/customers_redact":
      // 客户请求删除其数据时
      console.log("删除客户数据:", shop, payload);

      // 在这里实现客户数据删除逻辑
      // 例如：从数据库中删除与该客户相关的所有个人信息

      // 可能的操作：
      // 1. 匿名化客户数据
      // 2. 完全删除客户记录
      // 3. 删除客户的个人身份信息，但保留匿名统计数据

      break;
    default:
      return new Response("无法处理的webhook主题", { status: 400 });
  }

  return new Response("Webhook处理成功", { status: 200 });
};
