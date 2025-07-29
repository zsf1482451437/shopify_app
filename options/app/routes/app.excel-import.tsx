import type { ClientActionFunctionArgs } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ClientActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const optionSets = JSON.parse(formData.get("optionSets") as string);

  if (!Array.isArray(optionSets) || optionSets.length === 0) {
    return new Response(JSON.stringify({ error: "No data to import" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { name: string; success: boolean; error?: string }[] = [];

  try {
    // 1. 批量创建所有 optionSet 及其 options（不设置依赖）
    const createdSets = [];
    const allIdMappings: Record<string, Record<string, string>> = {};

    for (const set of optionSets) {
      try {
        const created = await prisma.productOptionSet.create({
          data: {
            name: set.name,
            shop,
            applyToAll: set.applyToAll,
            productTags: set.productTags,
            options: {
              create: set.options.map((opt: any) => ({
                name: opt.name,
                type: opt.type,
                required: opt.required,
                values: opt.values,
                dependOnOptionId: String(opt.dependOnOptionId) || null,
                showWhenValue: String(opt.showWhenValue) || null,
                price: opt.price !== undefined ? parseFloat(opt.price) : null,
              })),
            },
          },
          include: { options: true },
        });

        // 建立前端id到数据库id的映射
        const idMapping: Record<string, string> = {};
        set.options.forEach((frontendOption: any, idx: number) => {
          const dbOption = created.options[idx];
          if (frontendOption.id && dbOption.id) {
            idMapping[frontendOption.id] = dbOption.id;
          }
        });
        allIdMappings[set.id] = idMapping;
        createdSets.push({ ...created, frontendOptions: set.options });

        results.push({ name: set.name, success: true });
      } catch (err: any) {
        results.push({
          name: set.name,
          success: false,
          error: err?.message || "未知错误",
        });
      }
    }

    // 2. 批量更新依赖关系（只对成功的 set 做）
    for (const created of createdSets) {
      const setId = created.id;
      const idMapping = allIdMappings[setId];
      const frontendOptions = created.frontendOptions;

      const updatePromises = frontendOptions
        .map((opt: any, idx: number) => {
          if (!opt.dependOnOptionId) return null;
          const dbOption = created.options[idx];
          const mappedDependOnId = idMapping[opt.dependOnOptionId];
          if (mappedDependOnId) {
            return prisma.option.update({
              where: { id: dbOption.id },
              data: {
                dependOnOptionId: mappedDependOnId,
                showWhenValue: opt.showWhenValue || null,
              },
            });
          }
          return null;
        })
        .filter(Boolean);

      await Promise.all(updatePromises);
    }

    // 判断是否全部成功
    const allSuccess = results.every((r) => r.success);

    return new Response(
      JSON.stringify({
        allSuccess,
        results,
      }),
      {
        status: allSuccess ? 200 : 207, // 207: Multi-Status
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("批量导入失败:", error);
    return new Response(JSON.stringify({ error: "批量导入失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
