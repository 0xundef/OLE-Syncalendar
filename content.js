// Content script for HKMU Calendar Interceptor

// Function to inject the interceptor script
function injectScript() {
    console.log('💉 Attempting to inject interceptor script...');
    
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected-script.js');
    script.onload = function() {
        this.remove();
    };
    script.onerror = function() {
        console.error('❌ HKMU Calendar Interceptor: Failed to inject script');
    };
    
    // Inject as early as possible - try multiple targets
    const targets = [document.documentElement, document.head, document.body];
    let injected = false;
    
    for (const target of targets) {
        if (target && !injected) {
            try {
                target.appendChild(script);
                console.log('✅ Script injected into:', target.tagName);
                injected = true;
                break;
            } catch (e) {
                console.warn('⚠️ Failed to inject into', target.tagName, ':', e.message);
            }
        }
    }
    
    if (!injected) {
        console.error('❌ HKMU Calendar Interceptor: No suitable injection target found');
    }
}

// Inject immediately - don't wait for DOM
injectScript();

// Also inject when DOM is ready as backup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🔄 DOM ready - backup injection attempt');
        injectScript();
    });
}

// Additional backup on window load
window.addEventListener('load', () => {
    console.log('🔄 Window loaded - final backup injection attempt');
    injectScript();
});

// Listen for messages from injected script
window.addEventListener('message', function(event) {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) {
        return;
    }
    
    // Check if this is our intercepted data message
    if (event.data && event.data.type === 'HKMU_INTERCEPTED_DATA' && event.data.source === 'hkmu-interceptor') {
        
        const requestData = event.data.data;
        
        // Store data in Chrome storage
        chrome.storage.local.get(['interceptedRequests'], (result) => {
            const existingData = result.interceptedRequests || [];
            existingData.push(requestData);
            
            chrome.storage.local.set({
                interceptedRequests: existingData
            }, () => {
                // Send message to popup if it's open
                chrome.runtime.sendMessage({
                    type: 'DATA_INTERCEPTED',
                    data: requestData
                }).catch(() => {
                    // Popup might not be open, ignore error
                });
            });
        });
    }
});

console.log('🚀 HKMU Calendar Interceptor: Ready to monitor requests!');
console.log('👂 Content script listening for postMessage events...');