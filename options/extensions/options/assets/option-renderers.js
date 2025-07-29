/**
 * 产品自定义选项渲染函数集合
 */

(function () {
  // 包装渲染函数，添加条件显示逻辑
  function wrapWithConditional(html, option, allOptions) {
    if (!option.dependOnOptionId) {
      return html; // 没有条件显示设置，直接返回原始HTML
    }

    const { dependOnOptionId, showWhenValue } = option;

    // 新增：检查是否依赖于自己，如果是则直接返回
    if (option.id === dependOnOptionId) {
      console.warn("Option cannot depend on itself:", option.id);
      return html; // 不能依赖于自己，直接返回原始HTML
    }

    // 查找依赖的单选控件
    const dependOption = allOptions.find(
      (opt) => opt.id === dependOnOptionId && opt.type === "radio",
    );

    if (!dependOption) {
      return html; // 找不到依赖的控件，直接返回原始HTML
    }

    // 添加数据属性，用于客户端条件显示逻辑
    const wrappedHtml = `
      <div class="conditional-option"
           data-depend-on="${dependOnOptionId}"
           data-expected-value="${showWhenValue}"
           style="display: none;">
        ${html}
      </div>
    `;

    return wrappedHtml;
  }

  // 文本选项渲染
  function renderTextOption(option, allOptions) {
    // 添加价格显示
    const priceDisplay = option.price
      ? `<span class="product-option__price">(+${option.price})</span>`
      : "";

    const html = `
      <div class="product-option product-option--text" data-option-id="${option.id}" ${option.price ? `data-price="${option.price}"` : ""}>
        <label class="product-option__label">
          ${option.name} ${priceDisplay} ${option.required ? '<span class="product-option__required">*</span>' : ""}
        </label>
        <input type="text" class="product-option__input"
          name="properties[${option.name}]"
          pattern="[^0-9]*"
          oninput="this.value = this.value.replace(/[0-9]/g, '')"
          placeholder="Please enter any characters except numbers"
          ${option.required ? "required" : ""}>
      </div>
    `;

    const result = option.dependOnOptionId
      ? wrapWithConditional(html, option, allOptions)
      : html;

    return result;
  }

  // 数字输入框选项渲染
  function renderNumberOption(option, allOptions) {
    // 添加价格显示
    const priceDisplay = option.price
      ? `<span class="product-option__price">(+${option.price})</span>`
      : "";

    const uniqueId = "number_" + option.id.replace(/-/g, "_");

    const html = `
      <div class="product-option product-option--number" data-option-id="${option.id}" ${option.price ? `data-price="${option.price}"` : ""}>
        <label class="product-option__label">
          ${option.name} ${priceDisplay} ${option.required ? '<span class="product-option__required">*</span>' : ""}
        </label>
        <input type="number" class="product-option__input"
          id="${uniqueId}"
          name="properties[${option.name}]"
          placeholder="Please enter a number (0-99)"
          min="0"
          max="99"
          ${option.required ? "required" : ""}
          oninput="validateNumberInput(this)"
          onblur="validateNumberInput(this)">
        <div class="number-range-info" style="font-size: 0.75em; color: #666; margin-top: 3px;">
          Range: 0-99
        </div>
      </div>
    `;

    return option.dependOnOptionId
      ? wrapWithConditional(html, option, allOptions)
      : html;
  }

  // 下拉菜单选项渲染
  function renderDropdownOption(option, allOptions) {
    // 解析选项值数据
    const values = option.values ? JSON.parse(option.values) : [];
    const uniqueId = "dropdown_" + option.id.replace(/-/g, "_");

    // 添加价格显示
    const priceDisplay = option.price
      ? `<span class="product-option__price">(+${option.price})</span>`
      : "";

    const html = `
      <div class="product-option product-option--dropdown" data-option-id="${option.id}" ${option.price ? `data-price="${option.price}"` : ""}>
        <label class="product-option__label">
          ${option.name} ${priceDisplay} ${option.required ? '<span class="product-option__required">*</span>' : ""}
        </label>
        <div class="product-option__dropdown-container">
          <select class="product-option__input native-select" id="${uniqueId}"
            name="properties[${option.name}]"
            ${option.required ? "required" : ""} style="display: none;">
            <option value="">Please select...</option>
            ${values.map((value) => `<option value="${value.label}">${value.label}</option>`).join("")}
          </select>

          <div class="custom-select-wrapper">
            <div class="custom-select-trigger">${option.required ? "Please select..." : "Please select..."}</div>
            <div class="custom-options">
              <div class="custom-option" data-value="">Please select...</div>
              ${values
                .map((value) => {
                  if (value.image) {
                    return `<div class="custom-option" data-value="${value.label}">
                    <img src="${value.image}" class="option-image">
                    <span>${value.label}</span>
                  </div>`;
                  } else {
                    return `<div class="custom-option" data-value="${value.label}">
                    <span>${value.label}</span>
                  </div>`;
                  }
                })
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;

    return option.dependOnOptionId
      ? wrapWithConditional(html, option, allOptions)
      : html;
  }

  // 单选按钮选项渲染
  function renderRadioOption(option, allOptions) {
    // 解析选项值数据
    const values = option.values ? JSON.parse(option.values) : [];
    const uniqueId = "radio_" + option.id.replace(/-/g, "_");

    const html = `
      <div class="product-option product-option--radio" data-option-id="${option.id}">
        <label class="product-option__label">
          ${option.name} ${option.required ? '<span class="product-option__required">*</span>' : ""}
        </label>
        <div class="product-option__radio-group">
          ${values
            .map(
              (value, index) => `
            <div class="product-option__radio-item">
              <input type="radio"
                id="${uniqueId}_${index}"
                name="properties[${option.name}]"
                value="${value.label}"
                class="product-option__radio-input"
                data-option-id="${option.id}"
                ${index === 0 && option.required ? "required" : ""}>
              <label for="${uniqueId}_${index}" class="product-option__radio-label">${value.label}</label>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
      <style>
        .product-option__radio-item {
          display: flex;
          align-items: center;
        }
        .product-option__radio-input {
          margin-right: 8px;
        }
      </style>
    `;

    return option.dependOnOptionId
      ? wrapWithConditional(html, option, allOptions)
      : html;
  }

  // 新增：缩略图下拉菜单选项渲染（支持每个选项的价格）
  function renderDropdownThumbnailOption(option, allOptions) {
    // 解析选项值数据
    const values = option.values ? JSON.parse(option.values) : [];
    const uniqueId = "dropdown_thumbnail_" + option.id.replace(/-/g, "_");

    const html = `
      <div class="product-option product-option--dropdown-thumbnail" data-option-id="${option.id}">
        <label class="product-option__label">
          ${option.name} ${option.required ? '<span class="product-option__required">*</span>' : ""}
        </label>
        <div class="product-option__dropdown-container">
          <select class="product-option__input native-select" id="${uniqueId}"
            name="properties[${option.name}]"
            ${option.required ? "required" : ""} style="display: none;">
            <option value="">Please select...</option>
            ${values.map((value) => `<option value="${value.label}" data-price="${value.price || 0}">${value.label}</option>`).join("")}
          </select>

          <div class="custom-select-wrapper thumbnail-select">
            <div class="custom-select-trigger thumbnail-trigger">
              <div class="trigger-content">
                <div class="trigger-image-placeholder">
                  <span class="placeholder-text">Please select...</span>
                </div>
                <div class="trigger-text-container">
                  <span class="trigger-text">Please select...</span>
                  <span class="trigger-price" style="display: none;"></span>
                </div>
              </div>
            </div>
            <div class="custom-options thumbnail-options">
              <div class="custom-option thumbnail-option" data-value="" data-price="0">
                <div class="option-image-container">
                  <div class="no-image-placeholder">No image</div>
                </div>
                <div class="option-text-container">
                  <span class="option-text">Please select...</span>
                </div>
              </div>
              ${values
                .map((value) => {
                  const price = parseFloat(value.price || 0);
                  const priceDisplay =
                    price > 0
                      ? `<span class="option-price">(+$${price.toFixed(2)})</span>`
                      : "";

                  return `<div class="custom-option thumbnail-option" data-value="${value.label}" data-price="${price}">
                    <div class="option-image-container">
                      ${
                        value.image
                          ? `<img src="${value.image}" class="option-image" alt="${value.label}">`
                          : `<div class="no-image-placeholder">No image</div>`
                      }
                    </div>
                    <div class="option-text-container">
                      <span class="option-text">${value.label}</span>
                      ${priceDisplay}
                    </div>
                  </div>`;
                })
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;

    return option.dependOnOptionId
      ? wrapWithConditional(html, option, allOptions)
      : html;
  }

  // 修改样式部分，添加缩略图下拉菜单的样式
  document.addEventListener("DOMContentLoaded", function () {
    const style = document.createElement("style");
    style.textContent = `
      .product-option__price {
        font-size: 0.85em;
        color: #e94560;
        margin-left: 5px;
      }

      /* 缩略图下拉菜单特殊样式 */
      .thumbnail-select .custom-select-trigger {
        min-height: 60px;
        padding: 8px;
      }

      .trigger-content {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
      }

      .trigger-image-placeholder {
        width: 40px;
        height: 40px;
        border: 1px solid #ddd;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #f9f9f9;
        flex-shrink: 0;
      }

      .trigger-image-placeholder img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 3px;
      }

      .placeholder-text {
        font-size: 0.7em;
        color: #999;
        text-align: center;
      }

      .trigger-text-container {
        flex: 1;
        text-align: left;
      }

      .trigger-text {
        display: block;
      }

      .trigger-price {
        font-size: 0.85em;
        color: #e94560;
        font-weight: bold;
      }

      .thumbnail-options {
        min-width: 250px;
      }

      .thumbnail-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 8px;
        min-height: 60px;
      }

      .option-image-container {
        width: 50px;
        height: 50px;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #f9f9f9;
      }

      .option-image-container img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .no-image-placeholder {
        font-size: 0.7em;
        color: #999;
        text-align: center;
        padding: 2px;
      }

      .option-text-container {
        flex: 1;
        text-align: left;
      }

      .option-text {
        display: block;
        word-break: break-word;
      }

      .option-price {
        font-size: 0.8em;
        color: #e94560;
        font-weight: bold;
        display: block;
        margin-top: 2px;
      }

      .thumbnail-option:hover .option-image-container {
        border-color: #007bff;
      }
    `;
    document.head.appendChild(style);
  });

  // 在文件末尾，全局导出之前添加这两个新函数：

  // 修改现有的验证函数
  window.validateNumberInput = function (input) {
    let value = parseInt(input.value);

    // 如果输入为空或不是数字，不处理
    if (input.value === "" || isNaN(value)) {
      return;
    }

    // 自动修正超出范围的值
    if (value > 99) {
      input.value = 99;
      window.showInputMessage(
        input,
        "Auto-corrected to maximum value: 99",
        "warning",
      );
    } else if (value < 0) {
      input.value = 0;
      window.showInputMessage(
        input,
        "Auto-corrected to minimum value: 0",
        "warning",
      );
    }
  };

  // 新增：显示输入提示信息的函数
  window.showInputMessage = function (input, message, type) {
    // 移除已存在的提示
    const existingMessage = input.parentNode.querySelector(".input-message");
    if (existingMessage) {
      existingMessage.remove();
    }

    // 创建新的提示
    const messageEl = document.createElement("div");
    messageEl.className = "input-message";
    messageEl.textContent = message;
    messageEl.style.fontSize = "0.75em";
    messageEl.style.marginTop = "3px";
    messageEl.style.padding = "2px 6px";
    messageEl.style.borderRadius = "3px";

    if (type === "warning") {
      messageEl.style.color = "#f39c12";
      messageEl.style.backgroundColor = "#fef9e7";
      messageEl.style.border = "1px solid #f39c12";
    } else if (type === "error") {
      messageEl.style.color = "#d82c0d";
      messageEl.style.backgroundColor = "#fff8f8";
      messageEl.style.border = "1px solid #d82c0d";
    }

    // 添加到输入框后面
    input.parentNode.appendChild(messageEl);

    // 3秒后自动移除提示
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  };

  // 全局导出渲染函数
  window.OptionRenderers = {
    text: (option, allOptions) => renderTextOption(option, allOptions),
    dropdown: (option, allOptions) => renderDropdownOption(option, allOptions),
    dropdown_thumbnail: (option, allOptions) =>
      renderDropdownThumbnailOption(option, allOptions),
    radio: (option, allOptions) => renderRadioOption(option, allOptions),
    number: (option, allOptions) => renderNumberOption(option, allOptions),
  };
})();
