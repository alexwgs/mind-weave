# MindWeave · 织脑生产部署指南（OnePanel 面板 UI 操作版）

> 域名：**wei6130.top**
> 对外访问地址：**https://wei6130.top:8445**（服务器不放行 80/443，使用自定义 HTTPS 端口 8445）
> 上传目录：**/vol1/1000/dev**（后端、前端、日志都放在这里）
> 本文全部使用 OnePanel 网页面板操作，不需要 SSH 命令行

## 0. 目录规划

在 `/vol1/1000/dev` 下按如下结构存放（后面每步都会在面板里创建/上传）：

```
/vol1/1000/dev/
├── mind-weave-backend/           后端目录
│   ├── mind-weave-backend-1.0.0.jar  后端 jar（本仓库 mind-weave-backend/target 下）
│   └── application-prod.yml      生产配置
├── mind-weave-frontend/          前端目录（网站根目录，上传本仓库 mind-weave-frontend/dist 的内容）
│   └── index.html, assets/...
└── logs/                         日志目录（OpenResty 和后端日志）
```

## 1. 前置准备（面板 + 网页即可完成）

1. **安装 Java 17**：OnePanel → 软件商店（应用商店）→ 搜索 Java/JDK → 安装 **JDK 17**。
2. **数据库可达**：你的 Oracle 就跑在这台服务器的 Docker 容器里（**1panel-network** 网络，IPv4 `172.19.0.6`，端口 1521，服务名 TRMUSR）。后端无论是进程守护还是容器方式运行，都直接连 `172.19.0.6:1521/TRMUSR`，不需要对外放行 1521 端口。
3. **域名解析**：在 **DNSPod 网页控制台**把 `wei6130.top` 的 A 记录指向服务器 IP（纯网页操作）。
4. **准备 DNSPod API 凭据**（面板申请证书用）：DNSPod 控制台 → API Token 页面，记录 **ID** 和 **Token**。

## 1.5 你的后端如果是 Docker / Java 项目方式运行（重要）

如果日志里 jar 路径是 `/app/mind-weave-backend-1.0.0.jar` 且进程 PID 很小（如 PID 7），说明后端跑在 **Docker 容器**里（OnePanel 的 Java 项目/容器功能）。此时请按本节处理，跳过第 4 节的"进程守护"：

**数据库连不上的根因（你当前日志的错误）**

```
Caused by: java.io.IOException: Network is unreachable, socket connect lapse 9 ms.
/240e:36f:15a0:d2d0:aa5e:45ff:fe9c:f394 1521
```

`wei6130.top` 这个域名被解析成了 **IPv6 地址**（240e:...），而容器没有 IPv6 路由，所以连接失败。修复方法：**数据库地址不要用域名，改用 IPv4 地址**。

**在 OnePanel 容器设置里添加环境变量（替换占位符）**

