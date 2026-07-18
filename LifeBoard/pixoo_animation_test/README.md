# Pixoo64 native animation test

This directory is an isolated smoke test for Pixoo64 native multi-frame
animation. It does not change the production LifeBoard task or sender.

The important difference from the old experiment is that each RGB frame is
registered separately under one `PicID`, using `PicOffset` values `0` and `1`.
The default transport wraps those two `Draw/SendHttpGif` commands in one
`Draw/CommandList` request.

## Setup

Create the virtual environment and install the pinned dependency:

```powershell
& '<python.exe>' -m venv .\LifeBoard\pixoo_animation_test\.venv
.\LifeBoard\pixoo_animation_test\.venv\Scripts\python.exe -m pip install -r .\LifeBoard\pixoo_animation_test\requirements.txt
```

## Preview only

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\pixoo_animation_test\run_manual.ps1
```

## Upload the two-frame test

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\LifeBoard\pixoo_animation_test\run_manual.ps1 -Push
```

The server PC still sends the normal LifeBoard frame every minute, so the test
animation will be replaced by production automatically at the next update.
