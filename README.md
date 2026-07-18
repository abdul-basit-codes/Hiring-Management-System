# Hiring Management System (HMS)

A full-stack Hiring Management System with both a **C++ console backend** and a **web frontend** deployable to Vercel.

## Features

### Console (C++)
- Recruiter Registration & Login
- Candidate Registration & Login
- Job Posting & Application System
- Application Management (Accept/Reject)
- Admin Panel
- Persistent Data Storage (`.txt` files)

### Web Frontend
- Role-based dashboards (Candidate, Recruiter, Admin)
- Job posting and application workflow
- Skill matching and search
- Dark mode toggle
- Responsive design

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Console Backend | C++ (STL, File Handling) |
| Web Frontend | HTML, CSS, JavaScript |
| Web Server | Node.js (Vercel Serverless) |

## Project Structure

```
├── main.cpp              # C++ OOP console application
├── index.html            # Web frontend
├── app.js                # Frontend JavaScript (SPA logic)
├── style.css             # Frontend styles
├── styles-fix.css        # Additional styles
├── server.js             # Vercel serverless API
├── vercel.json           # Vercel deployment config
└── README.md
```

## How to Run

### Console (C++)
```bash
g++ main.cpp -o hms
./hms
```

### Web Frontend (Vercel)
1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import this repository
3. Framework: **Other** → Deploy

## Demo Accounts

| Role | Name | Password |
|------|------|----------|
| Recruiter | Ali Khan | pass123 |
| Candidate | Abdul Basit | mypass |
| Admin | Admin Code: `ADMIN2024` | — |

## OOP Concepts

- **Encapsulation** — Private data with controlled access
- **Inheritance** — Role-based class hierarchy
- **Polymorphism** — Virtual functions for role-specific behavior
- **Abstraction** — Interface-driven design
- **File Handling** — Persistent storage with `.txt` files

## Authors

- **Abdul Basit** — 01-134252-002
- **Burhan Qazi**

BSCS — Bahria University, Spring 2026
