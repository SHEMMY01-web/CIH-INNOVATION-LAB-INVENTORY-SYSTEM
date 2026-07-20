<div align="center">
  <h1 align="center">CIH Innovation Lab Inventory System</h1>

  <p align="center">
    A robust, web-based inventory and project management system designed to streamline operations, track assets, and manage attendance. Built with modern web technologies and powered by Supabase.
    <br />
    <br />
    <a href="#features"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="#getting-started">View Demo</a>
    ·
    <a href="https://github.com/SHEMMY01-web/CIH-INNOVATION-LAB-INVENTORY-SYSTEM/issues">Report Bug</a>
    ·
    <a href="https://github.com/SHEMMY01-web/CIH-INNOVATION-LAB-INVENTORY-SYSTEM/issues">Request Feature</a>
  </p>
</div>

---

## 📖 Table of Contents
- [About The Project](#about-the-project)
  - [Key Features](#key-features)
  - [Built With](#built-with)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Project Structure](#project-structure)
- [Database Configuration](#database-configuration)
- [Data Migration & Scripts](#data-migration--scripts)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## 🚀 About The Project

The **CIH Innovation Lab Inventory System** is a comprehensive management solution tailored for tracking laboratory assets, managing item borrow/return workflows, overseeing projects, and logging attendance. It provides an intuitive frontend interface connected to a secure, real-time Supabase backend.

### Key Features
* **Inventory Tracking:** Manage items, assets, and tools. Track item conditions (e.g., perfectly working, not working, to be received).
* **Project Management:** Create and monitor projects, and associate them with required tools and materials.
* **Transaction Logging:** Seamlessly log borrowing and returning of items, updating stock automatically.
* **Attendance System:** Integrated attendance logging with duplicate-punch prevention.
* **Role-Based Access:** Secure authentication and Row Level Security (RLS) ensuring that only authorized users can modify records.

### Built With

This project is built using a lightweight stack, ensuring high performance and easy maintainability:

* **Frontend:** HTML5, CSS3, Vanilla JavaScript
* **Backend:** [Supabase](https://supabase.com/) (PostgreSQL)
* **Scripts & Utilities:** Python (for data migration, CSV generation, and Excel processing)
* **Package Management:** npm (for basic build scripting and dependency handling)

---

## 💻 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

* Node.js and npm
  ```sh
  npm install npm@latest -g
  ```
* Python 3.x (for running migration and utility scripts)
* A [Supabase](https://supabase.com/) account and project.

### Installation

1. **Clone the repository**
   ```sh
   git clone https://github.com/SHEMMY01-web/CIH-INNOVATION-LAB-INVENTORY-SYSTEM.git
   cd CIH-INNOVATION-LAB-INVENTORY-SYSTEM
   ```

2. **Configure Environment Variables**
   Set your Supabase credentials in your environment. The build script uses these to generate the client-side configuration.
   ```sh
   export SUPABASE_URL="your-supabase-project-url"
   export SUPABASE_ANON_KEY="your-supabase-anon-key"
   ```

3. **Run the Build Script**
   This step generates the necessary `env.js` file for the frontend to connect to Supabase.
   ```sh
   npm install
   npm run build
   ```

4. **Serve the Application**
   You can use any local web server to serve the static files from the `FRONTEND` directory. For example, using Python:
   ```sh
   cd FRONTEND
   python -m http.server 8000
   ```
   Open `http://localhost:8000/HTML/index.html` in your browser.

---

## 📁 Project Structure

```text
CIH-INNOVATION-LAB-INVENTORY-SYSTEM/
├── FRONTEND/
│   ├── CSS/          # Stylesheets for all pages
│   ├── HTML/         # Application views (Dashboard, Catalog, Login, etc.)
│   ├── IMAGES/       # Static image assets
│   └── JS/           # Client-side logic and Supabase integration
├── *.py              # Python utility scripts (migrations, data extraction)
├── *.csv             # Data imports and exports
├── schema.sql        # Database schema, policies, and triggers
├── package.json      # NPM configuration and build scripts
└── README.md         # Project documentation
```

---

## 🗄️ Database Configuration

The system relies on a PostgreSQL database hosted on Supabase. The complete database schema, including tables, Row Level Security (RLS) policies, and triggers, is defined in `schema.sql`.

**Key Tables:**
- `items`: Stores inventory details, stock amounts, and item conditions.
- `transactions`: Logs check-in/check-out events.
- `projects`: Tracks ongoing projects.
- `attendance_logs`: Records device punch times with triggers to prevent duplicate entries within a 5-minute window.

To initialize your database, run the contents of `schema.sql` in your Supabase SQL Editor.

---

## 🛠️ Data Migration & Scripts

This repository includes several Python scripts designed to help with data migration, auditing, and maintenance. You can find them in the root directory:

* `generate_csv.py` / `generate_transactions_csv.py`: Export database records to CSV.
* `process_borrowed.py`: Analyze and process borrowed items logic.
* `read_excel.py`: Utility for parsing Excel data into the system.
* `migrate_db.py`: Assists with structural migrations or data imports.

*Note: Ensure you activate a Python virtual environment (`venv`) and install any required dependencies (like `pandas` or `supabase-py` if applicable) before running these scripts.*

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 📫 Contact

Project Link: [https://github.com/SHEMMY01-web/CIH-INNOVATION-LAB-INVENTORY-SYSTEM](https://github.com/SHEMMY01-web/CIH-INNOVATION-LAB-INVENTORY-SYSTEM)
