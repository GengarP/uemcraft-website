/* ============================================================
   data.js — UEMCraft 内容数据源（唯一真源）
   ------------------------------------------------------------
   新增新闻：在 news 数组加一个对象（含 markdown）
   新增活动：在 events.upcoming / events.past 加一个对象
   路径约定：一律使用根相对路径（以 / 开头），如 /assets/...、
             /news/article.html?slug=xxx
   转义注意：markdown 中的反引号 ` 需写作 \`，${ 需写作 \${
   ============================================================ */

window.UEMCRAFT_DATA = {
  news: [
    {
      slug: 'skin-uemcraft-cn',
      title: '皮肤站上线',
      excerpt: 'YIT & UEM 联合皮肤站现已正式接入 MUA Union 联合验证系统。',
      date: '2026-8-13',
      author: 'UEMCraft 理事会',
      tags: ['网站'],
      cover: '/assets/img/events/26-8-13-skin-uemcraft-cn.jpg',
      markdown: `YIT & UEM 联合皮肤站（[https://skin.uemcraft.cn/](https://skin.uemcraft.cn/)）现已正式接入 **MUA Union 联合验证系统**。即日起，燕京理工学院与应急管理大学的 Minecraft 玩家可使用联合认证账号在更多高校服务器间畅游，皮肤与披风数据互联互通。

## 什么是 MUA Union 联合验证？

MUA Union 联合认证是由 MUA 皮肤站和各高校皮肤站组成的玩家数据同步系统。接入该系统后，来自多个成员皮肤站的玩家可以登录同一个 Minecraft 服务器，并且能够互相看见彼此的皮肤和披风。系统提供了 UUID/角色名称冲突的绑定处理机制，并允许服务器指定成员皮肤站的黑白名单。

目前，MUA Union 已联络 **50 余个皮肤站**接入数据同步，覆盖 **20000 余名高校玩家**。玩家使用联合认证账号，便可进入所有接入 Union 联合认证的高校 Minecraft 服务器游玩。

## 皮肤站核心功能

YIT & UEM 联合皮肤站基于 Blessing Skin Server（v6.0.2，Laravel 10）构建，面向燕京理工学院与应急管理大学的在校学生开放，提供以下核心服务：

- **多角色管理**：一个账户可绑定多个游戏角色
- **皮肤库与分享**：浏览皮肤库，添加喜爱的皮肤并与好友分享
- **皮肤与披风托管**：配合 CustomSkinLoader 等换肤 Mod，为游戏角色设置皮肤与披风，其他玩家在游戏中可见

## 学生身份真实验证

与其他皮肤站不同，YIT & UEM 联合皮肤站要求用户在创建角色、上传皮肤前必须通过学校系统验证在校生身份。验证并非手动填写，而是真实调用学校系统：

- **燕京理工学院（YIT）**：调用教务系统 \`jw.yit.edu.cn\` 登录并核对学籍信息（姓名 + 学号）
- **应急管理大学（UEM）**：扫码验证（学校 App 扫码确认，无需密码，自动获取姓名 + 学号）

## 隐私与安全保障

皮肤站在设计上高度重视用户隐私：

- 密码仅存在于单次请求的内存中，不落库、不缓存、不打日志
- 数据库仅保存学校、学号、验证时间，不保存姓名
- 网页上仅显示验证所属学校，不显示学号、姓名等个人信息
- 不获取、不保存任何成绩、课表等学业信息
- 提供独立隐私协议页（\`/privacy\`）

## 接入 MUA Union 的意义

此次接入 MUA Union 联合验证系统，意味着 YIT & UEM 联合皮肤站正式成为 MUA 高校联盟生态的一部分。两校的 Minecraft 玩家不仅可以享受皮肤站本地的全部功能，还能：

- **跨校游玩**：使用联合认证账号进入其他接入 Union 的高校服务器
- **皮肤互通**：在支持 Union 的服务器中，皮肤与披风可被其他高校玩家看见
- **统一身份**：无需为不同服务器重复注册账号

目前，Minecraft 高校联盟（MUA）已拥有 **两百余个高校 MC 组织成员**，接入 Union 联合认证的高校皮肤站超过 40 个。YIT & UEM 联合皮肤站的加入，进一步壮大了这一高校 MC 生态。

---

> 网站已被添加到页脚的相关链接，点击即可直接访问！
`
    },
    {
      slug: 'autumn-recruitment',
      title: '秋季招新',
      excerpt: '新学年，新气象！UEMCraft 秋季招新即将开启，欢迎各位新同学加入我们，一起用方块创造世界。',
      date: '2026-08-06', // ISO，用于排序；显示时由 content.js 格式化为中文
      author: 'UEMCraft 理事会',
      tags: ['招募'],
      cover: '/assets/img/events/26-8-12-autumn-recruitment.png',
      markdown: `![招新海报](/assets/img/events/26-8-13-autumn-recruitment-2.jpg "招新海报")
      
应急管理大学 Minecraft 同好会（UEMCraft）现面向全体在校同学启动本年度秋季招新。无论你是建筑大师、红石工程师，还是单纯热爱方块世界的冒险家，这里都有属于你的一片天地。

## 关于同好会

UEMCraft，全称应急管理大学 Minecraft 同好会（英文名 UEMCraft），是以 Minecraft 为平台，开展校园数字复原、建筑创作、技术交流等活动的学生社群。

同好会致力于培养成员的创造力、团队协作能力与跨学科实践能力。社团是 MUA 高校联盟的成员组织，秉承"理事会统筹、部门分工、项目驱动、成员自治"的组织原则。

## 社团核心活动

- 校园数字复原：利用 Minecraft 对应急管理大学校园进行数字化重建
- 建筑创作：开展各类主题建筑项目与创意建造活动
- 技术交流：红石技术、模组探索与服务器运维经验分享

## 精选作品与往期活动

同好会成立以来，已积累众多建筑作品，并成功举办了多场校内活动。从校园建筑的精确复刻到创意主题城镇的构筑，每一件作品都凝聚着成员们的热情与匠心。

本学期，社团将继续组织建筑协作、生存挑战、技术研讨等多项活动，为每位成员提供展示才华的舞台。

## 秋季招新对象

- 应急管理大学全体在校本科生、研究生
- 对 Minecraft 有热情，零基础也欢迎

## 我们期待的你

- 热爱 Minecraft，愿意与他人合作分享
- 遵守服务器公约，友善交流
- 有责任心，乐于参与社团建设

即使你只是想在课余时间找一群朋友一起挖矿、造房子、探索世界，UEMCraft 也随时欢迎你。

## 联系我们

- 同好会 QQ 群：626405485
- 服务器地址：\`play.uemcraft.cn\`

---

UEMCraft 理事会
2026年8月6日`
    },
    {
      slug: 'immersive-fight',
      title: '沉浸战斗整合包服务器开设',
      excerpt: '全新沉浸战斗整合包服务器正式上线！包含丰富的技能树、精英怪物与战斗机制，带来全新的 PvE 体验。',
      date: '2026-08-06',
      author: 'UEMCraft 理事会',
      tags: ['服务器'],
      cover: '/assets/img/events/26-8-6-immersive-fight.png',
      coverCaption: '沉浸战斗整合包官方宣传图',
      markdown: `## 整合包简介

> 沉浸战斗（Immersive Fight）是一款以 **史诗战斗** 为核心战斗系统的冒险多人整合包。
> 它在舍弃多余繁杂要素的同时，加入了大量细节体验优化，致力于带来最沉浸的冒险战斗体验。

| 项目 | 详情 |
|------|------|
| 整合包名称 | 沉浸战斗（Immersive Fight）|
| 整合包版本 | V4.2.2 |
| 我的世界版本 | 1.20.1 |
| 模组平台 | Forge |
| 运行环境 | 客户端 + 服务端 |
| 分类 | 冒险 / 多人游戏 / 战斗 |

---

## 服务器信息

- **服务器 IP：** \`play.uemcraft.cn\`
- **整合包下载：** 前往 [UEMCraft 官方 QQ 群](https://qm.qq.com/q/VYDnv3ZJwC)下载

---

## 如何加入

1. 从上方链接下载 **沉浸战斗 V4.2.2** 整合包并完成安装；
2. 启动游戏，在多人服务器中添加服务器地址 \`play.uemcraft.cn\`；
3. 进入服务器，开启你的沉浸冒险之旅！

---

> 本服务器由 UEMCraft 运营维护，欢迎各位冒险家前来体验！`
    }
  ],

  events: {
    upcoming: [
      {
        title: '秋季招新',
        dateLabel: '2026.10',
        status: 'upcoming',
        cover: '/assets/img/events/26-8-12-autumn-recruitment.png',
        excerpt: '新学年，新气象！UEMCraft 秋季招新即将开启，欢迎各位新同学加入我们，一起用方块创造世界。',
        link: '/news/article.html?slug=autumn-recruitment'
      },
      {
        title: '沉浸战斗整合包服务器开设',
        dateLabel: '2026.7.24',
        status: 'ongoing',
        cover: '/assets/img/events/26-8-6-immersive-fight.png',
        excerpt: '全新沉浸战斗整合包服务器正式上线！包含丰富的技能树、精英怪物与战斗机制，带来全新的 PvE 体验。',
        link: '/news/article.html?slug=immersive-fight'
      }
    ],
    past: []
  }
};
