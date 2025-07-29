import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ClientLoaderFunctionArgs,
  ClientActionFunctionArgs,
} from "@remix-run/react";
import {
  useLoaderData,
  useSubmit,
  useFetcher,
  useNavigation,
  useActionData,
  useLocation,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  EmptyState,
  IndexTable,
  BlockStack,
  InlineStack,
  TextField,
  Text,
  Banner,
  Toast,
  useIndexResourceState,
  Modal,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { OptionSetModal } from "../components/OptionSetModal";
import {
  checkCartTransformStatus,
  manualActivateCartTransform,
  getCartTransformInfo,
} from "../utils/cart-transform.server";
import { ExcelImportModal } from "../components/ExcelImportModal";

interface ProductOptionSet {
  id: string;
  name: string;
  type: string;
  active: boolean;
  shop: string;
  createdAt: string;
  updatedAt: string;
  options: {
    name: string;
    id: string;
    type: string;
    required: boolean;
    values: string;
    dependOnOptionId: string;
    showWhenValue: string;
    price: number | null;
  }[];
  applyToAll: boolean;
  productTags: string | null;
}

interface LoaderData {
  optionSets: ProductOptionSet[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
  filters: {
    status: string;
    searchQuery: string;
  };
  productTags: string[];
  tagsLoading: boolean;
  shop: string;
  cartTransformActivated: boolean;
  cartTransformInfo?: any;
}

interface OptionType {
  id: string;
  name: string;
}

interface ActionResponse {
  success?: boolean;
  error?: string;
  message?: string;
  tags?: string[];
  cartTransformActivated?: boolean;
  cartTransformInfo?: any;
}

enum SelectionType {
  All = "all",
  Page = "page",
  Multi = "multi",
  Single = "single",
  Range = "range",
}

// 异步获取标签的函数（优化版本）
async function fetchProductTagsAsync(
  admin: any,
  shop: string,
): Promise<string[]> {
  try {
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

    // 延迟函数
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // 重试函数，带指数退避
    const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fn();
        } catch (error: any) {
          if (i === maxRetries - 1) throw error;

          // 如果是限流错误，等待更长时间
          const isThrottled =
            error.message?.includes("Throttled") ||
            error.message?.includes("throttled") ||
            error.message?.includes("THROTTLED");
          const baseDelay = isThrottled ? 5000 : 2000; // 🔧 增加延迟时间
          const waitTime = baseDelay * Math.pow(2, i);

          console.log(
            `标签获取失败 (尝试 ${i + 1}/${maxRetries}), ${waitTime}ms后重试...`,
            error.message,
          );
          await delay(waitTime);
        }
      }
    };

    let allTags = new Set<string>();
    let hasNextPage = true;
    let cursor = null;
    let first = 100; // 🔧 增加：每次获取100个产品（Shopify限制最大250）
    let requestCount = 0;
    const maxRequests = 50; // 🔧 增加：最多50次请求，可覆盖5000个产品

    console.log(`开始为商店 ${shop} 获取所有标签...`);

    // 🔧 移除标签数量限制，只受产品数量和请求次数限制
    while (hasNextPage && requestCount < maxRequests) {
      const variables: any = { first };
      if (cursor) {
        variables.after = cursor;
      }

      console.log(
        `正在获取第 ${requestCount + 1} 批产品（每批 ${first} 个）...`,
      );

      // 使用重试机制执行API调用
      const data = await retryWithBackoff(async () => {
        const response: Response = await admin.graphql(query, { variables });
        const result = await response.json();

        if (result.errors) {
          throw new Error(`GraphQL错误: ${JSON.stringify(result.errors)}`);
        }

        return result;
      });

      // 处理返回的数据
      let newTagsCount = 0;
      data.data.products.edges.forEach((edge: any) => {
        edge.node.tags.forEach((tag: string) => {
          if (tag.trim() && !allTags.has(tag.trim())) {
            allTags.add(tag.trim());
            newTagsCount++;
          }
        });
      });

      console.log(
        `第 ${requestCount + 1} 批完成，新增 ${newTagsCount} 个标签，累计 ${allTags.size} 个标签`,
      );

      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
      requestCount++;

      // 🔧 调整：更保守的延迟策略，避免限流
      if (hasNextPage && requestCount < maxRequests) {
        await delay(1200); // 增加到1.2秒间隔
      }

      // 🔧 新增：如果连续5批都没有新标签，提前结束
      if (newTagsCount === 0) {
        console.log("连续批次无新标签，可能已获取完所有标签");
      }
    }

    const result = Array.from(allTags).sort();
    console.log(
      `✅ 成功为商店 ${shop} 获取了 ${result.length} 个标签，共发送 ${requestCount} 个请求，覆盖约 ${requestCount * first} 个产品`,
    );

    return result;
  } catch (error) {
    console.error(`❌ 商店 ${shop} 标签获取失败:`, error);
    return [];
  }
}

