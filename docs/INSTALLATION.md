# 安装部署指南

五子棋 · Gomoku 完整的安装和部署文档

---

## 📋 目录

1. [系统要求](#系统要求)
2. [安装步骤](#安装步骤)
3. [启动游戏](#启动游戏)
4. [部署指南](#部署指南)
5. [故障排除](#故障排除)
6. [安全配置](#安全配置)

---

## 系统要求

### 开发环境

#### 必需软件
- **Node.js**: v16.0.0 或更高版本
- **NPM**: v7.0.0 或更高版本
- **Git**: 用于版本控制

#### 推荐软件
- **VS Code**: 代码编辑器
- **Chrome/Firefox**: 现代浏览器

### 生产环境

#### Web版本
- 任意现代Web服务器
- 支持静态文件托管

#### 桌面版本
- **Windows**: Windows 7 SP1 或更高
- **macOS**: macOS 10.13 或更高
- **Linux**: Ubuntu 18.04+ 或其他主流发行版

---

## 安装步骤

### 方法一：从源码安装

#### 1. 克隆仓库

```bash
# 使用HTTPS
git clone https://github.com/yourusername/gomoku.git

# 或使用SSH
git clone git@github.com:yourusername/gomoku.git

# 进入项目目录
cd gomoku
```

#### 2. 安装依赖（可选）

```bash
# 安装Node.js依赖
npm install

# 这会安装开发工具和Electron
```

#### 3. 验证安装

```bash
# 运行代码检查
npm run check

# 如果没有错误，安装成功
```

### 方法二：下载发布版本

#### Web版本
1. 下载最新的 `gomoku-web.zip`
2. 解压到任意目录
3. 按照[启动游戏](#启动游戏)章节操作

#### 桌面版本
1. 下载对应平台的安装包
   - Windows: `gomoku-setup-{version}.exe`
   - macOS: `gomoku-{version}.dmg`
   - Linux: `gomoku-{version}.AppImage`
2. 运行安装程序
3. 完成安装后启动游戏

---

## 启动游戏

### Web版本

#### 方法一：使用启动脚本（推荐）

**Windows用户：**
```bash
# 双击运行
启动游戏.bat
```

**macOS/Linux用户：**
```bash
# 添加执行权限（首次运行）
chmod +x 启动游戏.sh

# 运行脚本
./启动游戏.sh
```

#### 方法二：使用NPM命令

```bash
# 启动开发服务器
npm run serve

# 服务器将在 http://localhost:4173 启动
```

#### 方法三：使用自定义端口

```bash
# Windows
set PORT=8080 && npm run serve

# macOS/Linux
PORT=8080 npm run serve
```

#### 方法四：使用其他Web服务器

**使用Python：**
```bash
# Python 3
python -m http.server 4173

# Python 2
python -m SimpleHTTPServer 4173
```

**使用PHP：**
```bash
php -S localhost:4173
```

**使用Live Server（VS Code）：**
1. 安装Live Server扩展
2. 右键点击 `index.html`
3. 选择"Open with Live Server"

### 桌面版本

#### 开发模式

```bash
# 运行Electron应用
npm start

# 或开发模式（带DevTools）
npm run start:dev
```

#### 生产模式

直接运行安装后的可执行文件：
- Windows: 双击桌面快捷方式或开始菜单项
- macOS: 在Applications文件夹中启动
- Linux: 运行AppImage或已安装的可执行文件

---

## 部署指南

### 静态网站托管

#### GitHub Pages

1. **创建GitHub仓库**

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/username/gomoku.git
git push -u origin main
```

2. **启用GitHub Pages**

- 进入仓库Settings
- 找到Pages选项
- Source选择 `main` 分支
- 选择 `/ (root)` 目录
- 点击Save

3. **访问网站**

```
https://username.github.io/gomoku/
```

#### Netlify

1. **连接仓库**
   - 登录Netlify
   - 点击"New site from Git"
   - 选择GitHub仓库

2. **配置构建设置**
   - Build command: 留空（无需构建）
   - Publish directory: `.` 或留空

3. **部署**
   - 点击"Deploy site"
   - 等待部署完成

#### Vercel

1. **导入项目**
   - 登录Vercel
   - 点击"New Project"
   - 导入GitHub仓库

2. **配置**
   - Framework Preset: Other
   - Build Command: 留空
   - Output Directory: `./`

3. **部署**
   - 点击"Deploy"
   - 等待完成

#### 传统Web服务器

**Nginx配置：**

```nginx
server {
    listen 80;
    server_name gomoku.example.com;
    root /var/www/gomoku;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 启用gzip压缩
    gzip on;
    gzip_types text/css application/javascript application/json;
}
```

**Apache配置：**

```apache
<VirtualHost *:80>
    ServerName gomoku.example.com
    DocumentRoot /var/www/gomoku

    <Directory /var/www/gomoku>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # 启用压缩
    AddOutputFilterByType DEFLATE text/html text/css application/javascript
</VirtualHost>
```

### Docker部署

#### 创建Dockerfile

```dockerfile
FROM nginx:alpine

# 复制项目文件
COPY . /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### 构建和运行

```bash
# 构建镜像
docker build -t gomoku:latest .

# 运行容器
docker run -d -p 80:80 --name gomoku gomoku:latest

# 访问 http://localhost
```

### Steam部署

详见 [Steam集成指南](./STEAM_INTEGRATION.md)

---

## 故障排除

### 常见问题

#### 1. 端口被占用

**错误信息：**
```
Error: listen EADDRINUSE: address already in use :::4173
```

**解决方法：**

**方法一：停止占用进程**
```bash
# Windows
netstat -ano | findstr :4173
taskkill /F /PID <PID>

# macOS/Linux
lsof -ti:4173 | xargs kill -9
```

**方法二：使用其他端口**
```bash
PORT=8080 npm run serve
```

#### 2. Node.js版本过低

**错误信息：**
```
SyntaxError: Unexpected token 'export'
```

**解决方法：**
```bash
# 检查Node.js版本
node --version

# 如果低于v16.0.0，升级Node.js
# 访问 https://nodejs.org/ 下载最新版本
```

#### 3. 模块加载失败

**错误信息：**
```
Failed to load module script
```

**原因：** 直接打开index.html（file://协议）

**解决方法：** 必须通过HTTP服务器运行

#### 4. 页面空白

**可能原因：**
- JavaScript错误
- 资源加载失败
- 浏览器不兼容

**排查步骤：**
1. 按F12打开开发者工具
2. 查看Console选项卡错误信息
3. 查看Network选项卡网络请求
4. 检查浏览器是否支持ES Modules

#### 5. Electron启动失败

**错误信息：**
```
Cannot find module 'electron'
```

**解决方法：**
```bash
# 安装依赖
npm install

# 或只安装electron
npm install electron --save-dev
```

### 日志查看

#### 浏览器控制台

1. 按F12打开开发者工具
2. 选择Console选项卡
3. 查看错误和警告信息

#### 服务器日志

```bash
# 运行服务器时查看输出
npm run serve

# 日志会显示在命令行中
```

---

## 安全配置

### HTTPS配置

#### 使用Let's Encrypt

```bash
# 安装Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d gomoku.example.com

# 自动续期
sudo certbot renew --dry-run
```

#### Nginx HTTPS配置

```nginx
server {
    listen 443 ssl http2;
    server_name gomoku.example.com;

    ssl_certificate /etc/letsencrypt/live/gomoku.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gomoku.example.com/privkey.pem;

    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /var/www/gomoku;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name gomoku.example.com;
    return 301 https://$server_name$request_uri;
}
```

### 安全头配置

#### Nginx

```nginx
# 添加安全头
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

### 内容安全策略

在HTML中添加：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
```

---

## 性能优化

### 启用压缩

#### Nginx Gzip配置

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
gzip_comp_level 6;
```

### 启用缓存

#### Nginx缓存配置

```nginx
# 静态资源缓存
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# HTML不缓存
location ~* \.html$ {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### CDN加速

将静态资源托管到CDN：
1. 上传 `src/` 和 `assets/` 目录到CDN
2. 修改HTML中的资源引用路径

---

## 备份与恢复

### 备份项目

```bash
# 创建备份
tar -czf gomoku-backup-$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='builds' \
  --exclude='.git' \
  .

# 恢复备份
tar -xzf gomoku-backup-20260404.tar.gz
```

### 版本更新

```bash
# 拉取最新代码
git pull origin main

# 安装新依赖
npm install

# 重新启动
npm run serve
```

---

## 附录

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 4173 | 服务器端口 |
| NODE_ENV | development | 环境模式 |
| BUILD_NUMBER | 1 | 构建编号 |

### 常用命令

```bash
# 开发
npm run serve          # 启动开发服务器
npm run check          # 代码检查
npm start              # 运行Electron应用

# 构建
npm run build          # 构建Web版本
npm run build:win      # 构建Windows版本
npm run build:mac      # 构建macOS版本
npm run build:linux    # 构建Linux版本
npm run build:all      # 构建所有平台

# 清理
npm run clean          # 清理构建文件
```

---

**部署成功后，访问你的网站即可开始游戏！** 🎉