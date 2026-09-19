# MindWeave · 织脑

**编织我的第二大脑与 AI 智能体网络。**

MindWeave 是基于 Spring Boot 3 + React 18 + Semi Design 的个人综合系统，连接知识、计划、凭证、财务数据与 AI 智能体。数据存储于 Oracle（`TRMUSR` 库，历史工资模块继续使用 `SLR_` 前缀表以保持兼容）。

## 功能

- 公开知识花园（`/blog`）：站点默认入口，深色"菌丝体"视觉，首屏为随指针转动、可聚焦群落的 3D 知识网络，支持群落筛选、标题/摘要/标签搜索、按新鲜度展示的卡片流与文章阅读页（自动生成目录）
- 公开互动（`/community` 会客厅 · `/guestbook` 留言板）：两个独立板块。会客厅是**SSE 实时推送**的多房间聊天（在线成员列表、输入中提示、气泡对话流），游客免登录或登录后即可发言，**发布即公开、无需审核**，管理员可在后台删除；留言板与文章评论仍需先审后发。文章可逐篇开启评论
- 登录认证：管理员（ADMIN）/ 数据维护（MANAGER）/ 只读（VIEWER）三种角色
- 仪表盘：支持时间区间选择，区间实发合计、区间总薪资合计、区间记录月数、区间批注总数与全部图表随区间联动
- 工资记录：按月/年/考核等级/批注关键词/实发区间查询，组合列展示（加项合计默认展开，扣项合计、公司合计、另发奖金默认收起且带不同浅色底色，可一键展开/收起），另发奖金=其他奖金+年度实发，表格列顺序为 实发金额 → 另发奖金 → 总薪资，金额列支持点击表头排序（后端排序），操作列图标按钮组，新增记录可一键复制历史月份数据，月度详情卡片式展示（字段对齐、分区底色），分页默认每页 50 条，可选 20/50/100/500；筛选区域 PC 端固定置顶
- 悬浮批注：鼠标移到带 `·` 标记的数据单元格即可查看该字段批注（表格与详情页均支持）
- 年度奖金管理：年度奖金金额自动以"税前年终奖：金额"批注形式挂在"年度实发"字段上（有值则生成/更新，无值则清空），列表与详情不再单独展示"其他奖金/年度奖金"字段
- 响应式界面：PC 端表格视图，移动端卡片式列表 + 抽屉菜单，自动适配
- 批注管理：批注检索（关键词/年份/字段）、新增、编辑、删除，批注随记录导出
- 数据导入：上传 Excel（`工资` sheet），解析公式缓存值与全部批注，支持增量 / 替换两种模式，含批次历史
- 统计分析：年度汇总表（含同比）、月度实发趋势、收入构成、公司缴纳趋势
- 导出：查询结果一键导出带样式的 Excel（合并标题、分区表头底色、数据行分区浅色底、千分位数字格式、冻结表头），包含"工资明细"和"批注汇总"两个 sheet；批注以 Excel 单元格批注（右上角红角标）还原到对应数据单元格，鼠标悬停即可查看
- 用户管理：创建用户、分配角色、启用/禁用、重置密码
- 操作日志：登录、导入、增删改、导出等全程留痕
- 人生 RPG：把已完成待办、知识文章、保险箱整理和每日习惯转化为经验值，包含等级称号、四系技能树、连续打卡与成就徽章，Web 与微信小程序共用进度

## 快速启动（单端口模式）

1. 双击运行 `start-backend.bat`（后端 + 前端页面一体化，仅需 Java 17）
2. 浏览器访问 **http://localhost:8080**
3. 默认落地页是公开知识花园 **/blog**（无需登录）；进入管理后台点右上角"进入工作台"，或直接访问 http://localhost:8080/login
4. 登录：`admin / admin123`（登录后请在右上角"修改密码"）

路由约定：

| 路径 | 说明 |
| --- | --- |
| `/` | 自动跳转到 `/blog` |
| `/blog`、`/blog/:id` | 公开知识花园：菌丝体首屏、群落筛选、搜索、文章阅读页（无需登录） |
| `/community` | 公开会客厅：多房间即时聊天（游客可免登录发言，发布即公开，管理员可在后台删除） |
| `/guestbook` | 公开留言板：与会客厅独立的板块（游客可免登录留言，审核后显示） |
| `/login` | 管理后台登录 |
| `/home` | 登录后的管理后台首页，其余后台页面均在登录态下访问 |

