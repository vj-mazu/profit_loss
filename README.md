# Profit-Loss Commodity Trading ERP

Enterprise Commodity Trading & Logistics ERP for tracking bulk rice procurement from North India (UP/MP), logistics and 30KG branded packaging (Blue/Orange/Green), wholesale consignment splitting across destination markets (Maharashtra/Gujarat/Karnataka), quality cuttings, and 12% cash float interest engine.

---

## ⚡ Quick Start (Windows One-Click)

Simply double-click the **`start.bat`** file in the root folder:

```cmd
start.bat
```

This will automatically:
1. Connect to PostgreSQL (`profit_loss` database)
2. Run database migrations (creates all 6 tables and indexes)
3. Seed default Admin/Manager users, master settings, and the initial 40 trucks dataset
4. Start the Backend API server on `http://localhost:5050`
5. Start the React Frontend on `http://localhost:5173`
6. Open your default web browser to the login page!

---

## 🔑 Default Login Credentials

* **System Administrator:**
  * **Username:** `admin`
  * **Password:** `admin123`
  * *(Full access to rates, user account creation, system configuration)*
* **Operations Manager:**
  * **Username:** `manager`
  * **Password:** `manager123`
  * *(Access to daily entries, truck dispatch, sales bills, payment entries)*

---

## 📁 Application Modules (Tabs)

1. **📊 Executive Dashboard:** Live KPIs for truck fleet status (In-Transit, Unloaded, Settled), total quintals/bags, gross sales turnover, pending receivables, total cutting losses, and float interest yields.
2. **🚛 Inward Trucks Logistics:** Live fleet management tracking vehicle numbers, purchase bills, bags/quintals, lorry freight (LF), advances, transit turnaround, and one-click "Mark Unload".
3. **📦 Wholesale Sales & Bills:** Split truck consignments into merchant bills (e.g. MH-01 to MH-62), dual pricing (Actual Rate vs. Billing Rate), and live breakeven warnings.
4. **💰 Payments & Settlement (P&L):** Full P&L statement per truck matching the exact Cost of Goods breakdown and automated 12% interest float calculation (Early payer gain vs late payer loss).
5. **🌾 Mill Contracts & Bags:** Procurement contract tracking with millers and 30KG branded empty gunny bags (Blue, Orange, Green) inventory.
6. **⚙️ Master Settings:**
   * **Rates & Parameters:** Edit float interest rate % p.a. (default 12%), APMC %, IT/TCS %, EGB rates, and default brokerages.
   * **User Accounts:** Admin can create new login accounts (Admin/Manager) and manage passwords.
   * **Locations:** Dynamic origin and destination locations with custom invoice prefixes.
   * **Parties:** Millers and Wholesale buyers directory.
7. **📑 Pre-Formatted Excel Export:** Single-click download of a clean, styled Excel workbook with auto-fitted column widths, currency formatting, and print-ready margins.

---

## 🛠️ Manual Start (Command Line)

### Backend:
```bash
cd backend
npm install
npm start
```

### Frontend:
```bash
cd frontend
npm install
npm run dev
```
