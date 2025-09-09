// Popup script for XHR Request Interceptor

console.log('HKMU Calendar Sync: Popup script loaded');

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
    
    console.log('HKMU Calendar Sync: Popup initialized');
  } catch (error) {
    console.error('HKMU Calendar Sync: Failed to initialize popup', error);
  }
}

// Load request data from storage
async function loadRequestData() {
  console.log('=== loadRequestData called ===');
  return new Promise((resolve) => {
    chrome.storage.local.get(['interceptedRequests'], (result) => {
      console.log('Storage get result:', result);
      const requests = result.interceptedRequests || [];
      console.log('Loaded requests count:', requests.length);
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
  
  // Set up debug button
  const debugBtn = document.getElementById('debugBtn');
  if (debugBtn) {
    debugBtn.addEventListener('click', () => {
      console.log('Debug button clicked - calling debugInterceptedData...');
      debugInterceptedData();
      alert('Debug information logged to console. Open Developer Tools (F12) to view.');
    });
  }
  
  // Auto-refresh data every 2 seconds
  setInterval(async () => {
    await loadRequestData();
  }, 2000);
}



// Clear all intercepted data
async function clearAllData() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['interceptedRequests'], () => {
      console.log('HKMU Calendar Sync: All data cleared');
      resolve();
    });
  });
}

// Export data to CSV file for Google Calendar import
async function exportData() {
  console.log('=== exportData called ===');
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['interceptedRequests'], resolve);
    });
    console.log('Export - Storage result:', result);
    
    const requests = result.interceptedRequests || [];
    console.log('Export - Requests count:', requests.length);
    
    if (requests.length === 0) {
      console.log('Export - No requests found, showing alert');
      alert('No data to export');
      return;
    }
    
    // Parse calendar events from intercepted data
    console.log('Export - Calling parseCalendarEvents...');
    const events = parseCalendarEvents(requests);
    console.log('Export - Parsed events:', events);
    
    if (events.length === 0) {
      console.log('Export - No events found, showing alert');
      alert('No calendar events found in intercepted data');
      return;
    }
    
    // Generate CSV content
    const csvContent = generateGoogleCalendarCSV(events);
    
    const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(dataBlob);
    const filename = `hkmu-calendar-events-${new Date().toISOString().split('T')[0]}.csv`;
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    URL.revokeObjectURL(url);
    
    console.log('HKMU Calendar: Events exported to CSV', filename, `${events.length} events`);
    alert(`Successfully exported ${events.length} calendar events to CSV format for Google Calendar import.`);
  } catch (error) {
    console.error('HKMU Calendar: Export failed', error);
    alert('Failed to export calendar data. Check console for details.');
  }
}

// Parse calendar events from intercepted HKMU data
function parseCalendarEvents(requests) {
    console.log('🔍 Parsing calendar events from requests:', requests);
    
    let allEvents = [];
    
    requests.forEach((request, index) => {
        console.log(`📋 Processing request ${index + 1}:`, request);
        
        if (request.responseData) {
            try {
                let data;
                
                // Try to parse as JSON first
                if (typeof request.responseData === 'string') {
                    try {
                        data = JSON.parse(request.responseData);
                        console.log('✅ Successfully parsed JSON data:', data);
                    } catch (jsonError) {
                        console.log('⚠️ Not valid JSON, treating as text:', jsonError.message);
                        data = request.responseData;
                    }
                } else {
                    data = request.responseData;
                }
                
                // Extract events from the data
                let events = [];
                
                if (Array.isArray(data)) {
                    console.log('📊 Data is an array with', data.length, 'items');
                    events = data;
                } else if (data && typeof data === 'object') {
                    console.log('📊 Data is an object, checking for events array');
                    // Look for common event array properties
                    if (data.events) events = data.events;
                    else if (data.items) events = data.items;
                    else if (data.data) events = data.data;
                    else if (data.results) events = data.results;
                    else {
                        console.log('🔍 No standard event array found, treating object as single event');
                        events = [data];
                    }
                } else if (typeof data === 'string') {
                    console.log('📝 Data is text, attempting to extract event information');
                    // Try to extract event information from text
                    const lines = data.split('\n');
                    // This is a basic text parser - you may need to customize based on actual format
                    events = lines.filter(line => line.trim()).map(line => ({ title: line.trim() }));
                }
                
                console.log('🎯 Extracted events:', events);
                
                // Transform HKMU events to Google Calendar format
                if (events && events.length > 0) {
                    const transformedEvents = transformHKMUEvents(events);
                    allEvents = allEvents.concat(transformedEvents);
                }
                
            } catch (error) {
                console.error('❌ Error parsing request data:', error);
                console.log('📄 Raw data that caused error:', request.responseData);
            }
        } else {
            console.log('⚠️ No responseData found in request:', request);
        }
    });
    
    console.log('🎉 Total events found:', allEvents.length);
    console.log('📋 All events:', allEvents);
    
    return allEvents;
}

