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
      if (this.isBusy) return null;
      this.isBusy = true;
  
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'ai_helper',
          data: { prompt }
        });
  
        this.isBusy = false;
        
        if (result && result.text) {
            return result.text;
        } else {
            return "What a game!";
        }
      } catch (e) {
        console.error('AI Call failed:', e);
        this.isBusy = false;
        return "Game Over! (AI offline)";
      }
    }
  }
