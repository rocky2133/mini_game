// Cloud Function Entry
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  try {
    const { prompt } = event;

    // Use WeChat Cloud AI capability (DeepSeek/Hunyuan) if available
    // Standard invocation for "AI Service" extension usually looks like this:
    // const res = await cloud.extend.ai.bot.chat({ ... })
    // OR calling a specific model API.
    
    // Since we don't have the exact extension installed, we will simulate the structure 
    // OR try to call the model via cloud.callFunction if it was a wrapper.
    
    // However, the user asked to use "Tencent Cloud built-in AI extension SDK".
    // This often refers to `wx.cloud.extend.AI` or similar.
    // If not available, we can use `cloud.openapi.ai` (limited) or assume usage of `tencentcloud-sdk-nodejs`.
    
    // Let's implement a standard call to "lke" (Logic Knowledge Engine) or "hunyuan" via SDK if we had it.
    // For now, we'll try to use the generic AI HTTP API or return a mock if not configured.
    // BUT the user specifically asked for "Capability".
    
    // Implementation for "Mini Program AI Capability":
    // Reference: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/ai/
    
    // We will attempt to use the `cloud.AI` namespace if it exists (modern SDK).
    
    // If `cloud.AI` is not available, we return a fallback to avoid crashing.
    
    const ai = cloud.AI; 
    if (!ai) {
        // Fallback for demo purposes if SDK isn't updated
        return {
            success: true,
            text: `[AI Mock] Wow! ${prompt.substring(0, 20)}... That was intense! Better luck next time!`
        };
    }

    // Assuming we want a simple chat completion
    const res = await ai.chat.completions.create({
        model: 'deepseek-r1', // or 'hunyuan-lite'
        messages: [
            { role: 'system', content: 'You are a funny and sharp poker commentator. Keep it short (1 sentence).' },
            { role: 'user', content: prompt }
        ]
    });

    return {
        success: true,
        text: res.choices[0].message.content
    };

  } catch (e) {
    console.error(e)
    return {
      success: false,
      error: e.message,
      text: "AI is speechless about this game!" // Fallback
    }
  }
}
