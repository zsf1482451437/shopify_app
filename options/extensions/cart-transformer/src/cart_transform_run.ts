import type {
  CartTransformRunInput,
  CartTransformRunResult,
  ProductVariant,
  Operation,
} from "../generated/api";

type CartOperation = {
  lineExpand?: {
    cartLineId: string;
    expandedCartItems: {
      merchandiseId: string;
      quantity: number;
      price: {
        adjustment: {
          fixedPricePerUnit: {
            amount: number;
          };
        };
      };
      attributes: { key: string; value: string }[];
    }[];
  };
};

// 只排除处理标记和价格属性
const EXCLUDED_ATTRIBUTES = new Set([
  "_cart_transform_processed",
  "_price",
]);

export function cartTransformRun(input: CartTransformRunInput): CartTransformRunResult {
  console.log("🚀 Cart Transform 被调用了！");

  if (input.cart.lines.length === 0) {
    return { operations: [] };
  }

  const operations: CartOperation[] = [];

  input.cart.lines.forEach((item, index) => {


    const currentPrice = parseFloat(item.cost.amountPerQuantity.amount);

    if (item.priceAttribute?.value) {
      try {
        const additionalPrice = parseFloat(item.priceAttribute.value);

        if (!isNaN(additionalPrice) && additionalPrice > 0) {
          let allAttributes = getAttributes(item);
          const isProcessed = allAttributes.some(attr => attr.key === "_cart_transform_processed");

          if (!isProcessed) {
            const newUnitPrice = currentPrice + additionalPrice;
            console.log(`🚀 价格调整: ${currentPrice} + ${additionalPrice} = ${newUnitPrice}`);

            // 添加处理标记
            allAttributes.push({
              key: "_cart_transform_processed",
              value: "true"
            });

            // 保留所有重要属性（包括 _all_properties）
            const finalAttributes = allAttributes.filter(attr => !EXCLUDED_ATTRIBUTES.has(attr.key));

            console.log("🚀 最终属性:", finalAttributes);

            // 简单的 lineExpand，一对一替换
            const expandOperation: CartOperation = {
              lineExpand: {
                cartLineId: item.id,
                expandedCartItems: [
                  {
                    merchandiseId: (item.merchandise as ProductVariant).id,
                    quantity: 1,
                    price: {
                      adjustment: {
                        fixedPricePerUnit: {
                          amount: newUnitPrice,
                        },
                      },
                    },
                    attributes: finalAttributes,
                  },
                ],
              },
            };

            operations.push(expandOperation);
            console.log("🚀 添加了lineExpand操作");
          } else {
            console.log("🚀 商品已处理过，跳过");
          }
        }
      } catch (e) {
        console.error("🚀 处理错误:", e);
      }
    }
  });

  console.log(`🚀 生成了 ${operations.length} 个操作`);
  return { operations: operations as Operation[] };
}

function getAttributes(item: any): { key: string; value: string }[] {
  const allAttributes: { key: string; value: string }[] = [];

  try {
    if (item.attribute?.value) {
      const data = JSON.parse(item.attribute.value);

      Object.entries(data).forEach(([key, value]) => {
        allAttributes.push({ key, value: value as string });
      });
    }
  } catch (e) {
    console.error("🚀 解析属性失败:", e);
  }

  return allAttributes;
}
