import { BrowserRouter, Routes, Route, HashRouter } from "react-router-dom";
import HomePage from "./pages/Main/HomePage";
import ViewOrdering from "./components/MainComponents/ViewOrdering";
import PrintBilling from "./components/MainComponents/PrintBilling";
import SalesDashboard from "./components/Dashboards/SalesDashboard";
import TransactionRecords from "./components/Dashboards/TransactionRecords";
import GlobalThemeToggle from "./components/common/GlobalThemeToggle";
import GlobalSync from "./components/common/GlobalSync";
import PosReadingModal from "./components/MainComponents/PosReadingModal";
import PosLogin from "./pages/PosCore/PosLogin";
import PosSelectBusunit from "./pages/PosCore/PosSelectBusunit";
import PosHomeScreen from "./pages/PosCore/PosHomeScreen";
import PosPayment from "./components/MainComponents/PosPayment";
import ProductList from "./components/MainComponents/Productlist";
import SyncProductsAndPricing from "./components/MainComponents/SyncProductsAndPricing";
import PrivateRoute from "./routes/PrivateRoute";
import SyncOfflineSalesToWeb from "./components/MainComponents/SyncOfflineSalesToWeb";
import UserRoles from "./components/MainComponents/PosSettingsModal/UserRoles";
import CmpEmployeeInfo from "./components/Hris/CmpEmployeeInfo";
import MemberQueings from "../src/pages/Admin/MemberQueings";
import MemberProfile from "./components/Hris/MemberProfile";
const App = () => {
  return (
    <HashRouter>
      {}
      <GlobalSync />

      <Routes>
        <Route exact path="/" element={<PosLogin />} />
        <Route exact path="/ordering" element={<ViewOrdering />} />
        <Route exact path="/printbilling" element={<PrintBilling />} />
        <Route exact path="/salesdashboard" element={<SalesDashboard />} />
        <Route exact path="/productlist" element={<ProductList />} />
        <Route
          exact
          path="/transactionrecords"
          element={<TransactionRecords />}
        />
        <Route exact path="/posreading" element={<PosReadingModal />} />
        <Route
          exact
          path="/poscoreselectbusunit"
          element={<PosSelectBusunit />}
        />
        <Route exact path="/poscorehomescreen" element={<PosHomeScreen />} />
        <Route exact path="/payments" element={<PosPayment />} />
        {/* Private Routes */}
        <Route
          path="/pricesyncing"
          element={<PrivateRoute routename={"/pricesyncing"} />}
        >
          <Route path="/pricesyncing" element={<SyncProductsAndPricing />} />
        </Route>
        {/* Private Routes */}
        <Route
          path="/salesrecordssyncing"
          element={<PrivateRoute routename={"/salesrecordssyncing"} />}
        >
          <Route
            path="/salesrecordssyncing"
            element={<SyncOfflineSalesToWeb />}
          />
        </Route>

        <Route
          path="/employeeinfo"
          element={<PrivateRoute routename={"/pricesyncing"} />}
        >
          <Route path="/employeeinfo" element={<CmpEmployeeInfo />} />
        </Route>

        <Route
          path="/userroles"
          element={<PrivateRoute routename={"/pricesyncing"} />}
        >
          <Route path="/userroles" element={<UserRoles />} />
        </Route>

        <Route
          path="/userqueu"
          element={<PrivateRoute routename={"/pricesyncing"} />}
        >
          <Route path="/userqueu" element={<MemberQueings />} />
        </Route>

          <Route
            path="/"
            element={<PrivateRoute routename={"/pricesyncing"} />}
          >
            <Route path="/memberprofile/:id" element={<MemberProfile />} />
          </Route>

      </Routes>

      <GlobalThemeToggle />
    </HashRouter>
  );
};

export default App;
