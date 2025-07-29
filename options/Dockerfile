FROM node:18-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV SHOPIFY_API_KEY="84179925f56dcd207ff9ff58b4265d41"
ENV SHOPIFY_API_SECRET="17c79f40f2c9755693e07bc7ff53b682"
ENV SHOPIFY_APP_URL="https://shopify.dyjerseys.com/"
ENV SCOPES="write_products write_cart_transforms read_customers read_orders write_orders"

# 创建专门的SQLite数据目录并设置权限
RUN mkdir -p /app/data && chown -R node:node /app/data
# 配置SQLite数据库路径
ENV DATABASE_URL="file:/app/data/prod.sqlite"

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force
# Remove CLI packages since we don't need them in production by default.
RUN npm remove @shopify/cli

COPY . .

# 确保node用户拥有所有应用文件的权限
RUN chown -R node:node /app

# 使用非root用户运行应用
USER node

# 确保prisma目录权限正确
RUN npx prisma generate

RUN npm run build

# 添加卷声明，确保数据持久化
VOLUME ["/app/data"]

# 修改健康检查，使用根路径代替/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

# 修改启动命令，确保每次启动都执行迁移
CMD npx prisma migrate deploy && npm run start
