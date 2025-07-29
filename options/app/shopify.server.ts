import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { activateCartTransform } from "./utils/cart-transform.server";

// 保存激活状态到数据库
async function saveActivationStatus(shop: string, activated: boolean) {
  try {
    await prisma.session.updateMany({
      where: { shop },
      data: {
        // 可以添加一个新字段来跟踪激活状态
        // cartTransformActivated: activated
      }
    });
  } catch (error) {
    console.error("Failed to save activation status:", error);
  }
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      try {
        console.log("🚀 Starting afterAuth hook for shop:", session.shop);

        // 使用工具函数激活Cart Transform
        const activated = await activateCartTransform(admin, session.shop);

        if (activated) {
          console.log("✅ Cart Transform activation completed successfully");
          await saveActivationStatus(session.shop, true);
        } else {
          console.log("❌ Cart Transform activation failed");
          await saveActivationStatus(session.shop, false);
        }

        console.log("✨ AfterAuth hook completed");
      } catch (error) {
        console.error("❌ Error in afterAuth hook:", error);
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
