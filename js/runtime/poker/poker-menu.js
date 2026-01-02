import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../../render';
import RoomManager from './room-manager';
import UserManager from '../user-manager';

export default class PokerMenu {
  constructor() {
    this.roomInput = '';
    this.manager = RoomManager.getInstance();
    
    // Layout constants
    this.centerX = SCREEN_WIDTH / 2;
    this.centerY = SCREEN_HEIGHT / 2;
    
    // Keypad layout
    this.keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Del', '0', 'OK'];
    this.keyWidth = 80;
    this.keyHeight = 60;
    this.gap = 10;
    this.startX = (SCREEN_WIDTH - (3 * this.keyWidth + 2 * this.gap)) / 2;
    this.startY = SCREEN_HEIGHT * 0.4;

    this.backBtnX = 20;
    this.backBtnY = 80;
    this.backBtnRadius = 20;
  }

  render(ctx) {
    // Background (simple dark green)
    ctx.fillStyle = '#2F4F4F';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Texas Hold\'em', this.centerX, SCREEN_HEIGHT * 0.15);
    ctx.font = '20px Arial';
    ctx.fillText('Enter Room Number', this.centerX, SCREEN_HEIGHT * 0.20);

    // Input Display
    ctx.fillStyle = '#000000';
    ctx.fillRect(this.centerX - 100, SCREEN_HEIGHT * 0.25, 200, 50);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '30px Courier New';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.roomInput.padEnd(4, '_').split('').join(' '), this.centerX, SCREEN_HEIGHT * 0.25 + 25);
    ctx.textBaseline = 'alphabetic';

    // Keypad
    this.keys.forEach((key, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      const x = this.startX + col * (this.keyWidth + this.gap);
      const y = this.startY + row * (this.keyHeight + this.gap);

      ctx.fillStyle = '#444444';
      if (key === 'OK') ctx.fillStyle = '#228B22'; // Green for OK
      if (key === 'Del') ctx.fillStyle = '#B22222'; // Red for Del
      
      this.roundRect(ctx, x, y, this.keyWidth, this.keyHeight, 5);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key, x + this.keyWidth / 2, y + this.keyHeight / 2);
    });
    ctx.textBaseline = 'alphabetic';
    
    // Back Button
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(this.backBtnX + this.backBtnRadius, this.backBtnY, this.backBtnRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('<', this.backBtnX + this.backBtnRadius, this.backBtnY);
    ctx.textBaseline = 'alphabetic';
  }

  async touchHandler(x, y) {
      // Check Back Button
      const dxBack = x - (this.backBtnX + this.backBtnRadius);
      const dyBack = y - this.backBtnY;
      if (dxBack * dxBack + dyBack * dyBack <= this.backBtnRadius * this.backBtnRadius) {
          return { action: 'back' };
      }

      // Check Keypad
      for (let i = 0; i < this.keys.length; i++) {
          const row = Math.floor(i / 3);
          const col = i % 3;
          const kx = this.startX + col * (this.keyWidth + this.gap);
          const ky = this.startY + row * (this.keyHeight + this.gap);
          
          if (x >= kx && x <= kx + this.keyWidth &&
              y >= ky && y <= ky + this.keyHeight) {
              return await this.handleInput(this.keys[i]);
          }
      }
      return null;
  }

  async handleInput(key) {
      if (key === 'Del') {
          this.roomInput = this.roomInput.slice(0, -1);
      } else if (key === 'OK') {
          if (this.roomInput.length === 4) {
              return await this.joinOrCreateRoom();
          }
      } else {
          if (this.roomInput.length < 4) {
              this.roomInput += key;
          }
      }
      return null;
  }

  async joinOrCreateRoom() {
      // Logic to check room
      const user = UserManager.getInstance().getCurrentUser();
      const myName = user ? user.nickName : ('Player_' + Math.floor(Math.random() * 100));
      const myAvatar = user ? user.avatarUrl : null;
      
      const userInfo = { name: myName, avatarUrl: myAvatar };

      // Try to join first
      wx.showLoading({ title: 'Joining...' });
      let result = await this.manager.joinRoom(this.roomInput, userInfo);
      
      if (!result.success) {
          if (result.message === 'Room not found') {
               // Create
               wx.showLoading({ title: 'Creating...' });
               result = await this.manager.createRoom(userInfo, this.roomInput);
          } else {
              wx.hideLoading();
              // Show error (Room full, etc.)
              wx.showToast({
                  title: result.message || 'Error',
                  icon: 'none'
              });
              return null;
          }
      }
      
      wx.hideLoading();
      if (result.success) {
          return { action: 'enter_game', room: result.room, userId: result.userId, docId: result.docId };
      }
      return null;
  }
  
  roundRect(ctx, x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
  }
}
