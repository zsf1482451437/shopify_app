import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const productTags = url.searchParams.get("productTags");

    if (!shop) {
      return { error: "Shop parameter is required", status: 400 };
    }

    // 获取该商店的所有激活选项集
    const optionSets = await prisma.productOptionSet.findMany({
      where: {
        shop,
        active: true,
      },
      include: {
        options: true,
      },
    });

    // 如果有商品标签信息，进行过滤
    let filteredOptionSets = optionSets;
    if (productTags) {
      const tagsArray = productTags.split(",").map((tag) => tag.trim());

      filteredOptionSets = optionSets.filter((optionSet) => {
        // 如果设置为应用到所有商品，则包含
        if (optionSet.applyToAll) {
          return true;
        }

        // 如果设置了特定标签，检查商品标签是否匹配
        if (optionSet.productTags) {
          const requiredTags = optionSet.productTags
            .split(",")
            .map((tag) => tag.trim());
          // 检查商品标签中是否包含任何一个必需的标签
          return requiredTags.some((requiredTag) =>
            tagsArray.includes(requiredTag),
          );
        }

        return false;
      });
    }

    return { optionSets: filteredOptionSets };
  } catch (error) {
    console.error("Error fetching active options:", error);
    return { error: "Failed to fetch active options", status: 500 };
  }
};
