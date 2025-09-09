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
                console.log('🎯 HKMU Interceptor: Detected XHR request to', this._interceptUrl);
                
                const originalOnReadyStateChange = this.onreadystatechange;
                
                this.onreadystatechange = function() {
                    if (this.readyState === 4) {
                        console.log('HKMU Calendar Data Intercepted:', this.responseText);
                        
                        // Store intercepted data in Chrome storage
                        const requestData = {
                            url: this._interceptUrl,
                            method: this._interceptMethod,
                            timestamp: new Date().toISOString(),
                            responseData: this.responseText,
                            status: this.status,
                            statusText: this.statusText
                        };
                        
                        // Save to Chrome storage
                        chrome.storage.local.get(['interceptedRequests'], (result) => {
                            const existingData = result.interceptedRequests || [];
                            existingData.push(requestData);
                            
                            chrome.storage.local.set({
                                interceptedRequests: existingData
                            }, () => {
                                console.log('Data saved to Chrome storage');
                                
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
                                console.log('HKMU Calendar Data Intercepted:', textData);
                                
                                // Store intercepted data in Chrome storage
                                const requestData = {
                                    url: url,
                                    method: method,
                                    timestamp: new Date().toISOString(),
                                    responseData: textData,
                                    status: response.status,
                                    statusText: response.statusText
                                };
                                
                                // Save to Chrome storage
                                chrome.storage.local.get(['interceptedRequests'], (result) => {
                                    const existingData = result.interceptedRequests || [];
                                    existingData.push(requestData);
                                    
                                    chrome.storage.local.set({
                                        interceptedRequests: existingData
                                    }, () => {
                                        console.log('Data saved to Chrome storage');
                                        
                                        // Send message to popup if it's open
                                        chrome.runtime.sendMessage({
                                            type: 'DATA_INTERCEPTED',
                                            data: requestData
                                        }).catch(() => {
                                            // Popup might not be open, ignore error
                                        });
                                    });
                                });
                            })
                            .catch(error => {

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

                
                // Create the duplicate button as an anchor tag
                const duplicateButton = document.createElement('a');
                duplicateButton.href = '#';
                duplicateButton.id = 'btnCustomAction';
                duplicateButton.className = originalButton.className; // Copy all classes
                duplicateButton.style.cssText = originalButton.style.cssText; // Copy all inline styles
                
                // Create the icon span
                const iconSpan = document.createElement('span');
                iconSpan.className = 'ui-icon ui-icon-gear';
                
                // Add the icon and text
                duplicateButton.appendChild(iconSpan);
                duplicateButton.appendChild(document.createTextNode('Custom Action'));
                
                // Add empty click handler (to be filled later)
                duplicateButton.onclick = function(e) {
                    e.preventDefault();
                    // Custom Action button clicked - function to be implemented
                    // Empty function - user will fill this later
                };
                
                // Add proper spacing to match the gap between other buttons
                duplicateButton.style.marginLeft = '5px';
                
                // Insert the button next to the original
                originalButton.parentNode.insertBefore(duplicateButton, originalButton.nextSibling);
                

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
    
})();