> 知识花园使用一套独立的深色"菌床"配色，与后台的浅紫主题互不影响；标题使用衬线体，
> 在中文环境或有网络时加载 Noto Serif SC，不可用时回退到系统衬线字体。

## 会客厅的实时方案

会客厅不是轮询，而是一条 SSE 长连接（`/api/community/public/rooms/{id}/stream`）：
新消息、在线成员列表、正在输入提示都由服务端推送。消息**先同步写入 Oracle 再广播**，
所以"看到的消息一定已经落库"，不会出现推送成功但数据丢失。

| 能力 | 说明 |
| --- | --- |
| 消息推送 | 发言后房间内所有人立即收到，无需刷新 |
| 在线列表 | 谁在这个房间、谁是成员/游客；正常关闭页面即时下线，异常断线由心跳兜底 |
| 输入中提示 | 客户端按键触发，服务端按 3 秒限流，避免每次按键都推送 |
| 连接状态 | 页面显示 连接中/已连接/重连中/轮询模式 |
| 降级 | 推送不可用时前端自动退回 6 秒轮询；`community.realtime.enabled=false` 可整体关闭 |

参数都在 `application.yml` 的 `community.realtime` 下：心跳 15 秒、在线超时 45 秒、
淘汰间隔 10 秒、单连接最长 30 分钟。**如果前面挂了反向代理，必须为这条路径关闭
proxy_buffering**，否则推送会被网关缓冲住（见 `deploy/openresty-mind-weave.conf` 中的专用 location）。

在线状态支持 `memory` 与 `redis` 两种存储。开发环境默认使用内存；生产配置默认连接
`172.19.0.5:6379` 的 Redis，并使用 `mindweave:community:presence` 独立 key 前缀。
浏览器先通过普通 HTTP 请求登记身份（该请求可以携带登录 JWT），随后再建立 EventSource，
因此不会把 JWT 放入 URL，也不会让登录用户被误判成匿名游客。

### 关于 Kafka：为什么没有直接用它当主链路

Kafka 是"后端到后端"的传输层，浏览器和小程序都说不了 Kafka 协议，所以**到达客户端这一段
仍然必须是 SSE 或 WebSocket**——换成 Kafka 并不能替代它。当前这套方案里，广播被抽象成
`RealtimeBroadcaster` 接口（默认实现 `InMemorySseBroadcaster`），将来要让 AI 智能体、
小程序或其它实例订阅会客厅消息时，按这个接口再写一个 Kafka 实现即可：消息照旧同步落库并
推给在线客户端，同时额外发一份事件到 topic，不牺牲可靠性。接入步骤：

1. `pom.xml` 加 `spring-boot-starter-kafka`；
2. 在 `community/realtime/` 下新增 `KafkaRealtimeBroadcaster implements RealtimeBroadcaster`，
   标注 `@ConditionalOnProperty(name = "community.realtime.transport", havingValue = "kafka")`；
3. 给内存实现加 `havingValue = "memory", matchIfMissing = true`，用配置切换；
4. topic 名称沿用 `community.realtime.kafka-topic`（默认 `mindweave.community.room`）。

> 单节点 Kafka 记得把 `offsets.topic.replication.factor` 设为 1，否则消费者起不来；
> 另外 broker 的 `advertised.listeners` 必须是**调用方能访问到的地址**，
> 只在内网暴露时，部署在服务器上的后端可以连，本机开发连不上。

当前单应用实例不启用 Kafka 客户端：Oracle 是消息事实来源，Redis 负责在线状态，SSE 负责
推送。扩容到多个 MindWeave 实例后，再启用 Kafka 做跨实例房间事件扇出。

停止服务：双击 `stop-backend.bat`。

## 生产部署（OnePanel + OpenResty）

生产环境配置与完整部署步骤见 [deploy/部署指南-OnePanel.md](deploy/部署指南-OnePanel.md)：

- 域名 `wei6130.top`，对外访问 **https://wei6130.top:8445**（服务器不放行 80/443，使用自定义 HTTPS 端口）
- 上传目录 `/vol1/1000/dev`（mind-weave-backend / mind-weave-frontend / logs）
- 全部通过 OnePanel 网页面板操作（文件管理、进程守护、网站、证书、防火墙），OpenResty 托管前端静态文件，`/api` 反向代理到本机后端 8080
- 证书使用 DNS 验证申请（不依赖 80 端口），JWT 密钥与数据库密码生产环境必改

