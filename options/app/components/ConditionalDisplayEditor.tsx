import { BlockStack, InlineStack, Text } from "@shopify/polaris";
import type { Option } from "./OptionEditor";

interface ConditionalDisplayEditorProps {
  config: Option;
  onUpdate: (updated: Option) => void;
  allOptions: Option[];
}

export function ConditionalDisplayEditor({
  config,
  onUpdate,
  allOptions,
}: ConditionalDisplayEditorProps): JSX.Element {
  return (
    <BlockStack gap="400">
      <Text variant="headingMd" as="h3">
        {config.name} ({config.type})
      </Text>

      <BlockStack gap="400">
        <InlineStack align="center">
          <input
            type="checkbox"
            id={`conditional-${config.id || config.type}`}
            checked={!!config.dependOnOptionId}
            onChange={(e) => {
              if (e.target.checked) {
                onUpdate({
                  ...config,
                });
              } else {
                onUpdate({
                  ...config,
                  dependOnOptionId: "",
                  showWhenValue: "",
                });
              }
            }}
          />
          <label htmlFor={`conditional-${config.id || config.type}`}>
            Enable conditional display
          </label>
        </InlineStack>

        {config.dependOnOptionId && (
          <BlockStack gap="300">
            <Text as="p">Display condition: When</Text>

            {/* 选择依赖的单选控件 */}
            <select
              value={config.dependOnOptionId}
              onChange={(e) => {
                onUpdate({
                  ...config,
                });
              }}
            >
              <option value="">Please select a radio button...</option>
              {allOptions
                .filter((opt) => opt.id !== config.id && opt.type === "radio")
                .map((opt) => (
                  <option key={opt.id || opt.name} value={opt.id || opt.name}>
                    {opt.name}
                  </option>
                ))}
            </select>

            {/* 选择期望的选项值 */}
            {config.dependOnOptionId && (
              <BlockStack gap="200">
                <Text as="p">Selected value is:</Text>
                <select
                  value={config.showWhenValue}
                  onChange={(e) => {
                    onUpdate({
                      ...config,
                      showWhenValue: e.target.value,
                    });
                  }}
                >
                  <option value="">Please select an option value...</option>
                  {allOptions
                    .find(
                      (opt) => (opt.id || opt.name) === config.dependOnOptionId,
                    )
                    ?.values?.map((val) => (
                      <option key={val.id} value={val.label}>
                        {val.label}
                      </option>
                    ))}
                </select>
              </BlockStack>
            )}
          </BlockStack>
        )}
      </BlockStack>
    </BlockStack>
  );
}
