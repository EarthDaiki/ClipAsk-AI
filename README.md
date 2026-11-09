# ClipAsk: Highlight Text & Ask ChatGPT

A lightweight Chrome extension that lets you ask ChatGPT directly from any webpage by highlighting text or cropping an area of the screen.

Version: `1.2.0`

---

## Features

### Text → ChatGPT

- Highlight text on a webpage
- Right-click and choose `Ask ChatGPT (selected text)`
- Get the answer in a bottom overlay without leaving the page

### Image / Screen Area → ChatGPT

- Right-click and choose `Ask ChatGPT (crop image area)`
- Drag to select an area of the visible page
- The extension captures and crops the selected area
- The cropped image is sent to ChatGPT for analysis

### Optional Chat Mode

- Keeps conversation context per domain
- Allows follow-up questions on the same website
- Can be turned on or off in Settings

### Optional Summary Mode

- Works when Chat Mode is enabled
- Summarizes conversation history before the next request after the configured message count is reached
- Helps reduce token usage and API cost
- Can be turned on or off in Advanced Settings

### Domain-Based Memory

- Chat history is organized by website domain
- Each domain can have separate conversation context
- Saved domain history can be deleted from the Memory tab

---

## Manifest Information

This extension uses Chrome Manifest V3.

```json
{
  "manifest_version": 3,
  "name": "ClipAsk: Highlight Text & Ask ChatGPT",
  "version": "1.2.0",
  "description": "Highlight or crop anything and ask AI instantly!"
}
```

---

## Permissions

The extension uses the following permissions:

```json
[
  "contextMenus",
  "storage",
  "scripting",
  "activeTab",
  "tabs"
]
```

### Why These Permissions Are Used

| Permission | Purpose |
|---|---|
| `contextMenus` | Adds right-click menu options for selected text and cropped image mode |
| `storage` | Saves settings, API key, chat mode settings, and domain memory locally |
| `scripting` | Injects the overlay UI, crop UI, markdown parser, and sanitizer into pages |
| `activeTab` | Allows the extension to interact with the current active tab after user action |
| `tabs` | Gets the current tab URL/domain and captures the visible tab for image cropping |

---

## Host Permissions

```json
[
  "https://*/*",
  "http://*/*",
  "https://api.openai.com/*"
]
```

### Why Host Permissions Are Used

| Host Permission | Purpose |
|---|---|
| `https://*/*` | Allows the extension to work on HTTPS websites |
| `http://*/*` | Allows the extension to work on HTTP websites |
| `https://api.openai.com/*` | Allows requests to the OpenAI API |

---

## Settings

The Options page includes:

- OpenAI API Key
- Additional Prompt
- Text Model
- Image Model
- Summary Model
- Max Output Tokens
- Chat Mode
- Summary Mode
- Summary Frequency

The extension fetches the models available to the supplied OpenAI API key and shows curated choices in the following order:

| Use | Model order |
|---|---|
| Text | `gpt-6-luna` (Recommended), `gpt-6.1-terra` (Balanced), `gpt-6.1-sol` (Advanced) |
| Image | `gpt-6.1-terra` (Recommended), `gpt-6-luna` (Budget), `gpt-6.1-sol` (Advanced) |
| Summary | `gpt-6-luna` (Recommended), `gpt-6.1-terra` (Balanced), `gpt-6.1-sol` (Advanced) |

For each dropdown, if none of its curated models are available, the extension falls back to available GPT-5 and GPT-6 models.

No model is selected automatically. Text, image, and summary models are selected separately and stored locally.

The initial settings are Chat Mode off, Summary Mode on, max output tokens set to `500`, and summary frequency set to `30` messages. Summary Mode only takes effect while Chat Mode is enabled.

All settings are stored locally in the browser using `chrome.storage.local`.

---

## How It Works

### Model Selection Flow

```text
Enter OpenAI API Key
→ Fetch available models from OpenAI API
→ Show available curated models in the configured order for each use
→ Fall back to available GPT-5 and GPT-6 models when no curated model is available
→ Show the resulting choices in the model dropdowns
→ Use the selected model for text, cropped image, or summary requests
```

### Context Menu

