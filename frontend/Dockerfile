# 前端多阶段构建
FROM node:20-alpine AS builder

WORKDIR /app

# 仅复制依赖清单以利用缓存
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .

# 接受构建期 API base URL
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ===== 运行镜像 =====
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx 配置：把 /api 反代到后端
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]