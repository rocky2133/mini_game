// Cloud Function Entry
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  try {
    const { prompt } = event;
    let aiText = '';
    
    // Check SDK Version
    let sdkVersion = 'unknown';
    try {
        sdkVersion = require('wx-server-sdk/package.json').version;
    } catch (e) {}

    // Ensure cloud.extend.AI is available
    if (!cloud.extend || !cloud.extend.AI) {
        throw new Error(`cloud.extend.AI is not available. SDK Version: ${sdkVersion}. Please update wx-server-sdk to >=2.9.5.`);
    }

    // Use WeChat Cloud AI capability
    const model = await cloud.extend.AI.createModel('hunyuan-lite');
    const res = await model.generateText({
        data: {
            messages: [
                { role: 'system', content: '你是一位幽默犀利的德州扑克解说员。请用一句话中文点评这局游戏。' },
                { role: 'user', content: prompt }
            ]
        }
    });
    
    // Handle various response formats
    if (typeof res === 'string') {
        aiText = res;
    } else if (res.text) {
        aiText = res.text;
    } else if (res.choices && res.choices.length > 0) {
        aiText = res.choices[0].message.content;
    } else {
        aiText = JSON.stringify(res);
    }
    
    return {
        success: true,
        text: aiText
    };

  } catch (e) {
    console.error(e)
    let sdkVersion = 'unknown';
    try {
        sdkVersion = require('wx-server-sdk/package.json').version;
    } catch (vErr) {}
    
    return {
      success: false,
      error: e.message,
      // Provide detailed error info for the user to see in the UI
      text: `AI 点评暂不可用 (${e.message} | SDK: ${sdkVersion})`
    }
  }
}
