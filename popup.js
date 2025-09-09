// Popup script for XHR Request Interceptor

console.log('XHR Interceptor: Popup script loaded');

// DOM elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const toggleBtn = document.getElementById('toggleBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const totalRequests = document.getElementById('totalRequests');
const todayRequests = document.getElementById('todayRequests');
const requestsList = document.getElementById('requestsList');
const emptyState = document.getElementById('emptyState');

// Simple state tracking
let isEnabled = true;

// Initialize popup
async function initialize() {
  try {
    // Load and display data
    await loadRequestData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update UI
    updateUI();
    
    console.log('XHR Interceptor: Popup initialized');
  } catch (error) {
    console.error('XHR Interceptor: Failed to initialize popup', error);
  }
}

// Load request data from storage
async function loadRequestData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['interceptedRequests'], (result) => {
      const requests = result.interceptedRequests || [];
      displayRequestData(requests);
      updateStats(requests);
      resolve();
    });
  });
}

// Display request data in the UI
function displayRequestData(requests) {
  if (requests.length === 0) {
    requestsList.innerHTML = '<div class="empty-state">No requests intercepted yet.</div>';
    return;
  }
  
  // Show only the last 10 requests in popup
  const recentRequests = requests.slice(-10).reverse();
  
  const requestsHTML = recentRequests.map(request => {
    const method = request.method || 'UNKNOWN';
    const url = request.url || 'Unknown URL';
    const time = new Date(request.timestamp).toLocaleTimeString();
    const status = request.responseStatus ? ` (${request.responseStatus})` : '';
    
    return `
      <div class="request-item" title="${url}">
        <span class="request-method method-${method}">${method}</span>
        <div class="request-url">${truncateUrl(url)}${status}</div>
        <div class="request-time">${time}</div>
      </div>
    `;
  }).join('');
  
  requestsList.innerHTML = requestsHTML;
}

// Update statistics
function updateStats(requests) {
  const total = requests.length;
  const today = requests.filter(request => {
    const requestDate = new Date(request.timestamp).toDateString();
    const todayDate = new Date().toDateString();
    return requestDate === todayDate;
  }).length;
  
  totalRequests.textContent = total;
  todayRequests.textContent = today;
}

// Truncate URL for display
function truncateUrl(url, maxLength = 40) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

// Update UI based on current state
function updateUI() {
  // Update status
  if (isEnabled) {
    statusDot.classList.remove('inactive');
    statusText.textContent = 'Active';
    toggleBtn.textContent = 'Disable';
    toggleBtn.classList.add('danger');
    toggleBtn.classList.remove('primary');
  } else {
    statusDot.classList.add('inactive');
    statusText.textContent = 'Inactive';
    toggleBtn.textContent = 'Enable';
    toggleBtn.classList.add('primary');
    toggleBtn.classList.remove('danger');
  }
}

// Set up event listeners
function setupEventListeners() {
  // Toggle interceptor
  toggleBtn.addEventListener('click', async () => {
    isEnabled = !isEnabled;
    updateUI();
  });
  
  // Clear data
  clearBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all intercepted data?')) {
      await clearAllData();
      await loadRequestData();
    }
  });
  
  // Export data
  exportBtn.addEventListener('click', async () => {
    await exportData();
  });
  
  // Auto-refresh data every 2 seconds
  setInterval(async () => {
    await loadRequestData();
  }, 2000);
}



// Clear all intercepted data
async function clearAllData() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['interceptedRequests'], () => {
      console.log('XHR Interceptor: All data cleared');
      resolve();
    });
  });
}

// Export data to JSON file
async function exportData() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['interceptedRequests'], resolve);
    });
    
    const requests = result.interceptedRequests || [];
    
    if (requests.length === 0) {
      alert('No data to export');
      return;
    }
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalRequests: requests.length,
      requests: requests
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const filename = `xhr-interceptor-data-${new Date().toISOString().split('T')[0]}.json`;
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    URL.revokeObjectURL(url);
    
    console.log('XHR Interceptor: Data exported', filename);
  } catch (error) {
    console.error('XHR Interceptor: Export failed', error);
    alert('Failed to export data. Check console for details.');
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'DATA_UPDATED') {
    loadRequestData();
    sendResponse({ success: true });
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

console.log('XHR Interceptor: Popup script initialized');