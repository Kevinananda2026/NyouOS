<div align="center">

<img src="Theme/Icon/nyouos_logo.png" alt="NyouOS" width="96" height="96" style="border-radius:20px">

# RynoOS

**A Fluent-style desktop operating system that runs in your browser**

Pure HTML + CSS + JavaScript, no backend, works out of the box.

[**🌐 Try it online**](https://rynoos.pages.dev/27.1/) · [中文说明](README.md)

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-27.1-blue)
![Web](https://img.shields.io/badge/runs%20in-browser-red)

</div>

---

## What is this?

RynoOS is a simulated desktop environment built with Web technologies. It gives you a full desktop in your browser: Start menu, taskbar, multi-window, file manager, settings, notification center, control center, widgets, and an AI assistant **Daola** that can operate the system for you.

All your data stays in your own browser (localStorage / IndexedDB). Nothing is uploaded to any server.

## Notes

Please do not download the code directly, otherwise it won’t be the latest RynoOS source code. Please go to the Releases page to download the latest version.

## Try it online

Open 👉 **https://rynoos.pages.dev/27.1/**

You will walk through the onboarding (OOBE) on first launch. Default PIN: **1234**.

## Repository

| Platform | URL |
|---|---|
| GitHub | <https://github.com/kevinananda2026/rynoos> |
| Gitee | <https://gitee.com/kevinananda2026/rynoos> |

## Run locally

No build step required. Clone and serve the folder with any static file server:

```bash
git clone https://github.com/kevinananda2026/rynoos.git
cd rynoos/27.0
# pick one:
python -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000/`.

> Opening `index.html` directly via `file://` works too, but some browser features (fetch preload, camera, geolocation) are restricted in that mode. A local HTTP server is recommended.

## Features

- 🖥️ **Full desktop experience**: boot, lock screen, login, multi-window, task view, snap layouts
- 📁 **File manager**: virtual filesystem, all files stored locally in your browser
- ⚙️ **Settings**: accounts, network, personalization, apps, languages, privacy, Daola AI, developer options
- 🤖 **Daola AI assistant**: built-in local command system; optional OpenAI / SiliconFlow-compatible API (your key stays in your browser)
- 🌐 **Multilingual**: Chinese, English, ภาษาไทย (Thai), 日本語 (Japanese)
- 🧩 **Built-in apps**: Files, Browser, Calculator, Clock, Weather, Notes, Photos, Camera, Media Player, App Store, Developer Center, Terminal, Task Manager
- 🎨 **Fluent Design**: Mica effect, Acrylic material, rounded corners and motion
- 📱 **PWA-friendly**: installable to your desktop

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt` | Open Start menu |
| `Alt + F` | Open / close Daola AI |
| `Alt + I` | Open Settings |
| `Alt + L` | Lock screen |
| `Alt + E` | Open Files |
| `Alt + A` | Open Control Center |
| `Alt + D` | Minimize all windows |
| `Alt + M` | Minimize current window |
| `Alt + W` | Task view |

## License

RynoOS is a fork of [**FluentOS-On-Web**](https://github.com/YoYoPAN1115/FluentOS-On-Web), originally created by **YoYoPAN1115** and released under the MIT License.

- Original code: **MIT License**, copyright YoYoPAN1115
- NyouOS modifications and additions: **GPLv3 License**, copyright KevinAnanda

From this fork onward, the whole project is distributed under GPLv3. See [LICENSE](LICENSE) for the full text.

If you distribute a modified version or deploy it as a public website, you must release the full source under GPLv3 and keep the original author's and this project's copyright notices.

## Third-party trademarks

The names and icons of WeChat, Alipay, Taobao, JD, Douyin, Bilibili, QQ Music and other third-party apps in the app store are used only to identify the origin of those apps. Their trademarks and graphic copyrights belong to their respective owners. RynoOS has no affiliation with, or endorsement from, those companies. "Fluent Design" is a design language of Microsoft; this project is not affiliated with Microsoft.

See the [Trademark Notice](https://rynoos.pages.dev/trademark.html).

## Privacy

- This is a fully static site. No personal data is collected, and no commercial use is made.
- All system data is stored locally in your browser.
- The Daola AI API key is entered by you; your browser sends requests directly to the API endpoint you configure, never through this project's servers.

See the [Privacy Notice](https://rynoos.pages.dev/about.html#privacy).

## Contact

- Email: <nyouos@163.com>
- If you find content that infringes your rights, or have suggestions, feel free to email us.

---

<div align="center">

© 2025-2026 **KevinAnanda** · Fork of [FluentOS-On-Web](https://github.com/YoYoPAN1115/FluentOS-On-Web) by YoYoPAN1115 · MIT / GPLv3

</div>