| 环境变量 | 值 |
| --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:oracle:thin:@172.19.0.6:1521/TRMUSR` |
| `SPRING_DATASOURCE_USERNAME` | `<你的数据库用户名>` |
| `SPRING_DATASOURCE_PASSWORD` | `<你的数据库密码>` |
| `SALARY_JWT_SECRET` | 强随机密钥 |
| `SALARY_VAULT_KEY` | 强随机密钥（保险箱凭证加密用，设置后勿再修改，否则旧密码无法解密） |
| `TOOLKIT_UPLOAD_DIR` | 附件目录。容器部署建议用容器内路径 `/app/uploads`，并把宿主机 `/vol1/1000/dev/uploads` 挂载到它 |
| `TZ` | `Asia/Shanghai` |

> ⚠️ **附件目录必须持久化，而且容器内外路径要一致**。
> 附件表里记录的是上传当时的**绝对路径**，所以：
> 1. `TOOLKIT_UPLOAD_DIR` 必须与 `volumes` 里的容器路径完全一致（例如都写 `/app/uploads`）；
> 2. 必须把宿主机目录挂载到该路径（`- /vol1/1000/dev/uploads:/app/uploads`），
>    否则容器每次重建/升级，`/app/uploads` 都是新的空目录，**已上传的图片和附件会全部"文件已丢失"**。
>
> 自检命令（在服务器上执行，能列出图片就说明路径正确）：
>
> ```bash
> docker exec mind-weave ls -l /app/uploads/article
> ```
>
> 如果这里为空，但数据库有附件记录，就是没挂载卷。

数据库地址说明：Oracle 容器固定 IP 是 `172.19.0.6`（1panel-network 子网 172.19.0.0/16）。后端容器/进程需要加入同一个网络才能访问；域名 `wei6130.top` 会解析出 IPv6，容器没有 IPv6 路由会连不上（就是你之前日志里的 `Network is unreachable`），所以生产配置统一用 `172.19.0.6`，不要用域名。

如果容器启动命令可以自定义，建议把 `-Djava.net.preferIPv4Stack=true` 加进 java 启动参数（双保险）。完整的容器编排模板见 `deploy/docker-compose.yml`。

**数据库放行**：Oracle 与本机后端在同一服务器、同一 Docker 网络，不需要额外放行 1521 端口。

## 2. 上传文件（OnePanel 文件管理器）

1. 打开 OnePanel → **文件**（文件管理）
2. 进入 `/vol1/1000/dev`，依次新建目录：`mind-weave-backend`、`mind-weave-frontend`、`logs`
3. 上传：
   - `mind-weave-backend/target/mind-weave-backend-1.0.0.jar` → `/vol1/1000/dev/mind-weave-backend/`
   - `deploy/application-prod.yml` → `/vol1/1000/dev/mind-weave-backend/`
   - 本仓库 `mind-weave-frontend/dist/` **里面的内容**（index.html、assets 文件夹）→ `/vol1/1000/dev/mind-weave-frontend/`

## 3. 修改生产配置（面板文件编辑）

1. 在文件管理器里打开 `/vol1/1000/dev/mind-weave-backend/application-prod.yml`（右键 → 编辑）
2. 确认并修改：
   - `url:` 已填好 `jdbc:oracle:thin:@172.19.0.6:1521/TRMUSR`，**不要改**
   - `password:` 填你自己的生产数据库密码（切勿使用示例值）
   - `secret:` 改为强随机密钥（可让面板生成随机字符串，或用一个长乱码）
   - `allowed-origins:` 保持 `https://wei6130.top:8445` 即可（已填好）
3. 保存。

## 1.6 用面板的「Java 运行环境」部署后端（推荐，无需进程守护）

1Panel 的「网站 → 运行环境」可以把 jar 直接跑成容器（日志里 `/app/mind-weave-backend-1.0.0.jar` 就是这种方式）。步骤如下：

1. 先确认 Java 运行环境已安装：**网站 → 运行环境 → Java**，没有就点「创建运行环境」，应用选 **Java 17**。
2. 上传后端文件到 `/vol1/1000/dev/mind-weave-backend/`（见第 2 节）：`mind-weave-backend-1.0.0.jar` + `application-prod.yml`。
3. 创建/编辑 Java 运行环境，关键配置：

| 配置项 | 值 |
| --- | --- |
| 环境名称 | `mind-weave`（随意） |
| 应用 | Java 17 |
| 项目目录 | `/vol1/1000/dev/mind-weave-backend` |
| 启动命令 | `java -jar mind-weave-backend-1.0.0.jar` |
| 端口映射 | `8080:8080`（宿主 8080 → 容器 8080） |

环境变量（v2 运行环境支持自定义环境变量；若界面没有该项，用第 3 节的 `application-prod.yml` 效果相同）：

