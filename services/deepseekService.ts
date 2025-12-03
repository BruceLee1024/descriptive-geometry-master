const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

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

// 生成 prompt
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

// 流式输出版本
export const explainGeometryStream = async (
  shapeName: string,
  promptContext: string = "",
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void
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
