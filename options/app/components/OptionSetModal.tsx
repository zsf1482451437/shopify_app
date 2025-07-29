import { useState, useEffect } from "react";
import {
  Modal,
  BlockStack,
  InlineStack,
  TextField,
  Text,
  Button,
  Select,
  Tag,
  Spinner,
} from "@shopify/polaris";
import type { Option, OptionValue } from "./OptionEditor";
import { OptionEditor } from "./OptionEditor";

interface OptionType {
  id: string;
  name: string;
}

interface OptionSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    options: Option[];
    applyToAll: boolean;
    productTags: string[];
  }) => Promise<void>;
  title: string;
  initialData?: {
    id?: string;
    name: string;
    options: Option[];
    applyToAll?: boolean;
    productTags?: string[];
  };
  optionTypes: OptionType[];
  mode: "create" | "edit" | "delete";
  productTags: string[];
  tagsLoading?: boolean; // 新增：标签加载状态
  onRefreshTags?: () => void; // 新增：刷新标签函数
}

export function OptionSetModal({
  isOpen,
  onClose,
  onSave,
  title,
  initialData,
  optionTypes,
  mode,
  productTags,
  tagsLoading = false, // 新增：默认值为false
  onRefreshTags, // 新增：刷新函数
}: OptionSetModalProps) {
  // 基础状态
  const [optionSetName, setOptionSetName] = useState<string>(
    initialData?.name || "Untitled option set",
  );
  const [optionConfigs, setOptionConfigs] = useState<Option[]>(
    initialData?.options || [],
  );

  // 商品标签相关状态
  const [applyToAll, setApplyToAll] = useState<boolean>(
    initialData?.applyToAll ?? true,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialData?.productTags || [],
  );
  const [selectedTagForAdd, setSelectedTagForAdd] = useState<string>("");

  // 错误状态
  const [nameError, setNameError] = useState<string>("");
  const [tagsError, setTagsError] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // 重置表单
  useEffect(() => {
    if (isOpen && initialData) {
      setOptionSetName(initialData.name);
      setApplyToAll(initialData.applyToAll ?? true);
      setSelectedTags(initialData.productTags || []);
      setSelectedTagForAdd("");

      const processedOptions = initialData.options.map((option) => {
        const optionObj = {
          id: option.id,
          name: option.name,
          type: option.type,
          required: option.required,
          values: option.values,
          dependOnOptionId: option.dependOnOptionId,
          showWhenValue: option.showWhenValue,
          price: option.price,
        };

        if (option.dependOnOptionId) {
          optionObj.dependOnOptionId = option.dependOnOptionId;
          optionObj.showWhenValue = option.showWhenValue || "";
        }

        return optionObj;
      });

      setOptionConfigs(processedOptions);
      setNameError("");
      setTagsError("");
    } else if (isOpen && !initialData) {
      setOptionSetName("Untitled option set");
      setOptionConfigs([]);
      setApplyToAll(true);
      setSelectedTags([]);
      setSelectedTagForAdd("");
      setNameError("");
      setTagsError("");
    }
  }, [isOpen, initialData]);

  // 处理应用范围变更
  const handleApplyToAllChange = (newApplyToAll: boolean) => {
    setApplyToAll(newApplyToAll);
    if (newApplyToAll) {
      setSelectedTags([]); // 清空已选标签
      setSelectedTagForAdd("");
    }
    // 🔧 移除：不再自动刷新标签，只在用户点击刷新按钮时才获取
  };

  // 处理手动刷新标签
  const handleRefreshTags = () => {
    if (onRefreshTags) {
      setSelectedTagForAdd(""); // 清空当前选择
      onRefreshTags();
    }
  };

  // 处理标签添加
  const handleAddTag = () => {
    if (!selectedTagForAdd) return;

    if (selectedTags.includes(selectedTagForAdd)) {
      setTagsError("This tag is already selected");
      return;
    }

    setSelectedTags((prev) => [...prev, selectedTagForAdd]);
    setSelectedTagForAdd("");
    setTagsError("");
  };

  // 处理标签删除
  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  // 获取可选择的标签选项
  const getSelectableTagOptions = () => {
    const selectableTags = productTags.filter(
      (tag) => !selectedTags.includes(tag),
    );

    return [
      { label: "Select a tag...", value: "" },
      ...selectableTags.map((tag) => ({ label: tag, value: tag })),
    ];
  };

  // 保存处理
  const handleSave = async () => {
    if (!optionSetName.trim()) {
      setNameError("Option set name cannot be empty");
      return;
    }

    if (!applyToAll && selectedTags.length === 0) {
      setTagsError(
        "Please select at least one product tag or choose 'Apply to all products'",
      );
      return;
    }

    const validatedOptions = optionConfigs.map((config) => {
      const processedConfig = {
        ...config,
        values: Array.isArray(config.values) ? config.values : [],
      };

      if (config.dependOnOptionId) {
        processedConfig.dependOnOptionId = config.dependOnOptionId;
        processedConfig.showWhenValue = config.showWhenValue;
      }

      return processedConfig;
    });

    setNameError("");
    setTagsError("");

    try {
      setIsSaving(true);
      setSaveError("");

      await onSave({
        name: optionSetName,
        options: validatedOptions,
        applyToAll,
        productTags: selectedTags,
      });

      onClose();
    } catch (error) {
      console.error("Failed to save option set:", error);
      setSaveError(String(error) || "Failed to save, please try again");
    } finally {
      setIsSaving(false);
    }
  };

  // 处理选项类型选择
  const handleOptionTypeSelect = (type: string): void => {
    // 检查是否已经选择了该类型
    const existingConfig = optionConfigs.find((config) => config.type === type);

    if (existingConfig) {
      // 如果已选择，则移除该类型
      setOptionConfigs((prev) => prev.filter((config) => config.type !== type));
    } else {
      // 为新控件生成一个UUID作为永久ID
      const permanentId = crypto.randomUUID();

      // 根据类型创建不同的默认配置
      let defaultValues: OptionValue[] = [];
      if (type === "dropdown") {
        // 普通下拉菜单：选项没有价格
        defaultValues = [{ id: crypto.randomUUID(), label: "Option 1" }];
      } else if (type === "dropdown_thumbnail") {
        // 缩略图下拉菜单：选项有价格
        defaultValues = [
          { id: crypto.randomUUID(), label: "Option 1", price: 0 },
        ];
      } else if (type === "radio") {
        // 单选按钮：选项没有价格
        defaultValues = [{ id: crypto.randomUUID(), label: "Option 1" }];
      }

      // 添加该类型的默认配置
      setOptionConfigs((prev) => [
        ...prev,
        {
          id: permanentId,
          type,
          name: `${type} Option`,
          required: false,
          values: defaultValues,
          dependOnOptionId: "",
          showWhenValue: "",
          price: type === "dropdown" ? 0 : undefined, // 只有普通下拉菜单才有统一价格
        },
      ]);
    }
  };

  // 移除现有选项
  const handleRemoveExistingOption = (optionId: string): void => {
    setOptionConfigs((prev) => prev.filter((config) => config.id !== optionId));
  };

  // 添加下拉选项值
  const addDropdownValue = (config: Option): void => {
    const newValue = {
      id: crypto.randomUUID(),
      label: `Option ${(Array.isArray(config.values) ? config.values.length : 0) + 1}`,
    };

    setOptionConfigs((prev) =>
      prev.map((c) => {
        if ((c.id && c.id === config.id) || (!c.id && c.type === config.type)) {
          return {
            ...c,
            values: Array.isArray(c.values)
              ? [...c.values, newValue]
              : [newValue],
          };
        }
        return c;
      }),
    );
  };

  // 更新下拉选项值
  const updateDropdownValue = (
    config: Option,
    valueId: string,
    updatedValue: Partial<OptionValue>,
  ): void => {
    setOptionConfigs((prev) =>
      prev.map((c) => {
        if ((c.id && c.id === config.id) || (!c.id && c.type === config.type)) {
          return {
            ...c,
            values: Array.isArray(c.values)
              ? c.values.map((v) =>
                  v.id === valueId ? { ...v, ...updatedValue } : v,
                )
              : [{ id: valueId, label: "Option 1", ...updatedValue }],
          };
        }
        return c;
      }),
    );
  };

  // 删除下拉选项值
  const removeDropdownValue = (config: Option, valueId: string): void => {
    setOptionConfigs((prev) =>
      prev.map((c) => {
        if ((c.id && c.id === config.id) || (!c.id && c.type === config.type)) {
          return {
            ...c,
            values: Array.isArray(c.values)
              ? c.values.filter((v) => v.id !== valueId)
              : [],
          };
        }
        return c;
      }),
    );
  };

  // 处理图片上传
  const handleImageUpload = (
    config: Option,
    valueId: string,
    file: File,
  ): void => {
    // 将文件转换为base64
    const reader = new FileReader();
    reader.onloadend = () => {
      updateDropdownValue(config, valueId, { image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // 更新选项配置
  const handleUpdateOption = (updatedConfig: Option): void => {
    setOptionConfigs((prev) =>
      prev.map((c) => {
        // 使用ID进行匹配，无论是临时ID还是真实ID
        if (c.id === updatedConfig.id) {
          return updatedConfig;
        }
        // 兼容旧的逻辑，如果没有ID，则使用类型匹配
        if (!updatedConfig.id && !c.id && c.type === updatedConfig.type) {
          return updatedConfig;
        }
        return c;
      }),
    );
  };

  // 添加复制控件函数
  const handleDuplicateOption = (optionToDuplicate: Option): void => {
    // 为复制的控件生成新的UUID
    const permanentId = crypto.randomUUID();

    // 根据类型创建不同的默认配置
    let defaultValues: OptionValue[] = [];
    if (optionToDuplicate.type === "dropdown") {
      defaultValues = [{ id: crypto.randomUUID(), label: "Option 1" }];
    } else if (optionToDuplicate.type === "dropdown_thumbnail") {
      defaultValues = [
        { id: crypto.randomUUID(), label: "Option 1", price: 0 },
      ];
    } else if (optionToDuplicate.type === "radio") {
      defaultValues = [{ id: crypto.randomUUID(), label: "Option 1" }];
    }

    // 创建与原控件相同类型的新控件，但使用初始配置
    const duplicatedOption = {
      id: permanentId,
      type: optionToDuplicate.type,
      name: `${optionToDuplicate.type} Option`,
      required: false,
      values: defaultValues,
      dependOnOptionId: "",
      showWhenValue: "",
      price: optionToDuplicate.type === "dropdown" ? 0 : undefined, // 只有普通下拉菜单才有统一价格
    };

    // 添加到现有配置中
    setOptionConfigs((prev) => [...prev, duplicatedOption]);
  };

  // 明确定义删除处理函数
  const handleDelete = async () => {
    await onSave({
      name: optionSetName,
      options: [],
      applyToAll: true,
      productTags: [],
    });
  };

  // 根据模式确定主要操作
  const getPrimaryAction = () => {
    switch (mode) {
      case "delete":
        return {
          content: "Delete",
          onAction: handleDelete,
          loading: isSaving,
          destructive: true,
        };
      case "create":
      case "edit":
      default:
        return {
          content: "Save",
          onAction: handleSave,
          loading: isSaving,
          destructive: false,
        };
    }
  };

  // 在OptionSetModal组件内部添加这个函数
  const renderTagsConfiguration = () => {
    if (applyToAll) return null;

    return (
      <BlockStack gap="300">
        <InlineStack align="space-between">
          <Text variant="bodyMd" as="p" tone="subdued">
            This option set will only apply to products containing the following
            tags:
          </Text>

          {/* 刷新标签按钮 */}
          {onRefreshTags && (
            <Button
              size="slim"
              variant="tertiary"
              onClick={handleRefreshTags}
              loading={tagsLoading}
              disabled={tagsLoading}
              icon={tagsLoading ? undefined : "🔄"}
            >
              {tagsLoading ? "Loading..." : "Refresh Tags"}
            </Button>
          )}
        </InlineStack>

        {/* 标签选择器 - 添加loading状态 */}
        {tagsLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px",
              backgroundColor: "#f9fafb",
              borderRadius: "6px",
            }}
          >
            <Spinner size="small" />
            <Text variant="bodyMd" as="p" tone="subdued">
              Loading product tags from your store...
            </Text>
          </div>
        ) : productTags.length > 0 ? (
          <InlineStack gap="200" align="start">
            <div style={{ flex: 1 }}>
              <Select
                label="Select product tag"
                labelHidden
                options={getSelectableTagOptions()}
                value={selectedTagForAdd}
                onChange={setSelectedTagForAdd}
                error={tagsError}
              />
            </div>
            <Button
              size="slim"
              onClick={handleAddTag}
              disabled={!selectedTagForAdd}
            >
              Add Tag
            </Button>
          </InlineStack>
        ) : (
          <div
            style={{
              padding: "12px",
              backgroundColor: "#fef3f2",
              borderRadius: "6px",
              border: "1px solid #fecaca",
            }}
          >
            <InlineStack align="space-between">
              <Text as="p" tone="subdued">
                No product tags found in your store.
              </Text>
              {onRefreshTags && (
                <Button
                  size="slim"
                  variant="tertiary"
                  onClick={handleRefreshTags}
                >
                  Try Again
                </Button>
              )}
            </InlineStack>
          </div>
        )}

        {/* 已选择的标签显示 */}
        {selectedTags.length > 0 && (
          <div>
            <Text variant="bodyMd" as="p" fontWeight="medium">
              Selected tags ({selectedTags.length}):
            </Text>
            <InlineStack gap="100" wrap={false}>
              {selectedTags.map((tag) => (
                <Tag key={tag} onRemove={() => handleRemoveTag(tag)}>
                  {tag}
                </Tag>
              ))}
            </InlineStack>
          </div>
        )}
      </BlockStack>
    );
  };

  // 创建/编辑模态框
  return (
    <Modal
      size="large"
      open={isOpen}
      onClose={onClose}
      title={mode === "delete" ? "Delete Option Set" : title}
      primaryAction={getPrimaryAction()}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
        },
      ]}
    >
      {saveError && (
        <div
          style={{
            marginBottom: "16px",
            padding: "8px",
            backgroundColor: "#FFF4F4",
            color: "#D82C0D",
            borderRadius: "4px",
          }}
        >
          {saveError}
        </div>
      )}
      <Modal.Section>
        <BlockStack gap="500">
          {mode === "delete" ? (
            <Text variant="bodyMd" as="p">
              Are you sure you want to delete the option set "{optionSetName}"?
              This action cannot be undone, and all related option data will be
              permanently deleted.
            </Text>
          ) : (
            <>
              <TextField
                label="Option Set Name"
                value={optionSetName}
                onChange={(value) => {
                  setOptionSetName(value);
                  if (value.trim() && nameError) {
                    setNameError("");
                  }
                }}
                autoComplete="off"
                placeholder="Please enter option set name"
                error={nameError}
                requiredIndicator
              />

              {/* 商品标签应用范围配置 */}
              <BlockStack gap="400">
                <Text variant="headingMd" as="h4">
                  Application scope
                </Text>

                <InlineStack gap="400">
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      checked={applyToAll}
                      onChange={() => handleApplyToAllChange(true)}
                      style={{ marginRight: "8px" }}
                    />
                    Apply to all products
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      checked={!applyToAll}
                      onChange={() => handleApplyToAllChange(false)}
                      style={{ marginRight: "8px" }}
                    />
                    Apply to products with specific tags
                  </label>
                </InlineStack>

                {/* 使用提取的函数 */}
                {renderTagsConfiguration()}
              </BlockStack>

              {/* 其余现有的选项类型配置部分保持不变 */}
              <div
                style={{ borderTop: "1px solid #dfe3e8", paddingTop: "20px" }}
              >
                <InlineStack gap="400" blockAlign="start">
                  {/* 右侧选项类型列表 */}
                  <div style={{ flex: 2 }}>
                    <BlockStack gap="400">
                      {/* 修改这里：根据模式显示不同的选项类型列表 */}
                      {mode === "edit"
                        ? optionTypes
                            .filter((type) =>
                              optionConfigs.some(
                                (config) => config.type === type.id,
                              ),
                            )
                            .map((type) => (
                              <div
                                key={type.id}
                                style={{
                                  padding: "12px",
                                  borderRadius: "4px",
                                  backgroundColor: "#f9fafb",
                                }}
                              >
                                <InlineStack align="space-between" gap="300">
                                  <InlineStack align="start" gap="300">
                                    <input
                                      type="checkbox"
                                      id={`type-${type.id}`}
                                      checked={true}
                                      disabled={true} // 添加这行：禁用编辑模式下的勾选框
                                      onChange={() =>
                                        handleOptionTypeSelect(type.id)
                                      }
                                      style={{
                                        width: "18px",
                                        height: "18px",
                                        cursor: "not-allowed", // 添加这行：显示禁用光标
                                      }}
                                    />
                                    <label
                                      htmlFor={`type-${type.id}`}
                                      style={{
                                        fontWeight: "bold",
                                        cursor: "default", // 修改这行：禁用光标
                                        fontSize: "14px",
                                        color: "#6b7280", // 添加这行：灰色文字表示禁用
                                      }}
                                    >
                                      {type.name}
                                    </label>
                                  </InlineStack>
                                </InlineStack>
                              </div>
                            ))
                        : optionTypes.map((type) => (
                            <div
                              key={type.id}
                              style={{
                                padding: "12px",
                                borderRadius: "4px",
                                backgroundColor: "#f9fafb",
                              }}
                            >
                              <InlineStack align="space-between" gap="300">
                                <InlineStack align="start" gap="300">
                                  <input
                                    type="checkbox"
                                    id={`type-${type.id}`}
                                    checked={optionConfigs.some(
                                      (config) => config.type === type.id,
                                    )}
                                    onChange={() =>
                                      handleOptionTypeSelect(type.id)
                                    }
                                    style={{ width: "18px", height: "18px" }}
                                  />
                                  <label
                                    htmlFor={`type-${type.id}`}
                                    style={{
                                      fontWeight: optionConfigs.some(
                                        (config) => config.type === type.id,
                                      )
                                        ? "bold"
                                        : "normal",
                                      cursor: "pointer",
                                      fontSize: "14px",
                                    }}
                                  >
                                    {type.name}
                                  </label>
                                </InlineStack>

                                {/* 在创建模式下，只有当已选择该类型时才显示复制按钮 */}
                                {optionConfigs.some(
                                  (config) => config.type === type.id,
                                ) && (
                                  <Button
                                    size="slim"
                                    variant="tertiary"
                                    onClick={() => {
                                      const optionToCopy = optionConfigs.find(
                                        (config) => config.type === type.id,
                                      );
                                      if (optionToCopy) {
                                        handleDuplicateOption(optionToCopy);
                                      }
                                    }}
                                  >
                                    Copy
                                  </Button>
                                )}
                              </InlineStack>
                            </div>
                          ))}
                    </BlockStack>
                  </div>

                  {/* 右侧控件配置区 */}
                  <div
                    style={{
                      flex: 3,
                      borderLeft: "1px solid #dfe3e8",
                      paddingLeft: "20px",
                      minHeight: "300px",
                    }}
                  >
                    {optionConfigs.length > 0 ? (
                      <BlockStack gap="800">
                        {/* 选项配置 */}
                        {optionConfigs
                          .filter((config) => config.id || !config.id)
                          .map((config, index) => (
                            <div
                              key={config.id || `new-${config.type}-${index}`}
                              style={{
                                padding: "16px",
                                backgroundColor: "#f6f6f7",
                                borderRadius: "8px",
                                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                              }}
                            >
                              {/* 这里使用扩展后的 OptionEditor 组件，包含条件显示配置 */}
                              <OptionEditor
                                config={config}
                                onUpdate={handleUpdateOption}
                                // 只在创建模式下传入 onRemove 函数
                                {...(mode === "create"
                                  ? {
                                      onRemove: () =>
                                        handleRemoveExistingOption(
                                          config.id || "",
                                        ),
                                    }
                                  : {})}
                                onDuplicate={() =>
                                  handleDuplicateOption(config)
                                }
                                allOptions={optionConfigs}
                                addDropdownValue={addDropdownValue}
                                updateDropdownValue={updateDropdownValue}
                                removeDropdownValue={removeDropdownValue}
                                handleImageUpload={handleImageUpload}
                              />
                            </div>
                          ))}
                      </BlockStack>
                    ) : (
                      <div
                        style={{
                          padding: "40px 20px",
                          textAlign: "center",
                          backgroundColor: "#f9fafb",
                          borderRadius: "8px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "200px",
                        }}
                      >
                        <Text variant="headingMd" as="p">
                          {mode === "create"
                            ? "Please select option types from the left"
                            : "All options have been removed"}
                        </Text>
                        <Text variant="bodyMd" as="p">
                          {mode === "create"
                            ? "After selecting, you can configure option properties here"
                            : "Please select option types from the left to add new options"}
                        </Text>
                      </div>
                    )}
                  </div>
                </InlineStack>
              </div>
            </>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
