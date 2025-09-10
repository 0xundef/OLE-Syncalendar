(function() {
    'use strict';
    

    
    // Target URL patterns to intercept
    const targetUrl = 'https://schedule.hkmu.edu.hk/ScheduleTool-war/main/calendar/sas_events.jsp';
    
    function isTargetUrl(url) {
        return url.includes('sas_events.jsp');
    }
    
    // Backup hooking function
    function hookAPIs() {


        // Hook XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            this._interceptUrl = url;
            this._interceptMethod = method;
            
            return originalXHROpen.apply(this, arguments);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
            
            if (isTargetUrl(this._interceptUrl)) {
                
                const originalOnReadyStateChange = this.onreadystatechange;
                
                this.onreadystatechange = function() {
                    if (this.readyState === 4) {
                        
                        // Store intercepted data via message passing
                        const requestData = {
                            url: this._interceptUrl,
                            method: this._interceptMethod,
                            timestamp: new Date().toISOString(),
                            responseData: this.responseText,
                            status: this.status,
                            statusText: this.statusText
                        };
                        
                        // Send data to content script via postMessage
                        window.postMessage({
                            type: 'HKMU_INTERCEPTED_DATA',
                            source: 'hkmu-interceptor',
                            data: requestData
                        }, '*');
                    }
                    
                    if (originalOnReadyStateChange) {
                        originalOnReadyStateChange.apply(this, arguments);
                    }
                };
            }
            
            return originalXHRSend.apply(this, arguments);
        };

        
        // Hook fetch API
        const originalFetch = window.fetch;
        
        window.fetch = function(input, init = {}) {
            const url = typeof input === 'string' ? input : input.url;
            const method = init.method || 'GET';
            
            if (isTargetUrl(url)) {
                
                return originalFetch.apply(this, arguments)
                    .then(response => {
                        
                        // Clone response to read body without consuming it
                        const responseClone = response.clone();
                        
                        // Try to read and log response data
                        responseClone.text()
                            .then(textData => {
                                
                                // Store intercepted data via message passing
                                const requestData = {
                                    url: url,
                                    method: method,
                                    timestamp: new Date().toISOString(),
                                    responseData: textData,
                                    status: response.status,
                                    statusText: response.statusText
                                };
                                
                                // Send data to content script via postMessage
                                window.postMessage({
                                    type: 'HKMU_INTERCEPTED_DATA',
                                    source: 'hkmu-interceptor',
                                    data: requestData
                                }, '*');
                            })
                            .catch(error => {
                                // Ignore read errors
                            });
                        
                        return response;
                    })
                    .catch(error => {
                        throw error;
                    });
            }
            
            return originalFetch.apply(this, arguments);
        };
    }

    
    // Initial hook
    hookAPIs();

})();