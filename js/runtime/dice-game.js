import Dice from './dice';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

export default class DiceGame {
  constructor() {
    this.diceCount = 1;
    this.dices = [];
    this.initDices();
    
    this.isRolling = false;
    this.rollDuration = 1000; // 1 second
    this.rollStartTime = 0;
    
    // UI Constants
    this.btnSize = 40; // Base size, will be dynamic
    this.controlAreaHeight = SCREEN_HEIGHT * 0.25; // Bottom 25% for controls
    this.gameAreaHeight = SCREEN_HEIGHT - this.controlAreaHeight;
    
    // Back Button Constants
    this.backBtnX = 20;
    this.backBtnY = 40; // Top-left corner
    this.backBtnRadius = 20;

    // Initialize UI Layout
    this.updateLayout();
  }

  updateLayout() {
      // Calculate dice size and layout based on count
      // Max columns: 3 (for 5-6 dice), 2 (for 2-4 dice), 1 (for 1 die)
      let cols = 1;
      if (this.diceCount >= 2 && this.diceCount <= 4) cols = 2;
      if (this.diceCount >= 5) cols = 3;
      
      const rows = Math.ceil(this.diceCount / cols);
      
      // Padding around the grid
      const padding = 20;
      const availableWidth = SCREEN_WIDTH - padding * 2;
      const availableHeight = this.gameAreaHeight - padding * 2 - 50; // -50 for title space
      
      // Calculate max possible size based on width and height constraints
      const maxDiceWidth = (availableWidth - (cols - 1) * 20) / cols;
      const maxDiceHeight = (availableHeight - (rows - 1) * 20) / rows;
      
      // Use the smaller dimension to keep aspect ratio 1:1, but cap at a reasonable max size
      this.diceSize = Math.min(maxDiceWidth, maxDiceHeight, 150); 
      
      // Calculate centering offsets
      const gridWidth = cols * this.diceSize + (cols - 1) * 20;
      const gridHeight = rows * this.diceSize + (rows - 1) * 20;
      
      this.gridStartX = (SCREEN_WIDTH - gridWidth) / 2;
      this.gridStartY = 50 + (availableHeight - gridHeight) / 2; // Center vertically in available space
      
      // Control Area Layout
      this.countBtnY = SCREEN_HEIGHT - this.controlAreaHeight + 20;
      this.rollBtnY = SCREEN_HEIGHT - 80;
      
      // Count Buttons
      const countBtnGap = 10;
      const totalCountWidth = SCREEN_WIDTH - 40; // 20px padding each side
      this.countBtnSize = (totalCountWidth - 5 * countBtnGap) / 6;
      this.countBtnStartX = 20;

      // Roll Button
      this.rollBtnRect = {
          x: (SCREEN_WIDTH - 200) / 2,
          y: this.rollBtnY,
          w: 200,
          h: 60
      };
  }

  initDices() {
    this.dices = [];
    for (let i = 0; i < this.diceCount; i++) {
      this.dices.push(new Dice());
    }
    this.updateLayout();
  }

  setDiceCount(count) {
    if (this.isRolling) return;
    this.diceCount = count;
    this.initDices();
  }

  startRoll() {
    if (this.isRolling) return;
    this.isRolling = true;
    this.rollStartTime = Date.now();
  }

  update() {
    if (this.isRolling) {
      const now = Date.now();
      if (now - this.rollStartTime > this.rollDuration) {
        this.isRolling = false;
      } else {
        if (GameGlobal.databus.frame % 5 === 0) {
             this.dices.forEach(d => d.setValue(Math.floor(Math.random() * 6) + 1));
        }
      }
    }
  }