export const loader = async ({ request }: ClientLoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // 解析URL查询参数
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const searchQuery = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const perPage = 10;

  // 构建查询条件
  const whereClause: any = {
    shop,
    ...(status === "active" ? { active: true } : {}),
    ...(status === "deactive" ? { active: false } : {}),
    ...(searchQuery
      ? {
          name: { contains: searchQuery },
        }
      : {}),
  };

  // 获取总数量
  const totalCount = await prisma.productOptionSet.count({
    where: whereClause,
  });

  // 计算分页
  const totalPages = Math.ceil(totalCount / perPage);
  const skip = (page - 1) * perPage;

  // 获取该商店的所有选项集（带分页）
  const optionSets = await prisma.productOptionSet.findMany({
    where: whereClause,
    orderBy: { updatedAt: "desc" },
    skip,
    take: perPage,
    include: {
      options: true,
    },
  });

  // 使用工具函数检查Cart Transform状态
  let cartTransformActivated = false;
  let cartTransformInfo = null;
  try {
    cartTransformActivated = await checkCartTransformStatus(admin);
    cartTransformInfo = await getCartTransformInfo(admin);
  } catch (error) {
    console.error("Error checking cart transform status:", error);
  }

  return {
    optionSets,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
    },
    filters: {
      status,
      searchQuery,
    },
    productTags: [], // 始终为空，通过action获取
    tagsLoading: false, // 初始不加载
    shop,
    cartTransformActivated,
    cartTransformInfo,
  };
};

