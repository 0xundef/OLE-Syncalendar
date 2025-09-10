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

    
    // Function to create duplicate button
    function createDuplicateButton() {

        
        const checkForButton = setInterval(() => {
            const originalButton = document.querySelector('#btnStudentAlertSetting');
            
            if (originalButton && !document.getElementById('btnCustomAction')) {

                
                // Create duplicate button
                const duplicateBtn = document.createElement('button');
                duplicateBtn.textContent = '📋 Duplicate Calendar';
                duplicateBtn.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 10px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                `;
                
                duplicateBtn.addEventListener('click', function() {
                    // This could trigger additional calendar data requests
                    window.location.reload();
                });
                
                document.body.appendChild(duplicateBtn);
                

                clearInterval(checkForButton);
            }
        }, 500); // Check every 500ms
        
        // Stop checking after 10 seconds to avoid infinite loop
        setTimeout(() => {
            clearInterval(checkForButton);
        }, 10000);
    }
    
    // Start creating the duplicate button when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createDuplicateButton);
    } else {
        createDuplicateButton();
    }
    } catch (error) {
        // Ignore setup errors
    }
})();