The extension adds two right-click menu options:

```text
Ask ChatGPT (selected text)
Ask ChatGPT (crop image area)
```

### Text Request Flow

```text
Highlight text
→ Right-click
→ Ask ChatGPT (selected text)
→ Send selected text to OpenAI
→ Display answer in the page overlay
```

### Image Request Flow

```text
Right-click
→ Ask ChatGPT (crop image area)
→ Drag to select an area
→ Capture visible tab
→ Crop selected area with canvas
→ Send cropped image to OpenAI
→ Display answer in the page overlay
```

### Chat Mode Flow

```text
Website domain
→ Saved conversation ID
→ Send previous_response_id
→ Continue the conversation
```

### Summary Mode Flow

```text
Conversation reaches summary limit
→ Start the next text or image request
→ Generate a summary before sending that request
→ Reset conversation ID
→ Send the summary as compact context with the new request
```

---

## Project Structure

```text
.
├── background.js          # Core extension logic, context menus, API calls, crop UI, overlay UI
├── options.html           # Options page HTML
├── options.js             # Options page logic and memory management
├── options.css            # Options page styling
├── summary.txt            # Prompt used for summarization
├── marked.umd.js          # Markdown parser
├── purify.min.js          # HTML sanitizer
├── manifest.json          # Chrome extension manifest
└── icons/
    ├── 16.png             # 16x16 extension icon
    ├── 32.png             # 32x32 extension icon
    ├── 48.png             # 48x48 extension icon
    └── 128.png            # 128x128 extension icon
```

---

## Web Accessible Resources

The extension exposes the following files to webpages when needed:

```json
[
  "summary.txt",
  "marked.umd.js",
  "purify.min.js"
]
```

These are used for:

| File | Purpose |
|---|---|
| `summary.txt` | Stores the prompt used for conversation summarization |
| `marked.umd.js` | Renders Markdown responses in the overlay |
| `purify.min.js` | Sanitizes rendered HTML before displaying it |

---

## Installation

1. Clone or download this repository.
2. Open Chrome.
3. Go to:

```text
chrome://extensions
```

4. Enable Developer mode.
5. Click Load unpacked.
6. Select the project folder.

---

## Setup

1. Open the extension Options page.
2. Enter your OpenAI API Key.
3. Click Save & Continue to validate the key and load available models.
4. Select the text and image models you want to use.
5. Set the max output tokens.
6. Choose whether to enable Chat Mode.
7. If Chat Mode is enabled, optionally configure Summary Mode, its frequency, and its model under Advanced Settings.
8. Click Save Settings.

---

## Usage

### Ask About Selected Text

1. Highlight text on any normal webpage.
2. Right-click the selected text.
3. Click `Ask ChatGPT (selected text)`.
4. Read the response in the bottom overlay.

### Ask About an Image or Page Area

1. Right-click on the page.
2. Click `Ask ChatGPT (crop image area)`.
3. Drag over the area you want to analyze.
4. Release the mouse.
5. Read the response in the bottom overlay.

---

## Memory

The Memory tab shows saved domains when Chat Mode is enabled and conversations have been saved.

You can delete saved history for each domain individually.

Example:

```text
github.com
openai.com
stackoverflow.com
```

Each domain stores its own conversation context.

---

## Privacy

- The OpenAI API key is stored locally in the browser.
- Settings are stored using `chrome.storage.local`.
- No custom backend server is used.
- Requests are sent directly from the extension to the OpenAI API.
- Chat history is optional and depends on Chat Mode.
- Domain-based conversation memory can be deleted from the Memory tab.

---

## Limitations

- The extension does not work on restricted Chrome pages such as `chrome://extensions`.
- Image mode uses the visible tab screenshot, so only the visible part of the page can be cropped.
- Summary Mode is optional and only useful when Chat Mode is enabled.
- Lower `maxOutputTokens` can reduce cost, but may shorten answers.

---

## Future Improvements

- Add keyboard shortcuts
- Add draggable overlay UI
- Add conversation export
- Add better image search support
- Add custom prompt presets
- Add light/dark theme setting

---

## License

MIT License

---

## Author

Daiki Hagiwara