// Transform HKMU event format to Google Calendar compatible format
function transformHKMUEvents(hkmuEvents) {
    const transformedEvents = [];
    
    // Tracking counters
    let originalEventsProcessed = 0;
    let totalActiveDaysFound = 0;
    let totalRecurringEventsGenerated = 0;
    let eventsWithMultipleDays = 0;
    
    console.log('🚀 Starting transformation of', hkmuEvents.length, 'original HKMU events');
    
    hkmuEvents.forEach((event, index) => {
        originalEventsProcessed++;
        console.log(`\n🔄 [${index + 1}/${hkmuEvents.length}] Transforming HKMU event:`, event.eventTitle || 'Untitled');
        
        // Check if this is HKMU format (has eventTitle and date components)
        if (event.eventTitle && event.startDate_yr) {
            // Get the days when this event occurs
            const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const activeDays = daysOfWeek.filter(day => event[day] === 'Y');
            
            totalActiveDaysFound += activeDays.length;
            if (activeDays.length > 1) {
                eventsWithMultipleDays++;
            }
            
            console.log('📅 Event occurs on', activeDays.length, 'days:', activeDays);
            
            // Create events for each active day
            let eventsForThisOriginal = 0;
            activeDays.forEach(dayName => {
                const dayIndex = daysOfWeek.indexOf(dayName);
                console.log(`  📍 Processing day: ${dayName} (index: ${dayIndex})`);
                
                // Calculate the actual date for this day of week
                const startDate = new Date(
                    parseInt(event.startDate_yr),
                    parseInt(event.startDate_mth) - 1, // Month is 0-based
                    parseInt(event.startDate_day)
                );
                
                const endDate = new Date(
                    parseInt(event.endDate_yr),
                    parseInt(event.endDate_mth) - 1,
                    parseInt(event.endDate_day)
                );
                
                console.log(`  📅 Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
                
                // Find the first occurrence of this day of week in the date range
                // JavaScript: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6
                // Our array: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
                const jsDay = dayIndex === 6 ? 0 : dayIndex + 1; // Convert our index to JavaScript day
                
                let currentDate = new Date(startDate);
                while (currentDate.getDay() !== jsDay && currentDate <= endDate) {
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                
                let weeklyEventsForThisDay = 0;
                // Create recurring events for this day of week
                while (currentDate <= endDate) {
                    const eventStartTime = new Date(currentDate);
                    eventStartTime.setHours(
                        parseInt(event.startDate_hour),
                        parseInt(event.startDate_min),
                        0,
                        0
                    );
                    
                    const eventEndTime = new Date(currentDate);
                    eventEndTime.setHours(
                        parseInt(event.endDate_hour),
                        parseInt(event.endDate_min),
                        0,
                        0
                    );
                    
                    const transformedEvent = {
                        subject: event.eventTitle,
                        startDate: eventStartTime,
                        startTime: eventStartTime,
                        endDate: eventEndTime,
                        endTime: eventEndTime,
                        allDayEvent: 'False',
                        description: event.eventDesc || '',
                        location: event.venue || '',
                        private: 'True'
                    };
                    
                    transformedEvents.push(transformedEvent);
                    eventsForThisOriginal++;
                    weeklyEventsForThisDay++;
                    totalRecurringEventsGenerated++;
                    
                    console.log(`    ✅ Created event #${weeklyEventsForThisDay} for ${dayName}:`, eventStartTime.toLocaleDateString(), 'at', eventStartTime.toLocaleTimeString());
                    
                    // Move to next week
                    currentDate.setDate(currentDate.getDate() + 7);
                }
                
                console.log(`  📊 Generated ${weeklyEventsForThisDay} weekly events for ${dayName}`);
             });
             
             console.log(`🔢 Original event "${event.eventTitle}" generated ${eventsForThisOriginal} total events`);
         } else {
             // Handle other event formats or create a basic event
             console.log('⚠️ Unknown event format, creating basic event');
             const basicEvent = {
                 subject: event.title || event.eventTitle || event.name || 'Untitled Event',
                 startDate: new Date().toLocaleDateString('en-US'),
                 startTime: '9:00 AM',
                 endDate: new Date().toLocaleDateString('en-US'),
                 endTime: '10:00 AM',
                 allDayEvent: 'False',
                 description: event.description || event.eventDesc || '',
                 location: event.location || event.venue || '',
                 private: 'True'
             };
             transformedEvents.push(basicEvent);
             totalRecurringEventsGenerated++;
         }
     });
     
     // Final transformation summary
     console.log('\n📈 TRANSFORMATION SUMMARY:');
     console.log('📥 Original events processed:', originalEventsProcessed);
     console.log('📅 Events with multiple active days:', eventsWithMultipleDays);
     console.log('🔢 Total active days found:', totalActiveDaysFound);
     console.log('🔄 Total recurring events generated:', totalRecurringEventsGenerated);
     console.log('📤 Final transformed events:', transformedEvents.length);
     console.log('📊 Transformation ratio:', (transformedEvents.length / hkmuEvents.length).toFixed(2) + ':1');
     console.log('🎯 Transformed', hkmuEvents.length, 'HKMU events into', transformedEvents.length, 'Google Calendar events');
     
     return transformedEvents;
}

