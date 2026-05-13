// 使用Vite代理解决CORS问题
const DEEPSEEK_API_URL = "/api/deepseek/chat/completions";

let apiKey: string | null = localStorage.getItem("deepseek_api_key");

export const setApiKey = (key: string) => {
  apiKey = key;
  localStorage.setItem("deepseek_api_key", key);
};

export const getApiKey = (): string | null => {
  return apiKey;
};

export const clearApiKey = () => {
  apiKey = null;
  localStorage.removeItem("deepseek_api_key");
};

// 消息类型
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 系统提示词 - 定义AI助教的角色和行为
const SYSTEM_PROMPT = `你是一位经验丰富、和蔼可亲的画法几何（工程制图）大学老师，名叫"几何老师"。

## 你的教学风格：
- **引导式教学**：不直接给答案，而是通过提问引导学生思考
- **循序渐进**：从简单概念开始，逐步深入
- **鼓励为主**：多表扬学生的思考过程，即使答错也要肯定其努力
- **生动形象**：用生活中的例子来解释抽象概念

## 你的核心知识领域：
1. **投影原理**：正投影、斜投影、中心投影
2. **三视图**：主视图(V面)、俯视图(H面)、左视图(W面)的投影规律
3. **投影特性**：真实性、积聚性、类似性
4. **三视图关系**：长对正、高平齐、宽相等
5. **基本几何体**：棱柱、棱锥、圆柱、圆锥、球、圆环等
6. **组合体**：叠加式、切割式、综合式
7. **截交线与相贯线**：平面与立体相交、两立体相交

## 对话规则：
1. 每次回复控制在150字以内，保持简洁
2. 经常用问题结尾，引导学生继续思考
3. 使用Markdown格式（加粗重点、列表等）
4. 如果学生问的问题超出画法几何范围，友好地引导回来
5. 根据学生的回答调整难度和解释方式

## 常用引导问题示例：
- "你觉得从正面看这个物体，会是什么形状呢？"
- "想象一下，如果有一束平行光从上往下照，影子会是什么样？"
- "这两个视图之间有什么关系？提示：注意它们的尺寸..."
- "很好的思考！那你能解释一下为什么会这样吗？"`;

// 生成 prompt（保留兼容旧接口）
const generatePrompt = (shapeName: string, promptContext: string = "") => {
  return `
你是一位画法几何（工程制图）的资深大学老师。
现在的教学场景是：学生正在观察一个"${shapeName}"的三维模型及其三视图投影。

请用通俗易懂、生动的语言（中文）简要讲解：
1. 该形体在主视图（V面）、俯视图（H面）、左视图（W面）分别是什么形状？
2. 为什么会是这样的形状？（提到简单的投影原理，如积聚性、真实性）。
3. ${promptContext ? `回答用户的特定问题: ${promptContext}` : "给出一个观察重点提示。"}

要求：
- 限制在 300 字以内。
- 格式清晰，使用 Markdown 格式（加粗、列表等）。
- 语气鼓励且专业。
  `.trim();
};

// 对话式AI助教 - 流式输出
export const chatWithTutorStream = async (
  messages: ChatMessage[],
  currentShape: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<void> => {
  if (!apiKey) {
    onError("请先在设置中输入 DeepSeek API Key。");
    return;
  }

  try {
    // 构建完整的消息列表，包含系统提示和当前形体上下文
    const contextMessage: ChatMessage = {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\n## 当前教学场景：\n学生正在观察一个"${currentShape}"的三维模型及其三视图投影。请根据这个具体形体来引导教学。`
    };

    const fullMessages = [contextMessage, ...messages];

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: fullMessages,
        max_tokens: 500,
        temperature: 0.8,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        onError("API Key 无效，请检查后重新输入。");
        return;
      }
      onError("AI 老师暂时掉线了，请稍后再试。");
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError("无法读取响应流");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    onComplete();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    console.error("DeepSeek API Error:", error);
    onError("AI 老师暂时掉线了，请稍后再试。");
  }
};

// 生成欢迎消息
export const generateWelcomeMessage = (shapeName: string): string => {
  const welcomeMessages = [
    `👋 你好！我是你的画法几何助教。\n\n我看到你正在学习**${shapeName}**的三视图投影，这是个很好的学习对象！\n\n在开始之前，我想先问你：**你觉得从正面看这个物体，会是什么形状呢？** 🤔`,
    `📐 欢迎来到画法几何课堂！\n\n今天我们一起来研究**${shapeName}**。观察一下右边的三维模型，然后告诉我：\n\n**如果有一束平行光从正前方照过来，这个物体的影子会是什么样的？**`,
    `🎓 同学你好！很高兴能帮助你学习画法几何。\n\n我注意到你选择了**${shapeName}**来学习。这是一个很经典的几何体！\n\n让我们从一个简单的问题开始：**你能描述一下这个物体的基本形状吗？**`,
  ];
  return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
};

// 流式输出版本
export const explainGeometryStream = async (
  shapeName: string,
  promptContext: string = "",
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<void> => {
  if (!apiKey) {
    onError("请先在设置中输入 DeepSeek API Key。");
    return;
  }

  try {
    const prompt = generatePrompt(shapeName, promptContext);

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.7,
        stream: true, // 启用流式输出
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        onError("API Key 无效，请检查后重新输入。");
        return;
      }
      onError("AI 老师暂时掉线了，请稍后再试。");
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError("无法读取响应流");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    onComplete();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    console.error("DeepSeek API Error:", error);
    onError("AI 老师暂时掉线了，请稍后再试。");
  }
};

// 非流式版本（保留兼容）
export const explainGeometry = async (
  shapeName: string,
  promptContext: string = ""
): Promise<string> => {
  if (!apiKey) {
    return "请先在设置中输入 DeepSeek API Key。";
  }

  try {
    const prompt = generatePrompt(shapeName, promptContext);

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return "API Key 无效，请检查后重新输入。";
      }
      return "AI 老师暂时掉线了，请稍后再试。";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "AI 正在思考中...";
  } catch (error) {
    console.error("DeepSeek API Error:", error);
    return "AI 老师暂时掉线了，请稍后再试。";
  }
};