  render(ctx) {
    // 1. Draw Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'; // Changed to middle for better alignment with button
    ctx.fillText('Dice Game', SCREEN_WIDTH / 2, this.backBtnY); // Align with back button

    // Draw Back Button (<)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Increased opacity
    ctx.beginPath();
    ctx.arc(this.backBtnX + this.backBtnRadius, this.backBtnY, this.backBtnRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.backBtnX + this.backBtnRadius + 5, this.backBtnY - 8);
    ctx.lineTo(this.backBtnX + this.backBtnRadius - 5, this.backBtnY);
    ctx.lineTo(this.backBtnX + this.backBtnRadius + 5, this.backBtnY + 8);
    ctx.stroke();

    // 2. Render Dice
    // Re-calculate grid locally to handle the dynamic list
    let cols = 1;
    if (this.diceCount >= 2 && this.diceCount <= 4) cols = 2;
    if (this.diceCount >= 5) cols = 3;

    this.dices.forEach((dice, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        
        const x = this.gridStartX + col * (this.diceSize + 20) + this.diceSize / 2;
        const y = this.gridStartY + row * (this.diceSize + 20) + this.diceSize / 2;
        
        dice.render(ctx, x, y, this.diceSize);
    });

    // 3. Render Controls Background (Optional, semi-transparent)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, SCREEN_HEIGHT - this.controlAreaHeight, SCREEN_WIDTH, this.controlAreaHeight);

    // 4. Render Count Selection Buttons
    ctx.font = '14px Arial';
    ctx.fillStyle = '#EEE';
    ctx.textAlign = 'left';
    ctx.fillText('Number of Dice:', 20, this.countBtnY - 25);

    for (let i = 1; i <= 6; i++) {
        const bx = this.countBtnStartX + (i - 1) * (this.countBtnSize + 10);
        const by = this.countBtnY;
        const size = this.countBtnSize;
        
        const isSelected = this.diceCount === i;
        
        // Button Shape (Circle)
        ctx.beginPath();
        ctx.arc(bx + size/2, by + size/2, size/2, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#FFD700' : '#FFF'; // Gold for selected, White for others
        ctx.fill();
        
        if (isSelected) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#FFA500';
            ctx.stroke();
        }

        // Button Text
        ctx.fillStyle = isSelected ? '#333' : '#333';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), bx + size/2, by + size/2);
    }

    // 5. Render Roll Button
    const rb = this.rollBtnRect;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    this.roundRect(ctx, rb.x + 4, rb.y + 4, rb.w, rb.h, 10, true, false);

    // Main Button
    ctx.fillStyle = this.isRolling ? '#A9A9A9' : '#1E90FF'; // DodgerBlue
    this.roundRect(ctx, rb.x, rb.y, rb.w, rb.h, 10, true, false);
    
    // Text
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.isRolling ? 'Rolling...' : 'ROLL', rb.x + rb.w/2, rb.y + rb.h/2);
    
    // Reset baseline
    ctx.textBaseline = 'alphabetic';
  }

  // Helper for rounded rectangle
  roundRect(ctx, x, y, w, h, r, fill = true, stroke = false) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
  }
  
  touchHandler(x, y) {
      if (this.isRolling) return null;

      // Check Back Button
      const dxBack = x - (this.backBtnX + this.backBtnRadius);
      const dyBack = y - this.backBtnY;
      if (dxBack * dxBack + dyBack * dyBack <= this.backBtnRadius * this.backBtnRadius) {
          return 'back';
      }

      // Check count buttons
      for (let i = 1; i <= 6; i++) {
        const bx = this.countBtnStartX + (i - 1) * (this.countBtnSize + 10);
        const by = this.countBtnY;
        const size = this.countBtnSize;
        
        // Simple circle hit test
        const dx = x - (bx + size/2);
        const dy = y - (by + size/2);
        if (dx*dx + dy*dy <= (size/2)*(size/2)) {
            this.setDiceCount(i);
            return null;
        }
      }
      
      // Check Roll Button
      if (x >= this.rollBtnRect.x && x <= this.rollBtnRect.x + this.rollBtnRect.w &&
          y >= this.rollBtnRect.y && y <= this.rollBtnRect.y + this.rollBtnRect.h) {
          this.startRoll();
      }
      
      return null;
  }
}
