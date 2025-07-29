import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  manualActivateCartTransform,
  // checkCartTransformStatus,
  getCartTransformInfo,
} from "../utils/cart-transform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const info = await getCartTransformInfo(admin);
    return info;
  } catch (error) {
    return {
      isActivated: false,
      transformsCount: 0,
      functionsCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const result = await manualActivateCartTransform(admin, session.shop);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
