import {
  BlockStack,
  InlineStack,
  TextField,
  Text,
  Button,
} from "@shopify/polaris";
import { DeleteIcon, PlusIcon } from "@shopify/polaris-icons";

// 导入类型定义
export interface OptionValue {
  id: string;
  label: string;
  image?: string;
  price?: number;
}

export interface Option {
  dependOnOptionId: string;
  showWhenValue: string;
  id?: string;
  type: string;
  name: string;
  required: boolean;
  values?: OptionValue[];
  price?: number;
  productId?: string;
}

interface OptionEditorProps {
  config: Option;
  onUpdate: (updated: Option) => void;
  onRemove?: () => void;
  onDuplicate: () => void;
  allOptions: Option[];
  addDropdownValue: (config: Option) => void;
  updateDropdownValue: (
    config: Option,
    valueId: string,
    updatedValue: Partial<OptionValue>,
  ) => void;
  removeDropdownValue: (config: Option, valueId: string) => void;
  handleImageUpload: (config: Option, valueId: string, file: File) => void;
}

// ==================== 组件外的渲染函数 ====================

// 渲染头部信息
function renderHeader(config: Option, onRemove?: () => void) {
  return (
    <InlineStack align="space-between">
      <Text variant="headingMd" as="h3">
        Type:{" "}
        {config.type === "dropdown_thumbnail"
          ? "Dropdown (Thumbnail)"
          : config.type}
      </Text>
      {onRemove && (
        <InlineStack gap="200">
          <Button onClick={onRemove} tone="critical">
            Remove
          </Button>
        </InlineStack>
      )}
    </InlineStack>
  );
}

// 渲染基本配置（名称和必填设置）
function renderBasicConfig(
  config: Option,
  onUpdate: (updated: Option) => void,
) {
  return (
    <InlineStack gap="400">
      <div style={{ flex: 2 }}>
        <TextField
          label="Name"
          value={config.name}
          onChange={(value) => onUpdate({ ...config, name: value })}
          autoComplete="off"
        />
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <label htmlFor={`required-${config.id || config.type}`}>
          Required：
        </label>
        <input
          id={`required-${config.id || config.type}`}
          type="checkbox"
          checked={config.required}
          onChange={() => onUpdate({ ...config, required: !config.required })}
        />
      </div>
    </InlineStack>
  );
}

// 渲染价格配置组件
function renderPriceConfig(
  config: Option,
  onUpdate: (updated: Option) => void,
  title: string = "Additional price",
  description: string = "Setting a fixed amount will be added directly to the product price",
) {
  return (
    <BlockStack gap="400">
      <Text variant="headingMd" as="h4">
        {title}
      </Text>

      <InlineStack gap="400" align="start">
        <TextField
          label="Additional price"
          labelHidden
          type="number"
          value={config.price?.toString() || "0"}
          onChange={(value) => {
            const price = parseFloat(value);
            onUpdate({
              ...config,
              price: isNaN(price) ? 0 : price,
            });
          }}
          autoComplete="off"
          suffix="$"
        />
      </InlineStack>

      <Text variant="bodyMd" as="p" tone="subdued">
        {description}
      </Text>
    </BlockStack>
  );
}

// 渲染文本和数字类型的价格配置
function renderTextNumberPriceConfig(
  config: Option,
  onUpdate: (updated: Option) => void,
) {
  if (config.type !== "text" && config.type !== "number") return null;

  return renderPriceConfig(config, onUpdate);
}

// 渲染选项值列表
function renderOptionValueList(
  config: Option,
  updateDropdownValue: (
    config: Option,
    valueId: string,
    updatedValue: Partial<OptionValue>,
  ) => void,
  removeDropdownValue: (config: Option, valueId: string) => void,
  handleImageUpload: (config: Option, valueId: string, file: File) => void,
  showImages: boolean = true,
) {
  if (!Array.isArray(config.values)) {
    return <Text as="p">Invalid option value data</Text>;
  }

  return (
    <div style={{ maxHeight: "300px", overflowY: "auto" }}>
      {config.values.map((value) => (
        <div
          key={value.id}
          style={{
            marginBottom: "10px",
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            backgroundColor: "#f9f9f9",
          }}
        >
          <InlineStack gap="400" align="center" blockAlign="center">
            {/* 缩略图区域 - 仅在需要时显示 */}
            {showImages && (
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  position: "relative",
                }}
              >
                {value.image ? (
                  <img
                    src={value.image}
                    alt={value.label}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "4px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: "#eee",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "4px",
                    }}
                  >
                    <Text variant="bodyMd" as="span">
                      No image
                    </Text>
                  </div>
                )}

                {/* 上传按钮 */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "0",
                    left: "0",
                    right: "0",
                    background: "rgba(0,0,0,0.5)",
                    padding: "2px",
                    textAlign: "center",
                    cursor: "pointer",
                    borderBottomLeftRadius: "4px",
                    borderBottomRightRadius: "4px",
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        handleImageUpload(config, value.id, file);
                      }
                    };
                    input.click();
                  }}
                >
                  <Text variant="bodyMd" as="span">
                    Upload
                  </Text>
                </div>
              </div>
            )}

            {/* 文本输入 */}
            <div style={{ flex: 1 }}>
              <TextField
                label={showImages ? "Option" : "Option text"}
                labelHidden
                value={value.label}
                onChange={(newValue) =>
                  updateDropdownValue(config, value.id, {
                    label: newValue,
                  })
                }
                autoComplete="off"
              />
            </div>

            {/* 删除按钮 */}
            <Button
              icon={<DeleteIcon />}
              variant="tertiary"
              onClick={() => removeDropdownValue(config, value.id)}
              disabled={config.values?.length === 1}
              tone="critical"
            >
              delete
            </Button>
          </InlineStack>
        </div>
      ))}
    </div>
  );
}

