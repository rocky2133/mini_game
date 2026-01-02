import './render'; // 初始化Canvas
import BackGround from './runtime/background'; // 导入背景类
import DataBus from './databus'; // 导入数据类
import DiceGame from './runtime/dice-game'; // 导入骰子游戏逻辑
import HomePage from './runtime/home-page'; // 导入首页逻辑
import PokerMenu from './runtime/poker/poker-menu'; // 导入德州扑克菜单
import PokerGame from './runtime/poker/poker-game'; // 导入德州扑克游戏
import UserManager from './runtime/user-manager'; // 导入用户管理器

const ctx = canvas.getContext('2d');

GameGlobal.databus = new DataBus();

/**
 * 游戏主函数
 */
export default class Main {
  aniId = 0;
  bg = new BackGround();
  diceGame = new DiceGame();
  homePage = new HomePage();
  pokerMenu = new PokerMenu();
  pokerGame = new PokerGame();

  currentScene = 'home'; // home, dice_game, poker_menu, poker_game

  constructor() {
    // Attempt Login on startup
    UserManager.getInstance().login().then(user => {
        console.log('User Logged In:', user);
    });

    wx.onTouchStart((e) => {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      
      if (this.currentScene === 'home') {
        const action = this.homePage.touchHandler(x, y);
        if (action === 'dice_game') {
          this.currentScene = 'dice_game';
        } else if (action === 'poker_menu') {
          this.currentScene = 'poker_menu';
        }
      } else if (this.currentScene === 'dice_game') {
        const action = this.diceGame.touchHandler(x, y);
        if (action === 'back') {
            this.confirmBack();
        }
      } else if (this.currentScene === 'poker_menu') {
          const resultOrPromise = this.pokerMenu.touchHandler(x, y);
          Promise.resolve(resultOrPromise).then(result => {
              if (result) {
                  if (result.action === 'back') {
                      this.currentScene = 'home';
                  } else if (result.action === 'enter_game') {
                      this.pokerGame.init(result.room, result.userId, result.docId);
                      this.currentScene = 'poker_game';
                  }
              }
          });
      } else if (this.currentScene === 'poker_game') {
          const resultOrPromise = this.pokerGame.touchHandler(x, y);
          Promise.resolve(resultOrPromise).then(action => {
              if (action === 'back') {
                  this.confirmBack('Return to Room Menu?');
              } else if (action === 'quit_game') {
                  this.currentScene = 'poker_menu';
              }
          });
      }
    });

    wx.onTouchMove((e) => {
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        if (this.currentScene === 'poker_game') {
            this.pokerGame.handleTouchMove(x, y);
        }
    });

    wx.onTouchEnd((e) => {
        const x = e.changedTouches[0].clientX;
        const y = e.changedTouches[0].clientY;
        if (this.currentScene === 'poker_game') {
            this.pokerGame.handleTouchEnd(x, y);
        }
    });

    this.start();
  }

  confirmBack(content = 'Return to Main Menu?') {
      wx.showModal({
          title: 'Confirm',
          content: content,
          success: (res) => {
        if (res.confirm) {
          if (this.currentScene === 'poker_game') {
            this.pokerGame.quit();
            this.currentScene = 'poker_menu';
          } else {
            this.currentScene = 'home';
          }
        }
      }
      });
  }

  start() {
    GameGlobal.databus.reset();
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background handling
    if (this.currentScene !== 'poker_menu' && this.currentScene !== 'poker_game') {
         this.bg.render(ctx);
    }

    if (this.currentScene === 'home') {
        this.homePage.render(ctx);
    } else if (this.currentScene === 'dice_game') {
        this.diceGame.render(ctx);
    } else if (this.currentScene === 'poker_menu') {
        this.pokerMenu.render(ctx);
    } else if (this.currentScene === 'poker_game') {
        this.pokerGame.render(ctx);
    }
  }

  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }
    GameGlobal.databus.frame++;
    
    if (this.currentScene !== 'poker_menu' && this.currentScene !== 'poker_game') {
        this.bg.update();
    }
    
    if (this.currentScene === 'dice_game') {
        this.diceGame.update();
    } else if (this.currentScene === 'poker_game') {
        this.pokerGame.update();
    }
  }

  loop() {
    this.update();
    this.render();
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}
