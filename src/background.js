import { isMonitoredIP } from './utils/ip-checker.js';

// 기본 설정
const DEFAULT_SETTINGS = {
    monitoredIPs: [], // 기본값으로 빈 배열 사용
    blockedSites: [],  // 기본값으로 빈 배열 사용
    enabled: true     // 기본값으로 활성화
};

// 설정 로드
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['ipKillSwitchSettings'], (result) => {
            if (result.ipKillSwitchSettings) {
                resolve(result.ipKillSwitchSettings);
            } else {
                // 기본 설정으로 초기화
                chrome.storage.sync.set({ ipKillSwitchSettings: DEFAULT_SETTINGS });
                resolve(DEFAULT_SETTINGS);
            }
        });
    });
}

// 설정 저장
function saveSettings(settings) {
    return chrome.storage.sync.set({ ipKillSwitchSettings: settings });
}

// IP 확인을 위한 함수
async function getIPAddress() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('IP 주소를 가져오는 중 오류 발생:', error);
        return null;
    }
}

// 규칙을 동적으로 관리
async function updateBlockingRules() {
    const ip = await getIPAddress();
    const settings = await loadSettings();
    
    // 확장 프로그램이 비활성화된 경우 모든 규칙 제거
    if (settings.enabled === false || settings.enabled === 'temporary') {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRuleIds = existingRules.map(rule => rule.id);
        
        if (existingRuleIds.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: existingRuleIds
            });
            console.log('확장 프로그램이 비활성화되었습니다. 모든 규칙이 제거되었습니다.');
        }
        return;
    }
    
    if (isMonitoredIP(ip, settings.monitoredIPs)) {
        // 모니터링 대상 IP에서 접속한 경우, 차단 사이트 규칙 적용
        
        // 기존 규칙 목록 가져오기
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRuleIds = existingRules.map(rule => rule.id);
        
        // 새 규칙 생성
        const newRules = [];
        let ruleId = 1;
        
        for (const site of settings.blockedSites) {
            // 메인 도메인 차단
            newRules.push({
                id: ruleId++,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: `*://${site}/*`,
                    resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'xmlhttprequest', 'websocket']
                }
            });
            
            // 서브도메인 차단
            newRules.push({
                id: ruleId++,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: `*://*.${site}/*`,
                    resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'xmlhttprequest', 'websocket']
                }
            });
        }
        
        // 규칙 업데이트
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: newRules
        });
        
        console.log('차단 규칙이 적용되었습니다. IP:', ip);
    } else {
        // 차단 규칙 모두 제거
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRuleIds = existingRules.map(rule => rule.id);
        
        if (existingRuleIds.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: existingRuleIds
            });
            console.log('안전한 IP입니다. 규칙이 제거되었습니다.');
        }
    }
}

// 임시 비활성화 타이머
let disableTimer = null;

// 메시지 핸들러 등록
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkIp') {
        getIPAddress().then(async (ip) => {
            const settings = await loadSettings();
            const monitored = isMonitoredIP(ip, settings.monitoredIPs);
            
            // 상태 반환 및 규칙 업데이트
            sendResponse({ 
                ip: ip,
                monitored: monitored,  // 여기서는 백엔드 로직 유지 (변수명 변경하지 않음)
                settings: settings
            });
            
            // 규칙 동적 업데이트
            updateBlockingRules();
        });
        return true; // 비동기 응답을 위해 true 반환
    }
    
    else if (message.action === 'enableExtension') {
        // 타이머가 있으면 제거
        if (disableTimer) {
            clearTimeout(disableTimer);
            disableTimer = null;
        }
        
        loadSettings().then(settings => {
            settings.enabled = true;
            return saveSettings(settings);
        }).then(() => {
            updateBlockingRules();
            sendResponse({ success: true });
        });
        return true;
    }
    
    else if (message.action === 'disableExtensionTemporary') {
        loadSettings().then(settings => {
            settings.enabled = 'temporary';
            return saveSettings(settings);
        }).then(() => {
            updateBlockingRules();
            
            // 1시간 후 자동으로 다시 활성화
            if (disableTimer) {
                clearTimeout(disableTimer);
            }
            
            disableTimer = setTimeout(() => {
                loadSettings().then(settings => {
                    settings.enabled = true;
                    return saveSettings(settings);
                }).then(() => {
                    updateBlockingRules();
                    console.log('1시간이 지나 확장 프로그램이 다시 활성화되었습니다.');
                });
            }, 3600000); // 1시간 = 3600000ms
            
            sendResponse({ success: true });
        });
        return true;
    }
    
    else if (message.action === 'disableExtensionPermanently') {
        // 타이머가 있으면 제거
        if (disableTimer) {
            clearTimeout(disableTimer);
            disableTimer = null;
        }
        
        loadSettings().then(settings => {
            settings.enabled = false;
            return saveSettings(settings);
        }).then(() => {
            updateBlockingRules();
            sendResponse({ success: true });
        });
        return true;
    }
    
    else if (message.action === 'getCurrentIp') {
        getIPAddress().then(ip => {
            sendResponse({ ip: ip });
        });
        return true;
    }
    
    else if (message.action === 'getCurrentSite') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs && tabs[0] && tabs[0].url) {
                try {
                    const url = new URL(tabs[0].url);
                    const domain = url.hostname.replace(/^www\./, '');
                    sendResponse({ domain: domain });
                } catch (e) {
                    sendResponse({ domain: null, error: e.message });
                }
            } else {
                sendResponse({ domain: null });
            }
        });
        return true;
    }
    
    else if (message.action === 'addMonitoredIP') {
        loadSettings().then(settings => {
            if (!settings.monitoredIPs.includes(message.ip)) {
                settings.monitoredIPs.push(message.ip);
                return saveSettings(settings);
            }
        }).then(() => {
            updateBlockingRules();
            sendResponse({ success: true });
        });
        return true;
    }
    
    else if (message.action === 'removeMonitoredIP') {
        loadSettings().then(settings => {
            settings.monitoredIPs = settings.monitoredIPs.filter(ip => ip !== message.ip);
            return saveSettings(settings);
        }).then(() => {
            updateBlockingRules();
            sendResponse({ success: true });
        });
        return true;
    }
    
    else if (message.action === 'addBlockedSite') {
        loadSettings().then(settings => {
            if (!settings.blockedSites.includes(message.site)) {
                settings.blockedSites.push(message.site);
                return saveSettings(settings);
            }
        }).then(() => {
            updateBlockingRules();
            sendResponse({ success: true });
        });
        return true;
    }
    
    else if (message.action === 'removeBlockedSite') {
        loadSettings().then(settings => {
            settings.blockedSites = settings.blockedSites.filter(site => site !== message.site);
            return saveSettings(settings);
        }).then(() => {
            updateBlockingRules();
            sendResponse({ success: true });
        });
        return true;
    }
});

// 확장 프로그램 설치 또는 업데이트 시 실행
chrome.runtime.onInstalled.addListener(() => {
    console.log("IP KillSwitch가 설치되었습니다.");
    loadSettings().then(() => updateBlockingRules());
});

// 브라우저가 시작될 때 실행
chrome.runtime.onStartup.addListener(() => {
    updateBlockingRules(); // 브라우저 시작 시 규칙 업데이트
});

// 주기적으로 IP 확인 (1시간마다)
setInterval(updateBlockingRules, 3600000);