// 渲染添加选项按钮
function renderAddOptionButton(
  config: Option,
  onUpdate: (updated: Option) => void,
  addDropdownValue: (config: Option) => void,
) {
  return (
    <Button
      onClick={() => {
        if (!Array.isArray(config.values)) {
          const updatedConfig = {
            ...config,
            values: [],
          };
          onUpdate(updatedConfig);
          addDropdownValue(updatedConfig);
        } else {
          addDropdownValue(config);
        }
      }}
      icon={<PlusIcon />}
    >
      Add option
    </Button>
  );
}

// 渲染下拉菜单编辑器（包括普通下拉和缩略图下拉）
function renderDropdownEditor(
  config: Option,
  onUpdate: (updated: Option) => void,
  updateDropdownValue: (
    config: Option,
    valueId: string,
    updatedValue: Partial<OptionValue>,
  ) => void,
  removeDropdownValue: (config: Option, valueId: string) => void,
  handleImageUpload: (config: Option, valueId: string, file: File) => void,
  addDropdownValue: (config: Option) => void,
) {
  const isDropdownType =
    config.type === "dropdown" || config.type === "dropdown_thumbnail";
  if (!isDropdownType) return null;

  // 判断是否显示统一价格配置
  const showUnifiedPrice = config.type === "dropdown";
  const showIndividualPrice = config.type === "dropdown_thumbnail";

  return (
    <BlockStack gap="400">
      {/* 统一价格配置 - 仅普通下拉菜单显示 */}
      {showUnifiedPrice &&
        renderPriceConfig(
          config,
          onUpdate,
          "Additional price",
          "Setting a fixed amount will be added directly to the product price when any option is selected",
        )}

      {/* 选项值编辑 */}
      <Text variant="headingMd" as="h4">
        {config.type === "dropdown_thumbnail"
          ? "Thumbnail dropdown options"
          : "Dropdown options"}
      </Text>

      {showIndividualPrice && (
        <Text variant="bodyMd" as="p" tone="subdued">
          Each option can have its own price. The selected option's price will
          be added to the product price.
        </Text>
      )}

      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
        {Array.isArray(config.values) ? (
          config.values.map((value) => (
            <div
              key={value.id}
              style={{
                marginBottom: "10px",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                backgroundColor: "#f9f9f9",
              }}
            >
              <InlineStack gap="400" align="center" blockAlign="center">
                {/* 缩略图区域 */}
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    position: "relative",
                  }}
                >
                  {value.image ? (
                    <img
                      src={value.image}
                      alt={value.label}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "4px",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#eee",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "4px",
                      }}
                    >
                      <Text variant="bodyMd" as="span">
                        No image
                      </Text>
                    </div>
                  )}

                  {/* 上传按钮 */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "0",
                      left: "0",
                      right: "0",
                      background: "rgba(0,0,0,0.5)",
                      padding: "2px",
                      textAlign: "center",
                      cursor: "pointer",
                      borderBottomLeftRadius: "4px",
                      borderBottomRightRadius: "4px",
                    }}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          handleImageUpload(config, value.id, file);
                        }
                      };
                      input.click();
                    }}
                  >
                    <Text variant="bodyMd" as="span">
                      Upload
                    </Text>
                  </div>
                </div>

                {/* 文本和价格输入区域 */}
                <div style={{ flex: 1 }}>
                  <BlockStack gap="200">
                    {/* 文本输入 */}
                    <TextField
                      label="Option text"
                      labelHidden
                      value={value.label}
                      onChange={(newValue) =>
                        updateDropdownValue(config, value.id, {
                          label: newValue,
                        })
                      }
                      autoComplete="off"
                      placeholder="Enter option text"
                    />

                    {/* 价格输入 - 仅 dropdown_thumbnail 类型显示 */}
                    {showIndividualPrice && (
                      <TextField
                        label="Additional price"
                        labelHidden
                        type="number"
                        value={value.price?.toString() || "0"}
                        onChange={(newPrice) => {
                          const price = parseFloat(newPrice);
                          updateDropdownValue(config, value.id, {
                            price: isNaN(price) ? 0 : price,
                          });
                        }}
                        autoComplete="off"
                        suffix="$"
                        placeholder="0.00"
                      />
                    )}
                  </BlockStack>
                </div>

                {/* 删除按钮 */}
                <Button
                  icon={<DeleteIcon />}
                  variant="tertiary"
                  onClick={() => removeDropdownValue(config, value.id)}
                  disabled={config.values?.length === 1}
                  tone="critical"
                >
                  delete
                </Button>
              </InlineStack>
            </div>
          ))
        ) : (
          <Text as="p">Invalid option value data</Text>
        )}
      </div>

      {renderAddOptionButton(config, onUpdate, addDropdownValue)}
    </BlockStack>
  );
}

