import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import UserManager from './user-manager';

export default class HomePage {
  constructor() {
    this.btnWidth = 200;
    this.btnHeight = 60;
    this.btnX = (SCREEN_WIDTH - this.btnWidth) / 2;
    
    // Stack buttons in center
    this.diceBtnY = SCREEN_HEIGHT / 2 - this.btnHeight - 15;
    this.pokerBtnY = SCREEN_HEIGHT / 2 + 15;
  }

  render(ctx) {
    // 绘制标题
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CPDD 小游戏', SCREEN_WIDTH / 2, SCREEN_HEIGHT * 0.25);

    // Dice Button
    this.drawButton(ctx, this.btnX, this.diceBtnY, '几个几', '#1E90FF');

    // Poker Button
    this.drawButton(ctx, this.btnX, this.pokerBtnY, '德扑', '#DC143C');
  }

  drawButton(ctx, x, y, text, color) {
    // 阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.roundRect(ctx, x + 4, y + 4, this.btnWidth, this.btnHeight, 10, true, false);
    
    // 按钮本体
    ctx.fillStyle = color;
    this.roundRect(ctx, x, y, this.btnWidth, this.btnHeight, 10, true, false);

    // 按钮文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + this.btnWidth / 2, y + this.btnHeight / 2);
    
    // 重置基线
    ctx.textBaseline = 'alphabetic';
  }

  async touchHandler(x, y) {
    let target = null;
    if (x >= this.btnX && x <= this.btnX + this.btnWidth) {
        if (y >= this.diceBtnY && y <= this.diceBtnY + this.btnHeight) {
            target = 'dice_game';
        } else if (y >= this.pokerBtnY && y <= this.pokerBtnY + this.btnHeight) {
            target = 'poker_menu';
        }
    }

    if (target) {
        const um = UserManager.getInstance();
        const user = um.getCurrentUser();
        
        if (!user) {
             wx.showToast({ title: 'Logging in...', icon: 'none' });
             try {
                 await um.login();
             } catch (e) {
                 wx.showToast({ title: 'Login Failed', icon: 'none' });
                 return null;
             }
        }
        
        // Check if we need to fetch info
        const currentUser = um.getCurrentUser();
        const needsInfo = !currentUser.avatarUrl || currentUser.nickName.startsWith('Player_');
        
        if (needsInfo) {
            try {
                await um.requireUserInfo();
                return target;
            } catch (e) {
                wx.showToast({ title: 'Auth Required', icon: 'none' });
                return null;
            }
        }
        return target;
    }
    return null;
  }

  // 辅助函数：绘制圆角矩形
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
}