| 变量名 | 值 |
| --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:oracle:thin:@172.19.0.6:1521/TRMUSR` |
| `SPRING_DATASOURCE_USERNAME` | `<你的数据库用户名>` |
| `SPRING_DATASOURCE_PASSWORD` | `<你的数据库密码>`（**务必使用强密码**） |
| `SALARY_JWT_SECRET` | 强随机密钥（`openssl rand -base64 48`） |
| `SALARY_VAULT_KEY` | 强随机密钥（保险箱凭证加密用，**设置后不可再改**，否则旧密码无法解密） |
| `TOOLKIT_UPLOAD_DIR` | `/app/uploads`（容器内路径，务必与下面挂载的容器路径一致） |
| `TZ` | `Asia/Shanghai` |

**⚠️ 必须加目录挂载（否则附件会丢）**：Java 运行环境是容器，容器内 `/app/uploads` 是临时目录，
容器一重建图片和附件全部"文件已丢失"。请在运行环境里添加挂载：

| 宿主机目录 | 容器目录 |
| --- | --- |
| `/vol1/1000/dev/uploads` | `/app/uploads` |

> 注意：容器部署时 `application-prod.yml` 里的 `toolkit.upload-dir` 若写成宿主机路径
> `/vol1/1000/dev/uploads`，**容器内并不存在该目录**，上传会失败或写到临时层。
> 容器部署请用环境变量 `TOOLKIT_UPLOAD_DIR=/app/uploads` 覆盖它（环境变量优先级高于 yml）。

说明：
- Java 容器默认就在 **1panel-network** 网络里，直接能连 Oracle 容器的 `172.19.0.6:1521`，不用额外配置；
- 端口映射 `8080:8080` 后，宿主机 `127.0.0.1:8080` 即可访问后端，前端网站配置里的 `/api/` 反代就指向它；
- 启动后看「日志」列，出现 `Started SalaryApplication` 且无 `Network is unreachable` 即成功；
- 如果之前失败的旧容器还占着 8080，先删除/停止它再启动新的。

**附件路径自检**（在服务器执行，能列出图片就说明挂载正确）：

```bash
docker exec mind-weave ls -l /app/uploads/article
# 顺便看容器实际拿到的路径与环境变量
docker inspect mind-weave --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
docker inspect mind-weave --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -i upload
```

> 工具库新功能（保险箱/文章/待办/Bark）上线前，还需要执行 `db/toolkit-schema.sql`
> 创建 `TK_` 前缀的新表（同 TRMUSR 库，数据库工具或 SQL 窗口执行即可）。

> 已经执行过 `toolkit-schema.sql` 的现有环境，上线公开互动功能前只执行一次 `db/community-upgrade.sql`；它会创建聊天室、留言板、文章评论表，并给文章表增加评论开关。新安装环境不要重复执行升级脚本。

## 4. 用面板"进程守护"启动后端

OnePanel → **进程守护**（若无此项，见文末备选）：

1. 点击"添加/新建守护进程"
2. 名称：`mind-weave`
3. 启动命令：

```text
/usr/bin/java -Xms256m -Xmx768m -jar /vol1/1000/dev/mind-weave-backend/mind-weave-backend-1.0.0.jar --spring.profiles.active=prod --spring.config.additional-location=file:/vol1/1000/dev/mind-weave-backend/
```

4. 工作目录：`/vol1/1000/dev/mind-weave-backend`
5. 日志输出：`/vol1/1000/dev/logs/mind-weave-backend.log`（面板一般有日志框，填上即可）
6. 勾选"开机自启"、"异常自动重启"，保存并启动

> 如果 `/usr/bin/java` 不对（面板装的 JDK 在其他位置），在面板"软件商店"里查看已装 JDK 的安装路径，把命令里的 java 路径换成实际路径。

## 5. 验证后端是否启动成功

在**进程守护**页面看到 `mind-weave` 状态为"运行中"，再打开它的日志：

- 日志中出现 `Started SalaryApplication in ...` 和 `HikariPool-1 - Start completed` 即成功
- 如果日志报 `Connection refused` / Oracle 相关错误，说明数据库连不上，回到第 1 步第 2 条排查

## 6. OnePanel 创建网站（OpenResty，端口 8445）

1. OnePanel → **网站** → 创建网站
2. 类型：**静态网站**；运行环境：**OpenResty**
3. 域名：`wei6130.top`
4. 根目录（网站目录）：`/vol1/1000/dev/mind-weave-frontend`
5. 端口：填写 **8445**（创建后可在网站设置里改监听端口为 8445）
6. 创建完成

## 7. 替换站点配置（面板配置编辑器）

1. 网站 → 找到 `wei6130.top` → **设置/配置**
2. 打开站点配置文件（面板一般提供"配置文件"标签或"伪静态"入口）
3. 把内容替换为 `deploy/openresty-mind-weave.conf` 的内容，注意：
   - 证书路径两行先填一个占位路径（第 8 步拿到证书后再改）
   - 其余不用改（root、日志路径、反代端口都已按 `/vol1/1000/dev` 和 8445 配好）
4. 保存并**重载**（面板"重载"按钮）

> 如果前端网站已经建好并且能正常访问（你现在就是这样），**不要整份替换站点配置**，以免破坏已有的 HTTPS 设置。只需要在现有站点配置里确认加上 `/api/` 反代块（`deploy/openresty-mind-weave.conf` 中 `location /api/` 那段，指向 `http://127.0.0.1:8080`）即可，并把 `client_max_body_size 120m;` 一起加上。
>
> ⚠️ **务必检查：删除或改造"按扩展名缓存"的那条规则**。如果站点里存在这样的块：
>
> ```nginx
> location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ { expires 7d; }
> ```
>
> nginx 的**正则 location 优先级高于普通前缀 location**，它会把 `/api/tool/attachments/1/content.png`
> 这类"以图片后缀结尾的接口路径"抢走，请求永远到不了后端 —— 症状就是**文章里的图片全部显示不出来**，
> 而数据库和文件其实都正常。正确做法是用 `^~ /assets/` 前缀匹配前端静态资源目录（见 `openresty-mind-weave.conf`），
> 不要用按扩展名的正则去匹配全站。

