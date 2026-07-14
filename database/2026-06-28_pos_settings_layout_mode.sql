CREATE TABLE IF NOT EXISTS `pos_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_pos_settings_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `pos_settings` (`setting_key`, `setting_value`)
VALUES ('announcement', 'FOR FRANCHISE : B1T1@GMAIL.COM')
ON DUPLICATE KEY UPDATE `setting_value` = `setting_value`;

INSERT INTO `tbl_pos_settings` (`ID`, `category`, `description`, `value`)
SELECT
  next_id,
  'Layout',
  'Layout Mode',
  'resto'
FROM (
  SELECT COALESCE(MAX(`ID`), 0) + 1 AS next_id
  FROM `tbl_pos_settings`
) AS seed
WHERE NOT EXISTS (
  SELECT 1
  FROM `tbl_pos_settings` AS existing
  WHERE existing.`description` IN ('Layout Mode', 'Screen Configuration')
);
