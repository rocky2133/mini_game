/**
 * 骰子绘制类
 */
export default class Dice {
  constructor() {
    this.value = 1;
  }

  setValue(val) {
    this.value = val;
  }

  /**
   * 绘制骰子
   * @param {CanvasContext} ctx 
   * @param {number} x 中心点x
   * @param {number} y 中心点y
   * @param {number} size 边长
   */
  render(ctx, x, y, size) {
    const r = size / 10; // 圆角半径
    const dotSize = size / 10; // 点的大小

    // 绘制背景（圆角矩形）
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制点
    const dots = this.getDotPositions(this.value);
    dots.forEach(pos => {
      ctx.beginPath();
      ctx.arc(pos.x * size, pos.y * size, dotSize, 0, Math.PI * 2);
      
      // 1点和4点为红色
      if (this.value === 1 || this.value === 4) {
          ctx.fillStyle = '#ff0000';
      } else {
          ctx.fillStyle = '#000000';
      }
      
      ctx.fill();
    });

    ctx.restore();
  }

  getDotPositions(value) {
    // 归一化坐标 (0-1)
    const c = 0.5;
    const l = 0.25;
    const r = 0.75;
    const t = 0.25;
    const b = 0.75;

    switch (value) {
      case 1: return [{x: c, y: c}];
      case 2: return [{x: l, y: t}, {x: r, y: b}];
      case 3: return [{x: l, y: t}, {x: c, y: c}, {x: r, y: b}];
      case 4: return [{x: l, y: t}, {x: r, y: t}, {x: l, y: b}, {x: r, y: b}];
      case 5: return [{x: l, y: t}, {x: r, y: t}, {x: c, y: c}, {x: l, y: b}, {x: r, y: b}];
      case 6: return [{x: l, y: t}, {x: r, y: t}, {x: l, y: c}, {x: r, y: c}, {x: l, y: b}, {x: r, y: b}];
      default: return [];
    }
  }
}