// 专门获取标签的API端点
export const action = async ({
  request,
}: ClientActionFunctionArgs): Promise<ActionResponse> => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  // 使用工具函数处理Cart Transform激活
  if (intent === "activate-cart-transform") {
    try {
      const result = await manualActivateCartTransform(admin, shop);

      return {
        success: result.success,
        message: result.success ? result.message : result.error,
        cartTransformActivated: result.success,
      };
    } catch (error: any) {
      console.error("❌ Manual Cart Transform activation failed:", error);
      return {
        success: false,
        message: "激活过程中出错: " + error.message,
        cartTransformActivated: false,
      };
    }
  }

  if (intent === "fetch-tags") {
    // 🔧 移除：缓存检查逻辑，直接获取新标签
    try {
      console.log(`开始获取商店 ${shop} 的标签...`);
      const tags = await fetchProductTagsAsync(admin, shop);

      console.log(`标签获取完成，商店 ${shop}，共 ${tags.length} 个标签`);

      // 🔧 移除：缓存设置逻辑
      return {
        success: true,
        tags,
      };
    } catch (error: any) {
      console.error(`标签获取失败，商店 ${shop}:`, error);
      return {
        success: false,
        error: error.message,
        tags: [],
      };
    }
  }

  if (intent === "batch-delete-option-set") {
    const ids = JSON.parse(formData.get("ids") as string);
    if (!Array.isArray(ids) || ids.length === 0) {
      return { error: "请选择要删除的选项集" };
    }
    await prisma.productOptionSet.deleteMany({
      where: {
        id: { in: ids },
        shop,
      },
    });
    return { success: true, message: "批量删除成功" };
  }

  // 其他原有的action处理逻辑...
  if (intent === "delete-option-set") {
    const id = formData.get("id") as string;

    const optionSet = await prisma.productOptionSet.findFirst({
      where: { id, shop },
    });

    if (!optionSet) {
      return {
        error:
          "Option set does not exist or you don't have permission to delete it",
      };
    }

    await prisma.productOptionSet.delete({
      where: { id },
    });

    return { success: true };
  } else if (intent === "toggle-option-set-status") {
    const id = formData.get("id") as string;
    const active = formData.get("active") === "true";

    const optionSet = await prisma.productOptionSet.findFirst({
      where: { id, shop },
    });

    if (!optionSet) {
      return {
        error:
          "Option set does not exist or you don't have permission to modify it",
      };
    }

    await prisma.productOptionSet.update({
      where: { id },
      data: { active: !active },
    });

    return {
      success: true,
      message: `Option set ${!active ? "enabled" : "disabled"}`,
    };
  } else if (intent === "update-option-set") {
    // ... 保持原有的更新逻辑不变 ...
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const options = JSON.parse(formData.get("options") as string);
    const applyToAll = formData.get("applyToAll") === "true";
    const productTags = formData.get("productTags")
      ? JSON.parse(formData.get("productTags") as string)
      : [];

    const optionSet = await prisma.productOptionSet.findFirst({
      where: { id, shop },
      include: { options: true },
    });

    if (!optionSet) {
      return {
        error: "选项集不存在或您没有权限修改它",
      };
    }

    await prisma.$transaction(async (tx) => {
      const existingOptions = await tx.option.findMany({
        where: { productOptionSetId: id },
        select: { id: true, name: true, type: true },
      });

      const existingIdMapping: Record<string, string> = {};
      existingOptions.forEach((opt) => {
        const key = `${opt.name}-${opt.type}`;
        existingIdMapping[key] = opt.id;
      });

      const existingOptionIds = optionSet.options.map((opt) => opt.id);
      const updatedOptionIds = options
        .filter((opt: { id: any }) => opt.id)
        .map((opt: { id: any }) => opt.id);
      const optionsToDelete = existingOptionIds.filter(
        (id) => !updatedOptionIds.includes(id),
      );

      const optionsToUpdate = options.filter((opt: { id: any }) => opt.id);
      const optionsToCreate = options.filter((opt: { id: any }) => !opt.id);

      if (optionsToDelete.length > 0) {
        await tx.option.deleteMany({
          where: {
            id: { in: optionsToDelete },
          },
        });
      }

      for (const opt of optionsToUpdate) {
        await tx.option.update({
          where: { id: opt.id },
          data: {
            name: opt.name,
            required: opt.required,
            values: opt.values ? JSON.stringify(opt.values) : null,
            dependOnOptionId: opt.dependOnOptionId,
            showWhenValue: opt.showWhenValue,
            price: opt.price !== undefined ? parseFloat(opt.price) : null,
          },
        });
      }

      if (optionsToCreate.length > 0) {
        await tx.productOptionSet.update({
          where: { id },
          data: {
            options: {
              create: optionsToCreate.map((opt: any) => ({
                name: opt.name,
                type: opt.type,
                required: opt.required,
                values: opt.values ? JSON.stringify(opt.values) : null,
                dependOnOptionId: opt.dependOnOptionId || null,
                showWhenValue: opt.showWhenValue || null,
                price: opt.price !== undefined ? parseFloat(opt.price) : null,
              })),
            },
          },
        });
      }

      const idMapping: Record<string, string> = {};

      options.forEach((opt: any) => {
        if (opt.id) {
          const key = `${opt.name}-${opt.type}`;
          const dbId = existingIdMapping[key] || opt.id;
          idMapping[opt.id] = dbId;
        }
      });

      for (const opt of options) {
        if (opt.dependOnOptionId && opt.id) {
          const dbId = idMapping[opt.id];
          const mappedDependOnId = idMapping[opt.dependOnOptionId];

          if (dbId && mappedDependOnId) {
            await tx.option.update({
              where: { id: dbId },
              data: {
                dependOnOptionId: mappedDependOnId,
                showWhenValue: opt.showWhenValue || null,
              },
            });
          }
        }
      }

      await tx.productOptionSet.update({
        where: { id },
        data: {
          name,
          applyToAll,
          productTags: productTags.length > 0 ? productTags.join(",") : null,
          updatedAt: new Date(),
        },
      });
    });

    return {
      success: true,
      message: "选项集已更新",
    };
  }

  return {};
};

const resourceName = {
  singular: "Option Set",
  plural: "Option Sets",
};

const optionTypes: OptionType[] = [
  {
    id: "text",
    name: "Text",
  },
  {
    id: "number",
    name: "Number",
  },
  {
    id: "dropdown",
    name: "Dropdown",
  },
  {
    id: "dropdown_thumbnail", // 新增
    name: "Dropdown (Thumbnail)", // 新增
  },
  {
    id: "radio",
    name: "Radio Button",
  },
];

