const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sql = require('mssql'); // Use mssql directly
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: 1433,
  pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true }
};

const seedPermissions = async () => {
  try {
    const pool = await sql.connect(config);
    
    console.log("⚠️  Resetting Permission Tables...");
    // 0. Drop Tables (Child first)
    await pool.request().query`IF OBJECT_ID('UserPermissions', 'U') IS NOT NULL DROP TABLE UserPermissions`;
    await pool.request().query`IF OBJECT_ID('RolePermissions', 'U') IS NOT NULL DROP TABLE RolePermissions`;
    await pool.request().query`IF OBJECT_ID('Permissions', 'U') IS NOT NULL DROP TABLE Permissions`;
    console.log("✅ Dropped existing tables.");

    // 1. Create Table if not exists
    await pool.request().query`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Permissions' AND xtype='U')
      CREATE TABLE Permissions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PermissionKey NVARCHAR(100) NOT NULL UNIQUE,
        Name NVARCHAR(100) NOT NULL,
        ParentKey NVARCHAR(100) NULL,
        IsActive BIT DEFAULT 1
      )
    `;
    console.log("✅ Permissions table checked/created.");

    // 1.1 Create RolePermissions Table if not exists
    await pool.request().query`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RolePermissions' AND xtype='U')
      CREATE TABLE RolePermissions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RoleId INT NOT NULL,
        PermissionKey NVARCHAR(100) NOT NULL,
        IsActive BIT DEFAULT 1
      )
    `;
    console.log("✅ RolePermissions table checked/created.");

    // 1.2 Create UserPermissions Table if not exists
    await pool.request().query`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserPermissions' AND xtype='U')
      CREATE TABLE UserPermissions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        PermissionKey NVARCHAR(100) NOT NULL,
        Granted BIT NOT NULL DEFAULT 1,
        IsActive BIT DEFAULT 1
      )
    `;
    console.log("✅ UserPermissions table checked/created.");

    // 2. Define Permissions
    const permissions = [
      // Dashboard
      { key: 'dashboard', name: 'Dashboard', parent: null },
      { key: 'dashboard_view', name: 'View', parent: 'dashboard' },

      // Users
      { key: 'users', name: 'Users', parent: null },
      { key: 'user_create', name: 'Create', parent: 'users' },
      { key: 'user_view', name: 'View', parent: 'users' }, // Changed 'Read' to 'View' to match user request
      { key: 'user_edit', name: 'Edit', parent: 'users' }, // Changed 'Update' to 'Edit'
      { key: 'user_delete', name: 'Delete', parent: 'users' },

      // Roles
      { key: 'roles', name: 'Roles', parent: null },
      { key: 'role_create', name: 'Create', parent: 'roles' },
      { key: 'role_view', name: 'View', parent: 'roles' },
      { key: 'role_edit', name: 'Edit', parent: 'roles' },
      { key: 'role_delete', name: 'Delete', parent: 'roles' },

      // Countries
      { key: 'countries', name: 'Countries', parent: null },
      { key: 'country_create', name: 'Create', parent: 'countries' },
      { key: 'country_view', name: 'View', parent: 'countries' },
      { key: 'country_edit', name: 'Edit', parent: 'countries' },
      { key: 'country_delete', name: 'Delete', parent: 'countries' },

      // States
      { key: 'states', name: 'States', parent: null },
      { key: 'state_create', name: 'Create', parent: 'states' },
      { key: 'state_view', name: 'View', parent: 'states' },
      { key: 'state_edit', name: 'Edit', parent: 'states' },
      { key: 'state_delete', name: 'Delete', parent: 'states' },

      // Cities
      { key: 'cities', name: 'Cities', parent: null },
      { key: 'city_create', name: 'Create', parent: 'cities' },
      { key: 'city_view', name: 'View', parent: 'cities' },
      { key: 'city_edit', name: 'Edit', parent: 'cities' },
      { key: 'city_delete', name: 'Delete', parent: 'cities' },

      // Regions
      { key: 'regions', name: 'Regions', parent: null },
      { key: 'region_create', name: 'Create', parent: 'regions' },
      { key: 'region_view', name: 'View', parent: 'regions' },
      { key: 'region_edit', name: 'Edit', parent: 'regions' },
      { key: 'region_delete', name: 'Delete', parent: 'regions' },

      // Territories
      { key: 'territories', name: 'Territories', parent: null },
      { key: 'territory_create', name: 'Create', parent: 'territories' },
      { key: 'territory_view', name: 'View', parent: 'territories' },
      { key: 'territory_edit', name: 'Edit', parent: 'territories' },
      { key: 'territory_delete', name: 'Delete', parent: 'territories' },

      // Customer Groups (Example of applied pattern)
      { key: 'customer_groups', name: 'Customer Groups', parent: null },
      { key: 'customer_group_create', name: 'Create', parent: 'customer_groups' },
      { key: 'customer_group_view', name: 'View', parent: 'customer_groups' },
      { key: 'customer_group_edit', name: 'Edit', parent: 'customer_groups' },
      { key: 'customer_group_delete', name: 'Delete', parent: 'customer_groups' },

      // Supplier Groups
      { key: 'supplier_groups', name: 'Supplier Groups', parent: null },
      { key: 'supplier_group_create', name: 'Create', parent: 'supplier_groups' },
      { key: 'supplier_group_view', name: 'View', parent: 'supplier_groups' },
      { key: 'supplier_group_edit', name: 'Edit', parent: 'supplier_groups' },
      { key: 'supplier_group_delete', name: 'Delete', parent: 'supplier_groups' },
      
      // Masters (Expanded)
      { key: 'banks', name: 'Banks', parent: null },
      { key: 'bank_create', name: 'Create', parent: 'banks' },
      { key: 'bank_view', name: 'View', parent: 'banks' },
      { key: 'bank_edit', name: 'Edit', parent: 'banks' },
      { key: 'bank_delete', name: 'Delete', parent: 'banks' },

      { key: 'expense_types', name: 'Expense Types', parent: null },
      { key: 'expense_type_create', name: 'Create', parent: 'expense_types' },
      { key: 'expense_type_view', name: 'View', parent: 'expense_types' },
      { key: 'expense_type_edit', name: 'Edit', parent: 'expense_types' },
      { key: 'expense_type_delete', name: 'Delete', parent: 'expense_types' },

      { key: 'services_master', name: 'Services Master', parent: null },
      { key: 'service_master_create', name: 'Create', parent: 'services_master' },
      { key: 'service_master_view', name: 'View', parent: 'services_master' },
      { key: 'service_master_edit', name: 'Edit', parent: 'services_master' },
      { key: 'service_master_delete', name: 'Delete', parent: 'services_master' },

      { key: 'shippers', name: 'Shippers', parent: null },
      { key: 'shipper_create', name: 'Create', parent: 'shippers' },
      { key: 'shipper_view', name: 'View', parent: 'shippers' },
      { key: 'shipper_edit', name: 'Edit', parent: 'shippers' },
      { key: 'shipper_delete', name: 'Delete', parent: 'shippers' },

      { key: 'warehouses', name: 'Warehouses', parent: null },
      { key: 'warehouse_create', name: 'Create', parent: 'warehouses' },
      { key: 'warehouse_view', name: 'View', parent: 'warehouses' },
      { key: 'warehouse_edit', name: 'Edit', parent: 'warehouses' },
      { key: 'warehouse_delete', name: 'Delete', parent: 'warehouses' },

      { key: 'agenda_item_types', name: 'Agenda Item Types', parent: null },
      { key: 'agenda_item_type_create', name: 'Create', parent: 'agenda_item_types' },
      { key: 'agenda_item_type_view', name: 'View', parent: 'agenda_item_types' },
      { key: 'agenda_item_type_edit', name: 'Edit', parent: 'agenda_item_types' },
      { key: 'agenda_item_type_delete', name: 'Delete', parent: 'agenda_item_types' },

      { key: 'meeting_types', name: 'Meeting Types', parent: null },
      { key: 'meeting_type_create', name: 'Create', parent: 'meeting_types' },
      { key: 'meeting_type_view', name: 'View', parent: 'meeting_types' },
      { key: 'meeting_type_edit', name: 'Edit', parent: 'meeting_types' },
      { key: 'meeting_type_delete', name: 'Delete', parent: 'meeting_types' },

      { key: 'locations', name: 'Locations', parent: null },
      { key: 'location_create', name: 'Create', parent: 'locations' },
      { key: 'location_view', name: 'View', parent: 'locations' },
      { key: 'location_edit', name: 'Edit', parent: 'locations' },
      { key: 'location_delete', name: 'Delete', parent: 'locations' },

      { key: 'attendance_status', name: 'Attendance Status', parent: null },
      { key: 'attendance_status_create', name: 'Create', parent: 'attendance_status' },
      { key: 'attendance_status_view', name: 'View', parent: 'attendance_status' },
      { key: 'attendance_status_edit', name: 'Edit', parent: 'attendance_status' },
      { key: 'attendance_status_delete', name: 'Delete', parent: 'attendance_status' },

      { key: 'attendee_types', name: 'Attendee Types', parent: null },
      { key: 'attendee_type_create', name: 'Create', parent: 'attendee_types' },
      { key: 'attendee_type_view', name: 'View', parent: 'attendee_types' },
      { key: 'attendee_type_edit', name: 'Edit', parent: 'attendee_types' },
      { key: 'attendee_type_delete', name: 'Delete', parent: 'attendee_types' },

      { key: 'resolution_status', name: 'Resolution Status', parent: null },
      { key: 'resolution_status_create', name: 'Create', parent: 'resolution_status' },
      { key: 'resolution_status_view', name: 'View', parent: 'resolution_status' },
      { key: 'resolution_status_edit', name: 'Edit', parent: 'resolution_status' },
      { key: 'resolution_status_delete', name: 'Delete', parent: 'resolution_status' },

      { key: 'deductions', name: 'Deductions', parent: null },
      { key: 'deduction_create', name: 'Create', parent: 'deductions' },
      { key: 'deduction_view', name: 'View', parent: 'deductions' },
      { key: 'deduction_edit', name: 'Edit', parent: 'deductions' },
      { key: 'deduction_delete', name: 'Delete', parent: 'deductions' },

      { key: 'incomes', name: 'Incomes', parent: null },
      { key: 'income_create', name: 'Create', parent: 'incomes' },
      { key: 'income_view', name: 'View', parent: 'incomes' },
      { key: 'income_edit', name: 'Edit', parent: 'incomes' },
      { key: 'income_delete', name: 'Delete', parent: 'incomes' },

      // Meeting
      { key: 'meetings', name: 'Meetings', parent: null },
      { key: 'meeting_create', name: 'Create', parent: 'meetings' },
      { key: 'meeting_view', name: 'View', parent: 'meetings' },
      { key: 'meeting_edit', name: 'Edit', parent: 'meetings' },
      { key: 'meeting_delete', name: 'Delete', parent: 'meetings' },

      // Business Partners - Customers
      { key: 'customers', name: 'Customers', parent: null },
      { key: 'customer_create', name: 'Create', parent: 'customers' },
      { key: 'customer_view', name: 'View', parent: 'customers' },
      { key: 'customer_edit', name: 'Edit', parent: 'customers' },
      { key: 'customer_delete', name: 'Delete', parent: 'customers' },
      
      // Business Partners - Suppliers
      { key: 'suppliers', name: 'Suppliers', parent: null },
      { key: 'supplier_create', name: 'Create', parent: 'suppliers' },
      { key: 'supplier_view', name: 'View', parent: 'suppliers' },
      { key: 'supplier_edit', name: 'Edit', parent: 'suppliers' },
      { key: 'supplier_delete', name: 'Delete', parent: 'suppliers' },

      // Inventory
      { key: 'inventory', name: 'Inventory', parent: null },
      { key: 'inventory_view', name: 'View', parent: 'inventory' }, // General access
      { key: 'products', name: 'Products', parent: 'inventory' },
      { key: 'product_create', name: 'Create', parent: 'products' },
      { key: 'product_view', name: 'View', parent: 'products' },
      { key: 'product_edit', name: 'Edit', parent: 'products' },
      { key: 'product_delete', name: 'Delete', parent: 'products' },
      
      { key: 'categories', name: 'Categories', parent: 'inventory' },
      { key: 'category_create', name: 'Create', parent: 'categories' },
      { key: 'category_view', name: 'View', parent: 'categories' },
      { key: 'category_edit', name: 'Edit', parent: 'categories' },
      { key: 'category_delete', name: 'Delete', parent: 'categories' },

      { key: 'units', name: 'Units', parent: 'inventory' },
      { key: 'unit_create', name: 'Create', parent: 'units' },
      { key: 'unit_view', name: 'View', parent: 'units' },
      { key: 'unit_edit', name: 'Edit', parent: 'units' },
      { key: 'unit_delete', name: 'Delete', parent: 'units' },

      { key: 'brands', name: 'Brands', parent: 'inventory' },
      { key: 'brand_create', name: 'Create', parent: 'brands' },
      { key: 'brand_view', name: 'View', parent: 'brands' },
      { key: 'brand_edit', name: 'Edit', parent: 'brands' },
      { key: 'brand_delete', name: 'Delete', parent: 'brands' },

      { key: 'damaged_products', name: 'Damaged Products', parent: 'inventory' },
      { key: 'damaged_product_create', name: 'Create', parent: 'damaged_products' },
      { key: 'damaged_product_view', name: 'View', parent: 'damaged_products' },
      { key: 'damaged_product_edit', name: 'Edit', parent: 'damaged_products' },
      { key: 'damaged_product_delete', name: 'Delete', parent: 'damaged_products' },

      { key: 'goods_receipts', name: 'Goods Receipts', parent: 'inventory' },
      { key: 'goods_receipt_create', name: 'Create', parent: 'goods_receipts' },
      { key: 'goods_receipt_view', name: 'View', parent: 'goods_receipts' },
      { key: 'goods_receipt_edit', name: 'Edit', parent: 'goods_receipts' },
      { key: 'goods_receipt_delete', name: 'Delete', parent: 'goods_receipts' },

      { key: 'goods_issue', name: 'Goods Issue', parent: 'inventory' },
      { key: 'goods_issue_create', name: 'Create', parent: 'goods_issue' },
      { key: 'goods_issue_view', name: 'View', parent: 'goods_issue' },
      { key: 'goods_issue_edit', name: 'Edit', parent: 'goods_issue' },
      { key: 'goods_issue_delete', name: 'Delete', parent: 'goods_issue' },

      { key: 'update_stock', name: 'Update Stock', parent: 'inventory' },

      // Sales
      { key: 'sales', name: 'Sales', parent: null },
      { key: 'sales_view', name: 'View', parent: 'sales' },
      { key: 'sales_create', name: 'Create', parent: 'sales' },
      { key: 'sales_edit', name: 'Edit', parent: 'sales' },
      { key: 'sales_delete', name: 'Delete', parent: 'sales' },

      // Purchasing
      { key: 'purchasing', name: 'Purchasing', parent: null },
      { key: 'purchasing_view', name: 'View', parent: 'purchasing' },
      { key: 'purchasing_create', name: 'Create', parent: 'purchasing' },
      { key: 'purchasing_edit', name: 'Edit', parent: 'purchasing' },
      { key: 'purchasing_delete', name: 'Delete', parent: 'purchasing' },

      // Services (Module)
      { key: 'services', name: 'Services', parent: null },
      { key: 'services_view', name: 'View', parent: 'services' },
      { key: 'services_create', name: 'Create', parent: 'services' },
      { key: 'services_edit', name: 'Edit', parent: 'services' },
      { key: 'services_delete', name: 'Delete', parent: 'services' },

      // Cash / Bank
      { key: 'cash_bank', name: 'Cash & Bank', parent: null },
      { key: 'cash_bank_view', name: 'View', parent: 'cash_bank' },
      { key: 'cash_bank_create', name: 'Create', parent: 'cash_bank' },
      { key: 'cash_bank_edit', name: 'Edit', parent: 'cash_bank' },
      { key: 'cash_bank_delete', name: 'Delete', parent: 'cash_bank' },

      // Financial
      { key: 'financial', name: 'Financial', parent: null },
      { key: 'financial_view', name: 'View', parent: 'financial' },
      { key: 'financial_create', name: 'Create', parent: 'financial' },
      { key: 'financial_edit', name: 'Edit', parent: 'financial' },
      { key: 'financial_delete', name: 'Delete', parent: 'financial' },

      // HR (General)
      { key: 'hr', name: 'Human Resources', parent: null },
      { key: 'hr_view', name: 'View', parent: 'hr' },
      // Employees are separate below
      { key: 'employees', name: 'Employees', parent: 'hr' },
      { key: 'employee_create', name: 'Create Emp', parent: 'employees' },
      { key: 'employee_view', name: 'View Emp', parent: 'employees' },
      { key: 'employee_edit', name: 'Edit Emp', parent: 'employees' },
      { key: 'employee_delete', name: 'Delete Emp', parent: 'employees' },

      { key: 'departments', name: 'Departments', parent: 'hr' },
      { key: 'department_create', name: 'Create', parent: 'departments' },
      { key: 'department_view', name: 'View', parent: 'departments' },
      { key: 'department_edit', name: 'Edit', parent: 'departments' },
      { key: 'department_delete', name: 'Delete', parent: 'departments' },

      { key: 'designations', name: 'Designations', parent: 'hr' },
      { key: 'designation_create', name: 'Create', parent: 'designations' },
      { key: 'designation_view', name: 'View', parent: 'designations' },
      { key: 'designation_edit', name: 'Edit', parent: 'designations' },
      { key: 'designation_delete', name: 'Delete', parent: 'designations' },

      { key: 'attendance', name: 'Attendance', parent: 'hr' },
      { key: 'attendance_create', name: 'Create', parent: 'attendance' }, // e.g. Mark attendance
      { key: 'attendance_view', name: 'View', parent: 'attendance' },
      { key: 'attendance_edit', name: 'Edit', parent: 'attendance' },
      { key: 'attendance_delete', name: 'Delete', parent: 'attendance' },

      { key: 'payroll', name: 'Payroll', parent: 'hr' },
      { key: 'payroll_create', name: 'Create', parent: 'payroll' },
      { key: 'payroll_view', name: 'View', parent: 'payroll' },
      { key: 'payroll_edit', name: 'Edit', parent: 'payroll' },
      { key: 'payroll_delete', name: 'Delete', parent: 'payroll' },

      // Reports
      { key: 'reports', name: 'Reports', parent: null },
      { key: 'reports_create', name: 'Create', parent: 'reports' },
      { key: 'reports_view', name: 'View', parent: 'reports' },
      { key: 'reports_edit', name: 'Edit', parent: 'reports' },
      { key: 'reports_delete', name: 'Delete', parent: 'reports' },

      // Administration (Already have Users/Roles)
      { key: 'settings', name: 'Settings', parent: null },
      // Settings / Config
      { key: 'currencies', name: 'Currencies', parent: null },
      { key: 'currency_create', name: 'Create', parent: 'currencies' },
      { key: 'currency_view', name: 'View', parent: 'currencies' },
      { key: 'currency_edit', name: 'Edit', parent: 'currencies' },
      { key: 'currency_delete', name: 'Delete', parent: 'currencies' },

      { key: 'languages', name: 'Languages', parent: null },
      { key: 'language_create', name: 'Create', parent: 'languages' },
      { key: 'language_view', name: 'View', parent: 'languages' },
      { key: 'language_edit', name: 'Edit', parent: 'languages' },
      { key: 'language_delete', name: 'Delete', parent: 'languages' },

      { key: 'tax_types', name: 'Tax Types', parent: null },
      { key: 'tax_type_create', name: 'Create', parent: 'tax_types' },
      { key: 'tax_type_view', name: 'View', parent: 'tax_types' },
      { key: 'tax_type_edit', name: 'Edit', parent: 'tax_types' },
      { key: 'tax_type_delete', name: 'Delete', parent: 'tax_types' },

      { key: 'tax_percentages', name: 'Tax Percentages', parent: null },
      { key: 'tax_percentage_create', name: 'Create', parent: 'tax_percentages' },
      { key: 'tax_percentage_view', name: 'View', parent: 'tax_percentages' },
      { key: 'tax_percentage_edit', name: 'Edit', parent: 'tax_percentages' },
      { key: 'tax_percentage_delete', name: 'Delete', parent: 'tax_percentages' },
    ];

    // 3. Insert Permissions
    for (const p of permissions) {
      // Check if exists
      const check = await pool.request()
        .input('key', sql.NVarChar, p.key)
        .query('SELECT Id FROM Permissions WHERE PermissionKey = @key');

      if (check.recordset.length === 0) {
        await pool.request()
          .input('key', sql.NVarChar, p.key)
          .input('name', sql.NVarChar, p.name)
          .input('parent', sql.NVarChar, p.parent)
          .query(`
            INSERT INTO Permissions (PermissionKey, Name, ParentKey)
            VALUES (@key, @name, @parent)
          `);
        console.log(`Initialized permission: ${p.key}`);
      } else {
      }
    }
    
    // ----------------------------------------------------
    // 4. ASSIGN ALL TO SUPERADMIN
    // ----------------------------------------------------
    const superAdminRole = await pool.request().query`
      SELECT RoleId FROM Roles WHERE RoleName = 'superadmin'
    `;

    if (superAdminRole.recordset.length > 0) {
        const saId = superAdminRole.recordset[0].RoleId;
        console.log(`ℹ️ Found SuperAdmin Role ID: ${saId}. Assigning all permissions...`);

        for (const p of permissions) {
            const check = await pool.request()
                .input('rid', sql.Int, saId)
                .input('pkey', sql.NVarChar, p.key)
                .query('SELECT Id FROM RolePermissions WHERE RoleId = @rid AND PermissionKey = @pkey');

            if (check.recordset.length === 0) {
                await pool.request()
                    .input('rid', sql.Int, saId)
                    .input('pkey', sql.NVarChar, p.key)
                    .query('INSERT INTO RolePermissions (RoleId, PermissionKey) VALUES (@rid, @pkey)');
                console.log(`   + Assigned ${p.key} to SuperAdmin`);
            }
        }
    } else {
        console.warn("⚠️ 'superadmin' role NOT FOUND. Please create it manually or via seedRoles.js first.");
    }

    console.log("🎉 Permissions seeding completed.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding Error:", error);
    process.exit(1);
  }
};

seedPermissions();
