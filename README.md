# 🎯 画法几何大师 | Descriptive Geometry Master

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18.x-61dafb.svg)
![Three.js](https://img.shields.io/badge/Three.js-r158-black.svg)

**交互式三维可视化画法几何学习平台**

[在线演示](#) · [功能特性](#-功能特性) · [快速开始](#-快速开始) · [技术栈](#-技术栈)

</div>

---

## 📖 项目简介

**画法几何大师**是一个现代化的交互式画法几何教学工具，基于 Three.js 构建的 3D 可视化平台。它将抽象的投影原理转化为直观的三维动画，帮助学习者深入理解"长对正、高平齐、宽相等"等核心投影规律。

### ✨ 亮点

- 🎨 **酷炫科技感 UI** - 深色主题 + 网格背景 + 渐变装饰
- 🧊 **19 种预设形体** - 从基础到复杂，覆盖常见几何体
- 📐 **完整投影系统** - 三视图 + 轴测图 + 投影线追踪
- 🤖 **AI 智能助教** - DeepSeek 驱动，流式输出，实时答疑
- ✏️ **绘制建模** - SketchUp 风格的推拉建模
- 📁 **模型导入** - 支持 .glb/.gltf 格式

---

## 🎮 功能特性

### 形体库（19 种）

| 类别 | 形体 |
|------|------|
| **基础形体** | 正方体、圆柱体、圆锥体、球体、六棱柱、四棱锥 |
| **切割形体** | 切角块、楔形体、切口圆柱 |
| **组合形体** | L型支座、T型块、十字块、阶梯块、开槽块 |
| **回转体** | 空心圆柱、圆环体 |
| **相贯体** | 相贯三棱柱（CSG 布尔运算） |
| **自定义** | 模型导入、绘制建模 |

### 投影系统

- **三视图投影** - V(主视图)、H(俯视图)、W(左视图)、R(右视图)
- **投影面展开/折叠** - 动画演示投影面展开过程
- **投影线追踪** - 显示特征点到各投影面的投影线
- **虚线表示** - 不可见线用虚线显示，符合工程制图标准
- **轴测投影** - 等轴测、二等轴测、斜二测

### AI 助教

- DeepSeek API 驱动
- 流式输出 + Markdown 渲染
- 智能滚动 + 打字光标效果
- 一键解释投影关系

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装运行

```bash
# 克隆项目
git clone git@github.com:BruceLee1024/DESCRIPTIVE-GEOMETRY.git
cd DESCRIPTIVE-GEOMETRY

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 配置 AI 助教

1. 获取 DeepSeek API Key: [platform.deepseek.com](https://platform.deepseek.com/api_keys)
2. 点击界面右侧 AI 助教的 🔑 图标
3. 输入 API Key 并保存

---

## 🛠 技术栈

| 技术 | 用途 |
|------|------|
| **React 18** | UI 框架 |
| **TypeScript** | 类型安全 |
| **Three.js** | 3D 渲染引擎 |
| **@react-three/fiber** | React Three.js 绑定 |
| **@react-three/drei** | Three.js 工具库 |
| **three-bvh-csg** | CSG 布尔运算（相贯体） |
| **Tailwind CSS** | 样式框架 |
| **Vite** | 构建工具 |
| **DeepSeek API** | AI 助教 |

---

## 📁 项目结构

```
├── App.tsx                 # 主应用组件
├── index.tsx               # 入口文件
├── types.ts                # 类型定义 & 形体配置
├── components/
│   ├── HomePage.tsx        # 3D 动画主页
│   ├── GlassBoxScene.tsx   # 玻璃盒投影场景
│   ├── SceneComponents.tsx # 几何体 & 投影组件
│   ├── SketchBuilder.tsx   # 绘制建模组件
│   └── CustomModel.tsx     # 自定义模型加载
└── services/
    └── deepseekService.ts  # DeepSeek API 服务
```

---

## 📸 截图

### 主页
酷炫的 3D 动画背景，跟随鼠标移动的几何线条网格

### 学习界面
- 左侧：形体选择 + 参数调节 + 视图控制
- 中间：3D 投影可视化
- 右侧：AI 智能助教

---

## 🎓 教学价值

1. **直观理解投影规律** - "长对正、高平齐、宽相等"
2. **观察投影变化过程** - 展开/折叠投影面动画
3. **学习复杂形体投影** - 相贯线、截交线
4. **实践绘图技能** - 绘制建模 + 模型导入
5. **AI 实时答疑** - 随时提问，即时解答

---

## 📄 License

MIT License © 2024 BruceLee1024

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star！**

Made with ❤️ for Descriptive Geometry Learners

</div>
