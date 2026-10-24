<?php
declare(strict_types=1);
require_once __DIR__ . '/../common/migrate.php';

$map = ['festivalmall' => 'db_cnc_pos', 'festivalmall_report' => 'reports_database'];
$checks = 0;
function migrationSqlCheck(bool $value, string $message): void {
    global $checks;
    if (!$value) throw new RuntimeException('FAIL: ' . $message);
    $checks++; echo 'PASS: ' . $message . PHP_EOL;
}
function migrationSqlReject(callable $work, string $fragment, string $message): void {
    try { $work(); } catch (LightemSetupException $error) {
        migrationSqlCheck(str_contains($error->getMessage(), $fragment), $message); return;
    }
    throw new RuntimeException('FAIL: ' . $message . ' did not reject');
}
function migrationSqlStream(string $sql, array $map): string {
    $input = fopen('php://temp', 'w+'); $output = fopen('php://temp', 'w+');
    try { fwrite($input, $sql); rewind($input); lightemMigrationRewriteStream($input, $output, $map); rewind($output); return stream_get_contents($output); }
    finally { fclose($input); fclose($output); }
}
$literal = <<<'SQL'
INSERT INTO t VALUES ('festivalmall', 'festivalmall.t', '`festivalmall`', 'USE festivalmall;', 'quote\'festivalmall', 'slash\\festivalmall', '{"db":"festivalmall_report"}', 0x666573746976616c6c6d616c6c, NULL);
SQL;
$cases = [
    ['USE `festivalmall`; USE festivalmall_report;', 'USE `db_cnc_pos`; USE `reports_database`;', 'both USE statements'],
    ['SELECT `festivalmall`.`t`.`id` FROM festivalmall.t JOIN festivalmall_report.r ON t.id=r.id', 'SELECT `db_cnc_pos`.`t`.`id` FROM `db_cnc_pos`.t JOIN `reports_database`.r ON t.id=r.id', 'cross-database references'],
    ['REFERENCES `festivalmall_report`.`parent` (`id`)', 'REFERENCES `reports_database`.`parent` (`id`)', 'cross-database foreign key'],
    ['CALL festivalmall.proc(); SELECT festivalmall.func(1)', 'CALL `db_cnc_pos`.proc(); SELECT `db_cnc_pos`.func(1)', 'qualified procedure and function names'],
    ["-- USE festivalmall;\n# festivalmall.t\n/* festivalmall.t */\nUSE festivalmall;", "-- USE festivalmall;\n# festivalmall.t\n/* festivalmall.t */\nUSE `db_cnc_pos`;", 'ordinary comments byte-preserved'],
    ['/*!50001 SELECT * FROM `festivalmall`.`t` */; /*M!100100 SELECT * FROM festivalmall_report.t */;', '/*!50001 SELECT * FROM `db_cnc_pos`.`t` */; /*M!100100 SELECT * FROM `reports_database`.t */;', 'MySQL and MariaDB executable comments'],
    ['/*!50001 SELECT * FROM */ `festivalmall` /* plain */ . `t`;', '/*!50001 SELECT * FROM */ `db_cnc_pos` /* plain */ . `t`;', 'qualifiers across comment boundaries'],
    ['CREATE DEFINER=`festivalmall`@`localhost` PROCEDURE p() SELECT `festivalmall` FROM `festivalmall`;', 'CREATE DEFINER=`festivalmall`@`localhost` PROCEDURE p() SELECT `festivalmall` FROM `festivalmall`;', 'unqualified table/column and definer identities'],
    ['SELECT t.festivalmall FROM t;', 'SELECT t.festivalmall FROM t;', 'column names after a dot'],
    ['SELECT t.festivalmall FROM festivalmall.t t;', 'SELECT t.festivalmall FROM `db_cnc_pos`.t t;', 'column named like source database stays unchanged'],
    ["SELECT festivalmall.t.id, 'festivalmall' AS store FROM festivalmall.t", "SELECT `db_cnc_pos`.t.id, 'festivalmall' AS store FROM `db_cnc_pos`.t", 'database-like data literal with output alias'],
    ['SELECT `festivalmall``extra`.x;', 'SELECT `festivalmall``extra`.x;', 'escaped backtick identifier'],
    [$literal, $literal, 'row strings, JSON, binary hex and NULL unchanged'],
    ["SELECT 'festivalmall\nfestivalmall_report', \"festivalmall.t\", 'doubled''festivalmall';", "SELECT 'festivalmall\nfestivalmall_report', \"festivalmall.t\", 'doubled''festivalmall';", 'multiline and double-quoted strings unchanged'],
];
foreach ($cases as [$sql, $expected, $label]) {
    migrationSqlCheck(migrationSqlStream($sql, $map) === $expected, $label . ' streaming');
    migrationSqlCheck(lightemMigrationRewriteSql($sql, $map) === $expected, $label . ' definitions');
}
migrationSqlCheck(migrationSqlStream('USE a; USE b; SELECT a.t.x,b.t.y FROM a.t,b.t;', ['a' => 'b', 'b' => 'a']) === 'USE `b`; USE `a`; SELECT `b`.t.x,`a`.t.y FROM `b`.t,`a`.t;', 'cyclic mapping is applied exactly once');
migrationSqlCheck(migrationSqlStream('INSERT INTO t VALUES(123.45,-123.01); USE `123`; SELECT * FROM `123`.t;', ['123' => 'db_cnc_pos']) === 'INSERT INTO t VALUES(123.45,-123.01); USE `db_cnc_pos`; SELECT * FROM `db_cnc_pos`.t;', 'numeric schema mapping never changes decimal data literals');
foreach (['SELECT festivalmall.id FROM t AS festivalmall', 'SELECT festivalmall.id FROM t festivalmall', 'SELECT festivalmall.id FROM festivalmall', "SELECT festivalmall.id FROM t AS 'festivalmall'", 'WITH festivalmall AS (SELECT 1) SELECT festivalmall.id FROM festivalmall', 'SELECT festivalmall.id FROM festivalmall.festivalmall', 'SELECT festivalmall.id FROM t AS FestivalMall'] as $sql) {
    migrationSqlReject(fn() => lightemMigrationRewriteSql($sql, $map), 'collides', 'ambiguous alias/table rejected: ' . $sql);
}
foreach (['SELECT * FROM FESTIVALMALL.t', 'USE FestivalMall;'] as $sql) {
    migrationSqlReject(fn() => lightemMigrationRewriteSql($sql, $map), 'different letter case', 'mixed-case source reference requires review');
}
foreach (["BEGIN PREPARE s FROM 'SELECT * FROM festivalmall.t'; END", "BEGIN EXECUTE IMMEDIATE 'SELECT * FROM festivalmall.t'; END"] as $sql) {
    migrationSqlReject(fn() => lightemMigrationRewriteSql($sql, $map, true), 'Dynamic SQL', 'dynamic stored SQL requires review');
}
migrationSqlCheck(lightemMigrationRewriteSql("SELECT 'PREPARE festivalmall.t'", $map, true) === "SELECT 'PREPARE festivalmall.t'", 'dynamic keywords inside literal are data');
foreach (['ANSI_QUOTES', 'NO_BACKSLASH_ESCAPES', 'STRICT_TRANS_TABLES,ANSI_QUOTES'] as $mode) {
    migrationSqlReject(fn() => migrationSqlStream("/*!50003 SET sql_mode = '$mode' */; SELECT 1;", $map), 'SQL objects require', 'unsupported lexical SQL mode fails before import');
}
foreach (["SELECT 'unfinished", '/* missing close', '/*!50000 USE festivalmall'] as $sql) {
    migrationSqlReject(fn() => migrationSqlStream($sql, $map), 'Unterminated', 'incomplete SQL is rejected');
}
$large = "INSERT INTO t VALUES ('" . str_repeat('festivalmall\\n', 12000) . "');\nUSE festivalmall_report;";
migrationSqlCheck(migrationSqlStream($large, $map) === substr($large, 0, strrpos($large, 'USE')) . 'USE `reports_database`;', 'stream buffer boundaries preserve large literal and following USE');
$identity = ['db_cnc_pos' => 'db_cnc_pos', 'reports_database' => 'reports_database'];
migrationSqlCheck(lightemMigrationRewriteSql('SELECT db_cnc_pos.id FROM t AS db_cnc_pos', $identity) === 'SELECT db_cnc_pos.id FROM t AS db_cnc_pos', 'identity-name migration remains backward compatible');
echo "Completed $checks SQL mapping checks.\n";