// Generate CSV content compatible with Google Calendar
function generateGoogleCalendarCSV(events) {
  // Google Calendar CSV headers
  const headers = [
    'Subject',
    'Start Date',
    'Start Time', 
    'End Date',
    'End Time',
    'All Day Event',
    'Description',
    'Location'
  ];
  
  let csvContent = headers.join(',') + '\n';
  
  events.forEach(event => {
    try {
      // Format dates and times for Google Calendar
      const startDate = formatDateForGoogleCalendar(event.startDate);
      const endDate = formatDateForGoogleCalendar(event.endDate || event.startDate);
      const startTime = formatTimeForGoogleCalendar(event.startTime);
      const endTime = formatTimeForGoogleCalendar(event.endTime || event.startTime);
      
      // Validate that start time is before end time
      const startDateTime = new Date(event.startDate);
      const endDateTime = new Date(event.endDate || event.startDate);
      
      if (startDateTime > endDateTime) {
        console.warn('Invalid event: start time after end time', event);
        return; // Skip this event
      }
      
      // Escape CSV values
      const row = [
        escapeCSVValue(event.subject || 'HKMU Event'),
        startDate,
        startTime,
        endDate, 
        endTime,
        event.allDayEvent === 'True' ? 'TRUE' : 'FALSE',
        escapeCSVValue(event.description || ''),
        escapeCSVValue(event.location || '')
      ];
      
      csvContent += row.join(',') + '\n';
    } catch (error) {
      console.warn('Error formatting event for CSV:', event, error);
    }
  });
  
  return csvContent;
}

// Format date for Google Calendar (MM/DD/YYYY)
function formatDateForGoogleCalendar(dateInput) {
  try {
    if (!dateInput) {
      return new Date().toLocaleDateString('en-US');
    }
    
    let date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      date = new Date(dateInput);
    }
    
    if (isNaN(date.getTime())) {
      return new Date().toLocaleDateString('en-US');
    }
    
    return date.toLocaleDateString('en-US');
  } catch (error) {
    return new Date().toLocaleDateString('en-US');
  }
}

// Format time for Google Calendar (HH:MM AM/PM)
function formatTimeForGoogleCalendar(timeInput) {
  try {
    if (!timeInput) {
      return '9:00 AM';
    }
    
    let time;
    if (timeInput instanceof Date) {
      time = timeInput;
    } else if (typeof timeInput === 'string' && timeInput.includes(':')) {
      const [hours, minutes] = timeInput.split(':');
      time = new Date();
      time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      time = new Date(timeInput);
    }
    
    if (isNaN(time.getTime())) {
      return '9:00 AM';
    }
    
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch (error) {
    return '9:00 AM';
  }
}

// Add one hour to a time string
function addOneHour(timeStr) {
  try {
    if (!timeStr) return '10:00 AM';
    
    const time = new Date();
    if (timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':');
      time.setHours(parseInt(hours) + 1, parseInt(minutes), 0, 0);
    } else {
      time.setHours(10, 0, 0, 0);
    }
    
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch (error) {
    return '10:00 AM';
  }
}

// Escape CSV values (handle commas, quotes, newlines)
function escapeCSVValue(value) {
  if (!value) return '';
  
  const stringValue = String(value);
  
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  
  return stringValue;
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'DATA_UPDATED') {
    loadRequestData();
    sendResponse({ success: true });
  } else if (request.type === 'DATA_INTERCEPTED') {
    // New data intercepted, refresh the display
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

console.log('HKMU Calendar Sync: Popup script initialized');