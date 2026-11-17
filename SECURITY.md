# Security Policy

## Supported versions

Security fixes are applied to the default branch (`main`), which is what the
GitHub Pages site serves.

## Scope

The app runs entirely in the browser. It sends nothing to any server: the only
device it talks to is a PASCO sensor the user picks in the browser's own
Bluetooth or USB chooser, and recordings leave the page only when the user
downloads a CSV. A Content-Security-Policy restricts the built page to its own
origin.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting
on this repository (Security → Report a vulnerability).
