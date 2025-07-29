#!/bin/bash

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
IMAGE="images.taotens.com/shopify/tt-options:$TIMESTAMP"

echo "🐳 Building: $IMAGE"
docker build -t "$IMAGE" -t "images.taotens.com/shopify/tt-options:latest" .

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "请选择接下来的操作："
    echo "1) 推送到远程仓库"
    echo "2) 保存为压缩包"
    echo "3) 跳过"
    read -p "请输入选择 (1/2/3): " choice

    case $choice in
        1)
            echo "📤 Pushing to remote repository..."
            docker push "$IMAGE"
            docker push "images.taotens.com/shopify/tt-options:latest"

            if [ $? -eq 0 ]; then
                echo "✅ Push successful!"
            else
                echo "❌ Push failed!"
                exit 1
            fi
            ;;
        2)
            echo "💾 Saving image as compressed archive..."
            docker save "$IMAGE" | gzip > "tt-options-${TIMESTAMP}.tar.gz"

            if [ $? -eq 0 ]; then
                echo "✅ Save successful!"
                echo "🎉 Image saved as: tt-options-${TIMESTAMP}.tar.gz"
                # 显示文件大小
                file_size=$(du -h "tt-options-${TIMESTAMP}.tar.gz" | cut -f1)
                echo "📦 File size: $file_size"
            else
                echo "❌ Save failed!"
                exit 1
            fi
            ;;
        3)
            echo "⏭️ Skipping..."
            ;;
        *)
            echo "❌ Invalid choice, skipping..."
            ;;
    esac
else
    echo "❌ Build failed!"
    exit 1
fi
