# Fastfetch Wallpaper

Animated desktop wallpaper inspired by the **Fastfetch** terminal layout.

This project recreates a terminal-style system monitor directly on the desktop using **Wallpaper Engine**, combining live system statistics, music playback information, ASCII album art and subtle CRT-style visual effects.

The goal of the project was to create a desktop that feels like a living terminal HUD while remaining minimal and usable.

---

## Features

• Fastfetch-style system information
• Live CPU / RAM / disk usage indicators
• Audio spectrum visualizer
• Now Playing music information
• ASCII album cover rendering
• Dynamic accent color based on album artwork
• Animated Windows logo wave effect
• Subtle CRT glow and scanline effects
• Minimal watermark logo

The wallpaper is designed to stay readable while leaving most of the desktop free for icons and applications.

---

## Preview

<img width="1919" height="1029" alt="изображение" src="https://github.com/user-attachments/assets/af3c2f7f-d0ce-4e37-845d-07d6c2ab2cb3" />

---

<img width="1919" height="1039" alt="изображение" src="https://github.com/user-attachments/assets/28340b5f-2124-4b04-8c1f-2729f7bd1bfd" />

---

<img width="639" height="517" alt="изображение" src="https://github.com/user-attachments/assets/c53b412c-8e1d-46fa-bb7c-f2d682c8975f" />

---

<img width="760" height="509" alt="изображение" src="https://github.com/user-attachments/assets/a000d398-b86b-4eba-979f-0b3fcad10a7e" />

---

## Requirements

• Wallpaper Engine
• Windows 10 / 11

The wallpaper uses a small helper service to collect system information.

---

## Installation

This repository contains the **wallpaper source files**, not a pre-generated Wallpaper Engine project.

This approach avoids common compatibility issues where `project.json` files fail to load on other systems.

Follow the steps below to create the wallpaper locally.

### Step 1 — Download the project

Clone or download this repository:

```
git clone https://github.com/yourname/fastfetch-wallpaper.git
```

or download the ZIP archive and extract it.

---

### Step 2 — Create a wallpaper in Wallpaper Engine

1. Open **Wallpaper Engine**
2. Go to **Wallpaper Editor**
3. Click **Create Wallpaper**
4. Choose **Web Wallpaper**

---

### Step 3 — Select the project folder

When the editor asks for the entry file:

Select:

```
index.html
```

Wallpaper Engine will automatically load the page as a wallpaper.

---

### Step 4 — Save the wallpaper

After loading:

```
File → Save
```

You can now use the wallpaper normally inside Wallpaper Engine.

---

## Optional Helper Service

The wallpaper uses a small helper application to collect system information such as:

* CPU usage
* RAM usage
* disk statistics
* system uptime

Run the helper installer included in the repository to enable these features.

Without the helper the wallpaper will still run, but system statistics will not update!.


---

## Configuration

Most settings can be adjusted directly in the wallpaper code.

Important files:

```
index.html     – main layout
style.css      – visual styling
app.js         – logic and animations
```

---

## Design Notes

The visual style is inspired by:

• Fastfetch / terminal dashboards
• CRT monitor aesthetics
• minimal system HUD interfaces

Special care was taken to keep animations subtle so the wallpaper remains comfortable for everyday use.

---

## Author

Created by **MIMISSID**

---

## Acknowledgements

Special thanks to **ChatGPT** for development assistance and visual design iteration.

---

## License

This project is provided for personal use and learning purposes.
Feel free to modify and experiment with it.
