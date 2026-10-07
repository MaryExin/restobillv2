-- Lightem fresh-install schema. No application rows or triggers.

CREATE TABLE `lkp_discount_type` (
  `id` int(11) NOT NULL,
  `discount_name` varchar(50) NOT NULL,
  `calculation_type` enum('percentage','fixed') DEFAULT 'percentage',
  `default_value` decimal(5,2) DEFAULT 0.00,
  `is_vat_exempt` tinyint(1) DEFAULT 0,
  `is_system_defined` tinyint(1) DEFAULT 0,
  `industry_type` enum('universal','fnb','retail') DEFAULT 'universal',
  `status` enum('active','inactive') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `lkp_loyalty_cs_name` (
  `id` int(11) NOT NULL,
  `customer_name` varchar(150) NOT NULL,
  `phone_number` varchar(20) NOT NULL,
  `loyalty_points` decimal(10,2) NOT NULL DEFAULT 0.00,
  `date_registered` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `lkp_sales_type` (
  `seq` int(11) NOT NULL,
  `sales_type_id` varchar(45) NOT NULL,
  `description` varchar(45) NOT NULL,
  `deletestatus` varchar(45) NOT NULL,
  `usertracker` varchar(45) NOT NULL,
  `createdtime` varchar(45) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_employees` (
  `seq` int(11) NOT NULL,
  `payroll_empid` varchar(255) NOT NULL,
  `empid` varchar(255) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `firstname` varchar(45) NOT NULL,
  `middlename` varchar(45) DEFAULT NULL,
  `lastname` varchar(45) NOT NULL,
  `position` varchar(45) NOT NULL,
  `department` varchar(45) NOT NULL,
  `birthdate` date NOT NULL,
  `sss` bigint(20) NOT NULL,
  `phic` bigint(20) NOT NULL,
  `mdf` bigint(20) NOT NULL,
  `tin` bigint(20) NOT NULL,
  `contact_no` bigint(20) NOT NULL,
  `email` varchar(45) NOT NULL,
  `address` varchar(45) NOT NULL,
  `salary` double NOT NULL,
  `salary_type` varchar(255) NOT NULL,
  `date_started` date NOT NULL,
  `status` varchar(45) NOT NULL,
  `tax_class` varchar(45) NOT NULL,
  `spp_class` varchar(45) NOT NULL,
  `busunit_code` varchar(45) NOT NULL,
  `factordays` int(11) NOT NULL,
  `image_filename` varchar(255) DEFAULT NULL,
  `deletestatus` varchar(45) NOT NULL,
  `usertracker` varchar(255) NOT NULL,
  `createdtime` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_expenses` (
  `seq` int(11) NOT NULL,
  `busunitcode` varchar(45) DEFAULT NULL,
  `inv_number` varchar(255) DEFAULT NULL,
  `expenses_desc` varchar(255) DEFAULT NULL,
  `expenses_amount` varchar(45) DEFAULT NULL,
  `user` varchar(45) DEFAULT NULL,
  `deletestatus` varchar(45) DEFAULT NULL,
  `datacreated` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_inventory_customer_list` (
  `AutoNum` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `customer_type` varchar(255) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `customer_id_number` varchar(255) NOT NULL,
  `ordering_passcode` varchar(255) NOT NULL,
  `tin` varchar(255) NOT NULL,
  `business_style` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `email_address` varchar(255) NOT NULL,
  `record_status` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `tbl_inventory_customer_po` (
  `AutoNum` int(11) NOT NULL,
  `po_id` int(11) NOT NULL,
  `po_date` datetime NOT NULL,
  `delivery_date` date NOT NULL,
  `customer_id` int(11) NOT NULL,
  `contact_person` varchar(255) NOT NULL,
  `contact_person_phone` varchar(25) NOT NULL,
  `delivery_address` varchar(255) NOT NULL,
  `product_id` int(11) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `unit_of_measure` varchar(255) NOT NULL,
  `unit_cost` double NOT NULL,
  `selling_price` double NOT NULL,
  `discount` double NOT NULL,
  `bar_code` varchar(8) NOT NULL,
  `sku` varchar(6) NOT NULL,
  `order_quantity` double NOT NULL,
  `prepared_by` varchar(255) NOT NULL,
  `acknowledged_by` varchar(255) NOT NULL,
  `order_status` varchar(255) NOT NULL,
  `record_status` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `tbl_inventory_in_transactions` (
  `AutoNum` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `category_code` varchar(255) NOT NULL,
  `unit_code` varchar(255) NOT NULL,
  `Project_Code` varchar(100) NOT NULL,
  `product_id` int(11) NOT NULL,
  `barcode` varchar(255) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `unit_of_measure` varchar(255) NOT NULL,
  `quantity` double NOT NULL,
  `unit_price` double NOT NULL,
  `selling_price` double NOT NULL,
  `discount` double NOT NULL,
  `amount` double NOT NULL,
  `bill_to` varchar(100) NOT NULL,
  `ship_to` varchar(100) NOT NULL,
  `date_time` datetime NOT NULL,
  `po_number` int(11) NOT NULL,
  `ack_no` int(255) NOT NULL,
  `dr_number` int(11) NOT NULL,
  `dr_date` date NOT NULL,
  `consignment` varchar(255) NOT NULL,
  `business_style` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `memo` varchar(1000) NOT NULL,
  `prepared_by` varchar(255) NOT NULL,
  `checked_by` varchar(255) NOT NULL,
  `approved_by` varchar(255) NOT NULL,
  `released_by` varchar(255) NOT NULL,
  `received_by` varchar(255) NOT NULL,
  `remarks` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_inventory_loss_transactions` (
  `AutoNum` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `category_code` varchar(255) NOT NULL,
  `unit_code` varchar(255) NOT NULL,
  `Project_Code` varchar(100) NOT NULL,
  `product_id` int(11) NOT NULL,
  `barcode` varchar(255) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `unit_of_measure` varchar(255) NOT NULL,
  `quantity` double NOT NULL,
  `unit_price` double NOT NULL,
  `selling_price` double NOT NULL,
  `discount` double NOT NULL,
  `amount` double NOT NULL,
  `bill_to` varchar(100) NOT NULL,
  `ship_to` varchar(100) NOT NULL,
  `date_time` datetime NOT NULL,
  `dr_no` int(255) NOT NULL,
  `invoice_number` int(11) NOT NULL,
  `invoice_date` date NOT NULL,
  `consignment` varchar(255) NOT NULL,
  `business_style` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `memo` varchar(1000) NOT NULL,
  `prepared_by` varchar(255) NOT NULL,
  `checked_by` varchar(255) NOT NULL,
  `approved_by` varchar(255) NOT NULL,
  `released_by` varchar(255) NOT NULL,
  `received_by` varchar(255) NOT NULL,
  `remarks` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `tbl_inventory_out_transactions` (
  `AutoNum` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `category_code` varchar(255) NOT NULL,
  `unit_code` varchar(255) NOT NULL,
  `Project_Code` varchar(100) NOT NULL,
  `product_id` int(11) NOT NULL,
  `barcode` varchar(255) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `unit_of_measure` varchar(255) NOT NULL,
  `quantity` double NOT NULL,
  `unit_price` double NOT NULL,
  `selling_price` double NOT NULL,
  `discount` double NOT NULL,
  `amount` double NOT NULL,
  `bill_to` varchar(100) NOT NULL,
  `ship_to` varchar(100) NOT NULL,
  `date_time` datetime NOT NULL,
  `cpo_number` int(11) NOT NULL,
  `dr_no` int(255) NOT NULL,
  `invoice_number` int(11) NOT NULL,
  `invoice_date` date NOT NULL,
  `consignment` varchar(255) NOT NULL,
  `business_style` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `memo` varchar(1000) NOT NULL,
  `prepared_by` varchar(255) NOT NULL,
  `checked_by` varchar(255) NOT NULL,
  `approved_by` varchar(255) NOT NULL,
  `released_by` varchar(255) NOT NULL,
  `received_by` varchar(255) NOT NULL,
  `remarks` varchar(255) NOT NULL,
  `description` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `tbl_inventory_products_beginningending` (
  `AutoNum` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `beginning_date` datetime NOT NULL,
  `ending_date` datetime NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `product_id` varchar(255) NOT NULL,
  `item_category` varchar(255) NOT NULL,
  `barcode` varchar(255) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `unit_of_measure` varchar(255) NOT NULL,
  `unit_price` double NOT NULL,
  `selling_price` double NOT NULL,
  `beginning_inventory` double NOT NULL,
  `total_in` double NOT NULL,
  `item_return` double NOT NULL,
  `item_repair` double NOT NULL,
  `total_out` double NOT NULL,
  `sponsorship` double NOT NULL,
  `freebies` double NOT NULL,
  `assorted` double NOT NULL,
  `portioning` double NOT NULL,
  `item_usage` double NOT NULL,
  `sales` double NOT NULL,
  `item_damage` double NOT NULL,
  `item_spoilage` double NOT NULL,
  `item_expired` double NOT NULL,
  `ending_inventory` double NOT NULL,
  `actual_count` double NOT NULL,
  `variance` double NOT NULL,
  `prepared_by` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `tbl_inventory_products_masterlist` (
  `seq` int(11) NOT NULL,
  `product_id` varchar(255) NOT NULL,
  `category_code` varchar(255) NOT NULL,
  `unit_code` varchar(255) NOT NULL,
  `inventory_type` varchar(255) NOT NULL,
  `item_category` varchar(255) NOT NULL,
  `subcategory_item_category` varchar(255) DEFAULT NULL,
  `item_name` varchar(255) NOT NULL,
  `item_description` varchar(255) NOT NULL,
  `unit_of_measure` varchar(255) NOT NULL,
  `item_color` varchar(255) NOT NULL,
  `item_brand` varchar(255) NOT NULL,
  `item_variant` varchar(255) NOT NULL,
  `item_size` varchar(255) NOT NULL,
  `unit_cost` double NOT NULL,
  `selling_price` double NOT NULL,
  `vatable` varchar(255) NOT NULL,
  `bar_code` varchar(255) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `isDiscountable` varchar(10) DEFAULT 'Yes',
  `beginning_inventory` double NOT NULL,
  `actual_count` double NOT NULL,
  `remaining_count` double NOT NULL,
  `variance` varchar(255) NOT NULL,
  `safety_stock` double NOT NULL,
  `reordering_point` double NOT NULL,
  `status` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_inventory_shifting_records` (
  `ID` int(11) NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` int(11) NOT NULL,
  `Shift_ID` int(11) NOT NULL,
  `Opening_User_ID` int(11) NOT NULL,
  `Opening_DateTime` datetime NOT NULL,
  `Closing_User_ID` int(11) NOT NULL,
  `Closing_DateTime` datetime NOT NULL,
  `Shift_Status` varchar(255) NOT NULL,
  `Remarks` varchar(255) NOT NULL,
  `Status` varchar(255) NOT NULL,
  `Date_Recorded` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_accountclass` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `Unit_Code` double NOT NULL,
  `AccountClass_Code` varchar(100) NOT NULL,
  `AccountClass_Name` varchar(500) NOT NULL,
  `AccountClass_Notes` varchar(500) NOT NULL,
  `Status` varchar(100) NOT NULL,
  `Remarks` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_activity_logs` (
  `ID` int(11) NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` int(11) NOT NULL,
  `activity_date_time` datetime NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `user_name` varchar(255) NOT NULL,
  `type_of_activity` varchar(255) NOT NULL,
  `activity_performed` varchar(255) NOT NULL,
  `values_of_data` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_business_category` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `Category_Name` varchar(100) NOT NULL,
  `Category_Description` varchar(100) NOT NULL,
  `Print_Color1` double NOT NULL,
  `Print_Color2` double NOT NULL,
  `Print_Color3` double NOT NULL,
  `Status` varchar(100) NOT NULL,
  `Remarks` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_business_units` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `Corp_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `Unit_Name` varchar(500) NOT NULL,
  `Unit_TIN` varchar(500) NOT NULL,
  `Unit_Address` varchar(500) NOT NULL,
  `Business_Type` varchar(255) NOT NULL,
  `VAT_Registration` varchar(255) NOT NULL,
  `Region_Name` varchar(100) NOT NULL,
  `Area_Name` varchar(100) NOT NULL,
  `Notes` varchar(1000) NOT NULL,
  `MD` varchar(200) NOT NULL,
  `GM` varchar(200) NOT NULL,
  `BP` varchar(500) NOT NULL,
  `Code_2` varchar(100) NOT NULL,
  `Status` varchar(100) NOT NULL,
  `Remarks` varchar(100) NOT NULL,
  `Date_Open` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_chartofaccounts` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `GLSL` double NOT NULL,
  `GL_Account` varchar(1000) NOT NULL,
  `GL` double NOT NULL,
  `SL_Account` varchar(1000) NOT NULL,
  `ExpandedAccounts` varchar(500) NOT NULL,
  `ExpandedAccountDesc` varchar(500) NOT NULL,
  `Added_By` varchar(100) NOT NULL,
  `Added_Date` varchar(100) NOT NULL,
  `Edited_By` varchar(100) NOT NULL,
  `Edited_Date` varchar(100) NOT NULL,
  `Deleted_By` varchar(100) NOT NULL,
  `Deleted_Date` varchar(100) NOT NULL,
  `Aging_Type` varchar(100) NOT NULL,
  `Status` varchar(100) NOT NULL,
  `Remarks` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_corporations` (
  `ID` double NOT NULL,
  `Corp_Code` double NOT NULL,
  `Corp_Name` varchar(1000) NOT NULL,
  `Corp_Address` varchar(1000) NOT NULL,
  `Corp_TIN` varchar(100) NOT NULL,
  `Status` varchar(100) NOT NULL,
  `Remarks` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_costcenter` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `CostCenter_Code` varchar(100) NOT NULL,
  `CostCenter_Name` varchar(500) NOT NULL,
  `CostCenter_Notes` varchar(500) NOT NULL,
  `Status` varchar(100) NOT NULL,
  `Remarks` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_expandedpnlaccounts` (
  `ID` int(11) NOT NULL,
  `ExpandedAccounts` varchar(500) NOT NULL,
  `ExpandedAccountDesc` varchar(500) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_projects` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `Unit_Code` double NOT NULL,
  `Project_Code` varchar(100) NOT NULL,
  `Project_Name` varchar(500) NOT NULL,
  `Project_Notes` varchar(500) NOT NULL,
  `Start_Date` date NOT NULL,
  `End_Date` date NOT NULL,
  `Duration_Date` date NOT NULL,
  `Duration_Days` int(11) NOT NULL,
  `Status` varchar(100) NOT NULL,
  `Remarks` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_signatories` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `Unit_Code` double NOT NULL,
  `Signatory_Code` int(11) NOT NULL,
  `Signatory_Name` varchar(500) NOT NULL,
  `Notes` varchar(255) NOT NULL,
  `Status` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_suppliers` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `Unit_Code` double NOT NULL,
  `Supplier_Code` int(11) NOT NULL,
  `Supplier_Name` varchar(500) NOT NULL,
  `Supplier_TIN` varchar(500) NOT NULL,
  `Supplier_Address` varchar(500) NOT NULL,
  `Supplier_Notes` varchar(500) NOT NULL,
  `Supplier_Notes2` varchar(500) NOT NULL,
  `Status` varchar(100) NOT NULL,
  `Remarks` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_suppliers_wtax_reference` (
  `ID` double NOT NULL,
  `Supplier_Code` int(11) NOT NULL,
  `WTax_Reference` varchar(500) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_transaction` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `Unit_Code` double NOT NULL,
  `Transaction_Type` varchar(100) NOT NULL,
  `Transaction_Reference_No` double NOT NULL,
  `Supplier_Code` int(11) NOT NULL,
  `Transaction_Date` date NOT NULL,
  `GLSL` double NOT NULL,
  `Debit_Credit` varchar(100) NOT NULL,
  `Amount` double NOT NULL,
  `Item_Description` varchar(3000) NOT NULL,
  `Ref_No` varchar(100) NOT NULL,
  `ATC_Code` varchar(100) NOT NULL,
  `Project_Code` varchar(100) NOT NULL,
  `CostCenter_Code` varchar(100) NOT NULL,
  `AccountClass_Code` varchar(100) NOT NULL,
  `Other_Remarks` varchar(200) NOT NULL,
  `Status` varchar(200) NOT NULL,
  `DateTime_Created` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_transaction_logs` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `Unit_Code` double NOT NULL,
  `Register` varchar(100) NOT NULL,
  `Trans_Date` date NOT NULL,
  `Reference_No` varchar(500) NOT NULL,
  `Trans_Type` varchar(500) NOT NULL,
  `User_ID` int(11) NOT NULL,
  `Amount` double NOT NULL,
  `Description` varchar(1000) NOT NULL,
  `Log_Date` date NOT NULL,
  `Log_Time` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_users` (
  `ID` double NOT NULL,
  `User_ID` double NOT NULL,
  `User_Name` varchar(1000) NOT NULL,
  `User_Password` varchar(100) NOT NULL,
  `First_Name` varchar(100) NOT NULL,
  `Middle_Initial` varchar(100) NOT NULL,
  `Last_Name` varchar(100) NOT NULL,
  `Gender` varchar(255) NOT NULL,
  `User_Role` varchar(100) NOT NULL,
  `Notes` varchar(1000) NOT NULL,
  `Status` varchar(100) NOT NULL,
  `Remarks` varchar(100) NOT NULL,
  `preference_theme_style` varchar(255) NOT NULL,
  `preference_theme_color_1` varchar(255) NOT NULL,
  `preference_theme_color_2` varchar(255) NOT NULL,
  `preference_theme_color_3` varchar(255) NOT NULL,
  `preference_theme_color_4` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_users_credentials_business_units` (
  `AutoNum` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `category_code` varchar(255) NOT NULL,
  `unit_code` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_users_credentials_system_features` (
  `AutoNum` int(11) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `system_module` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `feature_description` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_main_wtax_reference` (
  `ID` int(11) NOT NULL,
  `ATC` varchar(100) NOT NULL,
  `Title` varchar(300) NOT NULL,
  `Description` varchar(500) NOT NULL,
  `Percentage` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_mode_of_payment` (
  `seq` int(11) NOT NULL,
  `mop_id` varchar(45) NOT NULL,
  `mop` varchar(45) NOT NULL,
  `sl_code` varchar(45) NOT NULL,
  `reference_On_Off` tinyint(1) DEFAULT NULL,
  `MOP_On_Off` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_payroll_employee_masterlist` (
  `AutoNum` int(11) NOT NULL,
  `employee_id` int(11) NOT NULL,
  `category_code` varchar(255) NOT NULL,
  `unit_code` int(11) NOT NULL,
  `previous_category_code` varchar(255) NOT NULL,
  `previous_unit_code` int(11) NOT NULL,
  `employee_name` varchar(100) NOT NULL,
  `department` varchar(300) NOT NULL,
  `position` varchar(300) NOT NULL,
  `employment_status` varchar(300) NOT NULL,
  `hiring_date` date NOT NULL,
  `salary_type` varchar(100) NOT NULL,
  `salary` double NOT NULL,
  `allowance_1_description` varchar(255) NOT NULL,
  `allowance_1_amount` double NOT NULL,
  `allowance_1_type` varchar(255) NOT NULL,
  `allowance_1_taxable` varchar(255) NOT NULL,
  `allowance_1_date_to_pay` int(11) NOT NULL,
  `allowance_2_description` varchar(255) NOT NULL,
  `allowance_2_amount` double NOT NULL,
  `allowance_2_type` varchar(255) NOT NULL,
  `allowance_2_taxable` varchar(255) NOT NULL,
  `allowance_2_date_to_pay` int(11) NOT NULL,
  `allowance_3_description` varchar(255) NOT NULL,
  `allowance_3_amount` double NOT NULL,
  `allowance_3_type` varchar(255) NOT NULL,
  `allowance_3_taxable` varchar(255) NOT NULL,
  `allowance_3_date_to_pay` int(11) NOT NULL,
  `allowance_4_description` varchar(255) NOT NULL,
  `allowance_4_amount` double NOT NULL,
  `allowance_4_type` varchar(255) NOT NULL,
  `allowance_4_taxable` varchar(255) NOT NULL,
  `allowance_4_date_to_pay` int(11) NOT NULL,
  `allowance_5_description` varchar(255) NOT NULL,
  `allowance_5_amount` double NOT NULL,
  `allowance_5_type` varchar(255) NOT NULL,
  `allowance_5_taxable` varchar(255) NOT NULL,
  `allowance_5_date_to_pay` int(11) NOT NULL,
  `allowance_6_description` varchar(255) NOT NULL,
  `allowance_6_amount` double NOT NULL,
  `allowance_6_type` varchar(255) NOT NULL,
  `allowance_6_taxable` varchar(255) NOT NULL,
  `allowance_6_date_to_pay` int(11) NOT NULL,
  `allowance_7_description` varchar(255) NOT NULL,
  `allowance_7_amount` double NOT NULL,
  `allowance_7_type` varchar(255) NOT NULL,
  `allowance_7_taxable` varchar(255) NOT NULL,
  `allowance_7_date_to_pay` int(11) NOT NULL,
  `allowance_8_description` varchar(255) NOT NULL,
  `allowance_8_amount` double NOT NULL,
  `allowance_8_type` varchar(255) NOT NULL,
  `allowance_8_taxable` varchar(255) NOT NULL,
  `allowance_8_date_to_pay` int(11) NOT NULL,
  `allowance_9_description` varchar(255) NOT NULL,
  `allowance_9_amount` double NOT NULL,
  `allowance_9_type` varchar(255) NOT NULL,
  `allowance_9_taxable` varchar(255) NOT NULL,
  `allowance_9_date_to_pay` int(11) NOT NULL,
  `allowance_10_description` varchar(255) NOT NULL,
  `allowance_10_amount` double NOT NULL,
  `allowance_10_type` varchar(255) NOT NULL,
  `allowance_10_taxable` varchar(255) NOT NULL,
  `allowance_10_date_to_pay` int(11) NOT NULL,
  `cola` double NOT NULL,
  `active` varchar(100) NOT NULL,
  `bank_account_number` varchar(300) NOT NULL,
  `tax_status` varchar(300) NOT NULL,
  `tin` varchar(100) NOT NULL,
  `sss` varchar(100) NOT NULL,
  `ph` varchar(100) NOT NULL,
  `pbg` varchar(100) NOT NULL,
  `deduct_tax` varchar(100) NOT NULL,
  `deduct_sss` varchar(100) NOT NULL,
  `deduct_philhealth` varchar(100) NOT NULL,
  `deduct_pagibig` varchar(100) NOT NULL,
  `other_deductions_1_description` varchar(255) NOT NULL,
  `other_deductions_1_amount` double NOT NULL,
  `other_deductions_1_type` varchar(255) NOT NULL,
  `other_deductions_1_date_to_deduct` int(11) NOT NULL,
  `other_deductions_2_description` varchar(255) NOT NULL,
  `other_deductions_2_amount` double NOT NULL,
  `other_deductions_2_type` varchar(255) NOT NULL,
  `other_deductions_2_date_to_deduct` int(11) NOT NULL,
  `other_deductions_3_description` varchar(255) NOT NULL,
  `other_deductions_3_amount` double NOT NULL,
  `other_deductions_3_type` varchar(255) NOT NULL,
  `other_deductions_3_date_to_deduct` int(11) NOT NULL,
  `other_deductions_4_description` varchar(255) NOT NULL,
  `other_deductions_4_amount` double NOT NULL,
  `other_deductions_4_type` varchar(255) NOT NULL,
  `other_deductions_4_date_to_deduct` int(11) NOT NULL,
  `other_deductions_5_description` varchar(255) NOT NULL,
  `other_deductions_5_amount` double NOT NULL,
  `other_deductions_5_type` varchar(255) NOT NULL,
  `other_deductions_5_date_to_deduct` int(11) NOT NULL,
  `other_deductions_6_description` varchar(255) NOT NULL,
  `other_deductions_6_amount` double NOT NULL,
  `other_deductions_6_type` varchar(255) NOT NULL,
  `other_deductions_6_date_to_deduct` int(11) NOT NULL,
  `other_deductions_7_description` varchar(255) NOT NULL,
  `other_deductions_7_amount` double NOT NULL,
  `other_deductions_7_type` varchar(255) NOT NULL,
  `other_deductions_7_date_to_deduct` int(11) NOT NULL,
  `other_deductions_8_description` varchar(255) NOT NULL,
  `other_deductions_8_amount` double NOT NULL,
  `other_deductions_8_type` varchar(255) NOT NULL,
  `other_deductions_8_date_to_deduct` int(11) NOT NULL,
  `other_deductions_9_description` varchar(255) NOT NULL,
  `other_deductions_9_amount` double NOT NULL,
  `other_deductions_9_type` varchar(255) NOT NULL,
  `other_deductions_9_date_to_deduct` int(11) NOT NULL,
  `other_deductions_10_description` varchar(255) NOT NULL,
  `other_deductions_10_amount` double NOT NULL,
  `other_deductions_10_type` varchar(255) NOT NULL,
  `other_deductions_10_date_to_deduct` int(11) NOT NULL,
  `sched_type` varchar(300) NOT NULL,
  `flexi_time` varchar(200) NOT NULL,
  `grace_period_consumables` double NOT NULL,
  `grace_period_consumables_amount` double NOT NULL,
  `allotted_leaves` double NOT NULL,
  `compute_holidays_regular` varchar(255) NOT NULL,
  `compute_holidays_special` varchar(255) NOT NULL,
  `gender` varchar(50) NOT NULL,
  `birthdate` date NOT NULL,
  `primary_address` varchar(500) NOT NULL,
  `secondary_address` varchar(500) NOT NULL,
  `contact_no` varchar(200) NOT NULL,
  `nationality` varchar(200) NOT NULL,
  `civil_status` varchar(200) NOT NULL,
  `religion` varchar(200) NOT NULL,
  `primary_school` varchar(500) NOT NULL,
  `secondary_school` varchar(500) NOT NULL,
  `tertiary_school` varchar(500) NOT NULL,
  `course` varchar(300) NOT NULL,
  `employer_1` varchar(200) NOT NULL,
  `pnl_account_class` varchar(200) NOT NULL,
  `employee_category` varchar(250) NOT NULL,
  `movement_date` date NOT NULL,
  `effectivity_date` date NOT NULL,
  `floating_date` date NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPRESSED;

CREATE TABLE `tbl_pos_developer_account` (
  `singleton_id` tinyint(3) UNSIGNED NOT NULL,
  `subject_id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(120) NOT NULL,
  `email` varchar(255) NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `credential_version` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_discount_type_sales_type` (
  `id` int(11) NOT NULL,
  `discount_type_id` int(11) NOT NULL,
  `sales_type_id` varchar(50) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `percent_value` decimal(8,2) DEFAULT NULL,
  `usertracker` varchar(100) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_document_counters` (
  `Category_Code` varchar(100) NOT NULL,
  `Unit_Code` varchar(100) NOT NULL,
  `next_billing_no` bigint(20) NOT NULL DEFAULT 3000000001,
  `next_invoice_no` bigint(20) NOT NULL DEFAULT 4000000001,
  `next_transaction_id` bigint(20) NOT NULL DEFAULT 1000000001,
  `next_order_slip_no` bigint(20) NOT NULL DEFAULT 2000000001,
  `next_refund_id` varchar(50) DEFAULT NULL,
  `next_void_id` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_ledger` (
  `id` int(11) NOT NULL,
  `entry_type` enum('IN','OUT') NOT NULL,
  `category` varchar(100) DEFAULT 'General',
  `description` varchar(255) NOT NULL,
  `remarks` text DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `recorded_by` varchar(100) DEFAULT 'Admin',
  `entry_date` date DEFAULT curdate(),
  `entry_time` time DEFAULT curtime(),
  `status` enum('active','inactive') DEFAULT 'active',
  `void_reason` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_list_of_other_charges` (
  `ID` int(11) NOT NULL,
  `category` varchar(255) NOT NULL,
  `particulars` varchar(255) NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `rate_type` varchar(20) NOT NULL DEFAULT 'Percentage',
  `is_enabled` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_pos_loyalty_discounts` (
  `id` int(11) NOT NULL,
  `transaction_id` varchar(50) NOT NULL,
  `Category_Code` varchar(255) DEFAULT NULL,
  `Unit_Code` varchar(255) DEFAULT NULL,
  `Project_Code` varchar(255) DEFAULT NULL,
  `transaction_date` varchar(50) DEFAULT NULL,
  `loyalty_member_id` int(11) NOT NULL,
  `customer_name` varchar(150) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `points_redeemed` int(11) NOT NULL DEFAULT 0,
  `points_earned` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` varchar(20) NOT NULL DEFAULT 'Active',
  `usertracker` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_permissions` (
  `id` int(10) UNSIGNED NOT NULL,
  `permission_group` varchar(60) NOT NULL,
  `permission_key` varchar(80) NOT NULL,
  `permission_name` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_locked` tinyint(1) NOT NULL DEFAULT 0,
  `is_developer_only` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_roles` (
  `id` int(10) UNSIGNED NOT NULL,
  `role_key` varchar(80) NOT NULL,
  `role_value` varchar(64) NOT NULL,
  `role_name` varchar(100) NOT NULL,
  `role_tokens_json` text DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_by` varchar(80) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_role_permissions` (
  `role_id` int(10) UNSIGNED NOT NULL,
  `permission_id` int(10) UNSIGNED NOT NULL,
  `can_access` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_settings` (
  `ID` int(11) NOT NULL,
  `category` varchar(255) NOT NULL,
  `description` varchar(255) NOT NULL,
  `value` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_pos_shifting_records` (
  `ID` int(11) NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `Shift_ID` int(11) NOT NULL,
  `terminal_number` int(11) NOT NULL,
  `Opening_User_ID` int(11) NOT NULL,
  `Opening_DateTime` datetime NOT NULL,
  `Opening_Cash_Count` double NOT NULL,
  `Closing_User_ID` int(11) NOT NULL,
  `Closing_DateTime` datetime NOT NULL,
  `Closing_Cash_Count` double NOT NULL,
  `Beg_OR` double NOT NULL,
  `End_OR` double NOT NULL,
  `Beg_VoidNo` double NOT NULL,
  `End_VoidNo` double NOT NULL,
  `Beg_RefundNo` double NOT NULL,
  `End_RefundNo` double NOT NULL,
  `Z_Counter_No` double NOT NULL,
  `Grand_Accum_Sales` double NOT NULL,
  `Shift_Status` varchar(255) NOT NULL,
  `Remarks` varchar(255) NOT NULL,
  `Status` varchar(255) NOT NULL,
  `Date_Recorded` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_pos_tables` (
  `ID` int(11) NOT NULL,
  `category_code` varchar(255) NOT NULL,
  `unit_code` varchar(255) NOT NULL,
  `table_name` varchar(255) NOT NULL,
  `transaction_reference` bigint(20) NOT NULL,
  `status` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_pos_table_rooms` (
  `ID` int(11) NOT NULL,
  `category_code` varchar(100) NOT NULL,
  `unit_code` varchar(100) NOT NULL,
  `room_key` varchar(120) NOT NULL,
  `room_name` varchar(160) NOT NULL,
  `tables_json` longtext DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `date_recorded` datetime NOT NULL DEFAULT current_timestamp(),
  `date_updated` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_terminal_config` (
  `id` int(11) NOT NULL,
  `categoryCode` varchar(150) NOT NULL,
  `unitCode` varchar(150) NOT NULL,
  `businessUnitName` varchar(255) NOT NULL,
  `terminalNumber` varchar(50) NOT NULL,
  `corpName` varchar(255) NOT NULL,
  `machineNumber` varchar(100) NOT NULL,
  `serialNumber` varchar(100) NOT NULL,
  `ptuNumber` varchar(100) NOT NULL,
  `ptuDateIssued` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_transactions` (
  `ID` double NOT NULL,
  `transaction_id` double NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `Project_Code` varchar(100) NOT NULL,
  `transaction_type` varchar(255) NOT NULL,
  `transaction_date` date NOT NULL,
  `transaction_time` varchar(255) NOT NULL,
  `terminal_number` int(11) NOT NULL,
  `purchase_order_no` double NOT NULL,
  `order_slip_no` double NOT NULL,
  `billing_no` double NOT NULL,
  `invoice_no` double NOT NULL,
  `table_number` varchar(255) NOT NULL,
  `order_type` varchar(255) NOT NULL,
  `customer_exclusive_id` varchar(50) DEFAULT NULL,
  `customer_head_count` int(11) NOT NULL,
  `customer_count_for_discount` int(11) NOT NULL,
  `discount_type` varchar(255) NOT NULL,
  `TotalSales` double NOT NULL,
  `Discount` double NOT NULL,
  `OtherCharges` double NOT NULL,
  `TotalAmountDue` double NOT NULL,
  `VATableSales` double NOT NULL,
  `VATableSales_VAT` double NOT NULL,
  `VATExemptSales` double NOT NULL,
  `VATExemptSales_VAT` double NOT NULL,
  `VATZeroRatedSales` double NOT NULL,
  `payment_amount` double NOT NULL,
  `payment_method` varchar(255) NOT NULL,
  `change_amount` double NOT NULL,
  `short_over` double NOT NULL,
  `special_instructions` mediumtext NOT NULL,
  `cashier` varchar(255) NOT NULL,
  `remarks` varchar(255) NOT NULL,
  `order_status` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL,
  `void_id` double NOT NULL,
  `void_remarks` varchar(1000) NOT NULL,
  `void_date` datetime NOT NULL,
  `refund_id` double NOT NULL,
  `refund_remarks` varchar(1000) NOT NULL,
  `refund_date` datetime NOT NULL,
  `date_recorded` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_pos_transactions_customers` (
  `ID` double NOT NULL,
  `transaction_id` double NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `Project_Code` varchar(100) NOT NULL,
  `transaction_date` date NOT NULL DEFAULT '1990-01-01',
  `customer_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_pos_transactions_detailed` (
  `ID` double NOT NULL,
  `transaction_id` double NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `transaction_date` date NOT NULL,
  `product_id` varchar(255) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `sales_quantity` double NOT NULL,
  `landing_cost` double NOT NULL,
  `unit_cost` double NOT NULL,
  `selling_price` double NOT NULL,
  `vatable` varchar(255) NOT NULL,
  `isDiscountable` varchar(10) DEFAULT 'Yes',
  `order_status` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_pos_transactions_discounts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `transaction_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` varchar(255) DEFAULT NULL,
  `discount_type` varchar(50) NOT NULL,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `vat_exemption` decimal(10,2) NOT NULL DEFAULT 0.00,
  `customer_name` varchar(255) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('M','F') DEFAULT NULL,
  `tin` varchar(20) DEFAULT NULL,
  `contact_no` varchar(20) DEFAULT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `usertracker` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pos_transactions_discounts_per_product` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `transaction_id` varchar(50) NOT NULL,
  `transaction_date` date NOT NULL,
  `category_code` varchar(50) DEFAULT NULL,
  `unit_code` varchar(50) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `discount_type` varchar(50) NOT NULL,
  `discount_sharing` enum('SHARED','SOLO') DEFAULT 'SHARED',
  `total_customers` int(11) DEFAULT 1,
  `qualified_customers` int(11) DEFAULT 1,
  `vat_exempt_amount` decimal(10,2) DEFAULT 0.00,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `status` varchar(20) DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tbl_pos_transactions_other_charges` (
  `ID` double NOT NULL,
  `transaction_id` double NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `Project_Code` varchar(100) NOT NULL,
  `transaction_date` date DEFAULT '1990-01-01',
  `particulars` varchar(255) NOT NULL,
  `amount` double NOT NULL,
  `reference` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_pos_transactions_payments` (
  `ID` double NOT NULL,
  `transaction_id` double NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `Project_Code` varchar(100) NOT NULL,
  `transaction_date` date DEFAULT '1990-01-01',
  `payment_method` varchar(255) NOT NULL,
  `payment_amount` double NOT NULL,
  `payment_reference` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_pos_zreading_archive_log` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `shift_ref_id` int(11) NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `Shift_ID` int(11) NOT NULL,
  `terminal_number` int(11) NOT NULL,
  `Opening_DateTime` datetime NOT NULL,
  `triggered_by_user_id` varchar(100) DEFAULT NULL,
  `run_started_at` datetime NOT NULL,
  `run_finished_at` datetime DEFAULT NULL,
  `status` enum('Running','Success','Failed') NOT NULL DEFAULT 'Running',
  `transactions_replicated` int(11) NOT NULL DEFAULT 0,
  `detailed_replicated` int(11) NOT NULL DEFAULT 0,
  `customers_replicated` int(11) NOT NULL DEFAULT 0,
  `discounts_replicated` int(11) NOT NULL DEFAULT 0,
  `discounts_per_product_replicated` int(11) NOT NULL DEFAULT 0,
  `other_charges_replicated` int(11) NOT NULL DEFAULT 0,
  `payments_replicated` int(11) NOT NULL DEFAULT 0,
  `total_discount_recorded` decimal(14,2) DEFAULT NULL,
  `total_discount_expected_20pct` decimal(14,2) DEFAULT NULL,
  `discount_mismatch_count` int(11) NOT NULL DEFAULT 0,
  `error_message` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pricing_by_sales_type` (
  `seq` int(11) NOT NULL,
  `busunitcode` varchar(45) NOT NULL,
  `sales_type_id` varchar(45) NOT NULL,
  `pricing_category` varchar(45) NOT NULL,
  `deletestatus` varchar(45) NOT NULL,
  `usertracker` varchar(45) NOT NULL,
  `createdtime` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_pricing_details` (
  `seq` int(11) NOT NULL,
  `pricing_code` varchar(45) NOT NULL,
  `inv_code` varchar(45) NOT NULL,
  `cost_per_uom` double DEFAULT NULL,
  `srp` double NOT NULL,
  `deletestatus` varchar(45) NOT NULL,
  `usertracker` varchar(45) NOT NULL,
  `createdtime` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_printer_size` (
  `seq` int(11) NOT NULL,
  `printer_size` varchar(25) NOT NULL,
  `status` varchar(25) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_purchase_order_transactions` (
  `AutoNum` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` int(11) NOT NULL,
  `Project_Code` varchar(255) NOT NULL,
  `product_id` int(11) NOT NULL,
  `barcode` varchar(255) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `unit_of_measure` varchar(255) NOT NULL,
  `quantity` double NOT NULL,
  `unit_price` double NOT NULL,
  `discount` double NOT NULL,
  `amount` double NOT NULL,
  `bill_to` varchar(255) NOT NULL,
  `ship_to` varchar(255) NOT NULL,
  `po_date` datetime NOT NULL,
  `po_no` int(11) NOT NULL,
  `pr_no` int(11) NOT NULL,
  `pr_date` date NOT NULL,
  `consignment` varchar(255) NOT NULL,
  `business_style` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `memo` varchar(255) NOT NULL,
  `prepared_by` varchar(255) NOT NULL,
  `checked_by` varchar(255) NOT NULL,
  `approved_by` varchar(255) NOT NULL,
  `acknowledged_by` varchar(255) NOT NULL,
  `remarks` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `tbl_purchase_request_transactions` (
  `AutoNum` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` int(11) NOT NULL,
  `Project_Code` varchar(255) NOT NULL,
  `product_id` int(11) NOT NULL,
  `barcode` varchar(255) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `unit_of_measure` varchar(255) NOT NULL,
  `quantity` double NOT NULL,
  `unit_price` double NOT NULL,
  `discount` double NOT NULL,
  `amount` double NOT NULL,
  `bill_to` varchar(255) NOT NULL,
  `ship_to` varchar(255) NOT NULL,
  `pr_date` datetime NOT NULL,
  `pr_no` int(11) NOT NULL,
  `consignment` varchar(255) NOT NULL,
  `business_style` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `memo` varchar(255) NOT NULL,
  `prepared_by` varchar(255) NOT NULL,
  `checked_by` varchar(255) NOT NULL,
  `approved_by` varchar(255) NOT NULL,
  `acknowledged_by` varchar(255) NOT NULL,
  `remarks` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `tbl_refresh_token` (
  `token_hash` varchar(64) NOT NULL,
  `expires_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `tbl_sales_type` (
  `seq` int(11) NOT NULL,
  `sales_type_id` varchar(255) NOT NULL,
  `description` varchar(45) NOT NULL,
  `deletestatus` varchar(45) NOT NULL,
  `createdtime` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_settings_defaults` (
  `ID` double NOT NULL,
  `Category_Code` varchar(100) NOT NULL,
  `Unit_Code` double NOT NULL,
  `Setup_Code` int(11) NOT NULL,
  `Transaction_Type` varchar(100) NOT NULL,
  `Default_Supplier_Code` double NOT NULL,
  `Default_Project_Code` varchar(100) NOT NULL,
  `Default_Cost_Center_Code` varchar(100) NOT NULL,
  `Default_Account_Class_Code` varchar(100) NOT NULL,
  `Wtax_1` double NOT NULL,
  `Wtax_2` double NOT NULL,
  `Wtax_5` double NOT NULL,
  `Wtax_10` double NOT NULL,
  `Wtax_15` double NOT NULL,
  `Wtax_20` double NOT NULL,
  `Default_CIB` double NOT NULL,
  `Default_VatInput` double NOT NULL,
  `Default_Signatory_01` varchar(200) NOT NULL,
  `Default_Signatory_02` varchar(100) NOT NULL,
  `Default_Signatory_03` varchar(200) NOT NULL,
  `Default_Signatory_04` varchar(200) NOT NULL,
  `Approver_1` int(11) NOT NULL,
  `Approver_2` int(11) NOT NULL,
  `Approver_3` int(11) NOT NULL,
  `Status` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_settings_list_of_system_features` (
  `ID` int(11) NOT NULL,
  `system_order` int(11) NOT NULL,
  `system_module` varchar(255) NOT NULL,
  `category_order` int(11) NOT NULL,
  `category` varchar(255) NOT NULL,
  `feature_order` int(11) NOT NULL,
  `feature_description` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_settings_system_modules` (
  `AutoNum` int(11) NOT NULL,
  `system_module` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_settings_system_modules_matrix` (
  `AutoNum` int(11) NOT NULL,
  `system_module` varchar(255) NOT NULL,
  `system_order` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_settings_transaction_types` (
  `AutoNum` int(11) NOT NULL,
  `transaction_type` varchar(255) NOT NULL,
  `transaction_type_description` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_settings_validity` (
  `ID` double NOT NULL,
  `EX_Date` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=COMPACT;

CREATE TABLE `tbl_sync_queue` (
  `sync_id` int(11) NOT NULL,
  `pricing_code` varchar(50) DEFAULT NULL,
  `inv_code` varchar(50) DEFAULT NULL,
  `cost_per_uom` decimal(10,2) DEFAULT NULL,
  `srp` decimal(10,2) DEFAULT NULL,
  `deletestatus` varchar(100) DEFAULT NULL,
  `usertracker` varchar(255) DEFAULT NULL,
  `createdtime` datetime DEFAULT current_timestamp(),
  `sync_status` enum('Pending','Completed','Failed') DEFAULT 'Pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_system_settings_backup_db` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` varchar(255) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_theme_settings` (
  `ID` int(11) NOT NULL,
  `Setting_Key` varchar(100) NOT NULL DEFAULT 'default',
  `Theme_Name` varchar(120) NOT NULL DEFAULT 'default',
  `Light_Primary` varchar(20) DEFAULT '#38bdf8',
  `Light_Secondary` varchar(20) DEFAULT '#0ea5e9',
  `Light_Background` varchar(20) DEFAULT '#f8fafc',
  `Light_Surface` varchar(20) DEFAULT '#ffffff',
  `Light_Text` varchar(20) DEFAULT '#0f172a',
  `Dark_Primary` varchar(20) DEFAULT '#2563eb',
  `Dark_Secondary` varchar(20) DEFAULT '#1d4ed8',
  `Dark_Background` varchar(20) DEFAULT '#0f172a',
  `Dark_Surface` varchar(20) DEFAULT '#111827',
  `Dark_Text` varchar(20) DEFAULT '#ffffff',
  `Logo_Url` text DEFAULT NULL,
  `Login_Background_Url` text DEFAULT NULL,
  `Dashboard_Background_Url` text DEFAULT NULL,
  `Status` varchar(30) NOT NULL DEFAULT 'Active',
  `Created_At` datetime NOT NULL DEFAULT current_timestamp(),
  `Updated_At` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_users_global_assignment` (
  `uuid` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `classification` varchar(45) NOT NULL,
  `password` varchar(255) NOT NULL,
  `firstname` varchar(45) NOT NULL,
  `middlename` varchar(45) DEFAULT NULL,
  `lastname` varchar(45) NOT NULL,
  `company` varchar(45) NOT NULL,
  `department` varchar(45) NOT NULL,
  `contactnumber` varchar(45) NOT NULL,
  `status` varchar(45) NOT NULL,
  `verified` varchar(45) NOT NULL,
  `passlock` int(11) NOT NULL,
  `otp` int(11) NOT NULL,
  `otplock` int(11) NOT NULL,
  `usertracker` varchar(255) NOT NULL,
  `deletestatus` varchar(45) NOT NULL,
  `createtime` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tbl_user_roles` (
  `uuid` varchar(255) NOT NULL,
  `userid` varchar(255) NOT NULL,
  `roleclass` varchar(50) NOT NULL,
  `rolename` varchar(120) NOT NULL,
  `role_description` varchar(255) NOT NULL,
  `deletestatus` varchar(20) NOT NULL,
  `usertracker` varchar(255) NOT NULL,
  `createtime` datetime NOT NULL,
  `payment_amount` decimal(12,2) DEFAULT NULL,
  `payment_reference` varchar(120) DEFAULT NULL,
  `payment_mode` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `lkp_discount_type`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `lkp_loyalty_cs_name`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_loyalty_phone` (`phone_number`);

ALTER TABLE `lkp_sales_type`
  ADD PRIMARY KEY (`sales_type_id`),
  ADD UNIQUE KEY `id_UNIQUE` (`seq`),
  ADD UNIQUE KEY `sales_type_id_UNIQUE` (`sales_type_id`);

ALTER TABLE `tbl_employees`
  ADD PRIMARY KEY (`empid`),
  ADD UNIQUE KEY `seq_UNIQUE` (`seq`),
  ADD UNIQUE KEY `shortuuid_UNIQUE` (`empid`);

ALTER TABLE `tbl_expenses`
  ADD PRIMARY KEY (`seq`);

ALTER TABLE `tbl_inventory_customer_list`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_inventory_customer_po`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_inventory_in_transactions`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_inventory_loss_transactions`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_inventory_out_transactions`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_inventory_products_beginningending`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_inventory_products_masterlist`
  ADD PRIMARY KEY (`seq`);

ALTER TABLE `tbl_inventory_shifting_records`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_accountclass`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_activity_logs`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_business_category`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_business_units`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_chartofaccounts`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_corporations`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_costcenter`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_expandedpnlaccounts`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_projects`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_signatories`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_suppliers`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_suppliers_wtax_reference`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_transaction`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_transaction_logs`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_users`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_main_users_credentials_business_units`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_main_users_credentials_system_features`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_main_wtax_reference`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_mode_of_payment`
  ADD PRIMARY KEY (`seq`);

ALTER TABLE `tbl_payroll_employee_masterlist`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_pos_developer_account`
  ADD PRIMARY KEY (`singleton_id`),
  ADD UNIQUE KEY `uq_tbl_pos_developer_account_subject` (`subject_id`),
  ADD UNIQUE KEY `uq_tbl_pos_developer_account_username` (`username`);

ALTER TABLE `tbl_pos_discount_type_sales_type`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_discount_sales_type` (`discount_type_id`,`sales_type_id`);

ALTER TABLE `tbl_pos_document_counters`
  ADD PRIMARY KEY (`Category_Code`,`Unit_Code`);

ALTER TABLE `tbl_pos_ledger`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `tbl_pos_list_of_other_charges`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_pos_loyalty_discounts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_loyalty_discounts_txn` (`transaction_id`,`Category_Code`,`Unit_Code`),
  ADD KEY `idx_loyalty_discounts_member` (`loyalty_member_id`);

ALTER TABLE `tbl_pos_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tbl_pos_permissions_key` (`permission_group`,`permission_key`),
  ADD KEY `idx_tbl_pos_permissions_active` (`is_active`),
  ADD KEY `idx_tbl_pos_permissions_group` (`permission_group`);

ALTER TABLE `tbl_pos_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tbl_pos_roles_role_key` (`role_key`),
  ADD UNIQUE KEY `uq_tbl_pos_roles_role_value` (`role_value`),
  ADD KEY `idx_tbl_pos_roles_active` (`is_active`);

ALTER TABLE `tbl_pos_role_permissions`
  ADD PRIMARY KEY (`role_id`,`permission_id`),
  ADD KEY `idx_tbl_pos_role_permissions_permission` (`permission_id`);

ALTER TABLE `tbl_pos_settings`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_pos_shifting_records`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_pos_tables`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_pos_table_rooms`
  ADD PRIMARY KEY (`ID`),
  ADD UNIQUE KEY `uq_pos_table_rooms_scope` (`category_code`,`unit_code`,`room_key`);

ALTER TABLE `tbl_pos_terminal_config`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_unit_terminal` (`unitCode`,`terminalNumber`),
  ADD KEY `idx_status` (`status`);

ALTER TABLE `tbl_pos_transactions`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_pos_transactions_customers`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_pos_transactions_detailed`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_pos_transactions_discounts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_transaction_id` (`transaction_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_discount_type` (`discount_type`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_usertracker` (`usertracker`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_transaction_customer` (`transaction_id`,`customer_id`);

ALTER TABLE `tbl_pos_transactions_discounts_per_product`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_transaction` (`transaction_id`),
  ADD KEY `idx_date` (`transaction_date`),
  ADD KEY `idx_product` (`product_id`);

ALTER TABLE `tbl_pos_transactions_other_charges`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_pos_transactions_payments`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_pos_zreading_archive_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_shift_ref` (`Unit_Code`,`Shift_ID`,`terminal_number`,`Opening_DateTime`),
  ADD KEY `idx_shift_ref_id` (`shift_ref_id`),
  ADD KEY `idx_status` (`status`);

ALTER TABLE `tbl_pricing_by_sales_type`
  ADD PRIMARY KEY (`seq`),
  ADD UNIQUE KEY `seq_UNIQUE` (`seq`);

ALTER TABLE `tbl_pricing_details`
  ADD PRIMARY KEY (`seq`),
  ADD UNIQUE KEY `seq_UNIQUE` (`seq`);

ALTER TABLE `tbl_printer_size`
  ADD PRIMARY KEY (`seq`);

ALTER TABLE `tbl_purchase_order_transactions`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_purchase_request_transactions`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_refresh_token`
  ADD PRIMARY KEY (`token_hash`),
  ADD KEY `expires_at` (`expires_at`);

ALTER TABLE `tbl_sales_type`
  ADD PRIMARY KEY (`seq`);

ALTER TABLE `tbl_settings_defaults`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_settings_list_of_system_features`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_settings_system_modules`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_settings_system_modules_matrix`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_settings_transaction_types`
  ADD PRIMARY KEY (`AutoNum`);

ALTER TABLE `tbl_settings_validity`
  ADD PRIMARY KEY (`ID`);

ALTER TABLE `tbl_sync_queue`
  ADD PRIMARY KEY (`sync_id`);

ALTER TABLE `tbl_system_settings_backup_db`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`);

ALTER TABLE `tbl_theme_settings`
  ADD PRIMARY KEY (`ID`),
  ADD UNIQUE KEY `uq_tbl_theme_settings_setting_key` (`Setting_Key`);

ALTER TABLE `tbl_users_global_assignment`
  ADD PRIMARY KEY (`uuid`),
  ADD UNIQUE KEY `uuid_UNIQUE` (`uuid`),
  ADD UNIQUE KEY `email_UNIQUE` (`email`);

ALTER TABLE `tbl_user_roles`
  ADD PRIMARY KEY (`uuid`),
  ADD UNIQUE KEY `uuid_UNIQUE` (`uuid`),
  ADD UNIQUE KEY `uq_user_roles_userid_roleclass_rolename_deletestatus` (`userid`,`roleclass`,`rolename`,`deletestatus`);

ALTER TABLE `lkp_discount_type`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `lkp_loyalty_cs_name`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `lkp_sales_type`
  MODIFY `seq` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_employees`
  MODIFY `seq` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_expenses`
  MODIFY `seq` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_inventory_customer_list`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_inventory_customer_po`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_inventory_in_transactions`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_inventory_loss_transactions`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_inventory_out_transactions`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_inventory_products_beginningending`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_inventory_products_masterlist`
  MODIFY `seq` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_inventory_shifting_records`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_main_accountclass`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_main_activity_logs`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_main_business_category`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_business_units`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_chartofaccounts`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_main_corporations`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_costcenter`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_expandedpnlaccounts`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_projects`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_signatories`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_suppliers`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_main_suppliers_wtax_reference`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_transaction`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_main_transaction_logs`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_main_users`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_users_credentials_business_units`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_users_credentials_system_features`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_main_wtax_reference`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_mode_of_payment`
  MODIFY `seq` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_payroll_employee_masterlist`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_discount_type_sales_type`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_ledger`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_list_of_other_charges`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_pos_loyalty_discounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_permissions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_pos_roles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_pos_settings`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_pos_shifting_records`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_tables`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_pos_table_rooms`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_terminal_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_pos_transactions`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_transactions_customers`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_transactions_detailed`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_transactions_discounts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_transactions_discounts_per_product`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_transactions_other_charges`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pos_transactions_payments`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_pricing_by_sales_type`
  MODIFY `seq` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_pricing_details`
  MODIFY `seq` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_printer_size`
  MODIFY `seq` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_purchase_order_transactions`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_purchase_request_transactions`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_settings_defaults`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT;

ALTER TABLE `tbl_settings_list_of_system_features`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_settings_system_modules`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_settings_system_modules_matrix`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_settings_transaction_types`
  MODIFY `AutoNum` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_settings_validity`
  MODIFY `ID` double NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_sync_queue`
  MODIFY `sync_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_system_settings_backup_db`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_theme_settings`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

ALTER TABLE `tbl_pos_role_permissions`
  ADD CONSTRAINT `fk_tbl_pos_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `tbl_pos_permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_tbl_pos_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `tbl_pos_roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
