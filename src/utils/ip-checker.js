/**
 * 주어진 IP가 모니터링 대상인지 확인합니다.
 * @param {string} currentIP - 현재 IP 주소
 * @param {Array<string>} monitoredIPs - 모니터링 대상 IP 주소 목록
 * @returns {boolean} - IP가 모니터링 대상이면 true, 아니면 false
 */
function isMonitoredIP(currentIP, monitoredIPs) {
    if (!currentIP || !monitoredIPs || !monitoredIPs.length) {
        return false;
    }
    
    return monitoredIPs.includes(currentIP);
}

export { isMonitoredIP };