## 开发模式（前端热更新）

1. 先运行 `start-backend.bat`
2. 再运行 `start-frontend-dev.bat`，访问 http://localhost:5173（已配置 `/api` 代理到 8080）

## 目录结构

```
salary_system/
├── mind-weave-backend/         # Spring Boot 后端
│   ├── src/main/java/com/salary/   # 实体/服务/控制器/安全配置
│   ├── src/main/resources/         # application.yml + 前端静态资源
│   └── target/mind-weave-backend-1.0.0.jar
├── mind-weave-frontend/        # React 18 + Vite + Semi Design 前端
│   ├── src/pages/                  # 知识花园（公开）/ 登录 / 仪表盘 / 记录 / 批注 / 导入 / 统计 / 待办 / 用户 / 日志 / 保险箱 / 文章
│   ├── src/components/             # 含 MyceliumCanvas（首屏 3D 知识网络，Canvas 手写透视投影）
│   ├── src/mycelium.css            # 公开知识花园的独立深色主题
│   └── src/knowledge.css           # 阅读器 / 文章库 / 编辑器共享样式
├── db/                         # 数据库工具
│   ├── schema.sql                  # Oracle DDL（SLR_ 表）
│   ├── InitSchema.java             # 执行建表
│   ├── ImportExcel.java            # 命令行导入 Excel（支持 replace 重导）
│   ├── VerifyImport.java           # 导入校验
│   └── ConnTest.java               # 连通性测试
├── 设计需求-工资管理系统.md
├── mind-weave-miniprogram/     # 微信小程序（原生，复用生产 API）
└── start-backend.bat / start-frontend-dev.bat / stop-backend.bat
```

## 微信小程序

- 代码位于 `mind-weave-miniprogram/`，与 Web 端共用生产接口 `https://wei6130.top:8445/api`；
- 使用账号密码登录，无需改动后端即可运行；
- 部署前需在微信公众平台配置 request 合法域名 `https://wei6130.top:8445`（域名需 ICP 备案）；
- 详细说明见 `小程序开发部署说明.md`。

## 数据库说明

- 本地开发连接：`jdbc:oracle:thin:@wei6130.top:1521/TRMUSR`（用户 trmusr）
- 生产环境（Oracle 在同一台服务器的 1panel-network 网络，容器 IP 172.19.0.6）：`jdbc:oracle:thin:@172.19.0.6:1521/TRMUSR`
- 工资系统对象统一使用 `SLR_` 前缀，与库内既有业务表隔离：
  - `SLR_SALARY_RECORD` 工资月度记录（45 条历史数据已导入）
  - `SLR_SALARY_COMMENT` 批注（62 条已导入）
  - `SLR_IMPORT_BATCH` 导入批次
  - `SLR_OPERATION_LOG` 操作日志
- `SLR_APP_USER` 用户

公开互动模块使用 `TK_CHAT_ROOM`、`TK_CHAT_MESSAGE`、`TK_GUESTBOOK_ENTRY`、`TK_ARTICLE_COMMENT`，并为 `TK_ARTICLE` 增加 `COMMENT_ENABLED`。已有数据库升级时执行 `db/community-upgrade.sql`；新库直接执行最新版 `db/toolkit-schema.sql`。

## 重新导入 Excel

### 页面方式

登录后进入"数据导入"页，上传 `工资明细表.xlsx`，先"解析预览"再"确认导入"（增量或替换模式）。

### 命令行方式

```bat
cd db
java --class-path "<ojdbc与poi依赖jar>" ImportExcel.java "D:\java_project\salary_system\工资明细表.xlsx" replace
```

## 常见问题

- **忘记密码**：请管理员在"用户管理"中重置；默认重置为 `123456`。
- **端口被占用**：修改 `mind-weave-backend/src/main/resources/application.yml` 的 `server.port` 后重新打包。
- **导入报"月份已存在"**：选择"替换导入"模式，或先删除对应记录。
- **数据库连接**：连接信息在 `mind-weave-backend/src/main/resources/application.yml`，部署到生产环境请改为配置文件/环境变量并加密。
