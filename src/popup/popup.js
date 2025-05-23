document.addEventListener('DOMContentLoaded', function() {
    // DOM 요소
    const currentIPElement = document.getElementById('current-ip');
    const ipStatusElement = document.getElementById('ip-status');
    const checkIPButton = document.getElementById('check-ip');
    const newIPInput = document.getElementById('new-ip');
    const addIPButton = document.getElementById('add-ip');
    const addCurrentIPButton = document.getElementById('add-current-ip');
    const ipListElement = document.getElementById('ip-list');
    const newSiteInput = document.getElementById('new-site');
    const addSiteButton = document.getElementById('add-site');
    const addCurrentSiteButton = document.getElementById('add-current-site');
    const siteListElement = document.getElementById('site-list');
    const extensionStatusElement = document.getElementById('extension-status');
    const extensionToggle = document.getElementById('extension-toggle');
    const disableMessage = document.getElementById('disable-message');
    const disablePermanently = document.getElementById('disable-permanently');
    
    let currentSettings = null;
    let currentIP = null;
    
    // 초기 데이터 로드
    loadData();
    
    // IP 및 설정 데이터 로드
    function loadData() {
        chrome.runtime.sendMessage({ action: 'checkIp' }, function(response) {
            if (response) {
                currentIP = response.ip;
                currentSettings = response.settings;
                updateUI(response);
                
                // 확장 프로그램 활성화 상태 업데이트
                updateExtensionStatus(response.settings.enabled);
            }
        });
    }
    
    // UI 업데이트
    function updateUI(data) {
        // 현재 IP 표시
        currentIPElement.textContent = data.ip;
        
        // IP 상태 표시
        if (data.monitored) {
            ipStatusElement.textContent = 'Listed';
            ipStatusElement.className = 'status safe';
        } else {
            ipStatusElement.textContent = 'Not Listed';
            ipStatusElement.className = 'status monitored';
        }
        
        // 모니터링 IP 목록 표시
        renderIPList(data.settings.monitoredIPs);
        
        // 차단 사이트 목록 표시
        renderSiteList(data.settings.blockedSites);
    }
    
    // 확장 프로그램 상태 업데이트
    function updateExtensionStatus(enabled) {
        if (enabled === true) {
            extensionStatusElement.textContent = 'ON';
            extensionStatusElement.className = 'active';
            extensionToggle.checked = true;
            disableMessage.style.display = 'none';
        } else if (enabled === false) {
            extensionStatusElement.textContent = 'OFF';
            extensionStatusElement.className = 'inactive-permanent';
            extensionToggle.checked = false;
            disableMessage.style.display = 'none';
        } else if (enabled === 'temporary') {
            extensionStatusElement.textContent = 'OFF';
            extensionStatusElement.className = 'inactive';
            extensionToggle.checked = false;
            disableMessage.style.display = 'block';
        }
    }
    
    // IP 목록 렌더링
    function renderIPList(ips) {
        ipListElement.innerHTML = '';
        ips.forEach(ip => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${ip}</span>
                <button class="delete-btn" data-ip="${ip}">×</button>
            `;
            ipListElement.appendChild(li);
        });
        
        // 삭제 버튼 이벤트 핸들러
        document.querySelectorAll('.delete-btn[data-ip]').forEach(button => {
            button.addEventListener('click', function() {
                const ip = this.getAttribute('data-ip');
                chrome.runtime.sendMessage(
                    { action: 'removeMonitoredIP', ip: ip }, 
                    () => loadData()
                );
            });
        });
    }
    
    // 사이트 목록 렌더링
    function renderSiteList(sites) {
        siteListElement.innerHTML = '';
        sites.forEach(site => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${site}</span>
                <button class="delete-btn" data-site="${site}">×</button>
            `;
            siteListElement.appendChild(li);
        });
        
        // 삭제 버튼 이벤트 핸들러
        document.querySelectorAll('.delete-btn[data-site]').forEach(button => {
            button.addEventListener('click', function() {
                const site = this.getAttribute('data-site');
                chrome.runtime.sendMessage(
                    { action: 'removeBlockedSite', site: site }, 
                    () => loadData()
                );
            });
        });
    }
    
    // 확장 프로그램 토글 이벤트
    extensionToggle.addEventListener('change', function() {
        if (this.checked) {
            // 확장 프로그램 활성화
            chrome.runtime.sendMessage({ action: 'enableExtension' }, () => {
                updateExtensionStatus(true);
                updateBlockingRules();
            });
        } else {
            // 확장 프로그램 일시적으로 비활성화 (1시간)
            chrome.runtime.sendMessage({ action: 'disableExtensionTemporary' }, () => {
                updateExtensionStatus('temporary');
            });
        }
    });
    
    // 영구 비활성화 이벤트
    disablePermanently.addEventListener('click', function(e) {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: 'disableExtensionPermanently' }, () => {
            updateExtensionStatus(false);
        });
    });
    
    // IP 확인 버튼 클릭 이벤트
    checkIPButton.addEventListener('click', function() {
        ipStatusElement.textContent = 'Checking...';
        ipStatusElement.className = 'status';
        loadData();
    });
    
    // IP 추가 버튼 클릭 이벤트
    addIPButton.addEventListener('click', function() {
        const ip = newIPInput.value.trim();
        if (ip) {
            chrome.runtime.sendMessage(
                { action: 'addMonitoredIP', ip: ip }, 
                () => {
                    newIPInput.value = '';
                    loadData();
                }
            );
        }
    });
    
    // 현재 IP 추가 버튼 클릭 이벤트
    addCurrentIPButton.addEventListener('click', function() {
        if (currentIP) {
            chrome.runtime.sendMessage(
                { action: 'addMonitoredIP', ip: currentIP }, 
                () => loadData()
            );
        }
    });
    
    // 사이트 추가 버튼 클릭 이벤트
    addSiteButton.addEventListener('click', function() {
        const site = newSiteInput.value.trim();
        if (site) {
            chrome.runtime.sendMessage(
                { action: 'addBlockedSite', site: site }, 
                () => {
                    newSiteInput.value = '';
                    loadData();
                }
            );
        }
    });
    
    // 현재 사이트 추가 버튼 클릭 이벤트
    addCurrentSiteButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'getCurrentSite' }, function(response) {
            if (response && response.domain) {
                chrome.runtime.sendMessage(
                    { action: 'addBlockedSite', site: response.domain }, 
                    () => loadData()
                );
            }
        });
    });
    
    // 엔터 키로 IP 추가
    newIPInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addIPButton.click();
        }
    });
    
    // 엔터 키로 사이트 추가
    newSiteInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addSiteButton.click();
        }
    });
});