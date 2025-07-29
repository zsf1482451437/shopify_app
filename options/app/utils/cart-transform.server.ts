/**
 * Cart Transform 工具函数
 * 用于检查和激活 Shopify Cart Transform 功能
 */

export interface CartTransformResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 检查 Cart Transform 是否已激活
 */
export async function checkCartTransformStatus(admin: any): Promise<boolean> {
  try {
    const existingTransformsQuery = `
      query {
        cartTransforms(first: 10) {
          edges {
            node {
              id
              functionId
            }
          }
        }
      }
    `;

    console.log("🔍 Checking existing cart transforms...");
    const existingResponse = await admin.graphql(existingTransformsQuery);
    const existingData = await existingResponse.json();

    const isActivated = existingData.data?.cartTransforms?.edges?.length > 0;
    console.log(`🔍 Cart Transform status: ${isActivated ? 'activated' : 'not activated'}`);

    return isActivated;
  } catch (error) {
    console.error("❌ Error checking cart transform status:", error);
    return false;
  }
}

/**
 * 查询 Cart Transform Function ID
 */
async function getCartTransformFunctionId(admin: any): Promise<string | null> {
  try {
    const functionQuery = `
      query {
        shopifyFunctions(first: 20) {
          edges {
            node {
              id
              app {
                id
              }
              apiType
              title
            }
          }
        }
      }
    `;

    console.log("🔍 Querying for cart transform functions...");
    const functionsResponse = await admin.graphql(functionQuery);
    const functionsData = await functionsResponse.json();

    console.log("📊 Functions data:", JSON.stringify(functionsData, null, 2));

    // 找到Cart Transform Function
    const cartTransformFunction = functionsData.data?.shopifyFunctions?.edges?.find(
      (edge: any) => edge.node.apiType === "cart_transform"
    );

    if (!cartTransformFunction) {
      console.log("⚠️ No cart transform function found - cart transformer extension may not be deployed");
      return null;
    }

    const functionId = cartTransformFunction.node.id;
    console.log("🎯 Found cart transform function ID:", functionId);

    return functionId;
  } catch (error) {
    console.error("❌ Error querying cart transform functions:", error);
    return null;
  }
}

/**
 * 执行 Cart Transform 激活
 */
