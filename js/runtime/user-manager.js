
export default class UserManager {
  constructor() {
    this.userInfo = null;
    this.db = wx.cloud.database();
    this.users = this.db.collection('users');
    this.openid = null;
    this.isLoggingIn = false;
  }

  static getInstance() {
    if (!UserManager.instance) {
      UserManager.instance = new UserManager();
    }
    return UserManager.instance;
  }

  async login() {
    if (this.userInfo) return this.userInfo;
    
    // Prevent concurrent login calls
    if (this.isLoggingIn) {
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (!this.isLoggingIn) {
                    clearInterval(check);
                    resolve(this.userInfo);
                }
            }, 100);
        });
    }
    
    this.isLoggingIn = true;

    try {
      // 1. Get OpenID
      if (!this.openid) {
          let storedId = wx.getStorageSync('openid');
          if (storedId && !storedId.startsWith('user_local_')) {
              this.openid = storedId;
          }

          if (!this.openid) {
               try {
                 const { result } = await wx.cloud.callFunction({ name: 'login' });
                 if (result && result.openid) {
                     this.openid = result.openid;
                     wx.setStorageSync('openid', this.openid);
                 } else {
                     throw new Error('Cloud login returned empty openid');
                 }
               } catch (e) {
                  console.error('Cloud login failed', e);
                  throw e;
               }
          }
      }

      // 2. Check DB
      const _ = this.db.command;
      const query = { _openid: this.openid };

      const res = await this.users.where(query).get();

      if (res.data && res.data.length > 0) {
        this.userInfo = res.data[0];
        console.log('User found in DB:', this.userInfo);
      } else {
        // 3. Not found, create default user
        // We defer the "Avatar/Name" collection to the UI layer (Home Page)
        // because we can't pop up a button here in a clean way without context.
        // We create a placeholder user.
        
        const randomNum = Math.floor(Math.random() * 10000);
        const newUser = {
            openid: this.openid,
            nickName: `Player_${randomNum}`,
            avatarUrl: '', // Empty or default
            gender: 0,
            createTime: this.db.serverDate(),
            lastLoginTime: this.db.serverDate(),
            chips: 1000
        };

        const addRes = await this.users.add({ data: newUser });
        this.userInfo = { ...newUser, _id: addRes._id };
        console.log('User registered (Default):', this.userInfo);
      }
      this.isLoggingIn = false;
      return this.userInfo;
    } catch (e) {
      console.error('Login/Auth failed', e);
      this.isLoggingIn = false;
      throw e; // Propagate error, do not allow guest login
    }
  }

  getCurrentUser() {
    return this.userInfo;
  }

  async requireUserInfo() {
    return new Promise((resolve, reject) => {
        wx.getUserProfile({
            desc: '用于完善会员资料',
            success: async (res) => {
                const { nickName, avatarUrl } = res.userInfo;
                if (this.userInfo) {
                    this.userInfo.nickName = nickName;
                    this.userInfo.avatarUrl = avatarUrl;
                    
                    // Update DB
                    try {
                        await this.users.doc(this.userInfo._id).update({
                            data: { nickName, avatarUrl }
                        });
                        console.log('User info updated from WeChat');
                        resolve(this.userInfo);
                    } catch (e) {
                        console.error('DB update failed', e);
                        // Even if DB fails, we resolve with local info so they can play
                        resolve(this.userInfo); 
                    }
                } else {
                    reject(new Error('User not logged in'));
                }
            },
            fail: (err) => {
                console.error('getUserProfile failed', err);
                reject(err);
            }
        });
    });
  }
}

