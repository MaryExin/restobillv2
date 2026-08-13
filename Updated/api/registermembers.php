<?php

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

date_default_timezone_set('Asia/Manila');

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);
    header("Allow: POST");
    exit;
}

$data = (array) json_decode(file_get_contents("php://input"), true);

// echo json_encode($data);

if (!array_key_exists("surname", $data) ||
    !array_key_exists("firstname", $data) ||
    !array_key_exists("middlename", $data) ||
    !array_key_exists("ownershipOwned", $data) ||
    !array_key_exists("ownedBy", $data) ||
    !array_key_exists("ownerRelation", $data) ||
    !array_key_exists("addressLineOne", $data) ||
    !array_key_exists("barangay", $data) ||
    !array_key_exists("municipality", $data) ||
    !array_key_exists("province", $data) ||
    !array_key_exists("cellphonenumber", $data) ||
    !array_key_exists("telephonenumber", $data) ||
    !array_key_exists("civilStatus", $data) ||
    !array_key_exists("birthDate", $data) ||
    !array_key_exists("birthPlace", $data) ||
    !array_key_exists("gender", $data) ||
    !array_key_exists("schoolLevel", $data) ||
    !array_key_exists("religion", $data) ||
    !array_key_exists("noOfDependents", $data) ||
    !array_key_exists("emailAddress", $data) ||
    !array_key_exists("sssGsis", $data) ||
    !array_key_exists("tinNo", $data) ||
    !array_key_exists("income_source", $data) ||
    !array_key_exists("company_name", $data) ||
    !array_key_exists("company_address", $data) ||
    !array_key_exists("company_years_of_service", $data) ||
    !array_key_exists("company_position", $data) ||
    !array_key_exists("company_contact_no", $data) ||
    !array_key_exists("company_datestarted", $data) ||
    !array_key_exists("monthly_income", $data) ||
    !array_key_exists("fatherName", $data) ||
    !array_key_exists("motherMaidenName", $data) ||
    !array_key_exists("parentAddress", $data) ||
    !array_key_exists("telNo", $data) ||
    !array_key_exists("heir_Name1", $data) ||
    !array_key_exists("heir_Relation1", $data) ||
    !array_key_exists("heir_Name2", $data) ||
    !array_key_exists("heir_Relation2", $data) ||
    !array_key_exists("heir_Name3", $data) ||
    !array_key_exists("heir_Relation3", $data) ||
    !array_key_exists("isMemberOfOtherCooperative", $data) ||
    !array_key_exists("otherCooperativeName", $data) ||
    !array_key_exists("withCriminalCase", $data) ||
    !array_key_exists("endorsedBy_Name1", $data) ||
    !array_key_exists("endorsedBy_AcctNo1", $data) ||
    !array_key_exists("endorsedBy_Signature1", $data) ||
    !array_key_exists("endorsedBy_Name2", $data) ||
    !array_key_exists("endorsedBy_AcctNo2", $data) ||
    !array_key_exists("endorsedBy_Signature2", $data) ||
    !array_key_exists("endorsedBy_Name3", $data) ||
    !array_key_exists("endorsedBy_AcctNo3", $data) ||
    !array_key_exists("endorsedBy_Signature3", $data) ||
    !array_key_exists("membershipSignature", $data) ||
    !array_key_exists("membershipDate", $data) ||
    !array_key_exists("nameofspouse", $data) ||
    !array_key_exists("birthdateofspouse", $data) ||
    !array_key_exists("birthplaceofspouse", $data) ||
    !array_key_exists("telephonenumberofspouse", $data) ||
    !array_key_exists("occupationofspouse", $data) ||
    !array_key_exists("occupationplaceofspouse", $data) ||
    !array_key_exists("monthlysalaryofspouse", $data) ||
    !array_key_exists("accountnumberofspouse", $data)
) {

    http_response_code(400);
    echo json_encode(["message" => "fill in blanks"]);
    exit;
}

// echo json_encode(["message" => $data]);

$database = new Database($_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]);

