# Cloudflare KV 云端存储设置指南

## 📋 概述

费曼学习卡现在支持云端存储功能！数据将保存在 Cloudflare KV 中，可以在不同设备间同步。

## 🚀 设置步骤

### 1. 创建 KV 命名空间

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择你的账户
3. 左侧菜单点击 **Workers & Pages**
4. 点击 **KV** 标签页
5. 点击 **Create a namespace** 按钮
6. 命名空间名称输入：`FEYNMAN_DATA`
7. 点击 **Add**
8. 复制创建后显示的 **Namespace ID**（类似 `1234567890abcdef1234567890abcdef`）

### 2. 配置 Pages 项目绑定

#### 方法 A：通过 Dashboard（推荐）

1. 在 Cloudflare Dashboard 中找到你的 Pages 项目（`academic-blog` 或实际项目名）
2. 进入 **Settings** → **Functions**
3. 滚动到 **KV namespace bindings** 部分
4. 点击 **Add binding**
5. 填写：
   - **Variable name**: `FEYNMAN_DATA`
   - **KV namespace**: 选择刚创建的 `FEYNMAN_DATA` 命名空间
6. 点击 **Save**

#### 方法 B：更新 wrangler.toml（备选）

如果你在本地使用 wrangler 部署，编辑 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "FEYNMAN_DATA"
id = "YOUR_KV_NAMESPACE_ID"  # 替换为步骤1中复制的 Namespace ID
```

### 3. 重新部署

更改 KV 绑定后，Cloudflare Pages 会自动重新部署。等待部署完成即可。

你也可以手动触发部署：
- 推送任意提交到 GitHub
- 或在 Cloudflare Dashboard 的 Pages 项目中点击 **Create deployment**

### 4. 测试云端同步

1. 访问 https://wangzhongliang.sryze.cc/feynman/
2. 点击右上角的 ⚙️ 设置按钮
3. 输入一个云端密钥（至少6位，建议使用强密码）
4. 点击 **启用云端同步**
5. 创建一些测试数据（学习卡、习惯等）
6. 数据会在2秒后自动同步到云端
7. 在另一台设备或浏览器中，使用相同密钥登录，应该能看到同步的数据

## 🔐 安全说明

- **密钥保护**：你的密钥会通过 SHA-256 哈希后作为 KV 的 key，不会明文存储在云端
- **数据隔离**：每个密钥对应独立的存储空间，不同用户的数据完全隔离
- **本地备份**：数据始终保存在浏览器本地，云端只是备份
- **免费额度**：
  - 每天 10 万次读取
  - 每天 1,000 次写入
  - 对个人使用完全足够

## 🎯 使用场景

- **多设备同步**：在家里电脑和公司电脑之间同步学习进度
- **数据备份**：防止浏览器清除数据导致丢失
- **跨浏览器**：在不同浏览器中使用相同的数据

## ⚠️ 注意事项

1. **密钥管理**：
   - 请妥善保管你的密钥
   - 忘记密钥后无法恢复，需要重新创建
   - 建议使用密码管理器保存

2. **同步时机**：
   - 数据修改后会在 2 秒内自动同步
   - 页面加载时会优先从云端加载数据
   - 可以手动点击"立即同步"强制同步

3. **隐私保护**：
   - 你的数据只有你能访问（通过密钥）
   - Cloudflare 作为基础设施提供商可以访问原始数据
   - 不建议存储极度敏感的信息

## 🐛 故障排除

### 同步失败

1. 检查浏览器控制台是否有错误信息
2. 确认 KV 命名空间已正确绑定到 Pages 项目
3. 检查 API 路由是否正常：
   - 访问 https://wangzhongliang.sryze.cc/api/feynman/save 应该返回 400 错误（正常）
   - 如果返回 404，说明 Functions 没有正确部署

### 数据丢失

1. 云端同步只是备份，本地数据仍然存在
2. 检查浏览器 localStorage：
   - 打开开发者工具 → Application → Local Storage
   - 查找 `feynman-data`、`habit-data` 等 key

### KV 配额超限

免费版 Cloudflare 的 KV 配额：
- 每天 1,000 次写入
- 每天 100,000 次读取

如果超出，可以考虑：
- 升级到 Workers Paid 计划（$5/月）
- 减少同步频率（修改代码中的 `debounce` 时间）

## 📝 API 文档

### POST /api/feynman/save

保存数据到云端。

**请求体**：
```json
{
  "passkey": "your-secret-key",
  "data": {
    "cards": [],
    "habits": [],
    "checks": {},
    "subjects": [],
    "scheduleRows": [],
    "scheduleCells": {}
  }
}
```

**响应**：
```json
{
  "success": true,
  "message": "Data saved successfully",
  "lastSyncAt": "2026-08-28T10:00:00.000Z"
}
```

### POST /api/feynman/load

从云端加载数据。

**请求体**：
```json
{
  "passkey": "your-secret-key"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "cards": [],
    "habits": [],
    "checks": {},
    "subjects": [],
    "scheduleRows": [],
    "scheduleCells": {},
    "lastSyncAt": "2026-08-28T10:00:00.000Z"
  }
}
```

## 🎉 完成

设置完成后，你的费曼学习卡就具备了云端存储能力！
