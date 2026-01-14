module.exports = {
  USER: {
    CREATE: "user_create", 
    VIEW: "user_view",
    EDIT: "user_edit",
    DELETE: "user_delete",
  },

  ROLE: {
    CREATE: "role_create",
    VIEW: "role_view",
    EDIT: "role_edit",
    DELETE: "role_delete",
  },

  COUNTRIES: {
    CREATE: "country_create", 
    VIEW: "country_view",
    EDIT: "country_edit",
    DELETE: "country_delete",
  },
  
  STATES: {
    CREATE: "state_create",
    VIEW: "state_view",
    EDIT: "state_edit",
    DELETE: "state_delete",
  },

  CITIES: {
    CREATE: "city_create",
    VIEW: "city_view",
    EDIT: "city_edit",
    DELETE: "city_delete",
  },

  REGIONS: {
    CREATE: "region_create",
    VIEW: "region_view",
    EDIT: "region_edit",
    DELETE: "region_delete",
  },

  TERRITORIES: {
    CREATE: "territory_create",
    VIEW: "territory_view",
    EDIT: "territory_edit",
    DELETE: "territory_delete",
  },

  CUSTOMER_GROUPS: {
    CREATE: "customer_group_create",
    VIEW: "customer_group_view",
    EDIT: "customer_group_edit",
    DELETE: "customer_group_delete",
  },
  SUPPLIER_GROUPS: {
    CREATE: "supplier_group_create",
    VIEW: "supplier_group_view",
    EDIT: "supplier_group_edit",
    DELETE: "supplier_group_delete",
  },
  BANKS: {
    CREATE: "bank_create",
    VIEW: "bank_view",
    EDIT: "bank_edit",
    DELETE: "bank_delete",
  },
  EXPENSE_TYPES: {
    CREATE: "expense_type_create",
    VIEW: "expense_type_view",
    EDIT: "expense_type_edit",
    DELETE: "expense_type_delete",
  },
  SERVICES_MASTER: {
    CREATE: "service_master_create",
    VIEW: "service_master_view",
    EDIT: "service_master_edit",
    DELETE: "service_master_delete",
  },
  SHIPPERS: {
    CREATE: "shipper_create",
    VIEW: "shipper_view",
    EDIT: "shipper_edit",
    DELETE: "shipper_delete",
  },
  WAREHOUSES: {
    CREATE: "warehouse_create",
    VIEW: "warehouse_view",
    EDIT: "warehouse_edit",
    DELETE: "warehouse_delete",
  },
  AGENDA_ITEM_TYPES: {
    CREATE: "agenda_item_type_create",
    VIEW: "agenda_item_type_view",
    EDIT: "agenda_item_type_edit",
    DELETE: "agenda_item_type_delete",
  },
  MEETING_TYPES: {
    CREATE: "meeting_type_create",
    VIEW: "meeting_type_view",
    EDIT: "meeting_type_edit",
    DELETE: "meeting_type_delete",
  },
  LOCATIONS: {
    CREATE: "location_create",
    VIEW: "location_view",
    EDIT: "location_edit",
    DELETE: "location_delete",
  },
  ATTENDANCE_STATUS: {
    CREATE: "attendance_status_create",
    VIEW: "attendance_status_view",
    EDIT: "attendance_status_edit",
    DELETE: "attendance_status_delete",
  },
  ATTENDEE_TYPES: {
    CREATE: "attendee_type_create",
    VIEW: "attendee_type_view",
    EDIT: "attendee_type_edit",
    DELETE: "attendee_type_delete",
  },
  RESOLUTION_STATUS: {
    CREATE: "resolution_status_create",
    VIEW: "resolution_status_view",
    EDIT: "resolution_status_edit",
    DELETE: "resolution_status_delete",
  },
  DEDUCTIONS: {
    CREATE: "deduction_create",
    VIEW: "deduction_view",
    EDIT: "deduction_edit",
    DELETE: "deduction_delete",
  },
  INCOMES: {
    CREATE: "income_create",
    VIEW: "income_view",
    EDIT: "income_edit",
    DELETE: "income_delete",
  },
  CURRENCIES: {
      CREATE: "currency_create",
      VIEW: "currency_view",
      EDIT: "currency_edit",
      DELETE: "currency_delete",
  },
  LANGUAGES: {
      CREATE: "language_create",
      VIEW: "language_view",
      EDIT: "language_edit",
      DELETE: "language_delete",
  },
  
  // MODULES (Using the keys we seeded)
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  
  // MODULES
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  
  SALES: {
      CREATE: "sales_create",
      VIEW: "sales_view",
      EDIT: "sales_edit",
      DELETE: "sales_delete",
  },

  INVENTORY: {
      VIEW: "inventory_view",
      // Products (Sub-module)
      PRODUCTS: {
        CREATE: "product_create",
        VIEW: "product_view",
        EDIT: "product_edit",
        DELETE: "product_delete",
      },
      CATEGORIES: {
        CREATE: "category_create",
        VIEW: "category_view",
        EDIT: "category_edit",
        DELETE: "category_delete",
      },
      UNITS: {
        CREATE: "unit_create",
        VIEW: "unit_view",
        EDIT: "unit_edit",
        DELETE: "unit_delete",
      },
      BRANDS: {
        CREATE: "brand_create",
        VIEW: "brand_view",
        EDIT: "brand_edit",
        DELETE: "brand_delete",
      },
      DAMAGED_PRODUCTS: {
        CREATE: "damaged_product_create",
        VIEW: "damaged_product_view",
        EDIT: "damaged_product_edit",
        DELETE: "damaged_product_delete",
      },
      GOODS_RECEIPTS: {
        CREATE: "goods_receipt_create",
        VIEW: "goods_receipt_view",
        EDIT: "goods_receipt_edit",
        DELETE: "goods_receipt_delete",
      },
      GOODS_ISSUE: {
        CREATE: "goods_issue_create",
        VIEW: "goods_issue_view",
        EDIT: "goods_issue_edit",
        DELETE: "goods_issue_delete",
      }
  },
  
  PURCHASING: {
      CREATE: "purchasing_create",
      VIEW: "purchasing_view",
      EDIT: "purchasing_edit",
      DELETE: "purchasing_delete",
  },

  SERVICES: {
      CREATE: "services_create",
      VIEW: "services_view",
      EDIT: "services_edit",
      DELETE: "services_delete",
  },

  CASH_BANK: {
      CREATE: "cash_bank_create",
      VIEW: "cash_bank_view",
      EDIT: "cash_bank_edit",
      DELETE: "cash_bank_delete",
  },
  
  FINANCIAL: {
      CREATE: "financial_create",
      VIEW: "financial_view",
      EDIT: "financial_edit",
      DELETE: "financial_delete",
  },

  HR: {
      VIEW: "hr_view", // General
      // Employees
      EMPLOYEES: {
        CREATE: "employee_create",
        VIEW: "employee_view",
        EDIT: "employee_edit",
        DELETE: "employee_delete",
      },
      DEPARTMENTS: {
        CREATE: "department_create",
        VIEW: "department_view",
        EDIT: "department_edit",
        DELETE: "department_delete",
      },
      DESIGNATIONS: {
        CREATE: "designation_create",
        VIEW: "designation_view",
        EDIT: "designation_edit",
        DELETE: "designation_delete",
      },
      PAYROLL: {
        CREATE: "payroll_create",
        VIEW: "payroll_view",
        EDIT: "payroll_edit",
        DELETE: "payroll_delete",
      },
      ATTENDANCE: {
        CREATE: "attendance_create",
        VIEW: "attendance_view",
        EDIT: "attendance_edit",
        DELETE: "attendance_delete",
      }
  },
  
  MEETINGS: {
      CREATE: "meeting_create",
      VIEW: "meeting_view",
      EDIT: "meeting_edit",
      DELETE: "meeting_delete",
  },
  
  CUSTOMERS: {
      CREATE: "customer_create",
      VIEW: "customer_view",
      EDIT: "customer_edit",
      DELETE: "customer_delete",
  },

  SUPPLIERS: {
      CREATE: "supplier_create",
      VIEW: "supplier_view",
      EDIT: "supplier_edit",
      DELETE: "supplier_delete",
  },
  
  REPORTS: {
      CREATE: "reports_create",
      VIEW: "reports_view",
      EDIT: "reports_edit",
      DELETE: "reports_delete",
  },

  SETTINGS: "settings"
};


