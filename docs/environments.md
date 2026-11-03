# 运行环境说明

本项目只有两套运行环境。**任何文档、注释、对话、提交信息都按本文的称呼来写**，不要用「生产环境」「线上」「本地环境」这类含糊说法——它们在本项目里指代不明，已经造成过误判。

| 正式名称 | 代号 | 地址 | 定位 |
| --- | --- | --- | --- |
| **生产测试环境** | `staging` | `http://186.241.72.161:3000` | 部署在 VPS 上、供真实验证的测试站 |
| **开发测试环境** | `dev-preview` | `http://localhost:3000` | 本机跑前端、后端仍在远端 |

---

## 一、生产测试环境（staging）

**用途**：验证即将上线的功能。可以对外访问，也会读写真实数据库，但**它不是正式生产站点**，出问题不影响对外业务。

| 项 | 值 |
| --- | --- |
| 访问地址 | `http://186.241.72.161:3000` |
| 宿主机目录 | `/root/new-api-lite-deploy` |
| 容器名 | `new-api` |
| 镜像 | `ghcr.io/le-112k/new-api-lite:latest` |
| 编排 | Docker Compose（`docker-compose.yml`，服务名 `new-api`） |
| 数据库 | 容器 `postgres`，库 `new-api`，用户 `root` |
| 缓存 | 容器 `redis` |
| 更新方式 | `docker compose pull && docker compose up -d` |

前端与后端打包在同一个镜像里，**不存在只更新其中一半的情况**。

## 二、开发测试环境（dev-preview）

**用途**：改前端时看效果。前端跑在本机，支持热更新；**后端不在本机运行**，所有 `/api` 请求都转发到远端。

请求链路：

```
浏览器 → localhost:3000（rsbuild dev server）
       → localhost:3199（本地代理 deliverables/settings-audit/mock-api.cjs）
       → 上游（默认 = 生产测试环境 186.241.72.161:3000）
```

| 项 | 值 |
| --- | --- |
| 访问地址 | `http://localhost:3000` |
| 前端 | `cd web && ./node_modules/.bin/rsbuild dev` |
| 代理 | `node deliverables/settings-audit/mock-api.cjs`（端口 3199） |
| 上游 | 环境变量 `MOCK_UPSTREAM`，默认 `http://186.241.72.161:3000` |
| 备用上游 | `http://186.241.72.161:3999`（容器 `new-api-preview`，独立 `docker run`，非 Compose 托管） |

`MOCK_UPSTREAM` 指向谁，本机看到的就是谁的代码。**默认指向生产测试环境**，所以本地预览看到的后端行为等于生产测试环境当前部署的版本。

## 三、术语约定（强制）

| 场景 | 应该写 | 不要写 |
| --- | --- | --- |
| 指 `186.241.72.161:3000` | 生产测试环境 | 生产环境、线上、正式环境 |
| 指 `localhost:3000` | 开发测试环境 | 本地环境、本地预览（可作补充说明，但不能单独使用） |
| 指两个都适用 | 明确写出两套名称 | 「环境」 |

代码注释里提到环境时，首次出现必须带全名和地址，例如：

```go
// 生产测试环境（http://186.241.72.161:3000）与开发测试环境（localhost:3000）
// 共用同一个数据库，这里改的数据两边都会变。
```

> 例外：上游文档（如 `docs/authentication.md`）里的「生产环境」指使用者自行部署的正式实例，与本项目的两套测试环境无关。涉及本项目的这两套环境时，仍按上表称呼。

## 四、如何判断部署版本

```bash
# 生产测试环境跑的是哪一版
curl -s http://186.241.72.161:3000/api/option/model_pricing/preview -X POST -o /dev/null -w '%{http_code}\n'
```

| 返回 | 含义 |
| --- | --- |
| `404` | 该路由已被删除 → 跑的是含「按次计费改造」的新版 |
| `401` | 路由仍在、只是要鉴权 → 跑的是旧版 |

> 不要用 `:3999` 判断版本。那个容器专门用来跑 latest，它的版本不代表生产测试环境。

## 五、部署与回滚（生产测试环境）

```bash
ssh vps
cd /root/new-api-lite-deploy

# 1. 记录当前镜像并打回滚标签
docker tag "$(docker inspect -f '{{.Image}}' new-api)" \
  ghcr.io/le-112k/new-api-lite:rollback-$(date +%Y%m%d)

# 2. 备份数据库
docker exec postgres pg_dump -U root -d new-api | gzip > /root/new-api-db-$(date +%Y%m%d-%H%M%S).sql.gz

# 3. 更新
docker compose pull && docker compose up -d
```

回滚：把 `rollback-日期` 重新打回 `latest`，再 `docker compose up -d`。

## 六、常见混淆

1. **本地报 `Invalid URL (GET /api/xxx)`** —— 上游镜像旧，缺这条路由。先确认 `MOCK_UPSTREAM` 指向哪里，再查该环境是否已部署新镜像。
2. **本地改了前端代码，接口行为没变** —— 前端在本地，后端在远端。接口变化必须部署到生产测试环境才生效。
3. **两套环境共用同一个数据库** —— 在生产测试环境改套餐、价格、渠道，开发测试环境立刻能看到同样的数据。反过来也一样，不要在本地预览里做「只是试试」的写操作。
4. **`localhost:3000` 与 `186.241.72.161:3000` 端口号相同** —— 前者是本机 rsbuild，后者是 VPS 容器，不要因为端口一样就当成同一套。
