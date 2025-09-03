# Hello Extensions - Chrome Extension

This is a basic Chrome extension based on the official Google Chrome Extensions tutorial.

## Features

- Simple popup interface
- Button to change webpage background color
- Uses Chrome storage API
- Demonstrates content script injection

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by clicking the toggle in the top right corner
3. Click "Load unpacked" button
4. Select this project folder (`HKMUCourseSync`)
5. The extension should now appear in your extensions list

## Usage

1. Click the extension icon in the Chrome toolbar
2. A popup will appear with "Hello Extensions" title and a button
3. Click the button to change the background color of the current webpage

## Files Structure

- `manifest.json` - Extension configuration and metadata
- `hello.html` - Popup interface HTML
- `button.css` - Styling for the popup
- `popup.js` - JavaScript functionality for the popup

## Permissions

- `storage` - To save user preferences
- `activeTab` - To access the current active tab
- `scripting` - To inject scripts into web pages