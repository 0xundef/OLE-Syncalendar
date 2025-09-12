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
        
        // Store data in Chrome storage (keep only latest 2 requests)
        chrome.storage.local.get(['interceptedRequests'], (result) => {
            const existingData = result.interceptedRequests || [];
            
            // Check if there's a previous request to compare with
            let hasChanges = false;
            let changeDetails = null;
            if (existingData.length > 0) {
                const previousData = existingData[existingData.length - 1];
                // Parse and compare calendar events as sets
                const comparison = compareCalendarEvents(previousData.responseData, requestData.responseData);
                hasChanges = comparison.hasChanges;
                changeDetails = comparison.details;
            }
            
            existingData.push(requestData);
            
            // Keep only the latest 2 requests
            const latestRequests = existingData.slice(-2);
            
            chrome.storage.local.set({
                interceptedRequests: latestRequests
            }, () => {
                // Data has changed, but notification is removed as it's not needed
                // We still prepare the message for logging purposes
                if (hasChanges && changeDetails) {
                    const { added, removed } = changeDetails;
                    let message = 'Calendar data updated: ';
                    
                    if (added.length > 0 && removed.length > 0) {
                        message += `${added.length} added, ${removed.length} removed`;
                    } else if (added.length > 0) {
                        message += `${added.length} new event(s) added`;
                    } else if (removed.length > 0) {
                        message += `${removed.length} event(s) removed`;
                    }
                    
                    // Log the update instead of showing a notification
                    console.log('Calendar update:', message);
                }
                
                // Send message to popup if it's open
                chrome.runtime.sendMessage({
                    type: 'DATA_INTERCEPTED',
                    data: requestData,
                    hasChanges: hasChanges,
                    changeDetails: changeDetails
                }).catch(() => {
                    // Popup might not be open, ignore error
                });
            });
        });
    }
});

// Function to compare calendar events
function compareCalendarEvents(previousData, currentData) {
    try {
        // Parse JSON responses
        const prevEvents = JSON.parse(previousData);
        const currEvents = JSON.parse(currentData);
        
        // Convert to sets for comparison
        const prevSet = new Set(prevEvents.map(event => JSON.stringify(event)));
        const currSet = new Set(currEvents.map(event => JSON.stringify(event)));
        
        // Find differences
        const added = [...currSet].filter(event => !prevSet.has(event)).map(e => JSON.parse(e));
        const removed = [...prevSet].filter(event => !currSet.has(event)).map(e => JSON.parse(e));
        
        const hasChanges = added.length > 0 || removed.length > 0;
        
        return {
            hasChanges,
            details: {
                added,
                removed,
                totalPrevious: prevEvents.length,
                totalCurrent: currEvents.length
            }
        };
    } catch (error) {
        console.warn('⚠️ Error comparing calendar events:', error);
        // Fallback to string comparison
        return {
            hasChanges: previousData !== currentData,
            details: { error: 'Failed to parse JSON, used string comparison' }
        };
    }
}

console.log('🚀 HKMU Calendar Interceptor: Ready to monitor requests!');
console.log('👂 Content script listening for postMessage events...');