<?php

class GovtDeductionsController
{
    /**
     * Added for PHP 8.2+ compatibility (avoid dynamic properties deprecation).
     */
    protected $gateway;
    protected $user_id;



    public function __construct(
        $gateway,

        $user_id
    ) {

        $this->gateway = $gateway;

        $this->user_id = $user_id;

    }

    public function processExcelSSSReadData(string $method, $busunitCode, $dateFrom, $dateTo): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetSSS($busunitCode, $dateFrom, $dateTo));

            } elseif ($method == "POST") {

                // echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelPhicReadData(string $method, $busunitCode, $dateFrom, $dateTo): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetPhilhealth($busunitCode, $dateFrom, $dateTo));

            } elseif ($method == "POST") {

                // echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    public function processExcelMdfReadData(string $method, $busunitCode, $dateFrom, $dateTo): void
    {

        if (true) {

            if ($method == "GET") {

                echo json_encode($this->gateway->ExcelGetMdf($busunitCode, $dateFrom, $dateTo));

            } elseif ($method == "POST") {

                // echo json_encode($this->gateway->getbyPageData($pageIndex, $pageData));

            } else {

                $this->respondMethodNotAllowed("GET, POST");

            }

        }

    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {

        http_response_code(405);

        header("Allow: $allowed_methods");

    }

}