// Initialize connection var $conn, methods: getByUsername, getById
try {
    $conn = $database->getConnection();

    $sql = "INSERT INTO tbl_member_registration(member_id, existing_members_id, date_registered, surname, firstname,
    middlename, address_line_1, barangay, municipality, province, type_of_home_ownership, home_owner, home_owner_relationship,
    phone_number, cellphone_number, civil_status, birthdate, birth_place, gender,
    religion, educational_attainment, no_of_dependents, email_address, sss_or_gsis_no, tin, income_source,
    company_name, company_address, company_years_of_service, company_position, company_contact_no, company_datestarted, monthly_income,
    fathers_name, mothers_name, parents_address, parents_contact_no, spouse_firstname, spouse_middlename, spouse_lastname,
    spouse_birthdate, spouse_birthplace, spouse_contact_no, spouse_income_source, spouse_company_address, spouse_monthly_income, Status)
    VALUES ('10001', '100001', now(), :surname, :firstname, :middlename, :address_line_1, :barangay, :municipality, :province,
    :type_of_home_ownership, :home_owner, :home_owner_relationship, :phone_number, :cellphone_number, :civil_status, :birthdate, :birth_place, :gender,
    :religion, :educational_attainment, :no_of_dependents, :email_address, :sss_or_gsis_no, :tin, :income_source,
    :company_name, :company_address, :company_years_of_service, :company_position, :company_contact_no, :company_datestarted, :monthly_income,
    :fathers_name, :mothers_name, :parents_address, :parents_contact_no, :spouse_firstname, :spouse_middlename, :spouse_lastname,
    :spouse_birthdate, :spouse_birthplace, :spouse_contact_no, :spouse_income_source, :spouse_company_address, :spouse_monthly_income, 'Inactive')";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":surname", $data["surname"], PDO::PARAM_STR);
    $stmt->bindValue(":firstname", $data["firstname"], PDO::PARAM_STR);
    $stmt->bindValue(":middlename", $data["middlename"], PDO::PARAM_STR);
    $stmt->bindValue(":address_line_1", $data["addressLineOne"], PDO::PARAM_STR);
    $stmt->bindValue(":barangay", $data["barangay"], PDO::PARAM_STR);
    $stmt->bindValue(":municipality", $data["municipality"], PDO::PARAM_STR);
    $stmt->bindValue(":province", $data["province"], PDO::PARAM_STR);
    $stmt->bindValue(":type_of_home_ownership", $data["ownershipOwned"], PDO::PARAM_STR);
    $stmt->bindValue(":home_owner", $data["ownedBy"], PDO::PARAM_STR);
    $stmt->bindValue(":home_owner_relationship", $data["ownerRelation"], PDO::PARAM_STR);
    $stmt->bindValue(":phone_number", $data["telephonenumber"], PDO::PARAM_STR);
    $stmt->bindValue(":cellphone_number", $data["cellphonenumber"], PDO::PARAM_STR);
    $stmt->bindValue(":civil_status", $data["civilStatus"], PDO::PARAM_STR);
    $stmt->bindValue(":birthdate", $data["birthDate"], PDO::PARAM_STR);
    $stmt->bindValue(":birth_place", $data["birthPlace"], PDO::PARAM_STR);
    $stmt->bindValue(":gender", $data["gender"], PDO::PARAM_STR);
    $stmt->bindValue(":religion", $data["religion"], PDO::PARAM_STR);
    $stmt->bindValue(":educational_attainment", $data["schoolLevel"], PDO::PARAM_STR);
    $stmt->bindValue(":no_of_dependents", $data["noOfDependents"], PDO::PARAM_STR);
    $stmt->bindValue(":email_address", $data["emailAddress"], PDO::PARAM_STR);
    $stmt->bindValue(":sss_or_gsis_no", $data["sssGsis"], PDO::PARAM_STR);
    $stmt->bindValue(":tin", $data["tinNo"], PDO::PARAM_STR);
    $stmt->bindValue(":income_source", $data["income_source"], PDO::PARAM_STR);
    $stmt->bindValue(":company_name", $data["company_name"], PDO::PARAM_STR);
    $stmt->bindValue(":company_address", $data["company_address"], PDO::PARAM_STR);
    $stmt->bindValue(":company_years_of_service", $data["company_years_of_service"], PDO::PARAM_STR);
    $stmt->bindValue(":company_position", $data["company_position"], PDO::PARAM_STR);
    $stmt->bindValue(":company_contact_no", $data["company_contact_no"], PDO::PARAM_STR);
    $stmt->bindValue(":company_datestarted", $data["company_datestarted"], PDO::PARAM_STR);
    $stmt->bindValue(":monthly_income", $data["monthly_income"], PDO::PARAM_STR);
    $stmt->bindValue(":fathers_name", $data["fatherName"], PDO::PARAM_STR);
    $stmt->bindValue(":mothers_name", $data["motherMaidenName"], PDO::PARAM_STR);
    $stmt->bindValue(":parents_address", $data["parentAddress"], PDO::PARAM_STR);
    $stmt->bindValue(":parents_contact_no", $data["telNo"], PDO::PARAM_STR);
    $stmt->bindValue(":spouse_firstname", $data["nameofspouse"], PDO::PARAM_STR);
    $stmt->bindValue(":spouse_middlename", $data["nameofspouse"], PDO::PARAM_STR);
    $stmt->bindValue(":spouse_lastname", $data["nameofspouse"], PDO::PARAM_STR);
    $stmt->bindValue(":spouse_birthdate", $data["birthdateofspouse"], PDO::PARAM_STR);
    $stmt->bindValue(":spouse_birthplace", $data["birthplaceofspouse"], PDO::PARAM_STR);
    $stmt->bindValue(":spouse_contact_no", $data["telephonenumberofspouse"], PDO::PARAM_STR);
    $stmt->bindValue(":spouse_income_source", $data["occupationofspouse"], PDO::PARAM_STR);
    $stmt->bindValue(":spouse_company_address", $data["occupationplaceofspouse"], PDO::PARAM_STR);
    $stmt->bindValue(":spouse_monthly_income", $data["monthlysalaryofspouse"], PDO::PARAM_STR);

    $stmt->execute();

    echo json_encode(["message" => "Thank you for registering"]);
    exit;

} catch (Exception $e) {
    echo json_encode(["message" => "Registration error"]);
    exit;

}
