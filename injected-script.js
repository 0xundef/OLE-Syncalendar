(function() {
    'use strict';
    
    console.log('🔧 HKMU Calendar Interceptor: Script loaded at', new Date().toISOString());
    
    // Target URL patterns to intercept
    const targetUrl = 'https://schedule.hkmu.edu.hk/ScheduleTool-war/main/calendar/sas_events.jsp';
    
    function isTargetUrl(url) {
        return url.includes('sas_events.jsp');
    }
    
    // Backup hooking function
    function hookAPIs() {
        console.log('🔄 Hooking/Re-hooking XHR and Fetch APIs...');

        // Hook XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            this._interceptUrl = url;
            this._interceptMethod = method;
            
            console.log('📡 XHR Request:', method, url);
            
            return originalXHROpen.apply(this, arguments);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
            console.log('🚀 XHR Send:', this._interceptMethod, this._interceptUrl);
            
            if (isTargetUrl(this._interceptUrl)) {
                console.log('🎯 HKMU Interceptor: Detected XHR request to', this._interceptUrl);
                
                const originalOnReadyStateChange = this.onreadystatechange;
                
                this.onreadystatechange = function() {
                    if (this.readyState === 4) {
                        console.log('HKMU Calendar Data Intercepted:', this.responseText);
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
            
            console.log('🌐 Fetch Request:', method, url);
            
            if (isTargetUrl(url)) {
                console.log('🎯 HKMU Interceptor: Detected fetch request to', url);
                
                return originalFetch.apply(this, arguments)
                    .then(response => {
                        console.log('✅ HKMU Interceptor: Fetch Response received!');
                        console.log('📊 Response Status:', response.status);
                        console.log('📊 Response Headers:', response.headers);
                        
                        // Clone response to read body without consuming it
                        const responseClone = response.clone();
                        
                        // Try to read and log response data
                        responseClone.text()
                            .then(textData => {
                                console.log('HKMU Calendar Data Intercepted:', textData);
                            })
                            .catch(error => {
                                console.log('❌ Error reading response:', error);
                            });
                        
                        return response;
                    })
                    .catch(error => {
                        console.log('❌ HKMU Interceptor: Fetch error:', error);
                        throw error;
                    });
            }
            
            return originalFetch.apply(this, arguments);
        };
    }

    
    // Initial hook
    hookAPIs();
    console.log('HKMU Calendar Interceptor: Ready');
    
    // Function to create duplicate button
    function createDuplicateButton() {
        console.log('🔍 Searching for original button...');
        
        const checkForButton = setInterval(() => {
            const originalButton = document.querySelector('#btnStudentAlertSetting');
            
            if (originalButton && !document.getElementById('btnCustomAction')) {
                console.log('🔘 Creating duplicate button...');
                
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
                    console.log('🔘 Custom Action button clicked - function to be implemented');
                    // Empty function - user will fill this later
                };
                
                // Add proper spacing to match the gap between other buttons
                duplicateButton.style.marginLeft = '5px';
                
                // Insert the button next to the original
                originalButton.parentNode.insertBefore(duplicateButton, originalButton.nextSibling);
                
                console.log('✅ Duplicate button created successfully');
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