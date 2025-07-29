import type { ClientActionFunctionArgs } from "@remix-run/react";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ClientActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const options = JSON.parse(formData.get("options") as string);
  const applyToAll = formData.get("applyToAll") === "true";
  const productTags = formData.get("productTags")
    ? JSON.parse(formData.get("productTags") as string)
    : [];

  // 验证数据
  if (!name || !options || !Array.isArray(options)) {
    return { error: "Invalid option set data", status: 400 };
  }

  if (!applyToAll && productTags.length === 0) {
    return {
      error:
        "Please select at least one product tag or choose 'Apply to all products'",
    };
  }

  try {
    // 分两步创建，先创建选项集和所有选项，再更新依赖关系
    const optionSet = await prisma.productOptionSet.create({
      data: {
        name,
        shop,
        applyToAll,
        productTags: productTags.length > 0 ? productTags.join(",") : null,
        options: {
          create: options.map((opt: any) => ({
            name: opt.name,
            type: opt.type,
            required: opt.required,
            values: opt.values ? JSON.stringify(opt.values) : null,
            dependOnOptionId: null, // 暂时不设置依赖关系
            showWhenValue: null,
            price: opt.price !== undefined ? parseFloat(opt.price) : null,
          })),
        },
      },
      include: {
        options: true,
      },
    });

    // 建立临时ID到数据库ID的映射
    const idMapping: Record<string, string> = {};
    options.forEach((frontendOption: any, index: number) => {
      const dbOption = optionSet.options[index];
      if (frontendOption.id && dbOption.id) {
        idMapping[frontendOption.id] = dbOption.id;
      }
    });

    // 更新有依赖关系的选项
    const updatePromises = options
      .filter((opt: any) => opt.dependOnOptionId)
      .map(async (frontendOption: any, index: number) => {
        const dbOption = optionSet.options[index];
        const mappedDependOnId = idMapping[frontendOption.dependOnOptionId];

        if (mappedDependOnId) {
          return prisma.option.update({
            where: { id: dbOption.id },
            data: {
              dependOnOptionId: mappedDependOnId,
              showWhenValue: frontendOption.showWhenValue || null,
            },
          });
        }
      });

    await Promise.all(updatePromises);

    return { success: true };
  } catch (error) {
    console.error("Failed to create option set:", error);
    return {
      error: "Failed to create option set. Please try again.",
      status: 500,
    };
  }
};

// 如果用户直接访问此路由，则重定向到选项列表页面
export const loader = async ({ request }: ClientActionFunctionArgs) => {
  await authenticate.admin(request);
  return redirect("/app/options");
};
