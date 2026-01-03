/**
 * AI Manager
 * Handles interactions with Cloud AI services
 */
export default class AIManager {
  constructor() {
    this.isBusy = false;
  }

  static getInstance() {
    if (!AIManager.instance) {
      AIManager.instance = new AIManager();
    }
    return AIManager.instance;
  }

  /**
   * Generate a comment for the game result
   * @param {string} prompt - The description of the game result
   * @returns {Promise<string>} - The AI generated comment
   */
  async generateGameComment(prompt) {
      if (this.isBusy) {
          return null;
      }
      this.isBusy = true;

      try {
        // Check if wx.cloud.extend.AI is available (Client-side AI, Base Library >= 3.7.1)
        if (wx.cloud.extend && wx.cloud.extend.AI) {
            try {
                // Use 'hunyuan-exp' as provider, and specify model in data
                // Note: If 'hunyuan-lite' is not found, try 'hunyuan-turbo' or 'deepseek' if enabled
                const model = wx.cloud.extend.AI.createModel('hunyuan-exp');
                const res = await model.generateText({
                    model: 'hunyuan-lite', // Try hunyuan-lite first, it is usually cheaper/faster
                    messages: [{ role: 'user', content: prompt }]
                });
                
                this.isBusy = false;

                // Parse standard OpenAI-compatible response format
                if (res && res.choices && res.choices.length > 0 && res.choices[0].message) {
                    return res.choices[0].message.content;
                }
                // Handle potential simplified response
                if (res && res.text) {
                    return res.text;
                }

                console.warn('[AIManager] Unexpected AI response format:', res);
                return "精彩的对局！";
            } catch (err) {
                console.error('[AIManager] Client AI generation failed:', err);
                this.isBusy = false;
                return "【AI点评】对局变幻莫测！";
            }
        } else {
            // Fallback for older base libraries
            console.warn('[AIManager] wx.cloud.extend.AI not available. Base Library >= 3.7.1 required.');
            this.isBusy = false;
            return "【系统】请更新微信版本以体验AI点评 (需基础库 >= 3.7.1)";
        }
      } catch (e) {
        console.error('[AIManager] General Error:', e);
        this.isBusy = false;
        return "【本地点评】风云变幻，胜负乃兵家常事！";
      }
    }
}
