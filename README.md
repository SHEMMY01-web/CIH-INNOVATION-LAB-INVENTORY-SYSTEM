# CIH Innovation Lab Inventory System

![CIH Innovation Lab](https://img.shields.io/badge/CIH-Innovation%20Lab-blue?style=for-the-badge)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)

Welcome to the **CIH Innovation Lab Inventory System**! This repository contains the source code for the digital inventory management platform used by the CIH Innovation Lab. The system is designed to track assets, tools, general items, manage user attendance, and showcase projects built within the lab.

## 📖 About the Project

The CIH Innovation Lab is a hub for creativity, engineering, and problem-solving. This system provides a seamless way to:
- Browse the extensive catalog of available resources (General, Tools, Heavy Assets).
- Manage the checkout (borrowing) and returning of items.
- Allow staff members to manage inventory levels securely.
- Track student/user attendance logs.
- Showcase ongoing and completed projects by the community.
- Collect community feedback and comments.

## ✨ Features

- **Public Catalog**: A beautiful, searchable, and filterable public catalog for users to discover resources.
- **Theme Support**: Built-in light and dark modes tailored to user preferences.
- **Staff Portal**: Secure login area for staff to manage items and view transactions.
- **Real-time Inventory**: Integration with Supabase for real-time data updates and stock management.
- **Role-Based Security**: Extensive Row Level Security (RLS) policies implemented at the database level to ensure data integrity and secure access.
- **Attendance Tracking**: Automated logging of user punches with a debounce mechanism to prevent duplicate entries.
- **Data Migration Tools**: A suite of Python scripts to import, export, and clean data (CSV/Excel) seamlessly.

## 🛠️ Tech Stack

- **Frontend**: [React 18](https://react.dev/), [Vite](https://vitejs.dev/), [React Router](https://reactrouter.com/), Vanilla CSS design system.
- **Offline & PWA**: Service Worker caching architecture (Google Docs style) with custom PWA manifest.
- **Backend / Database**: [Supabase](https://supabase.com/) (PostgreSQL), handling Auth, Database, RLS, and RPC functions.
- **DevOps**: GitHub Actions automated database keep-alive workflow & Vercel deployment.

## 📁 Repository Structure

```text
INVENTORY/
├── client/                  # Modern Vite + React Single Page Application
│   ├── src/                 # React components, pages, contexts, utils & styles
│   │   ├── components/      # Reusable UI components (Navbar, Footer, AlertPopup, etc.)
│   │   ├── contexts/        # Global state (AlertContext, AuthContext)
│   │   ├── pages/           # Application views (Dashboard, Catalog, Items, etc.)
│   │   └── styles/          # Modern responsive styling & design tokens
│   ├── public/              # Static assets, Service Worker (sw.js), PWA manifest & IMAGES/
│   ├── vite.config.js       # Vite build configuration
│   └── package.json         # Client dependencies & scripts
├── .github/                 # GitHub Actions (keep-alive workflow)
├── schema.sql               # Core PostgreSQL schema, RLS policies, and triggers
├── package.json             # Root monorepo script runner (npm run dev / build)
├── vercel.json              # Production SPA deployment configuration
└── README.md                # Project documentation
```

## 🚀 Getting Started

Follow these instructions to set up the project locally for development and testing.

### Prerequisites

- Node.js (v18+) and npm
- A [Supabase](https://supabase.com/) project credentials (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).

### 1. Clone the repository

```bash
git clone https://github.com/SHEMMY01-web/CIH-INNOVATION-LAB-INVENTORY-SYSTEM.git
cd CIH-INNOVATION-LAB-INVENTORY-SYSTEM
```

### 2. Install Dependencies

```bash
npm --prefix client install
```

### 3. Environment Setup

Create a `.env` file in the `client/` directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Locally

```bash
npm run dev
```
Navigate to `http://localhost:5173/` in your browser.

### 5. Build for Production

```bash
npm run build
```
The optimized production bundle will be built in `client/dist/`.

## 🗄️ Database Schema Overview

The Supabase PostgreSQL database consists of the following core tables:
- **`items`**: Stores the inventory catalog (name, category, stock amounts, supplier, condition).
- **`transactions`**: Logs every borrow, return, or stock adjustment.
- **`projects`**: Showcases community builds.
- **`attendance_logs`**: Tracks user check-ins/check-outs with automated duplicate filtering.
- **`comments`**: Public feedback board.

*Note: Access to these tables is strictly controlled via Supabase Row Level Security (RLS). Only authenticated users can perform mutations on inventory.*

## 🐍 Utility Scripts

The project includes several Python scripts located in the root directory for administrative tasks:
- `migrate_db.py`: Safely applies schema updates.
- `import_items.csv` / `generate_csv.py`: Bulk import/export of inventory data.
- `process_borrowed.py`: Handles complex logic for resolving borrowed item statuses.
- `check_supabase.py`: Verifies the database connection and environment variables.

To use the Python scripts, activate your virtual environment and install the required dependencies (typically `supabase` and `pandas`/`openpyxl` for Excel reading).

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the terms specified in the `LICENSE` file. See `LICENSE` for more information.

---
*Built with ❤️ at the CIH Innovation Lab.*