// 渲染单选按钮编辑器
function renderRadioEditor(
  config: Option,
  onUpdate: (updated: Option) => void,
  updateDropdownValue: (
    config: Option,
    valueId: string,
    updatedValue: Partial<OptionValue>,
  ) => void,
  removeDropdownValue: (config: Option, valueId: string) => void,
  handleImageUpload: (config: Option, valueId: string, file: File) => void,
  addDropdownValue: (config: Option) => void,
) {
  if (config.type !== "radio") return null;

  return (
    <BlockStack gap="400">
      <Text variant="headingMd" as="h4">
        Options
      </Text>

      {renderOptionValueList(
        config,
        updateDropdownValue,
        removeDropdownValue,
        handleImageUpload,
        false, // 不显示图片
      )}

      {renderAddOptionButton(config, onUpdate, addDropdownValue)}
    </BlockStack>
  );
}

// 渲染条件显示配置
function renderConditionalDisplay(
  config: Option,
  onUpdate: (updated: Option) => void,
  radioOptions: Option[],
) {
  if (config.type === "radio") return null;

  return (
    <BlockStack gap="400">
      <Text variant="headingMd" as="h4">
        Show
      </Text>

      <BlockStack gap="300">
        {radioOptions.length > 0 ? (
          <>
            <InlineStack gap="200">
              {(() => {
                const dependOnOption = config.dependOnOptionId
                  ? radioOptions.find(
                      (opt) => opt.id === config.dependOnOptionId,
                    )
                  : radioOptions[0];

                const selectedOption = dependOnOption || radioOptions[0];

                return (
                  <>
                    <Text as="span">
                      when{" "}
                      <Text as="span" fontWeight="bold">
                        {selectedOption?.name || "Unknown control"}
                      </Text>{" "}
                      is
                    </Text>
                    <select
                      style={{ display: "inline-block", width: "40%" }}
                      value={config.showWhenValue || ""}
                      onChange={(e) => {
                        onUpdate({
                          ...config,
                          dependOnOptionId: selectedOption?.id || "",
                          showWhenValue: e.target.value,
                        });
                      }}
                    >
                      <option value="">Please select an option value...</option>
                      {selectedOption?.values?.map((val) => (
                        <option key={val.id} value={val.label}>
                          {val.label}
                        </option>
                      ))}
                    </select>
                  </>
                );
              })()}
            </InlineStack>

            {(() => {
              const dependOnOption = config.dependOnOptionId
                ? radioOptions.find((opt) => opt.id === config.dependOnOptionId)
                : radioOptions[0];

              return (
                dependOnOption?.values?.length === 0 && (
                  <Text tone="critical" as="p">
                    The selected radio button has no option values, please add
                    option values first
                  </Text>
                )
              );
            })()}

            {radioOptions.length > 1 && (
              <InlineStack gap="200">
                <Button
                  onClick={() => {
                    const currentIndex = config.dependOnOptionId
                      ? radioOptions.findIndex(
                          (opt) => opt.id === config.dependOnOptionId,
                        )
                      : 0;

                    const nextIndex = (currentIndex + 1) % radioOptions.length;
                    const nextOption = radioOptions[nextIndex];

                    onUpdate({
                      ...config,
                      dependOnOptionId: nextOption.id || "",
                      showWhenValue: nextOption.values?.[0]?.label || "",
                    });
                  }}
                >
                  Switch to the next radio button
                </Button>
              </InlineStack>
            )}
          </>
        ) : (
          <Text tone="critical" as="p">
            There are no other radio buttons in the current option set, please
            add a radio button first
          </Text>
        )}
      </BlockStack>
    </BlockStack>
  );
}

// ==================== 主组件 ====================

export function OptionEditor({
  config,
  onUpdate,
  onRemove,
  allOptions,
  addDropdownValue,
  updateDropdownValue,
  removeDropdownValue,
  handleImageUpload,
}: OptionEditorProps): JSX.Element {
  const radioOptions = allOptions.filter((opt) => opt.type === "radio");

  return (
    <BlockStack gap="400">
      {renderHeader(config, onRemove)}
      {renderBasicConfig(config, onUpdate)}
      {renderTextNumberPriceConfig(config, onUpdate)}
      {renderDropdownEditor(
        config,
        onUpdate,
        updateDropdownValue,
        removeDropdownValue,
        handleImageUpload,
        addDropdownValue,
      )}
      {renderRadioEditor(
        config,
        onUpdate,
        updateDropdownValue,
        removeDropdownValue,
        handleImageUpload,
        addDropdownValue,
      )}
      {renderConditionalDisplay(config, onUpdate, radioOptions)}
    </BlockStack>
  );
}
