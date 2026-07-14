-- Master list of discount types available across the POS. Seeded with the
-- existing statutory types (Senior/PWD/NAAC/Solo Parent, is_system_defined=1
-- so they can't be deleted from Settings) plus common F&B/retail/universal
-- discount types. Settings > Discount Mode > Discount Types manages this
-- table and, per sales type, whether each one is active and what percent it
-- gives (see tbl_pos_discount_type_sales_type).

CREATE TABLE IF NOT EXISTS `lkp_discount_type` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `discount_name` VARCHAR(150) NOT NULL,
  `calculation_type` VARCHAR(20) NOT NULL DEFAULT 'percentage',
  `default_value` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `is_vat_exempt` TINYINT(1) NOT NULL DEFAULT 0,
  `is_system_defined` TINYINT(1) NOT NULL DEFAULT 0,
  `industry_type` VARCHAR(20) NOT NULL DEFAULT 'universal',
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO `lkp_discount_type`
  (`id`, `discount_name`, `calculation_type`, `default_value`, `is_vat_exempt`, `is_system_defined`, `industry_type`, `status`)
VALUES
  (1,  'Senior Citizen',                'percentage', 20.00, 1, 1, 'universal', 'active'),
  (2,  'PWD (Persons with Disability)',  'percentage', 20.00, 1, 1, 'universal', 'active'),
  (3,  'Solo Parent',                    'percentage', 10.00, 1, 1, 'universal', 'active'),
  (4,  'National Athlete/Coach',         'percentage', 20.00, 0, 1, 'universal', 'active'),
  (5,  'Complimentary / Comp',           'percentage', 100.00, 0, 0, 'fnb',      'active'),
  (6,  'Staff / Employee Meal',          'percentage', 50.00, 0, 0, 'fnb',      'active'),
  (7,  'Happy Hour',                     'percentage', 20.00, 0, 0, 'fnb',      'active'),
  (8,  'Custom Item Discount (F&B)',     'percentage', 0.00, 0, 0, 'fnb',      'active'),
  (9,  'Custom Whole Bill (F&B)',        'percentage', 0.00, 0, 0, 'fnb',      'active'),
  (10, 'Buy 1 Take 1 (BOGO)',            'percentage', 100.00, 0, 0, 'retail',   'active'),
  (11, 'Clearance / Markdown',           'percentage', 50.00, 0, 0, 'retail',   'active'),
  (12, 'Damaged / As-Is Item',           'percentage', 30.00, 0, 0, 'retail',   'active'),
  (13, 'Bulk / Volume Discount',         'percentage', 0.00, 0, 0, 'retail',   'active'),
  (14, 'Fixed Amount Off',               'fixed',      0.00, 0, 1, 'universal', 'active'),
  (15, 'Percentage Promo',               'percentage', 0.00, 0, 0, 'universal', 'active'),
  (16, 'Voucher / Coupon Code',          'percentage', 0.00, 0, 0, 'universal', 'active'),
  (17, 'Bank / Payment Partner',         'percentage', 10.00, 0, 0, 'universal', 'active');
