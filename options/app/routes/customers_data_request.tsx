import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    return new Response("Webhook HMAC validation failed", { status: 401 });
  }

  switch (topic) {
    case "gdpr/customers_data_request":
      // 客户请求其数据时
      console.log("客户数据请求:", shop, payload);

      // 在这里实现收集客户数据的逻辑
      // 例如：从数据库中检索与该客户相关的所有数据并提供下载

      // 注意：通常您需要将这些数据发送到Shopify提供的回调URL
      // 或者将数据存储在一个安全的位置，以便客户可以访问

      break;
    default:
      return new Response("无法处理的webhook主题", { status: 400 });
  }

  return new Response("Webhook处理成功", { status: 200 });
};
