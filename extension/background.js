// The service worker: saves the games content.js records, and retries games that couldn't save
// (offline, or signed out) every few minutes, when Chrome starts, and right after signing in.
importScripts('config.js', 'account.js');

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type === 'game') {
    ZM_ACCOUNT.save(message.row).then(reply, err => reply({ saved: false, reason: err.message }));
    return true;  // the reply comes later
  }
  if (message?.type === 'flush') {
    ZM_ACCOUNT.flush().then(() => reply({}), () => reply({}));
    return true;
  }
});

chrome.alarms.create('retry', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(() => ZM_ACCOUNT.flush());
chrome.runtime.onStartup.addListener(() => ZM_ACCOUNT.flush());