## 8. 申请 HTTPS 证书（OnePanel DNS 验证，不需要 80 端口）

1. 网站设置 → **HTTPS/SSL**
2. 选择"申请证书"，验证方式选 **DNS 验证**
3. 面板会给出 TXT 记录（如 `_acme-challenge.wei6130.top` 和值）
4. 打开 **DNSPod 网页控制台** → 域名解析 → 添加 TXT 记录（把面板给的主机记录和值填进去）
5. 回面板点击"验证/完成"，证书签发后会自动安装
6. 回到第 7 步的站点配置，把 `ssl_certificate` / `ssl_certificate_key` 两行改成面板显示的证书实际路径，保存并重载

> 若面板申请证书时支持选择 DNS 服务商并让你填 DNSPod 的 ID/Token，直接填第 1 步准备的那两个值即可，面板会自动添加 TXT 记录。

## 9. 防火墙放行 8445（面板安全设置）

1. OnePanel → **安全/防火墙**
2. 添加放行规则：端口 `8445`，协议 TCP
3. 确认 8080 不需要对外放行（后端只监听本机，保持不放行）

## 10. 访问验证与改密码

1. 浏览器打开 **https://wei6130.top:8445**
2. 用 `admin / admin123` 登录
3. 右上角 → 修改密码，**立即更换默认密码**

## 11. 升级发布（面板操作）

1. **后端**：文件管理器覆盖上传新 jar 到 `/vol1/1000/dev/mind-weave-backend/`，然后在"进程守护"里重启 `mind-weave`
2. **前端**：文件管理器删除 `/vol1/1000/dev/mind-weave-frontend/` 旧文件，上传新 `mind-weave-frontend/dist` 内容
3. 刷新浏览器即可（静态资源带哈希，会自动加载新版）

## 12. 常见问题排查（面板内可看）

- **502 Bad Gateway**：进程守护里 `mind-weave` 没运行，查看它的日志；或确认站点配置里 `proxy_pass http://127.0.0.1:8080;` 与后端端口一致
- **证书告警**：确认证书路径写对、DNS 解析生效；8445 是非标准端口，个别旧设备/旧浏览器可能不认
- **刷新子页面 404**：确认站点配置里有 `try_files $uri $uri/ /index.html;`
- **登录提示 401/跨域**：访问地址必须是 `https://wei6130.top:8445`，与 `allowed-origins` 一致
- **上传 Excel 失败**：站点配置里 `client_max_body_size 20m;` 与后端 multipart 限制都正常
- **数据库连不上**：看进程守护日志中的 Oracle 报错；确认数据库地址从服务器可达

## 13. 备选：面板没有"进程守护"时

用 OnePanel 的**计划任务**：

1. 添加计划任务，类型选"执行命令/Shell"
2. 命令：

```bash
cd /vol1/1000/dev/mind-weave-backend && nohup /usr/bin/java -Xms256m -Xmx768m -jar mind-weave-backend-1.0.0.jar --spring.profiles.active=prod --spring.config.additional-location=file:/vol1/1000/dev/mind-weave-backend/ >> /vol1/1000/dev/logs/mind-weave-backend.log 2>&1 &
```

3. 触发条件选"开机"并手动执行一次；以后重启后端就手动再执行一次该任务

> 如果面板支持"Java 项目"类型的网站，也可以直接把 jar 作为 Java 项目添加（填 jar 路径和 8080 端口），效果等同进程守护。
