import { BrowserRouter, Routes, Route, HashRouter } from "react-router-dom";
import { useEffect } from "react";
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
import KioskFullscreenGuard from "./components/KioskSecondScreen/KioskFullscreenGuard";
import SecondScreenCart from "./components/KioskSecondScreen/SecondScreenCart";
import { useKioskSecondScreen } from "./hooks/useKioskSecondScreen";
import useApiHost from "./hooks/useApiHost";
import useZustandLayoutMode from "./context/useZustandLayoutMode";

const App = () => {
  // Auto-launch second screen the moment the app opens, if Kiosk Mode is active.
  useKioskSecondScreen();

  // Seed layoutMode from DB on first load; enables persistence across devices/reboots.
  const apiHost = useApiHost();
  const { initLayoutMode } = useZustandLayoutMode();
  useEffect(() => {
    if (apiHost) initLayoutMode(apiHost);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiHost]);

  return (
    <HashRouter>
      {}
      {/* Kiosk fullscreen enforcement — transparent, renders no UI unless gesture fallback needed */}
      <KioskFullscreenGuard />
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
          element={<PrivateRoute routename={"/employeeinfo"} />}
        >
          <Route path="/employeeinfo" element={<CmpEmployeeInfo />} />
        </Route>

        <Route
          path="/userroles"
          element={<PrivateRoute routename={"/userroles"} />}
        >
          <Route path="/userroles" element={<UserRoles />} />
        </Route>

        <Route
          path="/usersqueu"
          element={<PrivateRoute routename={"/usersqueu"} />}
        >
          <Route path="/usersqueu" element={<MemberQueings />} />
        </Route>

        <Route path="/" element={<PrivateRoute routename={"/pricesyncing"} />}>
          <Route path="/memberprofile/:id" element={<MemberProfile />} />
        </Route>

        {/* Kiosk second-screen display — loaded in the secondary BrowserWindow */}
        <Route path="/kiosk-display" element={<SecondScreenCart />} />
      </Routes>

      <GlobalThemeToggle />
    </HashRouter>
  );
};

export default App;