async function executeCartTransformActivation(admin: any, functionId: string): Promise<CartTransformResult> {
  try {
    const mutation = `
      mutation cartTransformCreate($functionId: String!) {
        cartTransformCreate(functionId: $functionId) {
          cartTransform {
            id
            functionId
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    console.log("🚀 Attempting to activate cart transform...");
    const response = await admin.graphql(mutation, {
      variables: { functionId: functionId }
    });

    const result = await response.json();
    console.log("📋 Activation result:", JSON.stringify(result, null, 2));

    if (result.data?.cartTransformCreate?.userErrors?.length > 0) {
      const errors = result.data.cartTransformCreate.userErrors;
      let hasNonDuplicateError = false;
      let errorMessages: string[] = [];

      errors.forEach((error: any) => {
        if (error.message.includes("already registered") ||
            error.message.includes("already exists") ||
            error.message.includes("already active") ||
            error.message.includes("duplicate")) {
          console.log("✅ Cart Transform already activated - OK");
        } else {
          console.error("❌ Cart Transform activation error:", error.message);
          hasNonDuplicateError = true;
          errorMessages.push(error.message);
        }
      });

      if (hasNonDuplicateError) {
        return {
          success: false,
          error: errorMessages.join("; ")
        };
      } else {
        return {
          success: true,
          message: "Cart Transform already activated"
        };
      }
    } else if (result.data?.cartTransformCreate?.cartTransform) {
      console.log("🎉 Cart Transform activated successfully!");
      console.log("Cart Transform ID:", result.data.cartTransformCreate.cartTransform.id);
      return {
        success: true,
        message: "Cart Transform activated successfully"
      };
    } else {
      console.log("⚠️ Unexpected response structure:", result);
      return {
        success: false,
        error: "Unexpected response structure"
      };
    }
  } catch (error) {
    console.error("❌ Error executing cart transform activation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * 激活 Cart Transform 功能（带重试机制）
 */
export async function activateCartTransform(
  admin: any,
  shop: string,
  retryCount = 0
): Promise<boolean> {
  const maxRetries = 3;
  console.log(`🎯 Starting Cart Transform activation for shop: ${shop} (attempt ${retryCount + 1}/${maxRetries + 1})`);

  try {
    // 首先检查是否已经激活
    const isAlreadyActivated = await checkCartTransformStatus(admin);
    if (isAlreadyActivated) {
      console.log("✅ Cart Transform already activated - skipping");
      return true;
    }

    // 获取 Function ID
    const functionId = await getCartTransformFunctionId(admin);
    if (!functionId) {
      console.log("❌ Cannot find cart transform function ID");
      return false;
    }

    // 执行激活
    const result = await executeCartTransformActivation(admin, functionId);

    if (result.success) {
      return true;
    } else {
      // 如果还有重试次数，则重试
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying activation in 2 seconds... (${retryCount + 1}/${maxRetries})`);
        console.log(`🔄 Retry reason: ${result.error}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await activateCartTransform(admin, shop, retryCount + 1);
      } else {
        console.error(`❌ Cart Transform activation failed after ${maxRetries + 1} attempts: ${result.error}`);
        return false;
      }
    }
  } catch (error) {
    console.error("❌ Error in cart transform activation process:", error);

    // 如果还有重试次数，则重试
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying activation due to error... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await activateCartTransform(admin, shop, retryCount + 1);
    }

    return false;
  }
}

/**
 * 手动激活 Cart Transform（用于API调用）
 */
export async function manualActivateCartTransform(
  admin: any,
  shop: string
): Promise<CartTransformResult> {
  console.log("🚀 Manual Cart Transform activation request for shop:", shop);

  try {
    // 首先检查是否已经激活
    const isAlreadyActivated = await checkCartTransformStatus(admin);
    if (isAlreadyActivated) {
      return {
        success: true,
        message: "Cart Transform 已经激活"
      };
    }

    // 获取 Function ID
    const functionId = await getCartTransformFunctionId(admin);
    if (!functionId) {
      return {
        success: false,
        error: "无法找到 Cart Transform 功能。请确保 cart-transformer 扩展已正确部署。"
      };
    }

    // 执行激活
    const result = await executeCartTransformActivation(admin, functionId);

    if (result.success) {
      return {
        success: true,
        message: result.message || "Cart Transform 激活成功！"
      };
    } else {
      return {
        success: false,
        error: result.error || "激活失败"
      };
    }
  } catch (error) {
    console.error("❌ Manual Cart Transform activation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    };
  }
}

/**
 * 获取 Cart Transform 详细状态信息
 */
export async function getCartTransformInfo(admin: any): Promise<{
  isActivated: boolean;
  transformsCount: number;
  functionsCount: number;
  details?: any;
}> {
  try {
    // 检查已激活的 transforms
    const transformsQuery = `
      query {
        cartTransforms(first: 10) {
          edges {
            node {
              id
              functionId
            }
          }
        }
      }
    `;

    // 检查可用的 functions
    const functionsQuery = `
      query {
        shopifyFunctions(first: 20) {
          edges {
            node {
              id
              apiType
              title
            }
          }
        }
      }
    `;

    const [transformsResponse, functionsResponse] = await Promise.all([
      admin.graphql(transformsQuery),
      admin.graphql(functionsQuery)
    ]);

    const [transformsData, functionsData] = await Promise.all([
      transformsResponse.json(),
      functionsResponse.json()
    ]);

    const transforms = transformsData.data?.cartTransforms?.edges || [];
    const functions = functionsData.data?.shopifyFunctions?.edges || [];
    const cartTransformFunctions = functions.filter((edge: any) => edge.node.apiType === "cart_transform");

    return {
      isActivated: transforms.length > 0,
      transformsCount: transforms.length,
      functionsCount: cartTransformFunctions.length,
      details: {
        transforms,
        cartTransformFunctions
      }
    };
  } catch (error) {
    console.error("❌ Error getting cart transform info:", error);
    return {
      isActivated: false,
      transformsCount: 0,
      functionsCount: 0
    };
  }
}
