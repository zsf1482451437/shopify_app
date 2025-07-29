import { useState, useCallback, useEffect } from "react";
import {
  Modal,
  BlockStack,
  Button,
  Text,
  Banner,
  Card,
  DataTable,
} from "@shopify/polaris";
import * as XLSX from "xlsx";
import iconv from "iconv-lite";

interface ExcelOption {
  name: string;
  type: string;
  required: boolean;
  values: string;
  price: number | null;
}

interface ExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (formData: FormData) => void;
}

type ExcelImportResult = {
  allSuccess?: boolean;
  results?: { name: string; success: boolean; error?: string }[];
  error?: string;
};

export function ExcelImportModal({
  open,
  onClose,
  onImport,
  importResult, // 新增
}: ExcelImportModalProps & { importResult?: ExcelImportResult }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ExcelOption[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [, setImportProgress] = useState({
    total: 0,
    success: 0,
    fail: 0,
  });

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) return;

      // 验证文件类型
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "application/vnd.ms-excel", // .xls
        "text/csv", // .csv
      ];

      if (!validTypes.includes(selectedFile.type)) {
        setError(
          "Please select a valid Excel file (.xlsx, .xls) or CSV file (.csv)",
        );
        return;
      }

      setFile(selectedFile);
      setError("");
      parseExcelFile(selectedFile);
    },
    [],
  );

  // 字段声明配置
  const excelConfig: Record<
    string,
    {
      col: string;
      required?: boolean;
      transform?: (v: string) => string | number | boolean;
    }
  > = {
    setId: { col: "Option_set_id", required: true },
    setName: { col: "Option_set_name" },
    status: {
      col: "Status",
      transform: (v: string) => v === "Enable",
    },
    applyToAll: {
      col: "Apply_to_products",
      transform: (v: string) => v !== "Product Tags",
    },
    productTags: { col: "Product_tag" },
    optionId: { col: "Option_id", required: true },
    optionName: { col: "Option_name (Label_on_product)" },
    required: {
      col: "Required",
      transform: (v: string) => v === "YES" || v === "是" || v === "true",
    },
    type: {
      col: "Option_type",
      transform: (v: string) => {
        const map: Record<string, string> = {
          "Radio Button": "radio",
          "Text Field": "text",
          "Number Field": "number",
          "Dropdown Menu": "dropdown",
          "Dropdown Menu With Thumbnail": "dropdown_thumbnail",
        };
        return map[v] || v;
      },
    },
    price: {
      col: "Option_price",
      transform: (v: string) => Number(v) || 0,
    },
    // dropdownDefault: { col: "Dropdown_Default_option_text" },
    value: { col: "Option_value" },
    image: { col: "Swatch_value" }, // 新增
  };

  const parseExcelFile = useCallback(async (file: File) => {
    try {
      setLoading(true);
      const arrayBuffer = await file.arrayBuffer();

      // 尝试用utf-8解码，如果失败则用gbk
      let text = "";
      try {
        text = new TextDecoder("utf-8").decode(arrayBuffer);
      } catch {
        // 用 iconv-lite 解码为 gbk
        text = iconv.decode(Buffer.from(arrayBuffer), "gbk");
      }

      // 用 xlsx 解析
      const workbook = XLSX.read(text, { type: "string" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        setError(
          "Excel file must contain at least one header row and one data row",
        );
        return;
      }

      // 获取标题行
      const headers = jsonData[0] as string[];

      // 校验必需字段
      const missing = Object.values(excelConfig)
        .filter((c: any) => c.required && !headers.includes(c.col))
        .map((c: any) => c.col);
      if (missing.length > 0) {
        setError(`Missing required columns: ${missing.join(", ")}`);
        return;
      }

      // 分组聚合
      const setMap: Record<string, any> = {};

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row.length === 0) continue;

        // 声明式提取
        const get = (key: keyof typeof excelConfig) => {
          const conf = excelConfig[key];
          if (!conf) return undefined;
          const idx = headers.indexOf(conf.col);
          let val = idx >= 0 ? row[idx] : undefined;
          if (conf.transform) val = conf.transform(val);
          return val;
        };

        const setId = get("setId");
        if (!setId) continue;

        if (!setMap[setId]) {
          setMap[setId] = {
            id: setId,
            name: get("setName"),
            active: get("status"),
            applyToAll: get("applyToAll"),
            productTags: get("productTags") || null,
            options: [],
          };
        }

        const optionId = get("optionId");
        if (!optionId) continue;

        let option = setMap[setId].options.find((o: any) => o.id === optionId);
        if (!option) {
          option = {
            id: optionId,
            name: get("optionName"),
            required: get("required"),
            type: get("type"),
            // 对于dropdown类型，使用统一价格；对于dropdown_thumbnail类型，不设置统一价格
            price: get("type") === "dropdown" ? get("price") : undefined,
            values: [],
          };
          setMap[setId].options.push(option);
        }

        const value = get("value");
        const image = get("image");
        const itemPrice = get("price"); // 获取每行的价格

        if (value && value.trim()) {
          // 判断类型为 dropdown 或 dropdown_thumbnail 时，带上 swatch
          if (
            option.type === "dropdown" ||
            option.type === "dropdown_thumbnail"
          ) {
            if (
              !option.values.find(
                (v: any) =>
                  v.label === value.trim() && v.image === (image || ""),
              )
            ) {
              // 根据类型创建不同的选项值结构
              const newValue: any = {
                id: `${optionId}-${option.values.length + 1}`,
                label: value.trim(),
                image: image || "",
              };

              // 如果是 dropdown_thumbnail 类型，为每个选项值添加价格
              if (option.type === "dropdown_thumbnail") {
                newValue.price = itemPrice || 0;
              }

              option.values.push(newValue);
            } else {
              // 如果选项值已存在，但是 dropdown_thumbnail 类型需要更新价格
              if (option.type === "dropdown_thumbnail") {
                const existingValue = option.values.find(
                  (v: any) =>
                    v.label === value.trim() && v.image === (image || ""),
                );
                if (existingValue && itemPrice !== undefined) {
                  existingValue.price = itemPrice || 0;
                }
              }
            }
          } else {
            // 其他类型（radio等）不需要图片和价格
            if (!option.values.find((v: any) => v.label === value.trim())) {
              option.values.push({
                id: `${optionId}-${option.values.length + 1}`,
                label: value.trim(),
              });
            }
          }
        }
      }

      // 组装最终结构
      const result = Object.values(setMap).map((set: any) => ({
        ...set,
        options: set.options.map((opt: any) => ({
          ...opt,
          values: JSON.stringify(opt.values),
        })),
      }));

      // 声明式聚合后 - 修改这里的逻辑
      result.forEach((set: any) => {
        const radio = set.options.find(
          (opt: any) =>
            opt.type === "radio" && JSON.parse(opt.values).length === 2,
        );
        if (radio) {
          const radioValues = JSON.parse(radio.values);
          const firstLabel = radioValues[0]?.label;
          const secondLabel = radioValues[1]?.label;

          set.options.forEach((opt: any) => {
            // dropdown_thumbnail 类型不参与自动关联单选按钮
            if (opt.type === "dropdown_thumbnail") {
              // 只设置 productOptionSetId，不设置依赖关系
              opt.productOptionSetId = set.id;
            } else {
              // 其他类型的原有逻辑
              if (opt.type === "dropdown") {
                opt.showWhenValue = firstLabel;
              }
              if (opt.type === "text" || opt.type === "number") {
                opt.showWhenValue = secondLabel;
              }
              opt.dependOnOptionId = radio.id;
              opt.productOptionSetId = set.id;
            }
          });
        } else {
          // 没有Radio Button时也要加productOptionSetId
          set.options.forEach((opt: any) => {
            opt.productOptionSetId = set.id;
          });
        }
      });

      setPreviewData(result);
      console.log("Parsed optionSets:", result);
    } catch (err) {
      console.error("Failed to parse Excel file:", err);
      setError("Failed to parse Excel file, please check the file format");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = useCallback(() => {
    if (previewData.length === 0) {
      setError("No valid data to import");
      return;
    }
    setImporting(true);
    const formData = new FormData();
    formData.append("optionSets", JSON.stringify(previewData));
    onImport(formData);
  }, [previewData, onImport]);

  useEffect(() => {
    if (importResult) {
      setImporting(false);
      if (importResult.results) {
        const success = importResult.results.filter((r) => r.success).length;
        const fail = importResult.results.length - success;
        setImportProgress({
          total: importResult.results.length,
          success,
          fail,
        });
      }
      // 全部成功时，父组件会关闭弹窗
    }
  }, [importResult]);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setImporting(false);
      // 其他需要重置的状态
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setFile(null);
    setPreviewData([]);
    setError("");
    onClose();
  }, [onClose]);

  // 失败条数和详情
  const failed = importResult?.results?.filter((r) => !r.success) || [];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Excel Import Configuration Options"
      primaryAction={{
        content: "Import",
        onAction: handleImport,
        disabled: previewData.length === 0,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: handleClose,
        },
      ]}
      size="large"
    >
      <Modal.Section>
        <BlockStack>
          {importing && <Banner tone="info">Importing... Please wait.</Banner>}
          {/* 导入完成后显示结果 */}
          {!importing && importResult?.results && (
            <Banner tone={importResult.allSuccess ? "success" : "warning"}>
              {importResult.allSuccess
                ? `All ${importResult.results.length} records imported successfully!`
                : `Imported: ${importResult.results.filter((r) => r.success).length} success, ${importResult.results.filter((r) => !r.success).length} failed`}
            </Banner>
          )}
          {error && (
            <Banner tone="critical">
              <Text as="p">{error}</Text>
            </Banner>
          )}

          {/* 失败信息 */}
          {failed.length > 0 && (
            <Banner tone="critical" title={`${failed.length} import failed`}>
              <ul>
                {failed.map((f, idx) => (
                  <li key={idx}>
                    {f.name}：{f.error}
                  </li>
                ))}
              </ul>
            </Banner>
          )}

          <div style={{ marginTop: "16px" }}>
            <Card>
              <BlockStack>
                <Text variant="headingMd" as="h3">
                  Step 1: Select Excel File
                </Text>

                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  id="excel-file-input"
                />

                <Button
                  onClick={() =>
                    document.getElementById("excel-file-input")?.click()
                  }
                  disabled={loading}
                >
                  {loading ? "Parsing..." : "Select Excel File"}
                </Button>

                {file && (
                  <Text variant="bodyMd" as="p">
                    Selected file: {file.name}
                  </Text>
                )}
              </BlockStack>
            </Card>
          </div>

          {previewData.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <Card>
                {/* 新增：显示条数 */}
                <Text variant="bodyMd" as="p" tone="subdued">
                  Total {previewData.length} records
                </Text>
                <DataTable
                  columnContentTypes={[
                    "text", // 名称
                    "text", // 状态
                    "text", // 商品标签
                    "text", // 控件类型
                  ]}
                  headings={["Name", "Status", "Product Tags", "Control Type"]}
                  rows={previewData.map((set: any) => [
                    set.name,
                    set.active ? "Enabled" : "Disabled",
                    set.productTags || "-",
                    set.options.map((opt: any) => opt.type).join(", "),
                  ])}
                />
              </Card>
            </div>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