type ExcelImportResult = {
  allSuccess?: boolean;
  results?: { name: string; success: boolean; error?: string }[];
  error?: string;
};

export default function ProductOptions() {
  const {
    optionSets,
    pagination,
    filters,
    productTags: initialTags,
    shop,
    cartTransformActivated: initialCartTransformActivated,
    cartTransformInfo,
  } = useLoaderData<LoaderData>();

  const fetcher = useFetcher();
  const tagsFetcher = useFetcher<ActionResponse>();
  const cartTransformFetcher = useFetcher<ActionResponse>(); // 新增：Cart Transform激活fetcher
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData<ActionResponse>();
  const location = useLocation();
  const [showImportToast, setShowImportToast] = useState(false);
  const [showImportFailToast, setShowImportFailToast] = useState(false);
  const excelImportFetcher = useFetcher<ExcelImportResult>();

  // 标签相关状态
  const [productTags, setProductTags] = useState<string[]>(initialTags);
  const [tagsLoading, setTagsLoading] = useState(false);

  // Cart Transform状态
  const [cartTransformActivated, setCartTransformActivated] = useState(
    initialCartTransformActivated,
  );
  const [activatingCartTransform, setActivatingCartTransform] = useState(false);

  // Excel导入相关状态
  const [excelImportOpen, setExcelImportOpen] = useState(false);

  // 批量删除相关状态
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [batchDeleteIds, setBatchDeleteIds] = useState<string[]>([]);
  const [excelImportModalKey, setExcelImportModalKey] = useState(0);

  // 🔧 简化：只通过手动调用获取标签
  const refreshTags = useCallback(() => {
    console.log(`手动刷新商店 ${shop} 的标签列表...`);

    // 🔧 防重复：如果正在加载，不重复请求
    if (tagsLoading) {
      console.log("标签正在加载中，跳过重复请求");
      return;
    }

    setTagsLoading(true);

    const formData = new FormData();
    formData.append("intent", "fetch-tags");
    tagsFetcher.submit(formData, { method: "post" });
  }, [tagsFetcher, shop, tagsLoading]); // 🔧 修改：添加tagsLoading依赖防重复

  // 🔧 移除：自动获取标签的useEffect，避免重复调用

  // 🔧 简化：只监听标签获取结果
  useEffect(() => {
    if (tagsFetcher.data) {
      if (tagsFetcher.data.success) {
        setProductTags(tagsFetcher.data.tags || []);
        console.log(
          `标签加载完成: ${tagsFetcher.data.tags?.length || 0} 个标签`,
        );
      } else {
        console.error("标签获取失败:", tagsFetcher.data.error);
      }
      setTagsLoading(false); // 🔧 无论成功失败都停止loading
    }
  }, [tagsFetcher.data]);

  // 监听Cart Transform激活结果
  useEffect(() => {
    if (cartTransformFetcher.data) {
      setActivatingCartTransform(false);
      if (cartTransformFetcher.data.success) {
        setCartTransformActivated(true);
      }
    }
  }, [cartTransformFetcher.data]);

  // 监听导入结果
  useEffect(() => {
    if (excelImportFetcher.data && excelImportOpen) {
      if (excelImportFetcher.data.allSuccess) {
        setShowImportToast(true);
        setExcelImportOpen(false); // 关闭弹窗
        submit(null, { method: "get", action: "/app/options", replace: true });
      }
      // 部分失败时，不关闭弹窗
    }
  }, [excelImportFetcher.data, excelImportOpen, submit]);

  // 添加搜索状态
  const [searchValue, setSearchValue] = useState(filters.searchQuery || "");
  const [statusFilter, setStatusFilter] = useState(filters.status || "all");

  // 同步URL参数到状态
  useEffect(() => {
    setSearchValue(filters.searchQuery || "");
    setStatusFilter(filters.status || "all");
  }, [filters]);

  // 搜索处理函数
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  // 提交搜索
  const handleSearchSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("q", searchValue);
    formData.append("status", statusFilter);
    formData.append("page", "1");
    submit(formData, { method: "get", replace: true });
  }, [searchValue, statusFilter, submit]);

  // 处理状态筛选变更
  const handleStatusChange = useCallback(
    (value: string) => {
      setStatusFilter(value);
      const formData = new FormData();
      formData.append("q", searchValue);
      formData.append("status", value);
      formData.append("page", "1");
      submit(formData, { method: "get", replace: true });
    },
    [searchValue, submit],
  );

  // 清除所有筛选条件
  const handleClearFilters = useCallback(() => {
    setSearchValue("");
    setStatusFilter("all");
    const formData = new FormData();
    formData.append("q", "");
    formData.append("status", "all");
    formData.append("page", "1");
    submit(formData, { method: "get", replace: true });
  }, [submit]);

  // 模态框状态
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "create" | "edit" | "delete";
    title: string;
    initialData: {
      id?: string;
      name: string;
      options: {
        id?: string;
        type: string;
        name: string;
        required: boolean;
        values: {
          id: string;
          label: string;
          image?: string;
        }[];
        dependOnOptionId: string;
        showWhenValue: string;
        price: number;
      }[];
      applyToAll?: boolean;
      productTags?: string[];
    };
  }>({
    isOpen: false,
    mode: "create",
    title: "",
    initialData: {
      id: "",
      name: "",
      options: [],
    },
  });

  // 添加一个状态来跟踪上一次的navigation状态
  const [prevNavigationState, setPrevNavigationState] = useState(
    navigation.state,
  );

  // 监听fetcher状态变化 - 用于创建操作
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      closeModal();
      submit(null, {
        method: "get",
        action: "/app/options",
        replace: true,
      });
    }
  }, [fetcher.state, fetcher.data, submit]);

  // 监听navigation状态变化 - 用于编辑和删除操作
  useEffect(() => {
    if (
      prevNavigationState === "submitting" &&
      navigation.state === "idle" &&
      modalConfig.isOpen
    ) {
      closeModal();
    }
    setPrevNavigationState(navigation.state);
  }, [navigation.state, modalConfig.isOpen, prevNavigationState]);

  // 使用 useNavigation 和 useActionData 监听提交状态
  useEffect(() => {
    if (navigation.state === "idle" && actionData?.success === true) {
      closeModal();
    }
  }, [navigation.state, actionData]);

  // 打开创建弹窗
  const handleOpenCreateModal = (): void => {
    setModalConfig({
      isOpen: true,
      mode: "create",
      title: "Create Option Set",
      initialData: {
        id: "",
        name: "",
        options: [],
      },
    });
  };

  // 打开编辑弹窗
  const handleOpenEditModal = (optionSet: ProductOptionSet): void => {
    setModalConfig({
      isOpen: true,
      mode: "edit",
      title: "Edit Option Set",
      initialData: {
        id: optionSet.id,
        name: optionSet.name,
        applyToAll: optionSet.applyToAll ?? true,
        productTags: optionSet.productTags
          ? optionSet.productTags.split(",")
          : [],
        options: optionSet.options.map((opt) => ({
          id: opt.id,
          type: opt.type,
          name: opt.name,
          required: opt.required,
          values: opt.values ? JSON.parse(opt.values) : [],
          dependOnOptionId: opt.dependOnOptionId,
          showWhenValue: opt.showWhenValue,
          price: opt.price || 0,
        })),
      },
    });
  };

  // 打开删除弹窗
  const handleOpenDeleteModal = (optionSet: ProductOptionSet): void => {
    setModalConfig({
      isOpen: true,
      mode: "delete",
      title: "Delete Option Set",
      initialData: {
        id: optionSet.id,
        name: optionSet.name,
        options: [],
      },
    });
  };

  // 关闭弹窗
  const closeModal = (): void => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // 处理保存、编辑和删除的函数
  const handleCreate = (data: {
    name: string;
    options: any[];
    applyToAll: boolean;
    productTags: string[];
  }): void => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("options", JSON.stringify(data.options));
    formData.append("applyToAll", String(data.applyToAll));
    formData.append("productTags", JSON.stringify(data.productTags));

    fetcher.submit(formData, {
      method: "post",
      action: "/app/options-create",
    });
  };

  const handleEdit = (data: {
    name: string;
    options: any[];
    applyToAll: boolean;
    productTags: string[];
  }): void => {
    const formData = new FormData();
    formData.append("intent", "update-option-set");
    formData.append("id", modalConfig.initialData.id || "");
    formData.append("name", data.name);
    formData.append("options", JSON.stringify(data.options));
    formData.append("applyToAll", String(data.applyToAll));
    formData.append("productTags", JSON.stringify(data.productTags));

    submit(formData, { method: "post", replace: true });
  };

  const handleDelete = (): void => {
    const formData = new FormData();
    formData.append("intent", "delete-option-set");
    formData.append("id", modalConfig.initialData.id || "");

    submit(formData, { method: "post", replace: true });
  };

  // 处理保存
  const handleSave = async (data: {
    name: string;
    options: any[];
    applyToAll: boolean;
    productTags: string[];
  }): Promise<void> => {
    if (modalConfig.mode === "create") {
      handleCreate(data);
    } else if (modalConfig.mode === "edit") {
      handleEdit(data);
    } else if (modalConfig.mode === "delete") {
      handleDelete();
    }
  };

  const handleToggleStatus = (set: ProductOptionSet): void => {
    const formData = new FormData();
    formData.append("intent", "toggle-option-set-status");
    formData.append("id", set.id);
    formData.append("active", String(set.active));

    submit(formData, {
      method: "post",
      replace: true,
    });
  };

  // 新增：处理Cart Transform激活
  const handleActivateCartTransform = useCallback(() => {
    setActivatingCartTransform(true);
    const formData = new FormData();
    formData.append("intent", "activate-cart-transform");
    cartTransformFetcher.submit(formData, { method: "post" });
  }, [cartTransformFetcher]);

  // 添加Excel导入处理函数
  const handleExcelImport = () => {
    setExcelImportModalKey((k) => k + 1); // 每次打开都+1
    setExcelImportOpen(true);
  };

  const emptyStateMarkup = (
    <EmptyState
      heading="Manage Custom Product Options"
      action={{
        content: "Create Option Set",
        onAction: handleOpenCreateModal,
      }}
      image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg?height=200"
    ></EmptyState>
  );

  const ellipsisStyle: React.CSSProperties = {
    maxWidth: 120, // 可根据实际表格宽度调整
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
  };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(optionSets);

  const prevOptionSetsRef = useRef(optionSets);

  useEffect(() => {
    if (prevOptionSetsRef.current !== optionSets) {
      handleSelectionChange(SelectionType.All, false);
      prevOptionSetsRef.current = optionSets;
    }
  }, [optionSets, handleSelectionChange]);

  const openBatchDeleteModal = (ids: string[]) => {
    setBatchDeleteIds(ids);
    setShowBatchDeleteModal(true);
  };

  const confirmBatchDelete = () => {
    const formData = new FormData();
    formData.append("intent", "batch-delete-option-set");
    formData.append("ids", JSON.stringify(batchDeleteIds));
    submit(formData, { method: "post", replace: true });
    setShowBatchDeleteModal(false);
  };

  const cancelBatchDelete = () => {
    setShowBatchDeleteModal(false);
    setBatchDeleteIds([]);
  };

  const tableMarkup = (
    <div style={{ marginTop: "24px" }}>
      <IndexTable
        resourceName={resourceName}
        itemCount={optionSets?.length || 0}
        selectable={true}
        selectedItemsCount={
          allResourcesSelected ? "All" : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          { title: "Option Name" },
          { title: "Type" },
          { title: "Status" },
          { title: "Created At" },
          { title: "Updated At" },
          { title: "Actions" },
        ]}
      >
        {optionSets.length > 0 &&
          optionSets.map((set, index) => (
            <IndexTable.Row
              id={String(set.id)}
              key={set.id}
              position={index}
              selected={selectedResources.includes(set.id)}
            >
              <IndexTable.Cell>
                <div style={ellipsisStyle} title={set.name}>
                  {set.name}
                </div>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {set.options.map((opt) => opt.type).join(", ")}
              </IndexTable.Cell>
              <IndexTable.Cell>
                <div
                  style={{
                    display: "inline-block",
                    width: "40px",
                    height: "20px",
                    backgroundColor: set.active ? "#5c6ac4" : "#e0e0e0",
                    borderRadius: "10px",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease",
                  }}
                  onClick={() => handleToggleStatus(set)}
                >
                  <div
                    style={{
                      position: "absolute",
                      width: "16px",
                      height: "16px",
                      backgroundColor: "white",
                      borderRadius: "50%",
                      top: "2px",
                      left: set.active ? "22px" : "2px",
                      transition: "left 0.2s ease",
                    }}
                  />
                </div>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {new Date(set.createdAt).toLocaleString()}
              </IndexTable.Cell>
              <IndexTable.Cell>
                {new Date(set.updatedAt).toLocaleString()}
              </IndexTable.Cell>
              <IndexTable.Cell>
                <InlineStack gap="300">
                  <Button
                    variant="tertiary"
                    onClick={() => handleOpenEditModal(set)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="tertiary"
                    tone="critical"
                    onClick={() => handleOpenDeleteModal(set)}
                  >
                    Delete
                  </Button>
                </InlineStack>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
      </IndexTable>
    </div>
  );

  // 应用的筛选条件
  const appliedFilters = [];
  if (searchValue) {
    appliedFilters.push({
      key: "searchValue",
      label: `搜索: "${searchValue}"`,
      onRemove: () => {
        setSearchValue("");
        const formData = new FormData();
        formData.append("q", "");
        formData.append("status", statusFilter);
        submit(formData, { method: "get", replace: true });
      },
    });
  }

  if (statusFilter !== "all") {
    appliedFilters.push({
      key: "status",
      label: `状态: ${statusFilter === "active" ? "启用" : "禁用"}`,
      onRemove: () => {
        setStatusFilter("all");
        const formData = new FormData();
        formData.append("q", searchValue);
        formData.append("status", "all");
        submit(formData, { method: "get", replace: true });
      },
    });
  }

  useEffect(() => {
    // 检查URL参数
    const params = new URLSearchParams(location.search);
    if (params.get("import") === "success") {
      setShowImportToast(true);
      // 可选：清理URL参数
      window.history.replaceState({}, document.title, location.pathname);
    }
    if (params.get("import") === "fail") {
      setShowImportFailToast(true);
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location]);

  return (
    <Page
      title="Product Options Management"
      primaryAction={{
        content: "Create Option Set",
        onAction: handleOpenCreateModal,
      }}
      secondaryActions={[
        {
          content: "Excel Import",
          onAction: handleExcelImport,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          {/* Cart Transform激活提示 */}
          {!cartTransformActivated && (
            <Card>
              <Banner
                title="Cart Transform is not activated"
                action={{
                  content: activatingCartTransform
                    ? "Activating..."
                    : "Activate now",
                  onAction: handleActivateCartTransform,
                  loading: activatingCartTransform,
                }}
                tone="warning"
              >
                <BlockStack gap="200">
                  <p>
                    Cart Transform is used to handle price adjustments for
                    custom options. If this feature is not activated, custom
                    options with additional prices may not work properly.
                  </p>
                  {cartTransformInfo && (
                    <p>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Detected {cartTransformInfo.functionsCount} Cart
                        Transform functions, {cartTransformInfo.transformsCount}{" "}
                        currently activated
                      </Text>
                    </p>
                  )}
                </BlockStack>
              </Banner>
            </Card>
          )}

          {/* 现有的搜索和筛选卡片 */}
          <div style={{ marginTop: "24px" }}>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Option Set
                  </Text>
                  <Button onClick={refreshTags} loading={tagsLoading}>
                    Refresh product tags
                  </Button>
                </InlineStack>

                {/* 搜索栏 */}
                <InlineStack align="start" gap="400">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Search Option Sets"
                      value={searchValue}
                      onChange={handleSearchChange}
                      autoComplete="off"
                      placeholder="Enter option set name..."
                      onClearButtonClick={() => setSearchValue("")}
                      clearButton
                    />
                  </div>
                  <div style={{ marginTop: "24px" }}>
                    <Button onClick={handleSearchSubmit}>Search</Button>
                  </div>
                </InlineStack>

                {/* 筛选器 */}
                <InlineStack align="start" gap="400">
                  <Text as="span">Status filter:</Text>
                  <Button
                    pressed={statusFilter === "all"}
                    onClick={() => handleStatusChange("all")}
                    variant={statusFilter === "all" ? "primary" : "tertiary"}
                  >
                    All
                  </Button>
                  <Button
                    pressed={statusFilter === "active"}
                    onClick={() => handleStatusChange("active")}
                    variant={statusFilter === "active" ? "primary" : "tertiary"}
                  >
                    Enable
                  </Button>
                  <Button
                    pressed={statusFilter === "deactive"}
                    onClick={() => handleStatusChange("deactive")}
                    variant={
                      statusFilter === "deactive" ? "primary" : "tertiary"
                    }
                  >
                    Disable
                  </Button>

                  {(searchValue || statusFilter !== "all") && (
                    <Button onClick={handleClearFilters}>Clear filter</Button>
                  )}
                </InlineStack>

                {/* 应用的筛选条件标签 */}
                {appliedFilters.length > 0 && (
                  <InlineStack gap="200" wrap={true}>
                    {appliedFilters.map((filter) => (
                      <Button
                        key={filter.key}
                        onClick={filter.onRemove}
                        icon={
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                          >
                            <path
                              d="M6.5 13.5L13.5 6.5M6.5 6.5L13.5 13.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        }
                      >
                        {filter.label}
                      </Button>
                    ))}
                  </InlineStack>
                )}
              </BlockStack>
            </Card>
          </div>

          <div style={{ marginTop: "24px" }}>
            {optionSets?.length > 0 ? (
              <>
                <InlineStack gap="400" align="space-between">
                  <Text as="h2" variant="headingMd">
                    Option Set
                  </Text>
                  <Button
                    tone="critical"
                    disabled={selectedResources.length === 0}
                    onClick={() => openBatchDeleteModal(selectedResources)}
                  >
                    Batch Delete
                  </Button>
                </InlineStack>
                {tableMarkup}
              </>
            ) : (
              emptyStateMarkup
            )}
          </div>

          {/* 分页控制 */}
          {pagination && pagination.totalPages > 1 && (
            <div style={{ marginTop: "24px" }}>
              <Card>
                <InlineStack align="center" gap="400">
                  <Text as="p">
                    Page {pagination.currentPage} of {pagination.totalPages},
                    total {pagination.totalCount} records
                  </Text>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button
                      disabled={pagination.currentPage <= 1}
                      onClick={() => {
                        const formData = new FormData();
                        formData.append("q", searchValue);
                        formData.append("status", statusFilter);
                        formData.append(
                          "page",
                          String(pagination.currentPage - 1),
                        );
                        submit(formData, { method: "get", replace: true });
                      }}
                    >
                      Previous page
                    </Button>
                    <Button
                      disabled={pagination.currentPage >= pagination.totalPages}
                      onClick={() => {
                        const formData = new FormData();
                        formData.append("q", searchValue);
                        formData.append("status", statusFilter);
                        formData.append(
                          "page",
                          String(pagination.currentPage + 1),
                        );
                        submit(formData, { method: "get", replace: true });
                      }}
                    >
                      Next page
                    </Button>
                  </div>
                </InlineStack>
              </Card>
            </div>
          )}
        </Layout.Section>
      </Layout>

      {/* 使用封装的OptionSetModal组件 */}
      <OptionSetModal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        onSave={handleSave}
        title={modalConfig.title}
        initialData={modalConfig.initialData}
        optionTypes={optionTypes}
        mode={modalConfig.mode}
        productTags={productTags}
        tagsLoading={tagsLoading}
        onRefreshTags={refreshTags} // 🔧 只在手动点击时触发
      />

      {/* 添加Excel导入模态框 */}
      <ExcelImportModal
        key={excelImportModalKey}
        open={excelImportOpen}
        onClose={() => setExcelImportOpen(false)}
        onImport={(formData) => {
          excelImportFetcher.submit(formData, {
            method: "post",
            action: "/app/excel-import",
          });
        }}
        importResult={excelImportFetcher.data}
      />

      {showImportToast && (
        <Toast
          content="Excel batch import succeeded!"
          onDismiss={() => setShowImportToast(false)}
        />
      )}
      {showImportFailToast && (
        <Toast
          content="Excel batch import failed. Please check the data format or try again later."
          error
          onDismiss={() => setShowImportFailToast(false)}
        />
      )}

      <Modal
        open={showBatchDeleteModal}
        onClose={cancelBatchDelete}
        title="Batch Delete Option Sets"
        primaryAction={{
          content: "Confirm Delete",
          destructive: true,
          onAction: confirmBatchDelete,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: cancelBatchDelete,
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete these {batchDeleteIds.length}
            option sets? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
