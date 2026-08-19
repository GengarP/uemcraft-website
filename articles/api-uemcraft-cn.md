---
title: 服务器信息查询API公开
slug: api-uemcraft-cn
date: 2026-08-14
author: Gengar_Sama
tags:
  - 功能
excerpt: 实时查询Minecraft服务器状态，支持Java版与基岩版
---

## 前言

为了方便各位服主、开发者以及Minecraft爱好者实时获取服务器信息，我将 **Minecraft-Query** 项目部署到了自己的服务器上，并正式对外开放API服务。

无论你是想在自己的网站上展示服务器状态，还是开发配套的小程序、机器人插件，都可以直接调用本API，无需再自行搭建查询服务。

---

## API 基本信息

- **Base URL**：`https://api.uemcraft.cn/`
- **响应格式**：JSON
- **请求方式**：GET

---

## Java版服务器查询

查询Java版Minecraft服务器的实时状态。

### 接口地址

`GET /api/java/:server`

### 请求参数

| 参数 | 类型 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| server | string | 是 | Java版服务器地址 | — |
| port | integer | 否 | 服务器端口 | 25565 |

### 示例请求

`GET https://api.uemcraft.cn/api/java/mc.hypixel.net`


### 成功响应示例

```json
{
  "status": "success",
  "ip": "mc.hypixel.net",
  "port": 25565,
  "edition": "java",
  "online": true,
  "version": "Requires MC 1.8 - 1.20",
  "protocol": 47,
  "ping_method": "modern",
  "latency": 156,
  "motd": "Hypixel Network [1.8-1.20]",
  "players": {
    "online": 78452,
    "max": 200000,
    "list": [...]
  },
  "favicon": "data:image/png;base64,..."
}
```

### 错误响应示例

```json
{
  "status": "error",
  "ip": "nonexistent.server.com",
  "port": 25565,
  "error": "Connection failed: getaddrinfo ENOTFOUND",
  "online": false
}
```

> 基岩版服务器查询方式同理，本文不再赘述

---

## 响应字段说明

| 字段 | 说明 |
|-----|-----|
| status | 请求状态: `success` 或 `error` |
| ip | 查询的服务器ip/域名 |
| port | 查询的服务器端口 |
| edition | 服务器版本: `Java` 或 `Bedrock` |
| online | 服务器是否在线 |
| version | 服务器版本信息 |
| protocol | 协议版本号 |
| ping_method | Ping 方法 |
| latency | ~~响应延迟（毫秒）~~ 因为接口限制，此处可能会返回 `N/A` 或 `null,` |
| motd | 服务器 MOTD 信息 |
| players.online | 当前在线玩家人数 |
| players.max | 最大玩家容量 |
| players.list | 在线玩家列表（如有） |
| favicon | 服务器图标（Base64编码） |
| error | 错误信息，仅当 `status` 为 `error` 时 |

---

## 注意事项

- 请合理控制请求频率，避免对服务器造成过大压力
- 本 API 仅供个人学习与小型项目使用，如有大规模调用需求请联系我
- 如遇到查询失败，请检查服务器地址是否正确，以及服务器是否开放了对应端口

---

## 结语

以上就是本次开放的服务器查询 API 的全部内容。欢迎大家使用，如果在使用过程中遇到任何问题或有改进建议，欢迎随时反馈！

Happy Crafting!
