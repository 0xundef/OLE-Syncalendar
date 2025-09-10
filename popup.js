// Popup script for HKMU Calendar Interceptor

// DOM elements
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const requestsList = document.getElementById('requestsList');
const emptyState = document.getElementById('emptyState');



// Load and display request data
async function loadRequestData() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['interceptedRequests'], resolve);
    });
    
    const requests = result.interceptedRequests || [];
    displayRequestData(requests);
  } catch (error) {
    console.error('HKMU Syncalendar: Failed to load request data', error);
  }
}

// Display request data (show only the newest request)
function displayRequestData(requests) {
  if (!requests || requests.length === 0) {
    requestsList.innerHTML = '<div class="empty-state">No requests intercepted yet</div>';
    return;
  }
  
  // Get the newest request (last in array)
  const newestRequest = requests[requests.length - 1];
  
  // Determine status based on response status
  let statusText = 'SUCCESS';
  let statusClass = 'method-GET';
  
  if (newestRequest.status) {
    if (newestRequest.status >= 200 && newestRequest.status < 300) {
      statusText = 'SUCCESS';
      statusClass = 'method-GET';
    } else {
      statusText = 'ERROR';
      statusClass = 'method-DELETE';
    }
  }
  
  // Format the URL
  // Format the time
  const time = newestRequest.timestamp ? 
    new Date(newestRequest.timestamp).toLocaleTimeString() : 
    new Date().toLocaleTimeString();
  
  // Determine display message based on status
  const displayMessage = statusText === 'SUCCESS' ? 
    'fetch the newest calendar events' : 
    'failed to fetch calendar events';
  
  // Create the request item HTML
  const requestItemHTML = `
    <div class="request-item">
      <span class="request-method ${statusClass}">${statusText}</span>
      <span class="request-url">${displayMessage}</span>
      <span class="request-time">${time}</span>
    </div>
  `;
  
  requestsList.innerHTML = requestItemHTML;
}

// Initialize popup
async function initialize() {
  try {
    // Set up event listeners
    setupEventListeners();
    // Load initial data
    await loadRequestData();
  } catch (error) {
    console.error('HKMU Syncalendar: Failed to initialize popup', error);
  }
}











// Set up event listeners
function setupEventListeners() {
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
  
  // Auto-refresh every 2 seconds to show latest request status
  setInterval(async () => {
    await loadRequestData();
  }, 2000);
}



// Clear all intercepted data
async function clearAllData() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['interceptedRequests'], () => {

      resolve();
    });
  });
}

// Export data to CSV file for Google Calendar import
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
    
    // Get only the latest request for export
    const latestRequest = [requests[requests.length - 1]];
    
    // Parse calendar events from the latest intercepted data
    const events = parseCalendarEvents(latestRequest);
    
    if (events.length === 0) {
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
    
    alert(`Successfully exported ${events.length} calendar events to CSV format for Google Calendar import.`);
  } catch (error) {
    console.error('HKMU Calendar: Export failed', error);
    alert('Failed to export calendar data. Check console for details.');
  }
}

// Parse calendar events from intercepted HKMU data
function parseCalendarEvents(requests) {
    let allEvents = [];
    
    requests.forEach((request, index) => {
        
        if (request.responseData) {
            try {
                let data;
                
                // Try to parse as JSON first
                if (typeof request.responseData === 'string') {
                    try {
                        data = JSON.parse(request.responseData);
                    } catch (jsonError) {
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
                // Skip invalid data
            }
        } else {
            console.log('⚠️ No responseData found in request:', request);
        }
    });
    
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
    
    hkmuEvents.forEach((event, index) => {
        originalEventsProcessed++;
        
        // Check if this is HKMU format (has eventTitle and date components)
        if (event.eventTitle && event.startDate_yr) {
            // Get the days when this event occurs
            const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const activeDays = daysOfWeek.filter(day => event[day] === 'Y');
            
            totalActiveDaysFound += activeDays.length;
            if (activeDays.length > 1) {
                eventsWithMultipleDays++;
            }
            
            // Create events for each active day
            let eventsForThisOriginal = 0;
            activeDays.forEach(dayName => {
                const dayIndex = daysOfWeek.indexOf(dayName);
                
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
                    
                    // Move to next week
                    currentDate.setDate(currentDate.getDate() + 7);
                }
             });
         } else {
             // Handle other event formats or create a basic event
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

// Show visual indicator when data changes are detected
function showDataChangeIndicator(changeDetails) {
  // Create a temporary notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 1000;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
    line-height: 1.4;
  `;
  
  // Format notification content based on change details
  let content = '📅 Calendar Updated!';
  if (changeDetails && changeDetails.added && changeDetails.removed) {
    const { added, removed } = changeDetails;
    if (added.length > 0 && removed.length > 0) {
      content += `<br><small>+${added.length} added, -${removed.length} removed</small>`;
    } else if (added.length > 0) {
      content += `<br><small>+${added.length} new event(s)</small>`;
      if (added[0] && added[0].eventTitle) {
        content += `<br><small>📚 ${added[0].eventTitle}</small>`;
      }
    } else if (removed.length > 0) {
      content += `<br><small>-${removed.length} event(s) removed</small>`;
      if (removed[0] && removed[0].eventTitle) {
        content += `<br><small>📚 ${removed[0].eventTitle}</small>`;
      }
    }
  }
  
  notification.innerHTML = content;
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // Remove after 4 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 4000);
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

console.log('HKMU Syncalendar: Popup script initialized');