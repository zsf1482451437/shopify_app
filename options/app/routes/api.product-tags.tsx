import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
      return { error: "Shop parameter is required", status: 400 };
    }

    // 使用GraphQL查询获取所有商品的标签
    const query = `
      query getProductTags($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              tags
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    let allTags = new Set<string>();
    let hasNextPage = true;
    let cursor = null;

    // 分页获取所有商品的标签
    while (hasNextPage && allTags.size < 10000) {
      // 限制最多获取10000个标签
      const variables: any = {
        first: 250, // 每次获取250个商品
      };

      if (cursor) {
        variables.after = cursor;
      }

      const response: Response = await admin.graphql(query, { variables });
      const data = await response.json();

      if (data.errors) {
        console.error("GraphQL errors:", data.errors);
        return { error: "Failed to fetch product tags", status: 500 };
      }

      // 收集所有标签
      data.data.products.edges.forEach((edge: any) => {
        if (edge.node.tags && edge.node.tags.length > 0) {
          edge.node.tags.forEach((tag: string) => {
            if (tag.trim()) {
              allTags.add(tag.trim());
            }
          });
        }
      });

      // 检查是否还有更多页
      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
    }

    // 将Set转换为排序后的数组
    const sortedTags = Array.from(allTags).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );

    return {
      tags: sortedTags,
      count: sortedTags.length,
    };
  } catch (error) {
    console.error("Error fetching product tags:", error);
    return { error: "Failed to fetch product tags", status: 500 };
  }
};
