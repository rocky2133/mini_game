import Main from './js/main';

if (typeof wx !== 'undefined' && wx.cloud) {
    wx.cloud.init({
        traceUser: true,
        // env: 'your-env-id' // Optional: specify environment ID
    });
}

new Main();
