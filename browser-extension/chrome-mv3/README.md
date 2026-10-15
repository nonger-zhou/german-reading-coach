# Chrome MV3 Importer

桌面 Chrome 插件 MVP：在用户已经能看到的网页上点击插件按钮或右键菜单，将当前页面标题、URL、来源和正文带入 German Reading Coach 的 `/import` 页面。

## 本地安装

1. 打开 Chrome → `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本目录：`browser-extension/chrome-mv3`

## 使用方式

- 打开一篇你已经能阅读正文的文章。
- 点击浏览器工具栏里的插件按钮，或右键选择「导入到 German Reading Coach」。
- 插件会打开 `/import`，并把当前页面内容预填到导入页。

## 更新本地插件

代码更新后，回到 Chrome 的 `chrome://extensions/`，点击「更新」或在本插件卡片上点击**重新加载**，再重新打开目标文章测试。

## 正文识别规则（摘要）

- **标题**：优先 `og:title` / `twitter:title`（去掉 `| 媒体名` 后缀），并与 URL 路径词匹配校验。
- **正文**：优先 `<p>`；若过短则再采 `article` 内叶子 **`section`**（如博物馆博客 `snm-text`）及正文 class 的 **`div`**。遇到「Das könnte Sie auch interessieren」等即停止；跳过 Cookie 占位、发布日期、Newsletter 等噪声段。
- **兜底**：导入页 `parseArticleFromRaw` / `cleanArticleText` 会再次去掉推荐区、作者署名与上述 Cookie 占位段；错误标题（推荐区标题、人名）不会覆盖解析出的标题。

## 合规边界

- 插件只读取当前浏览器页面里已经展示给用户的内容。
- 不绕过付费墙、登录墙或订阅限制。
- 如果页面正文无法稳定识别，可在网页中先选中正文，再点击插件按钮或右键菜单导入选中文本。
